# shadow-dev-cli

Shadow dev 工作流的确定性脚手架 CLI。所有写操作走 **plan → execute 两段式**：`plan` 输出 planHash,`execute` 必须携带确认与匹配的 planHash 才会落盘或调用外部系统。纯 Node.js（≥20）、零 npm 依赖、单命令入口 `shadow-dev`。

CLI 有两类用途，本文档按此组织：

1. **装好并维护 shadow 生态**（`workflow` / `bind` 命令，任意目录可用）——看 [30 秒快速开始](#30-秒快速开始)
2. **在业务仓库里跑确定性开发工作流**（brief 生命周期命令，需在 git 仓库内）——看 [仓库工作流](#在业务仓库里跑-shadow-工作流)

---

## 30 秒快速开始

### 新机器：一条命令装好整个生态

```bash
curl -fsSL https://raw.githubusercontent.com/stack-wuh/shadow-dev-cli/v1.4.0/scripts/bootstrap.sh | bash -s claude-code
```

这条命令做三件事：

| 步骤 | 结果 |
|------|------|
| ① 安装 CLI 最新版 | `~/.local/share/shadow-dev-cli/shadow-dev-cli-<版本>/` + 托管 shim `~/.local/bin/shadow-dev` |
| ② 拉取工作流产物 | `~/.local/share/shadow-dev-workflow/shadow-dev-workflow-<版本>/`（skills、规则、知识库、适配器） |
| ③ 绑定宿主技能 | 按 claude-code 适配器把 6 个技能复制进 `~/.claude/skills/`（带托管标记，可一键解绑） |

> - 末尾参数是宿主名：`claude-code`（原生）或 `zcode`（兼容直用）。宿主清单由产物内 `adapters/<host>.json` 决定，新增宿主 = workflow 仓加一个描述符发版，**CLI 无需更新**。
> - 装完确认 `~/.local/bin` 在 PATH：`export PATH="$HOME/.local/bin:$PATH"`（建议写进 shell 配置）。

### 验证

```bash
shadow-dev version          # CLI 版本（任意目录可用）
shadow-dev workflow status  # 产物状态：current / previous / linked / resolved
shadow-dev bind status      # 各宿主：是否在场、绑定了哪些技能
```

### 日常更新 / 回滚 / 解绑

```bash
# 更新产物到最新版：plan 给出 planHash → execute 凭它落盘
shadow-dev workflow plan
shadow-dev workflow execute --plan-hash <复制上面输出的 planHash> --confirm

# 新版本有问题，一键回滚上一版（离线，不动 shim）
shadow-dev workflow rollback --confirm

# 解绑某宿主技能（按托管清单移除，不碰其他文件）
shadow-dev bind unbind --host claude-code --confirm
```

### 开发者双仓模式（改 workflow 源码即时生效）

```bash
shadow-dev workflow link --dir ~/github/shadow-dev-workflow --confirm   # LINK 直通轨，优先于安装版本
shadow-dev workflow unlink --confirm                                    # 移除直通，回落安装版本
```

---

## 在业务仓库里跑 shadow 工作流

前置：git 仓库；网络类命令（issue / publish / release / archive）需要 GitHub 凭证——`export GH_TOKEN="$(gh auth token)"` 或设置 `GITHUB_TOKEN`。

一个变更的完整生命周期（**所有写命令都要 `--confirm`**）：

```bash
cd your-repo

# ① 创建并批准变更 brief
#    brief 落在 shadow-docs/changes/<名称>/brief.md，编辑它写清动机、决策与任务清单
shadow-dev change create --name 20260925-fix-login --type fix --confirm
shadow-dev change approve --name 20260925-fix-login --confirm

# ② 建功能分支（从基线分支切出）
shadow-dev branch plan --name 20260925-fix-login
shadow-dev branch execute --name 20260925-fix-login --confirm

# ③ 写代码……完成后勾任务（任务清单来自 brief 正文）
shadow-dev task set --name 20260925-fix-login --task task-1 --state done --confirm

# ④ 审查（任务全部勾选才允许写 passed）
shadow-dev review plan --name 20260925-fix-login
shadow-dev review execute --name 20260925-fix-login --conclusion passed --confirm

# ⑤ 提交 + 推分支 + 开 PR（一步；文件列表必须显式，禁止 git add .）
shadow-dev release plan --name 20260925-fix-login --files src/login.ts --message "fix: 登录超时"
shadow-dev release execute --name 20260925-fix-login --confirm

# ⑥ 在 GitHub 上合并 PR，然后归档（brief 移入 archive/ 并重建 INDEX）
shadow-dev archive plan --name 20260925-fix-login
shadow-dev archive execute --name 20260925-fix-login --confirm
```

常用变体：

```bash
shadow-dev commit plan  --name <名称> --files a.ts,b.ts --message "fix: x"   # 只提交不开 PR
shadow-dev commit execute --name <名称> --confirm                            # 参数已持久化,免重传
shadow-dev publish plan  --name <名称> --title "标题"                        # 只推分支开 PR,不提交
shadow-dev publish execute --name <名称> --confirm
shadow-dev issue plan  --name <名称> --labels fix                            # 由 brief 确定性渲染 issue
shadow-dev issue execute --name <名称> --confirm
```

---

## 命令参考

### 生态分发：workflow / bind（无 brief 域，任意目录可用）

这两个域没有 brief,`--plan-hash` 是 execute 的唯一凭证。

| 命令 | 作用 | 关键参数 |
|------|------|----------|
| `workflow plan` | 解析目标版本并输出 planHash | `--release v6.3.1` 固定版本；`--from <目录\|tarball>` 离线安装；缺省取 latest |
| `workflow execute` | 下载/物化产物，切版本指针 | `--plan-hash <hash> --confirm`；先冒烟后落盘，保留上一版供回滚 |
| `workflow status` | 查看安装状态 | 输出 current / previous / linked / resolved |
| `workflow rollback` | 回滚上一版 | `--confirm`；离线对调 CURRENT/PREVIOUS |
| `workflow link` | 直通轨（开发用） | `--dir <checkout> --confirm`；LINK 优先于 CURRENT，源码改动即时生效 |
| `workflow unlink` | 移除直通 | `--confirm`；只删 LINK，回落 CURRENT 版本 |
| `bind plan` | 预览绑定清单 | `--host auto\|claude-code\|zcode…`；auto 只探测本机存在的宿主 |
| `bind execute` | 执行绑定 | `--host <名> --plan-hash <hash> --confirm`；复制 + sidecar 托管标记 |
| `bind status` | 绑定状态 | 各宿主在场情况与托管技能清单 |
| `bind unbind` | 解绑 | `--host <名> --confirm`；按 sidecar 精确移除 |

安装布局：

```
~/.local/share/shadow-dev-workflow/
├── shadow-dev-workflow-<版本>/     # 版本化产物（marketplace/package/skills/hooks/rules/knowledge/norms/docs/scripts/adapters）
├── CURRENT / PREVIOUS             # 版本指针（文本文件）
├── LINK                           # 直通指针（仅 link 轨写入；解析序 LINK → CURRENT）
└── …                              # 旧版本目录自动清理,保留当前与上一版

~/.claude/skills/                   # 绑定目标（zcode 为 ~/.zcode/skills）
├── shadow-dev-propose/ …          # 六个技能目录
└── .shadow-dev-workflow.json      # 托管清单（unbind 的依据;非托管同名目录会被拒绝覆盖）
```

### brief 生命周期（git 仓库内）

| 命令 | 作用 |
|------|------|
| `change create \| approve \| list` | 创建 / 批准变更 brief；`list` 列变更（`--all` 含归档、`--archived` 只列归档） |
| `branch plan \| execute` | 从基线分支建功能分支 |
| `sync plan \| execute` | fast-forward 同步上游（分叉时拒绝自动合并） |
| `conflict inspect` | 检查活动变更间的文件重叠 |
| `task list \| set` | 查看 / 勾选 brief 任务清单 |
| `review plan \| execute` | 写入审查结论与知识评估（任务未全勾选拒绝 passed） |
| `commit plan \| execute` | 按显式文件列表提交（参数持久化,execute 可免重传） |
| `publish plan \| execute` | 推分支并创建/复用 PR（缺省带 `Closes #N`） |
| `release plan \| execute` | 提交 + 推送 + 开 PR 复合操作 |
| `pr inspect` | 查看 brief 关联 PR |
| `reconcile plan \| execute` | 对齐 brief 状态与实际进度 |
| `archive plan \| execute` | 归档已合并变更并重建 INDEX（要求 review passed 且 PR 已合并） |
| `issue plan \| execute` | 由 brief 确定性渲染并创建 GitHub issue |
| `index rebuild plan \| execute` | 重建变更索引（无 brief 域） |

### 辅助

| 命令 | 作用 |
|------|------|
| `version` | CLI 版本（任意目录可用,不要求 git 仓库） |
| `repo inspect` | 查看仓库状态（分支、HEAD、脏文件） |
| `help [命令组]` / `help --full` | 人读命令表 / 结构化命令目录 |

---

## 核心机制：plan → execute

- `plan` 对计划数据做 SHA256 得到 **planHash**。带 `--name` 的域把 hash 持久化进 brief,`execute` 自动校验,无需搬运；无 brief 域（`workflow` / `bind` / `index rebuild`）hash 不落盘,`execute` 必须显式 `--plan-hash`。
- plan 之后相关状态有任何变化 → `PLAN_HASH_INVALID`（退出码 1）,重跑 plan 即可；没跑 plan 就 execute → `PLAN_HASH_REQUIRED`（退出码 2）。
- 所有写操作必须显式 `--confirm`。

### 退出码

| 码 | 含义 | 典型错误码 |
|----|------|-----------|
| 0 | 成功 | — |
| 1 | 输入/校验错误 | `PLAN_HASH_INVALID`、`BRIEF_NOT_FOUND`、`NAME_REQUIRED`、`TASKS_NOT_COMPLETE`、`REVIEW_NOT_PASSED`、`PR_NOT_MERGED`、`ARTIFACT_INVALID`、`UNMANAGED_TARGET` |
| 2 | 缺少确认或凭证 | `CONFIRMATION_REQUIRED`、`PLAN_HASH_REQUIRED` |
| 3 | 外部系统失败 | `GITHUB_TOKEN_REQUIRED`、`GITHUB_API_ERROR`、`API_TIMEOUT`、`GIT_PUSH_FAILED`、`DOWNLOAD_FAILED`、`RELEASE_NOT_FOUND` |
| 4 | 不支持的操作 | `UNSUPPORTED_OPERATION`（如 `git add .`、绝对路径） |

### 输出面

- stdout 恒为**单行 JSON**（机器契约）：成功 `{"ok":true,"command":…,"data":…}`,失败 `{"ok":false,"error":{code,message}}`。
- 出现与否按环境路由：管道/脚本中恒输出；**交互终端默认只看 stderr 人用层**（横幅、耗时、下一步建议）。任何环境想要 JSON：加 `--json` 或 `SHADOW_DEV_JSON=1`。
- 交互终端下 plan 的 `planHash` 仍打印在 stderr,可直接复制给 execute。
- 成功结果的 `data.nextStep` 是下一步建议命令（稳定英文模板,agent 可直接消费）。

---

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `GITHUB_TOKEN` / `GH_TOKEN` | — | GitHub API 凭证（issue/publish/release/archive 必需;workflow 拉公开 release 可选）。gh 已认证时：`export GH_TOKEN="$(gh auth token)"` |
| `SHADOW_GITHUB_API_URL` | `https://api.github.com` | API 地址（测试/代理） |
| `SHADOW_API_TIMEOUT_MS` | `15000` | API 超时 |
| `SHADOW_DEV_JSON` | — | `1` 等价 `--json` |
| `SHADOW_DEV_LANG` | 自动探测 | `zh` / `en`,只影响 stderr 文案 |
| `SHADOW_DEV_QUIET` | — | `1` 关闭 stderr 人用层 |
| `SHADOW_WORKFLOW_PREFIX` | `~/.local/share/shadow-dev-workflow` | workflow 产物前缀 |
| `SHADOW_WORKFLOW_HOME` | 用户 home | bind 解析 `~/.claude/skills` 等的根（测试/隔离用） |
| `SD_PREFIX` / `SD_BIN` | `~/.local/share/shadow-dev-cli` / `~/.local/bin` | CLI 安装位（install-cli.sh 与 bootstrap 透传） |
| `SHADOW_CLI_HOOK_DISABLE` | — | `1` 跳过插件的 SessionStart 自举（双仓开发时保护手动安装） |

## 安装细节（scripts/install-cli.sh）

bootstrap 的底层是同一个安装器,也可单独使用：

```bash
bash scripts/install-cli.sh install                    # 装最新版
bash scripts/install-cli.sh install --version v1.3.0   # 装指定版本
bash scripts/install-cli.sh install --channel main     # 装 main 分支构建
bash scripts/install-cli.sh install --from <tarball>   # 离线安装
bash scripts/install-cli.sh rollback                   # 回滚上一版（离线）
bash scripts/install-cli.sh status                     # 查看 CURRENT/PREVIOUS
bash scripts/install-cli.sh link <本仓库路径>            # link 直通轨（CLI 自身开发用）
bash scripts/install-cli.sh unlink                     # 移除 CLI 的 LINK
```

- 布局：`$PREFIX/shadow-dev-cli-<版本>/` + `CURRENT`/`PREVIOUS` 指针 + `$BIN/shadow-dev` 托管 shim（运行时读指针,更新与回滚不动 shim 本体）。
- 落盘前自校验（`help --json` 冒烟）失败则指针不动;非托管同名 shim 占位时拒绝覆盖,绝不静默。

## 排障

| 症状 | 处置 |
|------|------|
| `shadow-dev: command not found` | 把 `~/.local/bin` 加入 PATH |
| `CONFIRMATION_REQUIRED` | 写操作补 `--confirm` |
| `PLAN_HASH_REQUIRED` | 先运行同命令的 plan |
| `PLAN_HASH_INVALID` | plan 之后输入变了,重跑 plan |
| `GITHUB_TOKEN_REQUIRED` | `export GH_TOKEN="$(gh auth token)"` |
| `WORKFLOW_NOT_INSTALLED` | 先跑 workflow plan + execute,或直接跑 bootstrap |
| `ADAPTERS_MISSING` | workflow 产物过旧（< v6.3.1）,更新产物 |
| `UNMANAGED_TARGET` | 宿主目录存在同名非托管技能;手动移除后重试（绝不静默覆盖） |
| `DIRTY_WORKTREE` | 工作区有未提交业务改动,先 commit 或还原 |
| 插件 hook 提示「未能就位」 | 离线导致;联网后重开会话,或手动 `bash scripts/install-cli.sh install` |

## 开发

```bash
npm test   # node --test;契约测试覆盖全部命令域(test/cli.test.mjs 是唯一契约规格)
```

- 零 npm 依赖,Node ≥ 20。
- 行为契约：命令面、JSON 输出结构、错误码、planHash 机制保持稳定;改动必须测试同铺。
- 本 CLI 随 [shadow-dev-workflow](https://github.com/stack-wuh/shadow-dev-workflow) 插件分发(插件 SessionStart hook 自动安装 pin 版 CLI);完整命令语义与工作流配合见其 `docs/cli-guide.md`。

## License

MIT
