---
title: shadow-dev CLI 安装与分发模型
domain: install-distribution
keywords: [安装, installer, shim, 指针文件, LINK, CURRENT, 双轨, 回滚, 插件钩子, tarball, Git Bash, PowerShell, workflow 域, bind, adapters, sidecar, bootstrap]
scope: [scripts/install-cli.sh, scripts/bootstrap.sh, lib/domains/workflow.mjs, lib/domains/bind.mjs, test/install.test.mjs, test/cli.test.mjs]
status: active
source:
  - changes/20260917-feature-install-cli-script/brief.md
  - changes/20260917-fix-installer-url-taint/brief.md
  - changes/20260917-feature-install-link-mode/brief.md
  - changes/20260918-fix-installer-ci-cmd-assert/brief.md
  - changes/20260918-fix-cross-platform-ci/brief.md
  - changes/archive/20260925-feature-workflow-domain/brief.md
  - shadow-dev-workflow 仓 changes/archive/20260925-feature-pack-release/brief.md（跨仓产物契约）
  - shadow-dev-workflow 仓 changes/archive/20260925-fix-pack-adapters/brief.md（跨仓产物契约）
verified: 2026-09-25
---

# shadow-dev CLI 安装与分发模型

## 当前结论

`scripts/install-cli.sh` 是唯一安装入口，维护**双轨**：release 物化轨（拉 GitHub Release tarball → 校验 → 物化到 `$PREFIX/shadow-dev-cli-<ver>/` → 切 `CURRENT` 指针，`PREVIOUS` 供回滚）与 link 直通轨（`link <path>` 校验目标目录后把其绝对路径写入 `$PREFIX/LINK`，代码即改即生效，面向 CLI 开发者本人）。`$BIN/shadow-dev`(.sh/.cmd) 是托管 shim，运行时按 `LINK → CURRENT` 两段解析——任何更新、回滚、双轨切换都不改 shim 文件本体。`install --json` 单行输出是 shadow-dev-workflow 插件钩子的跨仓接缝契约。生态分发反转后，CLI 另管**第二产物**：`workflow` 域以同构双轨物化 shadow-dev-workflow 产物（release tarball → `$PREFIX/shadow-dev-workflow-<ver>/` → CURRENT/PREVIOUS/current 解析，解析序 LINK → CURRENT），`bind` 域按产物内 `adapters/<host>.json` 描述符把 skills 复制进宿主发现目录并以 sidecar（`.shadow-dev-workflow.json`）记托管清单——**新增宿主 = 产物加一个描述符，CLI 零改动**。`scripts/bootstrap.sh` 编排三段装机（CLI → workflow → bind）。两域均为无 brief 域，`--plan-hash` 是 execute 的唯一凭证，任意目录可用。

## 执行约束

- 命令面（install|update|rollback|status|link|unlink）、options、退出码（0/1/2/3）与布局在 install-cli.sh 文件头接缝注释、README「安装与分发」两处同源登记，改行为必须同步改注释。
- 指针落盘前置校验不可绕过：物化轨 `node cli.mjs help --json` 冒烟不过则 `CURRENT` 不动；link 轨目标缺 `cli.mjs`/`package.json` 或冒烟不过则 `LINK` 不写（artifact/selfcheck 走退出码 3，参数/冲突走 1）。
- shim 路径被非托管同名文件占用时 `shim_guard` 在任何写盘前失败退出，绝不静默覆盖；link 与 install 共用同一 guard 与 `gen_shims`。
- `LINK` 与 `CURRENT` 语义互斥不复用：`install` 永不写/删 `LINK`，`unlink` 只删 `LINK`；status 的 `linked` 为 additive 字段。JSON 输出中的 Windows 路径必须转义反斜杠（`sed 's/\\/\\\\/g'`）。
- Windows 上 `LINK` 落盘存 `cygpath -w` 的 Windows 形态（`.cmd` shim 用 `set /p` 直读，POSIX 形态 node 打不开）；shim `.cmd` 用 goto 两段分支而非括号块（括号块内 `%errorlevel%` 提前展开会吞掉真实退出码）。
- 信任边界分轨表述：release 轨 HTTPS + GitHub 仓库（无独立校验和），link 轨目标是用户显式给出的本机目录——引入 link 不扩大下载面，也不得把 link 目标喂给任何网络请求。
- workflow 产物消费契约三件必备：`marketplace.json`/`package.json`/`skills/`；`adapters/` 自 v6.3.1 起必备（bind 依赖），pack 清单与消费方契约两处同源登记。
- bind 绝不改 SKILL.md 字节：托管凭 sidecar，非托管同名目录在 plan 标记 blocked、execute 拒绝（exit 1），unbind 按 sidecar 逆操作；`readdirSync` 产出的 entries/sidecar keys 必须排序，保证 planHash 与 sidecar 字节确定。
- 大小写不敏感文件系统（macOS/Windows 默认）上，指针文件与入口软链命名不得仅大小写不同——`CURRENT` 指针文件与 `current` 软链同路径互删（已删软链，统一运行时解析 resolvedRoot）。
- **release 不作为 brief task**：review execute 的机械门禁要求全部任务勾选，而发布天然在 review 之后——把发布写成 task 会造成死锁（20260925-feature-pack-release 教训，发布放合并后/独立环节）。
- 测试需要打包 tar 时**必须经 `bash -c 'tar ...'` 执行**（与安装器本体同一解析路径）：node 直接 `spawnSync('tar')` 在 Windows runner 绑到 System32 bsdtar，读不了 `toUnix()` 产出的 MSYS `/tmp` 路径，导致全部安装器用例在 windows CI 恒红。

## 适用边界

适用于 `scripts/install-cli.sh` 及其托管 shim/指针的全部行为变更。不适用于 CLI 运行时输出面（见 cli-output-contract）。GitHub release 打包布局已入契约：CLI 侧 `pack.mjs` 产 `shadow-dev-cli-v<ver>.tar.gz`（cli.mjs/lib/package.json/README/LICENSE），workflow 侧产 `shadow-dev-workflow-v<ver>.tar.gz`（运行必需集 + adapters，见 workflow 仓 pack.mjs）。

## 验证方式

`node --test test/install.test.mjs` 全绿即契约成立（8 用例：离线物化+shim 运行、幂等/--force、非托管 shim 保护、回滚往返、坏产物、link 映射/优先/回退、link 校验与 guard、dry-run+status+参数拒绝）。shim 面是**平台分支**的：`.sh` 全平台生成，`.cmd` 仅 MINGW/MSYS/CYGWIN——测试断言 `.cmd` 必须带 `platform() === 'win32'` 平台门，恒真/恒假的跨平台断言会让 CI 门禁失真（历史上 main 因此连红一天）。手工复验：`bash scripts/install-cli.sh link <本仓库>` 后 `shadow-dev change list --archived` 立即可用且 `install --json` 后仍走 link（LINK 优先）；`unlink` 后回物化版本；`status --json` 的 `linked`/`current` 如实反映。

## 关联知识

- [CLI 双通道输出契约](cli-output-contract.md)
