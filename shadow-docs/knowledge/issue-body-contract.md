---
title: issue 正文双通道结构契约
domain: github-integration
keywords: [issue, 正文, 渲染器, issue-render, issuePlan, metadata, 机器通道, bodySha256, sections, 前缀, 最小投影, token]
scope: [lib/issue-render.mjs, lib/domains/issue.mjs, test/cli.test.mjs]
status: active
source:
  - changes/20260917-feature-unified-issue-structure/brief.md
verified: 2026-09-18
---

# issue 正文双通道结构契约

## 当前结论

`issue plan/execute` 的 GitHub issue 正文**不是自由文本**，而是由 `lib/issue-render.mjs` 从 brief **确定性渲染**（纯字符串拼接，零 LLM 推导）：人读分节骨架 + 机器 metadata 注释块双通道。骨架 = 白名单分节 `## 动机 / ## 引用规范 / ## 决策 / ## 任务`（缺节以 `（brief 缺少该节）` 占位；`结果/知识评估` 等内部节不进 issue）+ 可选 `## 补充`（`--body` 新语义）+ `完整 brief：<briefPath>` 指针行 + 末行 `<!-- shadow-dev:issue-metadata {...} -->` 单行 JSON（name/type/scope/status/branch/baseBranch/briefPath/cliVersion/prUrl/issueNumber）。标题自动补 `[type] ` 前缀，已带同类前缀幂等。

`issue plan` stdout 经域级 `present()` 投影只回摘要 `{name,title,labels,repository,bodyBytes,bodySha256,sections}`（实测 ~0.6KB，对比旧契约 7.5KB）；`sections` 中缺失节带 `-` 前缀标记。全文唯一存放处 = brief `workflow.issuePlan.body`。

## 执行约束

- 正文内容只能来自 brief 现有分节的机械搬运，渲染器**禁止**引入摘要/改写/AI 推导或本地化分支（stdout 与语言、TTY 无关）。
- 「预览即提交」由 `bodySha256` 承担：渲染结果（title/body/labels 及 raw 输入）参与 planHash——plan 后 brief 正文任何变动都会令 execute 报 `PLAN_HASH_INVALID`，**刷新 = 重跑 plan**，不得为绕过漂移引入陈旧快照 POST 或 PATCH 更新通道。
- 机器消费方解析唯一入口 = 正则提取末行 `<!-- shadow-dev:issue-metadata (.+) -->` JSON；新增字段向后兼容（只加不减），`prUrl`/`issueNumber` 为将来 update 通道预留。
- 其他域不得滥用 stdout 投影：`present(x)` 只用于重字段（全文/整段 brief/repo 快照）瘦身，语义输入必须仍在完整 planData 内参与哈希。

## 适用边界

适用于 `issue plan/execute` 全链路及一切依赖 issue 正文结构的下游（shadow-dev-workflow 插件、x.wuh.site 类 issue-as-data 站点）。不适用于 `publish`（PR body 仍为自由文本/`--body` 全文语义）与 `release`——它们的入参投影与非目标声明见 brief。历史 issue（#1~#19）不回填。

## 验证方式

`node test/cli.test.mjs` 中三条契约用例仍绿即成立：`issue renderer: deterministic skeleton...`（确定性/占位/前缀幂等/字段表）、`issue plan projects a lean summary; execute posts the rendered skeleton bound to bodySha256`（投影无重字段 + POST 正文 sha 与摘要一致）、`issue plan drifts when the brief body changes; re-plan refreshes the render`（漂移→PLAN_HASH_INVALID）。手工复验：`shadow-dev issue plan --name <变更> --json` stdout <1KB 且 `sections` 无 `-` 前缀项。

## 关联知识

- [CLI 双通道输出契约](cli-output-contract.md)
- [plan/execute 凭证链](plan-credential-chain.md)
