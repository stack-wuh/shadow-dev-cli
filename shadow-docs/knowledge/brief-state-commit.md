---
title: brief 最终态提交与零 dirty 不变量
domain: cli-infrastructure
keywords: [零 dirty, brief 最终态, 补提交, briefCommit, pushed, 空提交, GIT_PUSH_FAILED, archive push]
scope: [lib/steps.mjs, lib/domains/commit.mjs, lib/domains/publish.mjs, lib/domains/release.mjs, lib/domains/archive.mjs]
status: active
source:
  - changes/20261008-fix-brief-final-state-commit/brief.md
  - changes/20261010-feature-brief-scope-amend/brief.md
verified: 2026-10-10
verified-depth: runtime
---

# brief 最终态提交与零 dirty 不变量

## 当前结论

状态写盘晚于内容 commit 是生命周期的固有顺序（PR 号只能在 push 后得知），因此 commit/publish/release/archive 四域的 execute 端点必须由 `briefStateCommit` 补一笔「docs(shadow): brief 最终态——<status>[, PR #N]」提交收口：**execute 结束时 `git status --porcelain` 为空、brief 的最终态已在 HEAD、且已推送远端**（publish/release 经 `pushTip`，archive 经 commit 后 `git push`）。plan 端点写回的 planHash 属中间态，由配对的 execute 收口，不单独承诺干净。

## 执行约束

- 新增写 brief 的 execute 域：`write(b)` 之后必须调用 `briefStateCommit(r, b, "<最终态描述>")`；无差异返回 null 不造空 commit，重跑幂等。
- 需要远端同步的域（publish/release/archive）：补提交之后必须 `pushTip`/`git push`；push 失败一律响亮 `GIT_PUSH_FAILED`，禁止吞错续跑。archive 的 push 失败特例：归档提交已落本地 main，续跑不可经 plan（harness 读旧路径 BRIEF_NOT_FOUND），恢复需人工 push 一次。
- `commit/publish/release.execute` 的 `briefCommit`（sha 或 null）与 `archive.execute` 的 `pushed` 是 stdout JSON 公开契约（additive），改动须同步 `zero-dirty` 前缀的契约测试。
- review 阶段可用机械检查核对 execute 端点树是否干净（porcelain 为空）。

## 适用边界

适用于四域 execute 对 `shadow-docs/changes/**/brief.md` 的提交语义；不适用于 `task set`/`change create`/`change amend` 等直接命令（无 commit 职责），不适用于 INDEX 与归档目录移动（由 archive execute 自身 staged 清单负责）。`change amend` 的「无实际差异即不写盘」与本域「无差异返回 null 不造空 commit」是同一条纪律的两种落点。

## 验证方式

`node --test --test-name-pattern zero-dirty test/cli.test.mjs` 全绿即成立，关键断言：commit/release/publish execute 后 porcelain 为空且 HEAD 的 brief 含最终态字段；archive execute 后 bare origin 的 main 收到归档提交；replan 漂移恰好收口为一笔最终态 commit。

## 关联知识

- [plan/execute 凭证链与哈希边界](plan-credential-chain.md)
- [CLI 双通道输出契约](cli-output-contract.md)
