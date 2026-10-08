---
{
  "schema": "shadow-dev/v1",
  "name": "20261008-feature-blog-publish-domain",
  "type": "feature",
  "scope": "lib,cli",
  "status": "branched",
  "baseBranch": "main",
  "branch": "feature/20261008-feature-blog-publish-domain",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/commands.mjs",
    "lib/config.mjs",
    "lib/domains/blog.mjs",
    "lib/frontmatter.mjs",
    "lib/i18n.mjs",
    "shadow-docs/changes/20261008-feature-blog-publish-domain/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 41,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/41",
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
    "checkpoint": "issue:41",
    "planHash": "12e47e22114e14d488707e2595bc98dc61291a003d9dae280932be016bb91b76",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] 博客发布域 blog publish——把 blog 仓发布脚本收编进 CLI",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\n博客文章的发布链路（解析 frontmatter → 在 stack-wuh/blog 建 Issue 并附 wuh-site-metadata 注释块 → 调 server 同步接口）目前落在 blog 项目 scripts/publish.ts：依赖 tsx + @octokit/rest + gray-matter 三个运行时包，发布能力割裂在项目仓里。CLI 已有 GitHub API 通道（lib/github.mjs）、五层配置链与 plan/execute 凭证契约，可把该能力整体收编为 blog 域；集成后 blog 仓删除脚本，发布面收敛到 shadow-dev blog publish。\n\n## 引用规范\n- `shadow-docs/knowledge/cli-output-contract.md`\n  - 当前结论: stdout 单行 JSON 契约 + stderr 人用层；命令目录单一事实源\n  - 适用 scope: commands.mjs 注册、HINTS 错误码、nextStep 稳定模板——新域零例外\n- `norms/tdd-verification.md`\n  - 当前结论: L 级完整 TDD 先红后绿；进度可见性条款适用\n  - 适用 scope: 本变更全部实现任务\n\n## 决策\n- **选型:** 新建 `lib/domains/blog.mjs`（blog publish plan/execute，无 brief 域，--plan-hash 为唯一凭证，沿 index rebuild 先例）+ `lib/frontmatter.mjs`（纯函数最小解析器），CLI 保持零运行时依赖\n- **对比方案:** 引入 gray-matter/@octokit 依赖（违背零依赖架构）；blog 仓保留脚本仅做转发（能力仍割裂，删除目标不达成）\n- **理由:** 语料实测 frontmatter 全部为单行 `key: value` + 内联数组，一个百行内解析器即可覆盖；Issue 创建复用 api() 通道（SHADOW_GITHUB_API_URL 天然可 mock），sync 调用用 node:https 直发\n- **解析链:** repository = flag --repository > 项目 config blog.repository > 用户 config > 内置默认 `stack-wuh/blog`；syncUrl = flag --sync-url > env SYNC_URL > cwd/.env > config blog.syncUrl > 默认 `http://localhost:3200`；token = env GITHUB_TOKEN/GH_TOKEN > cwd/.env（与脚本的 .env 兜底一致，secrets 不进配置文件）\n- **错误码:** BLOG_FILE_REQUIRED / BLOG_FILE_NOT_FOUND / BLOG_TITLE_REQUIRED；sync 失败为尽力而为（与脚本语义一致）——落 `data.sync.ok=false`，退出码不变\n- **凭证链:** planData 含文件 sha256，plan 与 execute 之间文章改动 → PLAN_HASH_INVALID 重算拒绝\n- **非 git 可用:** blog 域不要求当前目录在 git 仓库内（发布的是文件不是仓库，沿 workflow/bind 通道），文件路径按 cwd 解析\n\n## 任务\n### Phase 1 — TDD 红灯\n- [ ] blog publish 契约失败测试 — `test/cli.test.mjs` — 八用例先红：plan 预览（title/labels/repo/syncUrl/fileHash）、execute 经 mock API 建 Issue（断言 body 尾部 wuh-site-metadata 注释块与 labels 数组）并触发 sync URL、plan→execute 间文件改动 PLAN_HASH_INVALID、BLOG_FILE_REQUIRED/BLOG_FILE_NOT_FOUND/BLOG_TITLE_REQUIRED 三错误、sync 失败仍 exit 0 且 data.sync.ok=false、项目 config blog.repository/syncUrl 生效且 flag 覆盖、help blog 目录与 stderr 人用层（语言钉死）\n### Phase 2 — 实现转绿\n- [ ] lib/frontmatter.mjs — `lib/frontmatter.mjs` — 围栏识别、单行标量（引号剥离/行尾注释剥离）、内联数组、labels/keywords 逗号串兼容、未知键忽略\n- [ ] lib/domains/blog.mjs — `lib/domains/blog.mjs` — planData/present/execute：解析链、cwd/.env 兜底、Issue 创建、sync POST 尽力而为\n- [ ] 命令注册与配置键 — `cli.mjs`, `lib/commands.mjs`, `lib/i18n.mjs`, `lib/config.mjs` — blog 路由（非 git 可用）、目录两条目与 HELP 派生、三个 HINTS、blog.repository/blog.syncUrl 校验\n### Phase 3 — 文档与自证\n- [ ] README blog 域 — `README.md` — 命令表、配置键面、发布流程与环境变量（替代 pnpm post 的迁移说明）\n- [ ] 自举与端到端自证 — 无 — 本 brief 全程新 CLI 管理；mock 链路下发布端到端绿\n\n完整 brief：shadow-docs/changes/20261008-feature-blog-publish-domain/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261008-feature-blog-publish-domain\",\"type\":\"feature\",\"scope\":\"lib,cli\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261008-feature-blog-publish-domain/brief.md\",\"cliVersion\":\"1.4.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "feature"
      ]
    },
    "release": {
      "files": [
        "README.md",
        "cli.mjs",
        "lib/commands.mjs",
        "lib/config.mjs",
        "lib/domains/blog.mjs",
        "lib/frontmatter.mjs",
        "lib/i18n.mjs",
        "shadow-docs/changes/20261008-feature-blog-publish-domain/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "feat(blog): blog publish 域——frontmatter→Issue→主站同步收编 blog 仓发布脚本,零运行时依赖,plan/execute 凭证链与 flag>env>.env>config 解析链",
      "title": "feat(blog): blog publish 域——收编 blog 仓发布脚本",
      "body": "Closes #41\n\n完整 brief：shadow-docs/changes/20261008-feature-blog-publish-domain/brief.md"
    }
  }
}
---

# 博客发布域 blog publish——把 blog 仓发布脚本收编进 CLI

## 动机
博客文章的发布链路（解析 frontmatter → 在 stack-wuh/blog 建 Issue 并附 wuh-site-metadata 注释块 → 调 server 同步接口）目前落在 blog 项目 scripts/publish.ts：依赖 tsx + @octokit/rest + gray-matter 三个运行时包，发布能力割裂在项目仓里。CLI 已有 GitHub API 通道（lib/github.mjs）、五层配置链与 plan/execute 凭证契约，可把该能力整体收编为 blog 域；集成后 blog 仓删除脚本，发布面收敛到 shadow-dev blog publish。

## 引用规范
- `shadow-docs/knowledge/cli-output-contract.md`
  - 当前结论: stdout 单行 JSON 契约 + stderr 人用层；命令目录单一事实源
  - 适用 scope: commands.mjs 注册、HINTS 错误码、nextStep 稳定模板——新域零例外
- `norms/tdd-verification.md`
  - 当前结论: L 级完整 TDD 先红后绿；进度可见性条款适用
  - 适用 scope: 本变更全部实现任务

## 决策
- **选型:** 新建 `lib/domains/blog.mjs`（blog publish plan/execute，无 brief 域，--plan-hash 为唯一凭证，沿 index rebuild 先例）+ `lib/frontmatter.mjs`（纯函数最小解析器），CLI 保持零运行时依赖
- **对比方案:** 引入 gray-matter/@octokit 依赖（违背零依赖架构）；blog 仓保留脚本仅做转发（能力仍割裂，删除目标不达成）
- **理由:** 语料实测 frontmatter 全部为单行 `key: value` + 内联数组，一个百行内解析器即可覆盖；Issue 创建复用 api() 通道（SHADOW_GITHUB_API_URL 天然可 mock），sync 调用用 node:https 直发
- **解析链:** repository = flag --repository > 项目 config blog.repository > 用户 config > 内置默认 `stack-wuh/blog`；syncUrl = flag --sync-url > env SYNC_URL > cwd/.env > config blog.syncUrl > 默认 `http://localhost:3200`；token = env GITHUB_TOKEN/GH_TOKEN > cwd/.env（与脚本的 .env 兜底一致，secrets 不进配置文件）
- **错误码:** BLOG_FILE_REQUIRED / BLOG_FILE_NOT_FOUND / BLOG_TITLE_REQUIRED；sync 失败为尽力而为（与脚本语义一致）——落 `data.sync.ok=false`，退出码不变
- **凭证链:** planData 含文件 sha256，plan 与 execute 之间文章改动 → PLAN_HASH_INVALID 重算拒绝
- **非 git 可用:** blog 域不要求当前目录在 git 仓库内（发布的是文件不是仓库，沿 workflow/bind 通道），文件路径按 cwd 解析

## 任务
### Phase 1 — TDD 红灯
- [x] blog publish 契约失败测试 — `test/cli.test.mjs` — 八用例先红：plan 预览（title/labels/repo/syncUrl/fileHash）、execute 经 mock API 建 Issue（断言 body 尾部 wuh-site-metadata 注释块与 labels 数组）并触发 sync URL、plan→execute 间文件改动 PLAN_HASH_INVALID、BLOG_FILE_REQUIRED/BLOG_FILE_NOT_FOUND/BLOG_TITLE_REQUIRED 三错误、sync 失败仍 exit 0 且 data.sync.ok=false、项目 config blog.repository/syncUrl 生效且 flag 覆盖、help blog 目录与 stderr 人用层（语言钉死）
### Phase 2 — 实现转绿
- [x] lib/frontmatter.mjs — `lib/frontmatter.mjs` — 围栏识别、单行标量（引号剥离/行尾注释剥离）、内联数组、labels/keywords 逗号串兼容、未知键忽略
- [x] lib/domains/blog.mjs — `lib/domains/blog.mjs` — planData/present/execute：解析链、cwd/.env 兜底、Issue 创建、sync POST 尽力而为
- [x] 命令注册与配置键 — `cli.mjs`, `lib/commands.mjs`, `lib/i18n.mjs`, `lib/config.mjs` — blog 路由（非 git 可用）、目录两条目与 HELP 派生、三个 HINTS、blog.repository/blog.syncUrl 校验
### Phase 3 — 文档与自证
- [x] README blog 域 — `README.md` — 命令表、配置键面、发布流程与环境变量（替代 pnpm post 的迁移说明）
- [x] 自举与端到端自证 — 无 — 本 brief 全程新 CLI 管理；mock 链路下发布端到端绿

## 补充
集成完成后 blog 仓删除 scripts/publish.ts、pnpm post 入口、@octokit/rest/gray-matter/tsx 依赖并改 README 发布说明指向 shadow-dev blog publish——该清理走 blog 仓自己的 PR，不占本仓文件面。
