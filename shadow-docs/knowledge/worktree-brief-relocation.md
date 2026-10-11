---
title: brief 随专属 workspace 迁移与归属树
domain: cli-infrastructure
keywords: [worktree, workspace, 专属工作区, brief 迁移, relocate, 未跟踪, 唯一真相, 状态分裂, 归属树, 载体豁免, WORKTREE_DIRTY, BRIEF_NOT_FOUND, L 级并行]
scope: [lib/domains/worktree.mjs, cli.mjs, lib/commands.mjs, test/cli.test.mjs]
status: active
source:
  - changes/20261010-fix-worktree-uncommitted-brief/brief.md
verified: 2026-10-11
verified-depth: unit
verified-scope: 待 Phase 2 全量测试收敛后按实际深度更新（本机 node --test 受 139 段错误风暴干扰，需禁编译缓存 + 串行重试）
---

# brief 随专属 workspace 迁移与归属树

## 当前结论

`git worktree add` 从**基线**派生新工作树，而 `change create` 刚写的 brief 是未跟踪文件——新树里没有它。因此专属 workspace 必须**迁移** brief：把该 change 唯一的 brief 目录整体搬进新工作树，旧位置不留副本。

复制不是可选项：同一 change 出现两份可各自演进的 brief 就是受管状态分裂，`task set` 落 A 树、`review` 落 B 树会产生两个真相，其表征（静默数据损坏）远比一次报错难发现。

**归属树（owning tree）**：任一时刻决定「按 `--name` 去哪棵树读 brief」的那棵树，主工作区与某 worktree 互斥。除 `worktree` 域需要跨树定位（`locateBrief`）外，其余命令域一律按 cwd 所在树读写——这是设计意图，不是缺陷。

## 执行约束

- 迁移只发生在**状态回写之后**：`branch`、`status`、`workflow.worktree` 先写进 brief，再搬目录；迁移必须逐文件校验一致后才删源，校验失败回退目标并响亮抛 `RELOCATION_MISMATCH`、保留源文件。
- brief 已跟踪（已提交）时**一行都不动**，`relocated:false`。专属 workspace 的稳态路径不得被迁移逻辑改写。
- 回收不得吞掉唯一真相：`worktree remove execute` 在 `git worktree remove` 之前把未提交的 brief 搬回主工作树（`relocatedBack`），随后清空 `workflow.worktree`。
- **载体豁免**：未提交的 brief 不构成 `WORKTREE_DIRTY`（它是 CLI 的管理载体，不是用户工作）；真实用户改动仍必须照旧拒绝回收。脏判定属行为门禁，须留在 `planData` 内联执行，且**不得进入 planHash 输入**。
- harness 层（`planDomain`/`executeDomain`）必须尊重域导出的 `locateBrief`：硬按 cwd 所在树读 brief 会让跨树回收在进入域逻辑之前就 `BRIEF_NOT_FOUND`。
- `activeBriefs` 需覆盖主树与全部 worktree 并跨树去重，否则归属反查失明、同名 change 可被重复创建。
- 内容包侧不得把「L 级必须建专属 workspace」写成无条件要求：新立项（brief 未提交）场景可用，但降级 inline 是合法选择，需在 brief「决策」里写明隔离手段（见内容包 `norms/domain-model.md` 与本仓 README）。

## 适用边界

适用于任何「工作树从基线派生 + 起点产物未入库」的工具结构（脚手架、任务态文件、变更单）。不适用于所有文件已入库的场景——那时派生即自带上下文，迁移只会制造分裂。

## 验证方式

1. 未跟踪 brief：`worktree execute` → `relocated:true`；主树 `shadow-docs/changes/<name>/brief.md` 不存在，工作树内存在且 `branch`/`workflow.worktree`/`status` 已回写；在工作树内 `task list` 成功；主树内 `worktree inspect` → `recommendation:"reuse"`。
2. 回收：`worktree remove plan` → `dirty:false`；`remove execute` → `relocatedBack:true`、目录消失、`workflow.worktree=null`。
3. 载体豁免不得放水：工作树内有真实新文件时 → `WORKTREE_DIRTY`、退出码 1。
4. 稳态零回归：先提交 brief 再 `worktree execute` → `relocated:false`，主树副本仍在。
5. `node --test test/cli.test.mjs` 全绿（既有 5 条 worktree 用例与上述新用例同处一套基线）。

## 关联知识

- [brief 最终态提交与零 dirty 不变量](brief-state-commit.md)
- [plan/execute 凭证链与哈希边界](plan-credential-chain.md)
- [brief.md frontmatter 行尾契约](brief-frontmatter-crlf.md)
- [CLI 双通道输出契约](cli-output-contract.md)
