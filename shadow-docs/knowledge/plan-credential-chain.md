---
title: plan/execute 凭证链与哈希边界
domain: cli-infrastructure
keywords: [planHash, plan, execute, norm, changedFiles, 凭证, hash 漂移, porcelain, trim]
scope: [lib/plan.mjs, cli.mjs, lib/git.mjs]
status: active
source:
  - changes/20260917-fix-plan-credential-chain/brief.md
  - changes/20260925-fix-cli-silent-failures/brief.md
verified: 2026-09-25
---

# plan/execute 凭证链与哈希边界

## 当前结论

`planHash = sha256(canon({command, data: norm(planData)}))`。`norm()` 的剥离边界是**「plan 自身的副作用」**，共两类：① brief `workflow` 中由 plan 写回的凭证字段（`planHash`、`release`、`issuePlan`）；② `repo` 的易变 worktree 快照（`changedFiles`、`clean`）——plan 写回 brief 必然改变脏文件集合，不剥离则干净树上 execute 必漂移。`repo.head`/`branch`/`root` 属于语义输入，保留参与哈希。凭证存放：带 `--name` 的域以 brief 中持久化的 planHash 为准；无 brief 的域（`index rebuild`）以 `--plan-hash` 参数为唯一凭证。

## 执行约束

- 新增命令域导出 `planData` 时，凡包含 `repo` 状态，其 `changedFiles`/`clean` 已被 `norm()` 剥离，无需自行处理；不得为了「哈希稳定」把 head/branch 也剥掉。
- 脏工作区的行为门禁（如 `sync` 的 `DIRTY_WORKTREE`）必须在命令域 `planData` 内联执行——plan 与 execute 都会跑一次，这是哈希剥离脏状态后唯一的脏检查通道，不得移入哈希输入。
- `git()` 输出只做尾部裁剪（`trimEnd`）：`git status --porcelain` 状态行以空格开头（` M path`），消费方从下标 3 取路径，全局 `trim()` 会截掉首行路径首字符。
- execute 端若命令的 `planData` 依赖 flag 且该 flag **未持久化**（如 `publish`/`release` 的 `--title`/`--body`），execute 必须传与 plan 完全一致的参数，否则 `PLAN_HASH_INVALID` 属预期行为。已持久化的 flag 不受此限：`commit` 的 `--files`/`--message` 经 `workflow.commit` 持久化（`persistPlan` + `norm` 剥离，20260925-fix-cli-silent-failures 起），`release` 的经 `workflow.release`——execute 可只传 `--name --confirm`。新命令域引入可持久化 flag 时必须三处同步：`persistPlan` 写回、`norm()` 剥离、`planData` 回退读取。

## 适用边界

适用于所有走 `DOMAINS` 统一通道的 plan/execute 命令域。不适用于直接命令（`change create/approve`、`task set`、`repo inspect`），它们无哈希凭证。

## 验证方式

`node --test test/cli.test.mjs` 全绿即成立，关键用例：`plan to execute survives the clean-tree write of planHash`（干净树 plan→execute 可复现）、`porcelain first-line status keeps the full path in changed files`（首行路径完整）、`plan persists the hash so execute runs without copying it`（brief 凭证链）。

## 关联知识

- [CLI 双通道输出契约](cli-output-contract.md)
- [brief.md frontmatter 行尾契约](brief-frontmatter-crlf.md)
