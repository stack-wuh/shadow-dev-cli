# shadow-dev-cli

Shadow dev workflow 的确定性脚手架 CLI。所有命令走 plan → execute 两段式：`plan` 输出 planHash 并持久化进 brief，`execute` 必须携带确认与匹配的 planHash 才会落盘或调用外部系统，杜绝不可复现的隐式变更。planHash 覆盖命令的语义输入，但剥离 plan 自身的副作用（写回 brief 的凭证字段、易变 worktree 快照 `changedFiles`/`clean`）——干净树上 plan→execute 同样可复现。

纯 Node.js（>=20）、零 npm 依赖、单命令入口 `shadow-dev`。

## 命令

| 命令 | 说明 |
|------|------|
| `repo inspect` | 查看仓库状态（分支、HEAD、脏文件） |
| `change create\|approve` | 创建/批准变更 brief |
| `issue plan\|execute` | 创建 GitHub issue |
| `branch plan\|execute` | 建功能分支 |
| `sync plan\|execute` | fast-forward 同步上游 |
| `conflict inspect` | 检查 active brief 文件重叠 |
| `task list\|set` | 查看/勾选 brief 任务 |
| `review plan\|execute` | 记录审查结论与知识评估 |
| `commit plan\|execute` | 按显式文件列表提交 |
| `publish plan\|execute` | 推分支并创建 PR |
| `release plan\|execute` | 提交 + 推送 + 建 PR 复合操作 |
| `pr inspect` | 查看 brief 关联 PR |
| `reconcile plan\|execute` | 对齐 brief 状态与实际进度 |
| `archive plan\|execute` | 归档已合并变更并重建 INDEX |
| `index rebuild plan\|execute` | 重建变更索引 |

所有输出为单行 JSON：成功 `{"ok":true,"command":...,"data":...}`，失败 `{"ok":false,"error":{"code","message"}}`。`--json` 参数为历史兼容保留，接受即无操作（输出恒为 JSON）。带流程后继的命令，成功结果的 `data.nextStep` 给出下一步建议命令（稳定英文模板，不随语言变化，agent 可直接消费）。

## 人用输出层（stderr）

stdout 的 JSON 契约之外，CLI 在 stderr 渲染一层人类提示：进场横幅（命令+参数）、收场摘要（结果+耗时）、`nextStep` 引导、错误码的本地化解释与示例命令。stderr 内容不承载契约，可随时关闭。

- 语言解析：`--lang zh|en` > `SHADOW_DEV_LANG` > 系统 locale 自动探测 > 默认 `zh`。非法取值报 `INVALID_LANG`（退出码 2）。
- 关闭提示：`SHADOW_DEV_QUIET=1`（或 `true`）时 stderr 零输出，适合日志管道。
- 语言只影响 stderr 文案；错误 code、JSON 结构、`nextStep` 模板均不本地化。
- `shadow-dev help` 概览默认只回最小面：`data.help`（命令一览字符串，约 350 字节）；agent 需要结构化明细（usage/参数/必填/示例/nextStep）时用 `shadow-dev help --full`。`shadow-dev help <命令>` 查看单组详情，恒定结构化（组面小）。stderr 中文命令表不受 `--full` 影响。

## 平台兼容

- `--files` 路径参数接受 Windows 反斜杠写法（如 `lib\a.mjs`），自动归一为正斜杠并与 git 状态、conflict 比对对齐。
- `brief.md` 解析容忍 LF/CRLF（兼容 Windows `core.autocrlf` 检出与手工编辑），CLI 写回一律统一为 LF。
- git fetch/push 带 120 秒超时，避免凭据弹窗导致的永久挂起；GitHub API 超时见下方环境变量。

## 退出码

- `0` 成功
- `1` 输入/校验错误
- `2` 缺少确认（`--confirm` / `--plan-hash`）
- `3` 外部系统失败（git push/fetch、GitHub API）
- `4` 不支持的操作（如隐式 `git add .`）

## 环境变量

- `GITHUB_TOKEN` / `GH_TOKEN`：GitHub API 必需（issue/publish/release/archive）。
- `SHADOW_GITHUB_API_URL`：覆盖 API base URL（测试/代理），默认 `https://api.github.com`。
- `SHADOW_API_TIMEOUT_MS`：API 超时，默认 15000。
- `SHADOW_DEV_LANG`：`zh|en`，stderr 人用层语言（被 `--lang` 覆盖）。
- `SHADOW_DEV_QUIET`：非空且非 `0` 时关闭 stderr 人用层。

## 安装与分发

本 CLI 随 [shadow-dev-workflow](https://github.com/stack-wuh/shadow-dev-workflow) 插件通过安装脚本分发：插件仓库执行 `scripts/install-cli.sh` 从本仓库 release 拉取目录产物。独立使用时克隆本仓库后直接 `node cli.mjs --help`。

## 开发

```bash
npm test   # node --test，47 个契约测试覆盖全部命令域、stderr 人用层与凭证链
```

行为契约：命令、JSON 输出结构、错误码、planHash 机制保持稳定；`test/cli.test.mjs` 是唯一契约规格。
