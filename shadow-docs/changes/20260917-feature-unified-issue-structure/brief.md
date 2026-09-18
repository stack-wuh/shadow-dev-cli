---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-feature-unified-issue-structure",
  "type": "feature",
  "scope": "lib/domains/issue.mjs,lib/issue-render.mjs,lib/commands.mjs",
  "status": "reviewed",
  "baseBranch": "main",
  "branch": "feature/20260917-feature-unified-issue-structure",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/commands.mjs",
    "lib/domains/issue.mjs",
    "lib/i18n.mjs",
    "lib/issue-render.mjs",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 19,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/19",
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "43e37ba27823f535a8087e0dddc9bc6ab73082c7",
    "verifiedAt": "2026-09-17T13:29:34.011Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "issue:19",
    "planHash": "3047dc73a05feba0ee43365232767e98e52792f6a8066dbfcbdb6335aa4f77d0",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] issue 正文统一结构：brief 确定性生成 + 机器 metadata 通道",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\n当前 `issue plan --body` 接受自由文本，不给则空 body，CLI 创建的 issue 结构完全随性。参照仓库 stack-wuh/x.wuh.site（GitHub Issues 即 CMS）以三层机制统一结构：YAML issue forms（人创建）、工作流分节骨架（动机/决策/任务/验收）、正文底部 `<!-- wuh-site-metadata: {...} -->` 机器通道。但其工作流层靠人为自觉，已出现「决策/方案」分节名漂移（#381 vs #388）。shadow-dev 的 brief 本身就是结构化数据（frontmatter + 分节正文 + 任务复选框），可以把 issue 正文升级为「人读分节骨架 + 机器可读 metadata 注释块」双通道，并用 plan 快照机械锁定统一性。\n\n## 引用规范\n- shadow-docs/knowledge/plan-credential-chain.md\n  - 当前结论: planHash = sha256(canon({command, data: norm(planData)}))；norm 剥离 workflow.issuePlan；带 brief 的域以持久化 planHash 为凭证\n  - 适用 scope: lib/domains/* 的 plan/execute\n- shadow-docs/knowledge/cli-output-contract.md\n  - 当前结论: stdout JSON 契约不变；nextStep 为稳定英文模板；stderr 人用层\n  - 适用 scope: 全 CLI help/stderr/nextStep\n\n## 决策\n- **选型:** 分节直通渲染。新增纯函数 `lib/issue-render.mjs`：解析 brief 正文分节，白名单搬运 `## 动机 / ## 引用规范 / ## 决策 / ## 任务`（剔除 `## 结果 / ## 知识评估`），可选 `## 补充`（--body），尾部完整 brief 指针行，正文底部 `<!-- shadow-dev:issue-metadata {...} -->` JSON 注释块（name/type/scope/status/branch/baseBranch/briefPath/cliVersion，预留 prUrl/issueNumber 空值字段）。标题自动补 `[type] ` 前缀（已存在同类前缀则幂等不重复）。\n- **理由:** plan 时渲染并快照进 workflow.issuePlan，execute 只 POST 快照、绝不二次渲染——plan→execute 间隔 brief 被改动不撕裂一致性，刷新只需重跑 plan；norm 已剥离 issuePlan，凭证链零改动。缺白名单分节时生成占位提示「（brief 缺少该节）」，保证骨架恒定形状。\n- **对比方案:** B 仅字段渲染（只用 frontmatter+复选框）——动机/决策内容丢失，issue 成空壳，否；C 活镜像（状态变化 PATCH 更新 issue）——需 update 通道、凭证边界复杂化、归档真相已在 brief，YAGNI，否（仅在 metadata 预留字段留接口）。\n- **入参契约:** --title 选填覆盖（缺省 = [type] 前缀 + brief 首行 H1，无 H1 回落 change name）；--body 语义从「整段正文」改为「## 补充 节内容」；commands.mjs 入参描述与 nextStep 模板同步更新。\n- **零 LLM 生成:** renderIssueBody 是纯字符串拼接——直接搬运 brief 中已写好的分节文本，不做任何摘要、改写或 AI 推导步骤。正文的唯一来源是 brief 本身。\n- **token 契约（只留摘要，stdout 最小投影）:** 现状 issue.plan stdout ~4.3KB 中，body 出现两份（data.body + nextStep 内嵌全文），且 data 还整段回显 brief/repo（~1.2KB 纯噪音）。改造后 `issue plan` stdout `data` 投影为最小摘要：`{name, title, labels, repository, bodyBytes, bodySha256, sections}`——`bodySha256` 即 execute 所 POST 快照的哈希（「预览即提交」由哈希承担），`sections` 为白名单分节命中清单（缺失节以 `-节名` 标记）。nextStep 收敛为 `issue execute --name {name} --plan-hash {hash} --confirm`。实现走域级输出投影钩子（planDomain 支持 `mod.present?.(x)`，默认恒等，不破坏其他域契约）。全文唯一存放处 = brief `workflow.issuePlan.body`（execute 提交源；需完整预览时直接读 brief）。\n- **非目标:** 不回填历史 issue；不改动 x.wuh.site 侧；不引入 issue update/PATCH；其他 plan 域（commit/publish/release 等）的 brief/repo 回显暂不裁剪（投影钩子已就位，可作后续独立变更）。\n\n## 任务\n### Phase 1 渲染器\n- [x] 新增 renderIssueBody(b, extra)：分节解析 + 白名单搬运 + 缺节占位 + [type] 前缀幂等 + 底部 metadata JSON — `lib/issue-render.mjs`\n- [x] 渲染器确定性单测：同输入同输出、缺节占位、前缀幂等、--body 追加节、metadata 字段齐全 — `test/cli.test.mjs`\n### Phase 2 域接线\n- [x] planData 调渲染器：快照（title/body/labels）写 issuePlan；导出 present(x) 最小投影（去 body/brief/repo，加 bodyBytes/bodySha256/sections）；execute 只读快照 POST（planHash 校验已绑定快照内容） — `lib/domains/issue.mjs`\n- [x] planDomain 支持域级输出投影钩子 `mod.present?.(x)`，默认恒等，其余域零变化 — `cli.mjs`\n- [x] issue.plan/issue.execute 入参描述与 nextStep 模板更新：nextStep 去除 body 回显，收敛为 --name --plan-hash --confirm — `lib/commands.mjs`\n- [x] ISSUE_TITLE_REQUIRED 提示措辞更新（仅 title 与 H1 双缺时触发） — `lib/i18n.mjs`\n- [x] 端到端契约测试：apiStub 收到的 body 含分节骨架与 metadata 块且 sha 与 plan 摘要一致；plan stdout 不含 body 全文与 brief/repo 回显；其他域投影零变化；plan 重跑刷新快照 — `test/cli.test.mjs`\n### Phase 3 文档\n- [x] README 增加 issue 结构契约节（双通道说明 + metadata 字段表 + 示例） — `README.md`\n\n完整 brief：shadow-docs/changes/20260917-feature-unified-issue-structure/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20260917-feature-unified-issue-structure\",\"type\":\"feature\",\"scope\":\"lib/domains/issue.mjs,lib/issue-render.mjs,lib/commands.mjs\",\"status\":\"branched\",\"branch\":\"feature/20260917-feature-unified-issue-structure\",\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20260917-feature-unified-issue-structure/brief.md\",\"cliVersion\":\"1.2.0\",\"prUrl\":null,\"issueNumber\":19} -->\n",
      "labels": [
        "feature"
      ]
    }
  },
  "knowledge": {
    "action": "新增",
    "target": "shadow-docs/knowledge/issue-body-contract.md",
    "reason": "issue 正文成为 CLI 与外部消费者（插件、x.wuh.site 类站点）间的稳定数据契约：分节骨架+metadata 机器通道+stdout 最小投影；ship 时同步更新 cli-output-contract.md 的 present 钩子与 token 契约段"
  }
}
---

# issue 正文统一结构：brief 确定性生成 + 机器 metadata 通道

## 动机
当前 `issue plan --body` 接受自由文本，不给则空 body，CLI 创建的 issue 结构完全随性。参照仓库 stack-wuh/x.wuh.site（GitHub Issues 即 CMS）以三层机制统一结构：YAML issue forms（人创建）、工作流分节骨架（动机/决策/任务/验收）、正文底部 `<!-- wuh-site-metadata: {...} -->` 机器通道。但其工作流层靠人为自觉，已出现「决策/方案」分节名漂移（#381 vs #388）。shadow-dev 的 brief 本身就是结构化数据（frontmatter + 分节正文 + 任务复选框），可以把 issue 正文升级为「人读分节骨架 + 机器可读 metadata 注释块」双通道，并用 plan 快照机械锁定统一性。

## 引用规范
- shadow-docs/knowledge/plan-credential-chain.md
  - 当前结论: planHash = sha256(canon({command, data: norm(planData)}))；norm 剥离 workflow.issuePlan；带 brief 的域以持久化 planHash 为凭证
  - 适用 scope: lib/domains/* 的 plan/execute
- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout JSON 契约不变；nextStep 为稳定英文模板；stderr 人用层
  - 适用 scope: 全 CLI help/stderr/nextStep

## 决策
- **选型:** 分节直通渲染。新增纯函数 `lib/issue-render.mjs`：解析 brief 正文分节，白名单搬运 `## 动机 / ## 引用规范 / ## 决策 / ## 任务`（剔除 `## 结果 / ## 知识评估`），可选 `## 补充`（--body），尾部完整 brief 指针行，正文底部 `<!-- shadow-dev:issue-metadata {...} -->` JSON 注释块（name/type/scope/status/branch/baseBranch/briefPath/cliVersion，预留 prUrl/issueNumber 空值字段）。标题自动补 `[type] ` 前缀（已存在同类前缀则幂等不重复）。
- **理由:** plan 时渲染并快照进 workflow.issuePlan，execute 只 POST 快照、绝不二次渲染——plan→execute 间隔 brief 被改动不撕裂一致性，刷新只需重跑 plan；norm 已剥离 issuePlan，凭证链零改动。缺白名单分节时生成占位提示「（brief 缺少该节）」，保证骨架恒定形状。
- **对比方案:** B 仅字段渲染（只用 frontmatter+复选框）——动机/决策内容丢失，issue 成空壳，否；C 活镜像（状态变化 PATCH 更新 issue）——需 update 通道、凭证边界复杂化、归档真相已在 brief，YAGNI，否（仅在 metadata 预留字段留接口）。
- **入参契约:** --title 选填覆盖（缺省 = [type] 前缀 + brief 首行 H1，无 H1 回落 change name）；--body 语义从「整段正文」改为「## 补充 节内容」；commands.mjs 入参描述与 nextStep 模板同步更新。
- **零 LLM 生成:** renderIssueBody 是纯字符串拼接——直接搬运 brief 中已写好的分节文本，不做任何摘要、改写或 AI 推导步骤。正文的唯一来源是 brief 本身。
- **token 契约（只留摘要，stdout 最小投影）:** 现状 issue.plan stdout ~4.3KB 中，body 出现两份（data.body + nextStep 内嵌全文），且 data 还整段回显 brief/repo（~1.2KB 纯噪音）。改造后 `issue plan` stdout `data` 投影为最小摘要：`{name, title, labels, repository, bodyBytes, bodySha256, sections}`——`bodySha256` 即 execute 所 POST 快照的哈希（「预览即提交」由哈希承担），`sections` 为白名单分节命中清单（缺失节以 `-节名` 标记）。nextStep 收敛为 `issue execute --name {name} --plan-hash {hash} --confirm`。实现走域级输出投影钩子（planDomain 支持 `mod.present?.(x)`，默认恒等，不破坏其他域契约）。全文唯一存放处 = brief `workflow.issuePlan.body`（execute 提交源；需完整预览时直接读 brief）。
- **非目标:** 不回填历史 issue；不改动 x.wuh.site 侧；不引入 issue update/PATCH；其他 plan 域（commit/publish/release 等）的 brief/repo 回显暂不裁剪（投影钩子已就位，可作后续独立变更）。

## 任务
### Phase 1 渲染器
- [x] 新增 renderIssueBody(b, extra)：分节解析 + 白名单搬运 + 缺节占位 + [type] 前缀幂等 + 底部 metadata JSON — `lib/issue-render.mjs`
- [x] 渲染器确定性单测：同输入同输出、缺节占位、前缀幂等、--body 追加节、metadata 字段齐全 — `test/cli.test.mjs`
### Phase 2 域接线
- [x] planData 调渲染器：快照（title/body/labels）写 issuePlan；导出 present(x) 最小投影（去 body/brief/repo，加 bodyBytes/bodySha256/sections）；execute 只读快照 POST（planHash 校验已绑定快照内容） — `lib/domains/issue.mjs`
- [x] planDomain 支持域级输出投影钩子 `mod.present?.(x)`，默认恒等，其余域零变化 — `cli.mjs`
- [x] issue.plan/issue.execute 入参描述与 nextStep 模板更新：nextStep 去除 body 回显，收敛为 --name --plan-hash --confirm — `lib/commands.mjs`
- [x] ISSUE_TITLE_REQUIRED 提示措辞更新（仅 title 与 H1 双缺时触发） — `lib/i18n.mjs`
- [x] 端到端契约测试：apiStub 收到的 body 含分节骨架与 metadata 块且 sha 与 plan 摘要一致；plan stdout 不含 body 全文与 brief/repo 回显；其他域投影零变化；plan 重跑刷新快照 — `test/cli.test.mjs`
### Phase 3 文档
- [x] README 增加 issue 结构契约节（双通道说明 + metadata 字段表 + 示例） — `README.md`

## 结果
- 实际耗时: 约 2.5h（propose→review 当晚完成；跨 3 个并行会话错峰等待约 1 天）
- 验证: TDD 红灯先行确认（模块缺失+3 处契约差异）后全绿；ship worktree 合并态（origin/main@8140eff 基底）`npm test` exit=0（55 CLI + 6 installer）；dogfood 实测 issue.plan stdout 641B（旧 7564B，-92%）；POST 快照 sha 与 plan 摘要逐字节一致由 e2e 钉住。PR #24 merged（10ba1f8）；发布线上 v1.2.0 tag 目标（97f07e9）含本契约（bf5dc16 祖先链验证通过）

## 知识评估
- **预期影响:** 新增 + 更新
- **候选卡片:** 新增 knowledge/issue-body-contract.md（issue 正文双通道契约，入 menu 路由）；更新 cli-output-contract.md 的入参/nextStep 段
- **理由:** issue 正文成为 CLI 与外部消费者（插件、x.wuh.site 类站点）间的稳定数据契约，值得独立成卡；输出面契约同步受影响

## 协调注意
当前工作区存在并行会话 20260917-feature-change-list-archived（未提交，dirty 文件与本变更声明的 README.md/lib/commands.mjs/test/cli.test.mjs 重叠）。apply 前须等其合入或改用独立 worktree，commit 时只 add 本变更文件。

实际经过（2026-09-18 复盘）：先后出现 change-list-archived、install-link-mode、installer-ci-cmd-assert、cli-version 四个并行会话共写本 worktree；等待期凭证链两次拦截漂移（PLAN_HASH_INVALID 按设计生效）。发布阶段用 `git worktree add`（ship/20260917-unified-issue）cherry-pick 出纯净基底后 publish，避免把他人未合并提交带进 PR #24——此「ship worktree」模式应作为共享 checkout 并行的标准应对沉淀为知识。
