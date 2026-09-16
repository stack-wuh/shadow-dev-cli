# shadow-dev-cli

Shadow dev workflow 的确定性脚手架 CLI。所有命令走 plan → execute 两段式：`plan` 输出 planHash 并持久化进 brief，`execute` 必须携带确认与匹配的 planHash 才会落盘或调用外部系统，杜绝不可复现的隐式变更。

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

所有输出为单行 JSON：成功 `{"ok":true,"command":...,"data":...}`，失败 `{"ok":false,"error":{"code","message"}}`。

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

## 安装与分发

本 CLI 随 [shadow-dev-workflow](https://github.com/stack-wuh/shadow-dev-workflow) 插件通过安装脚本分发：插件仓库执行 `scripts/install-cli.sh` 从本仓库 release 拉取目录产物。独立使用时克隆本仓库后直接 `node cli.mjs --help`。

## 开发

```bash
npm test   # node --test，35 个契约测试覆盖全部命令域
```

行为契约：命令、JSON 输出结构、错误码、planHash 机制保持稳定；`test/cli.test.mjs` 是唯一契约规格。
