---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-fix-plan-credential-chain",
  "type": "fix",
  "scope": "lib",
  "status": "archived",
  "baseBranch": "main",
  "branch": "fix/20260917-fix-plan-credential-chain",
  "files": [
    "README.md",
    "lib/git.mjs",
    "lib/plan.mjs",
    "shadow-docs/knowledge/plan-credential-chain.md",
    "shadow-docs/menu.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 5,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/5",
    "pullRequest": 6,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/6"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "d614b8067d457c10144105703ffab61305c00e6a",
    "verifiedAt": "2026-09-17T07:40:38.557Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:6",
    "planHash": "689a605975f70075d02314b6b6ce0852bc7e662b9f080be46ba874eb1ce6bfab",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "plan 凭证链修复：execute hash 漂移与 porcelain 首行截字",
      "body": "两个 dogfood 实锤缺陷：① plan 回写自脏 worktree，干净树上 plan→execute 必然 PLAN_HASH_INVALID；② git() 全局 trim() 削掉 porcelain 首行前导空格，changedFiles 首条路径截字并污染 DIRTY_WORKTREE 判断。修复：norm() 剥离 repo.changedFiles/clean；git() 改 trimEnd()。详见 shadow-docs/changes/20260917-fix-plan-credential-chain/brief.md",
      "labels": [
        "fix"
      ]
    }
  },
  "knowledge": {
    "action": "新增",
    "target": "shadow-docs/knowledge/plan-credential-chain.md",
    "reason": "planHash 剥离边界与凭证存放规则是核心机制约束，新增域必须遵守"
  }
}
---

# plan 凭证链修复：execute hash 漂移与 porcelain 首行截字

## 动机

今天两个变更在真实 dogfood 中各踩中一个存量缺陷，均已定位根因并有现场复现路径：

1. **plan 自脏漂移**：`planDomain` 把 planHash 写回 brief 后 worktree 必然变脏；若 plan 之前树是干净的，`executeDomain` 重算的 planData 里 `repo.changedFiles` 从 `[]` 变成 `[brief]`，hash 必然不匹配 → 干净树上 plan→execute 永远 `PLAN_HASH_INVALID`（建 feature 分支时实测踩中，重跑 plan 才绕过）。
2. **porcelain 首行截字**：`git()` 对全部输出做 `.trim()`，porcelain 行 ` M path` 以空格开头，首行前导空格被削掉后 `slice(3)` 吃掉路径首字符（release 阶段实测：`shadow-docs` → `hadow-docs`），污染 `changedFiles`，进而使 sync 的 `DIRTY_WORKTREE` 判断和 conflict 比对失真。

## 引用规范

- norms/code-style.md（通用规范）
  - 当前结论: 渐进式治理，一次变更只做直接相关的事；修改旧代码只修与当前改动直接相关的问题。
  - 适用 scope: `lib/plan.mjs`、`lib/git.mjs`
- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout 恒为单行 JSON 契约，语言/环境无关；stderr 人用层与之隔离。
  - 适用 scope: 本变更不改输出通道结构，但新增的 norm() 剥离规则必须保持 planHash 语言无关——由存量逐字节测试保护。

## 决策

- **选型:** ① `lib/plan.mjs` 的 `norm()` 在哈希前剥离 `repo.changedFiles` 与 `repo.clean`（易变 worktree 快照，本就是 plan 自身写入的副作用源）；`repo.head`/`branch`/`root` 保留参与哈希。DIRTY_WORKTREE 行为检查保留在 `sync.planData` 内联执行（plan 与 execute 都会跑，安全语义不丢）。② `lib/git.mjs` 的 `git()` 由 `.trim()` 改 `.trimEnd()`：只剥尾部换行，首行前导空格不再丢失，rev-parse 等其余消费方无影响（它们的输出无前导空白）。
- **对比方案:** ①的另一路线是让 changedFiles 不出现在各域 planData（分支/审查/提交等域的 plan JSON 会丢失 repo 可见性，agent 消费退化），或把 planHash 挪出 brief（推翻已归档的凭证设计），均否。②的另一路线是 repo() 内特判首行补空格（在错误的层面打补丁，掩盖 git() 的有损 trim），否。
- **理由:** norm() 的既有职责就是"剥离 plan 产物自身造成的漂移源"（先例：workflow.planHash），本次是同构扩展；两处修复均为最小根因修复，不触任何外部契约。

## 任务

### Phase 1 — 失败测试（TDD）

- [x] 契约测试：干净树（shadow-docs 已提交）上 `branch plan` 后立即 `branch execute` 应成功 —— `test/cli.test.mjs`
- [x] 契约测试：仅跟踪文件被修改时 `repo inspect` 的 `changedFiles[0]` 路径完整（首行 ` M` 状态不再截字） —— `test/cli.test.mjs`

### Phase 2 — 根因修复

- [x] `norm()` 剥离 `repo.changedFiles`/`repo.clean`，补注释说明剥离边界 —— `lib/plan.mjs`
- [x] `git()` 改 `trimEnd()`，注释标明 porcelain 前导空格约束 —— `lib/git.mjs`

### Phase 3 — 回归与知识

- [x] 全量回归；README 环境变量/行为无需变更则不动，`plan/execute` 语义描述如有出入顺手校正 —— `README.md`
- [x] 知识卡片 `plan-credential-chain.md`（planHash 输入边界）落盘并加 menu 路由 —— `shadow-docs/knowledge/plan-credential-chain.md` `shadow-docs/menu.md`

## 结果

- 实际耗时: 约 20 分钟
- 验证: `node --test` 47/47 通过（45 存量 + 2 新增：干净树 plan→execute 可复现、porcelain 首行路径完整）；两条新测试在修复前均实测为红；README 计划哈希边界描述与卡片 `plan-credential-chain.md` + menu 路由已落盘。

## 知识评估

- **预期影响:** 新增
- **候选卡片:** shadow-docs/knowledge/plan-credential-chain.md（domain: cli-infrastructure，scope: lib/plan.mjs, cli.mjs）
- **理由:** 「planHash 输入 = 语义输入，不含易变 worktree 快照；凭证在 brief、DIRTY 检查在 planData」是本次确立的核心机制边界，后续所有新增域都要遵守，属非显然约束。
