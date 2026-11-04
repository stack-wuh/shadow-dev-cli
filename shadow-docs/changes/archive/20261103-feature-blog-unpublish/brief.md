---
{
  "schema": "shadow-dev/v1",
  "name": "20261103-feature-blog-unpublish",
  "type": "feature",
  "scope": "lib,test",
  "status": "archived",
  "baseBranch": "main",
  "branch": "feature/20261103-feature-blog-unpublish",
  "files": [
    "cli.mjs",
    "lib/commands.mjs",
    "lib/domains/blog.mjs",
    "test/blog-unpublish.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 75,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/75",
    "pullRequest": 76,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/76"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "2866c662e7499c56f0a40c889f1c92a5571bd9fe",
    "verifiedAt": "2026-11-04T00:21:52.277Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:76",
    "planHash": "96c3c620f096ddeb86189ca5ed06374466d290883c06a8d0fcc2acbe0fa11dc1",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] blog unpublish：下架命令 + 发布重新上架语义",
      "titleRaw": "blog unpublish：下架命令 + 发布重新上架语义",
      "supplement": "发布生命周期止步于 create/update。GitHub Issues 无删除，close 即下架（server 已同步 state，站点过滤 open）。本变更新增 blog unpublish（PATCH state=closed + sync ping，stdout 契约加 state）并让 publish update 路径补 state=open（重新发布=重新上架）；详见 shadow-docs/changes/20261103-feature-blog-unpublish/brief.md",
      "body": "## 动机\n发布链生命周期止步于 create/update：desktop 无法下架已发布文章。GitHub Issues API 无删除，**close 即下架**——server `syncIssue` 已同步 `state` 进 DB，站点内容全量过滤 `state: 'open'`（content-api 卡片既定语义），close 后站点即不可见、DB 保留对账。desktop 端（companion：wuh.site.desktop `20261103-feature-doc-unpublish`）需要 CLI 提供下架能力以保持发布通道统一。\n\n语义补充：`blog publish` 的 update 路径 PATCH 载荷补 `state: 'open'`——重新发布即重新上架（对 open issue 幂等 no-op，语义自然）。\n\n## 引用规范\n- shadow-docs/knowledge/plan-credential-chain.md\n  - 当前结论: 无 brief 域以 `--plan-hash` 为唯一凭证；planData 语义输入参与 planHash\n  - 适用 scope: lib/domains/blog.mjs\n  - 遵循方式: unpublish 的 planData（file/issue 号/repository/syncUrl）同链处理\n- shadow-docs/knowledge/cli-output-contract.md\n  - 当前结论: 命令目录 lib/commands.mjs 是 HELP/help JSON/nextStep 单一事实源；stdout JSON 是公开 API 需测试钉住；语言不变性由契约测试保护\n  - 适用 scope: lib/commands.mjs, lib/domains/blog.mjs, test/\n  - 遵循方式: `blog unpublish plan|execute` 目录条目 + 帮助文案（写明 close=下架）；state 字段进契约并用例钉住\n\n## 决策\n- **选型:** CLI 新增 `blog unpublish`（下架）+ publish update 补 `state:'open'`（重新上架）；desktop 经 CLI 调用（companion 变更），保持发布/下架通道统一。\n- **对比方案:** ①desktop 内置 Octokit 直 PATCH——用户已裁定通道统一 CLI，否决（desktop 侧仅保留 CLI 不可用时的降级，与本仓无关）；②独立 `blog delete` 命令——GitHub API 无删除，close 即终态，命名 delete 误导，否决。\n- **理由:** 下架与发布共用文件身份（frontmatter issue 号）、凭证链、planHash 凭证与 sync 语义，收口在同一命令域成本最低且可脚本化。\n\n## 任务\n### Phase 1\n- [ ] task 1 — `cli.mjs` + `lib/domains/blog.mjs` — blog 域二级词分流支持 unpublish（mod 解析按 verb 选择 planData/execute）+ unpublish planData（file 必需、issue 号必需 BLOG_ISSUE_REQUIRED、title 不必需、repository/syncUrl 同链）— 实现（INV-1）\n- [ ] task 2 — `lib/commands.mjs` — `blog unpublish plan|execute` 命令目录条目 + 帮助文案（close=下架语义）— 登记\n### Phase 2\n- [ ] task 3 — `lib/domains/blog.mjs` — unpublish execute（PATCH `{state:'closed'}` + sync ping + state 契约）+ publish update 载荷补 `state:'open'` — 实现（INV-2/INV-3/INV-4）\n- [ ] task 4 — `test/blog-unpublish.test.mjs` — 分流路由/无号拒绝/PATCH 载荷断言/state 契约/update 补 open/create 不变/zh-en 不变性 — 断言\n### Phase 3\n- [ ] task 5 — 版本 bump（随下个发版轨）— package.json — release\n\n## 补充\n发布生命周期止步于 create/update。GitHub Issues 无删除，close 即下架（server 已同步 state，站点过滤 open）。本变更新增 blog unpublish（PATCH state=closed + sync ping，stdout 契约加 state）并让 publish update 路径补 state=open（重新发布=重新上架）；详见 shadow-docs/changes/20261103-feature-blog-unpublish/brief.md\n\n完整 brief：shadow-docs/changes/20261103-feature-blog-unpublish/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261103-feature-blog-unpublish\",\"type\":\"feature\",\"scope\":\"lib,test\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261103-feature-blog-unpublish/brief.md\",\"cliVersion\":\"1.4.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "feature"
      ]
    },
    "commit": {
      "files": [
        "cli.mjs",
        "lib/commands.mjs",
        "lib/domains/blog.mjs",
        "package.json",
        "test/blog-unpublish.test.mjs"
      ],
      "message": "feat(blog): blog unpublish 下架命令 + 发布重新上架语义 (#75)\n\n- 新增 blog unpublish plan|execute：frontmatter issue 号必需（BLOG_ISSUE_REQUIRED）、title 非必需，PATCH 载荷只含 state=closed + sync ping，结果契约 {state, sync}\n- blog publish update 路径 PATCH 补 state:open（重新发布=重新上架，幂等）；create 不带 state\n- cli.mjs blog 二级词分流 + 命令目录 + 帮助文案；package.json 挂载两个 blog 测试文件"
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/cli-output-contract.md",
    "reason": "blog unpublish 命令目录与 stdout state 契约已由 test/blog-unpublish.test.mjs 钉住并随 v1.9.0 发版"
  }
}
---

# blog unpublish：下架命令 + 发布重新上架语义

## 动机

发布链生命周期止步于 create/update：desktop 无法下架已发布文章。GitHub Issues API 无删除，**close 即下架**——server `syncIssue` 已同步 `state` 进 DB，站点内容全量过滤 `state: 'open'`（content-api 卡片既定语义），close 后站点即不可见、DB 保留对账。desktop 端（companion：wuh.site.desktop `20261103-feature-doc-unpublish`）需要 CLI 提供下架能力以保持发布通道统一。

语义补充：`blog publish` 的 update 路径 PATCH 载荷补 `state: 'open'`——重新发布即重新上架（对 open issue 幂等 no-op，语义自然）。

## 复杂度评级

- **评级:** L
- **理由:** ①契约变更——命令目录新增二级词 `blog unpublish`（公开 API，lib/commands.mjs 单一事实源）+ stdout 契约新增 `state` 字段 + publish update 请求载荷语义变更；②命令域行为（PATCH state 外向副作用）；③闭/开状态写错直接影响线上可见性。
- **期望验证深度:** unit
- **取证策略:** assert-first（分流路由、无号拒绝、PATCH 载荷断言、state 契约、sync ping）

## 引用规范

- shadow-docs/knowledge/plan-credential-chain.md
  - 当前结论: 无 brief 域以 `--plan-hash` 为唯一凭证；planData 语义输入参与 planHash
  - 适用 scope: lib/domains/blog.mjs
  - 遵循方式: unpublish 的 planData（file/issue 号/repository/syncUrl）同链处理
- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: 命令目录 lib/commands.mjs 是 HELP/help JSON/nextStep 单一事实源；stdout JSON 是公开 API 需测试钉住；语言不变性由契约测试保护
  - 适用 scope: lib/commands.mjs, lib/domains/blog.mjs, test/
  - 遵循方式: `blog unpublish plan|execute` 目录条目 + 帮助文案（写明 close=下架）；state 字段进契约并用例钉住

## 领域模型

- **限界上下文:** blog 发布生命周期（CLI 域）——create/update/unpublish(reopen 归 publish)。反腐边界：不改 sync webhook、不改 server。
- **统一语言增量:** 下架（unpublish）= PATCH issue state=closed + sync ping；重新上架（republish）= publish update 路径携带 state:open。
- **聚合与不变量:**
  - **INV-1** `blog unpublish` frontmatter 无 `issue` 号 → plan 阶段 `BLOG_ISSUE_REQUIRED` 拒绝，不产生外向请求（拒绝路径）
  - **INV-2** unpublish execute 必须 `PATCH /issues/{n}` 且载荷为 `{state:'closed'}`（不含 title/body/labels），并 ping 同步端点刷新 DB
  - **INV-3** `blog publish` update 路径（frontmatter 有号）PATCH 载荷含 `state:'open'`；create 路径载荷不变（GitHub 默认 open）
  - **INV-4** unpublish 结果契约 `{repository, issue:{number,url}, state:'closed', sync}`；planHash 链与 publish 同规（执行间文件变化拒绝）
- **领域事件:** 无新事件面；sync ping 复用既有 best-effort 语义。

## 决策

- **选型:** CLI 新增 `blog unpublish`（下架）+ publish update 补 `state:'open'`（重新上架）；desktop 经 CLI 调用（companion 变更），保持发布/下架通道统一。
- **对比方案:** ①desktop 内置 Octokit 直 PATCH——用户已裁定通道统一 CLI，否决（desktop 侧仅保留 CLI 不可用时的降级，与本仓无关）；②独立 `blog delete` 命令——GitHub API 无删除，close 即终态，命名 delete 误导，否决。
- **理由:** 下架与发布共用文件身份（frontmatter issue 号）、凭证链、planHash 凭证与 sync 语义，收口在同一命令域成本最低且可脚本化。

## 任务

### Phase 1
- [x] task 1 — `cli.mjs` + `lib/domains/blog.mjs` — blog 域二级词分流支持 unpublish（mod 解析按 verb 选择 planData/execute）+ unpublish planData（file 必需、issue 号必需 BLOG_ISSUE_REQUIRED、title 不必需、repository/syncUrl 同链）— 实现（INV-1）
- [x] task 2 — `lib/commands.mjs` — `blog unpublish plan|execute` 命令目录条目 + 帮助文案（close=下架语义）— 登记
### Phase 2
- [x] task 3 — `lib/domains/blog.mjs` — unpublish execute（PATCH `{state:'closed'}` + sync ping + state 契约）+ publish update 载荷补 `state:'open'` — 实现（INV-2/INV-3/INV-4）
- [x] task 4 — `test/blog-unpublish.test.mjs` — 分流路由/无号拒绝/PATCH 载荷断言/state 契约/update 补 open/create 不变/zh-en 不变性 — 断言
### Phase 3
- [x] task 5 — 版本 bump（随下个发版轨）— package.json — release

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** 倾向新增 `shadow-docs/knowledge/blog-publish-upsert.md`（或与 20261018-feature-blog-publish-upsert 合并定名 blog-publish-domain：upsert + unpublish + reopen 全生命周期契约）
- **理由:** CLI blog 域自此为完整生命周期面（create/update/unpublish/reopen），desktop 与脚本调用方共用该契约，值得单卡沉淀
