---
title: shadow-dev CLI 安装与分发模型
domain: install-distribution
keywords: [安装, installer, shim, 指针文件, LINK, CURRENT, 双轨, 回滚, 插件钩子, tarball, Git Bash, PowerShell, workflow 域, bind, adapters, sidecar, bootstrap, requiresCommands, 能力契约, missingCommands, ARTIFACT_INCOMPATIBLE, 版本错位]
scope: [scripts/install-cli.sh, scripts/bootstrap.sh, lib/domains/workflow.mjs, lib/domains/bind.mjs, lib/commands.mjs, test/install.test.mjs, test/cli.test.mjs]
status: active
source:
  - changes/20260917-feature-install-cli-script/brief.md
  - changes/20260917-fix-installer-url-taint/brief.md
  - changes/20260917-feature-install-link-mode/brief.md
  - changes/20260918-fix-installer-ci-cmd-assert/brief.md
  - changes/20260918-fix-cross-platform-ci/brief.md
  - changes/archive/20260925-feature-workflow-domain/brief.md
  - changes/20261008-fix-ci-bind-tar-harness/brief.md
  - changes/20261008-feature-artifact-capability-contract/brief.md
  - shadow-dev-workflow 仓 changes/archive/20260925-feature-pack-release/brief.md（跨仓产物契约）
  - shadow-dev-workflow 仓 changes/archive/20260925-fix-pack-adapters/brief.md（跨仓产物契约）
verified: 2026-10-09
verified-depth: runtime
verified-scope: 隔离 `SHADOW_WORKFLOW_PREFIX` 下用 fixture 产物真实物化——兼容产物 `workflow execute` 退出 0 且 `CURRENT` 落版本；声明 `requiresCommands:["nope.does-not-exist","zzz.future.command"]` 的产物 execute 退出 1 且 stderr 报 `ARTIFACT_INCOMPATIBLE`，`CURRENT` 字节不变、无 `shadow-dev-workflow-9.9.9` 目录残留；`workflow link --dir` 同拒绝且 `LINK` 不写；`workflow status` 回 `artifactVersion/cliVersion/missingCommands`；CI `test.yml` 9/9（3 OS × node 20/22/24，run 37864139301）
---

# shadow-dev CLI 安装与分发模型

## 当前结论

`scripts/install-cli.sh` 是唯一安装入口，维护**双轨**：release 物化轨（拉 GitHub Release tarball → 校验 → 物化到 `$PREFIX/shadow-dev-cli-<ver>/` → 切 `CURRENT` 指针，`PREVIOUS` 供回滚）与 link 直通轨（`link <path>` 校验目标目录后把其绝对路径写入 `$PREFIX/LINK`，代码即改即生效，面向 CLI 开发者本人）。`$BIN/shadow-dev`(.sh/.cmd) 是托管 shim，运行时按 `LINK → CURRENT` 两段解析——任何更新、回滚、双轨切换都不改 shim 文件本体。`install --json` 单行输出是 shadow-dev-workflow 插件钩子的跨仓接缝契约。生态分发反转后，CLI 另管**第二产物**：`workflow` 域以同构双轨物化 shadow-dev-workflow 产物（release tarball → `$PREFIX/shadow-dev-workflow-<ver>/` → CURRENT/PREVIOUS/current 解析，解析序 LINK → CURRENT），`bind` 域按产物内 `adapters/<host>.json` 描述符把 skills 复制进宿主发现目录并以 sidecar（`.shadow-dev-workflow.json`）记托管清单——**新增宿主 = 产物加一个描述符，CLI 零改动**。`scripts/bootstrap.sh` 编排三段装机（CLI → workflow → bind）。两域均为无 brief 域，`--plan-hash` 是 execute 的唯一凭证，任意目录可用。分发权威由「workflow 插件 pin CLI」反转为「CLI 驱动内容产物」后，兼容判定不再依赖静态版本号，而由**产物能力契约**承担：产物 `package.json` 可声明 `requiresCommands`（它需要的命令键列表），CLI 在物化/直通落盘前拿自身命令目录（`lib/commands.mjs` 的 `COMMANDS`，即命令面单一事实源）断言，能力不齐即响亮拒绝且指针不动。

## 执行约束

- 命令面（install|update|rollback|status|link|unlink）、options、退出码（0/1/2/3）与布局在 install-cli.sh 文件头接缝注释、README「安装与分发」两处同源登记，改行为必须同步改注释。
- 指针落盘前置校验不可绕过：物化轨 `node cli.mjs help --json` 冒烟不过则 `CURRENT` 不动；link 轨目标缺 `cli.mjs`/`package.json` 或冒烟不过则 `LINK` 不写（artifact/selfcheck 走退出码 3，参数/冲突走 1）。
- shim 路径被非托管同名文件占用时 `shim_guard` 在任何写盘前失败退出，绝不静默覆盖；link 与 install 共用同一 guard 与 `gen_shims`。
- `LINK` 与 `CURRENT` 语义互斥不复用：`install` 永不写/删 `LINK`，`unlink` 只删 `LINK`；status 的 `linked` 为 additive 字段。JSON 输出中的 Windows 路径必须转义反斜杠（`sed 's/\\/\\\\/g'`）。
- Windows 上 `LINK` 落盘存 `cygpath -w` 的 Windows 形态（`.cmd` shim 用 `set /p` 直读，POSIX 形态 node 打不开）；shim `.cmd` 用 goto 两段分支而非括号块（括号块内 `%errorlevel%` 提前展开会吞掉真实退出码）。
- 信任边界分轨表述：release 轨 HTTPS + GitHub 仓库（无独立校验和），link 轨目标是用户显式给出的本机目录——引入 link 不扩大下载面，也不得把 link 目标喂给任何网络请求。
- workflow 产物消费契约三件必备：`marketplace.json`/`package.json`/`skills/`；`adapters/` 自 v6.3.1 起必备（bind 依赖），pack 清单与消费方契约两处同源登记。
- **产物能力契约（第四件，可选声明）**：`requiresCommands` 缺失或非数组 = 旧产物，一律视为兼容（零破坏）；声明了但当前 CLI 的命令目录里没有对应键 → `ARTIFACT_INCOMPATIBLE`（退出码 1，与 `ARTIFACT_INVALID` 的 3 类语义分开：前者是「内容比 CLI 新」的校验失败，后者是产物结构损坏）。
- **能力断言不可绕过且必须早于任何写盘**：`workflow execute` 在 `requireArtifact`/`verOf` 之后、`rmSync`/`mkdirSync`/`cpSync` 之前断言，`workflow link` 在写 `LINK` 之前断言——拒绝路径必须满足「`CURRENT`/`PREVIOUS`/`LINK` 字节不变 + 不产生半成品版本目录」，与既有「冒烟不过则指针不动」同一安全语义。观测与预览分工：`workflow plan` 仅对可离线解析的来源（`--from` 目录/tarball）透出 `missingCommands` 预览（下载轨恒 `null`），预览**不拦**、由 execute 拦；`workflow status` 恒不抛，暴露 `artifactVersion`/`cliVersion`/`missingCommands` 三元组供引导页与巡检读一个信号。跨仓演进顺序**消费方先行兼容、生产方随后声明**：CLI 先支持断言并发布，workflow 仓才删 `cliVersion` pin / SessionStart hook 并声明需求，否则中途「内容要求未发布命令」无任何机制兜住（20261008 实证：pin v1.4.0、skills 已指挥 worktree 域、而该域只在 main 未发布）。
- bind 绝不改 SKILL.md 字节：托管凭 sidecar，非托管同名目录在 plan 标记 blocked、execute 拒绝（exit 1），unbind 按 sidecar 逆操作；`readdirSync` 产出的 entries/sidecar keys 必须排序，保证 planHash 与 sidecar 字节确定。
- 大小写不敏感文件系统（macOS/Windows 默认）上，指针文件与入口软链命名不得仅大小写不同——`CURRENT` 指针文件与 `current` 软链同路径互删（已删软链，统一运行时解析 resolvedRoot）。
- **release 不作为 brief task**：review execute 的机械门禁要求全部任务勾选，而发布天然在 review 之后——把发布写成 task 会造成死锁（20260925-feature-pack-release 教训，发布放合并后/独立环节）。
- 凡需打包/解包 tar **必须经 `bash -c 'tar ...'` 执行**（与安装器本体同一解析路径），Windows 上的路径参数先 `cygpath -u` 归 POSIX：node 直接 spawn `tar` 的结果随 PATH 命中对象漂移——Windows runner 绑 System32 bsdtar 读不了 `toUnix()` 产出的 MSYS 路径（历史：安装器用例 windows CI 恒红），Git Bash msys tar 抢跑时反过来把 `C:\` 形态误读为"远程主机:路径"（2026-10-08 本机复现：workflow 域两处解包炸而 CI bsdtar 掩盖）。约束覆盖测试文件与 `lib/domains/workflow.mjs` 的 `untar()` 生产链路两处。

## 适用边界

适用于 `scripts/install-cli.sh` 及其托管 shim/指针的全部行为变更。不适用于 CLI 运行时输出面（见 cli-output-contract）。GitHub release 打包布局已入契约：CLI 侧 `pack.mjs` 产 `shadow-dev-cli-v<ver>.tar.gz`（cli.mjs/lib/package.json/README/LICENSE），workflow 侧产 `shadow-dev-workflow-v<ver>.tar.gz`（运行必需集 + adapters，见 workflow 仓 pack.mjs）。

## 验证方式

`node --test test/install.test.mjs` 全绿即契约成立（8 用例：离线物化+shim 运行、幂等/--force、非托管 shim 保护、回滚往返、坏产物、link 映射/优先/回退、link 校验与 guard、dry-run+status+参数拒绝）。

能力契约面：`node --test test/cli.test.mjs` 的 `workflow capability contract:` 四条用例（拒绝路径含指针/残留断言与 stderr `--lang zh` 断言、缺省兼容回归钉、status 三元组投影、link 轨拒绝）全绿，且 `workflow plan is stable and execute materializes versioned layout with pointers`、`workflow link track wins over CURRENT and unlink restores it` 两条既有用例保持绿。手工复验（隔离 `SHADOW_WORKFLOW_PREFIX`）：造一个 `package.json` 带 `requiresCommands: ["nope.does-not-exist"]` 的 fixture 产物，`workflow plan` 应 `ok:true` 且 `data.missingCommands` 含该键，`workflow execute` 应退出 1 报 `ARTIFACT_INCOMPATIBLE` 且 `CURRENT` 未变、无对应版本目录，`workflow link --dir` 同样拒绝且不写 `LINK`，`workflow status` 的 `artifactVersion/cliVersion/missingCommands` 如实回显。**本机注意**：`node --test` 全量在开发机不可靠（139 段错误风暴使 spawn 出的 CLI 子进程返回 `status:null`，runner 还可能整体挂死），全量回归以 CI `test.yml`（3 OS × node 20/22/24）为准；单用例隔离重跑即可收敛。shim 面是**平台分支**的：`.sh` 全平台生成，`.cmd` 仅 MINGW/MSYS/CYGWIN——测试断言 `.cmd` 必须带 `platform() === 'win32'` 平台门，恒真/恒假的跨平台断言会让 CI 门禁失真（历史上 main 因此连红一天）。手工复验：`bash scripts/install-cli.sh link <本仓库>` 后 `shadow-dev change list --archived` 立即可用且 `install --json` 后仍走 link（LINK 优先）；`unlink` 后回物化版本；`status --json` 的 `linked`/`current` 如实反映。

## 关联知识

- [CLI 双通道输出契约](cli-output-contract.md)
