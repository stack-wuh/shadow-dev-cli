---
{
  "schema": "shadow-dev/v1",
  "name": "20260925-fix-cli-silent-failures",
  "type": "fix",
  "scope": "cli",
  "status": "proposed",
  "baseBranch": "main",
  "branch": null,
  "files": [
    "lib/domains/archive.mjs",
    "lib/domains/branch.mjs",
    "lib/domains/commit.mjs",
    "lib/domains/publish.mjs",
    "lib/domains/release.mjs",
    "lib/plan.mjs",
    "shadow-docs/knowledge/plan-credential-chain.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 29,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/29",
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "pending",
    "verifiedCommit": null,
    "verifiedAt": null
  },
  "workflow": {
    "operation": null,
    "checkpoint": "issue:29",
    "planHash": "3d24545d8c604cb3e39b76a8244ff50b5ee3dab7ae3e1b4755d788d919f905a4",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[fix] CLI 静默失败修复：branch 门禁 / archive 落 commit / files 顺序归一",
      "body": "",
      "labels": [
        "fix"
      ]
    }
  }
}
---

# CLI 静默失败修复：branch 门禁 / archive 落 commit / files 顺序归一

## 动机

实证复盘（20260924-feature-git-history-capsule 全链路）暴露三个 CLI 静默失败或易错点：① `branch execute` 在非 base 分支时静默跳过建分支，仍报 ok:true 并把 brief 状态写为 branched——状态与现实脱节，发现时需手工补救（本次被迫手工建 worktree + 分支）；② `archive execute` 只 rename + 重建 INDEX，不落 commit，留下「INDEX 改 + 旧 brief 删 + 新目录未跟踪」半落状态，每次归档都要手工补三路径 add + commit；③ `commit/publish/release` 的 `--files` 数组在 planData 归一后与用户传参顺序脱钩（canon 只排对象键不排数组），execute 必须复现归一后的顺序才不炸 `PLAN_HASH_INVALID`——顺序敏感且不可发现（本次 plan 传原始顺序、按 nextStep 的排序形式 execute 才通过）。

## 引用规范

- shadow-docs/knowledge/plan-credential-chain.md
  - 当前结论: planHash = sha256(canon({command, data: norm(planData)}))；norm 剥离 plan 副作用（workflow 凭证字段、repo.changedFiles/clean）；带 --name 的域以 brief 持久化 planHash 为准
  - 适用 scope: lib/plan.mjs, lib/domains/branch.mjs, lib/domains/commit.mjs, lib/domains/archive.mjs
- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout 单行 JSON 为机器契约（公开 API 需测试钉住），人读内容只走 stderr；错误 code 与 nextStep 模板不本地化
  - 适用 scope: lib/domains/branch.mjs, lib/domains/archive.mjs

## 决策

- **选型:** ① branch execute 的 else 分支（非 base 分支）改为抛 `NOT_ON_BASE_BRANCH` 错误（附 current/base 分支信息），不再写 brief 状态；② archive execute 在 rename + buildIndex 后追加 `git add`（INDEX.md、changes/<name>、changes/archive/<name> 三显式路径）+ 本地 commit（message 惯例：`docs(shadow): 归档 <name>——PR #N 已合入 main，brief 移入 archive 并重建 INDEX`），nextStep 输出 push 命令；③ commit 域补 `persistPlan`（持久化 workflow.commit = {files, message}，release 域同款模式），norm() 同步剥离该字段，execute 无需重传 --files/--message。
- **对比方案:** branch 静默跳过改为自动 git worktree add（worktree CLI 化）——有价值的演进但涉及 brief 权威副本归属设计，另立 change，本次不捆绑；files 归一改为「execute 从 brief 持久化参数解析」（issue 模式推广）——改动面大且排序归一已消除实际痛点，延期。
- **理由:** 三处均为确定性本地行为的修正，不碰网络/发布语义；排序归一在 planData 内联完成使 plan/execute 天然一致，比要求用户复现归一顺序更符合「哈希防篡改而非防手滑」的既有设计意图（plan-credential-chain 卡的原话）。

**实现期前提修正（apply 记录）**：原任务③「files 数组顺序敏感导致 PLAN_HASH_INVALID」在实现期被证伪——`lib/input.mjs` 的 `fileList` 一直带 `.sort()`，顺序敏感不存在；真因是 commit execute 未重传 `--files/--message` 时 planData 以空参重算导致哈希不匹配（用法问题暴露 ergonomics 缺口）。任务③按此修正为 commit persistPlan。

## 任务
## 任务

### Phase 1
- [ ] branch execute 非 base 分支抛 NOT_ON_BASE_BRANCH（含 current/base 与建议命令），红→绿 — `lib/domains/branch.mjs` — 修改
- [ ] archive execute 追加三路径 git add + 本地 commit + nextStep push 提示，红→绿 — `lib/domains/archive.mjs` — 修改
- [ ] commit 域 persistPlan（workflow.commit 持久化 + norm 剥离 + planData 回退），execute 免重传参数，红→绿 — `lib/domains/commit.mjs`, `lib/plan.mjs` — 修改
- [ ] `node --test test/cli.test.mjs` 全绿；同步 plan-credential-chain 卡（数组归一边界）与 verified

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/plan-credential-chain.md
- **理由:** files 排序归一属哈希边界（norm）的新增条目，须原位更新该卡并在任务内同步；branch/archive 的行为修正属 bug 级，无新稳定事实。
