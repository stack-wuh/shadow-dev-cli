---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-feature-human-cli-ux",
  "type": "feature",
  "scope": "cli.mjs,lib",
  "status": "branched",
  "baseBranch": "main",
  "branch": "feature/20260917-feature-human-cli-ux",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/args.mjs",
    "lib/commands.mjs",
    "lib/human.mjs",
    "lib/i18n.mjs",
    "lib/input.mjs",
    "lib/output.mjs",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 2,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/2",
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
    "checkpoint": "issue:2",
    "planHash": "b250a3afca93dcad9c17e89b1aaaabd87f752dffa441a95a5cd9e3f4dd47c519",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "人用输出层：进出场提示、入参提示、结构化 help 与 zh/en 切换",
      "body": "在不改动 stdout JSON 契约的前提下为 CLI 增加人用输出层：stderr 渲染进出场横幅、入参示例、错误本地化解释与 help 人读版；语言按 --lang > SHADOW_DEV_LANG > locale > zh 解析，SHADOW_DEV_QUIET 可关；nextStep 以稳定 key 写入 JSON 供 agent 消费。依赖 20260917-refactor-compat-and-domain-convergence 的 Phase 2。详见 shadow-docs/changes/20260917-feature-human-cli-ux/brief.md",
      "labels": [
        "feature"
      ]
    }
  }
}
---

# 人用输出层：进出场提示、入参提示、结构化 help 与 zh/en 切换

## 动机

CLI 当前是纯机器契约界面：无进出场反馈（44 秒的 release 全程静默）、help 是一行命令串、漏参只回 `NAME_REQUIRED` 不提示怎么传、无任何中文层。目标是在**零破坏 stdout JSON 契约**的前提下补上人用体验层。本变更依赖 `20260917-refactor-compat-and-domain-convergence` 的 Phase 2（错误构造统一 `err(code, {status})`、路由领域钩子），apply 顺序为先完成该变更 Phase 1/2。

## 引用规范

- norms/code-style.md（通用规范）
  - 当前结论: 渐进式治理，一次变更只做直接相关的事；公共能力从稳定公开入口导出；不顺手重写无关代码。
  - 适用 scope: `cli.mjs`、`lib/`
- 架构决策（本 brief 确立，待沉淀卡片）
  - 当前结论: stdout 为纯 JSON 机器契约，人类可读输出一律走 stderr；错误 code 不本地化，仅提示文案本地化。
  - 适用 scope: 全仓

## 决策

- **选型:** 方案 A——stderr 人用提示层。语言解析 `--lang zh|en` > `SHADOW_DEV_LANG` > 系统 locale 自动探测 > 默认 zh；提示可经 `SHADOW_DEV_QUIET=1` 关闭。下一步建议同时以 `data.nextStep`（稳定 key）additive 写入 JSON，agent 消费者白赚引导。
- **对比方案:** 方案 B（TTY 探测双模式）使输出依赖运行环境，违背 deterministic 定位，且 agent harness 偶发 PTY 会撕裂契约；方案 C（JSON message 本地化）污染契约流，威胁 review gate 等文本匹配。均否。
- **理由:** 双受众分层是本工具的根设计：机器读 stdout、人读 stderr，两渠道内容同源（命令目录驱动），无双份事实。help JSON 保持向后兼容（保留原字符串字段，新增结构化 commands）。颜色、TTY 适配为非目标。

## 任务

### Phase 1 — 事实源与语言基础（依赖 refactor Phase 2 完成）

- [x] 命令目录 `lib/commands.mjs`：13 个命令组的 usage/参数(名称/必填/说明)/示例/nextStep 结构化定义，HELP 字符串由目录派生 —— `lib/commands.mjs` `lib/args.mjs`
- [x] i18n 词典 `lib/i18n.mjs`：zh/en 消息集 + 语言解析链（--lang > SHADOW_DEV_LANG > locale > zh），非法 --lang 报 usage 提示 —— `lib/i18n.mjs` `lib/args.mjs`

### Phase 2 — 人用层渲染与接线

- [x] `lib/human.mjs`：stderr 渲染器——进场横幅（命令+关键参数）、收场（✅ 结果摘要+耗时）、错误（code 本地化解释+该命令 usage 示例，参数表从命令目录派生）、`SHADOW_DEV_QUIET` 抑制 —— `lib/human.mjs`
- [x] `cli.mjs` 接线：handle 出口统一挂进出场/错误渲染；成功结果按目录追加 `data.nextStep`（含参数化建议，如 approve 后提示 `branch plan --name <n>`） —— `cli.mjs` `lib/output.mjs`
- [x] help 升级：`help` 返回保留旧字符串字段并新增结构化 commands；`help <command>` 单命令详情（stdout JSON、stderr 人读版） —— `cli.mjs` `lib/commands.mjs`
- [x] 漏参提示：全部验证错误（NAME_REQUIRED/CONFIRMATION_REQUIRED/PLAN_HASH_*/BRIEF_NOT_FOUND 等）的人用输出附带期望参数与示例 —— `lib/input.mjs` `lib/human.mjs`

### Phase 3 — 回归与文档

- [x] 契约测试：同命令在 `--lang zh`/`--lang en`/无 lang 下 stdout JSON 逐字节一致（nextStep 为稳定 key 非译文）；stderr 含对应语言提示；`SHADOW_DEV_QUIET=1` 时 stderr 无输出；help 子命令断言 —— `test/cli.test.mjs`
- [x] README：语言切换配置、stderr 人用层与 nextStep 说明、help 示例（与 refactor 变更的退出码表合流成稿） —— `README.md`

## 结果

- 实际耗时: 约 35 分钟
- 验证: `node --test` 45/45 通过（38 存量契约 + 7 新增人用层契约：语言无关 stdout 逐字节断言、stderr 提示、nextStep 稳定 key、结构化 help、QUIET 抑制、INVALID_LANG）；全模块 `node --check` 通过；期间发现并修复消息富化误伤 CONFIRMATION_REQUIRED/PLAN_HASH_REQUIRED 退出码 2 的回归（新契约测试当场捕获）。

## 知识评估

- **预期影响:** 新增
- **候选卡片:** shadow-docs/knowledge/cli-output-contract.md（domain: cli-infrastructure，scope: cli.mjs, lib/output.mjs, lib/human.mjs）
- **理由:** 「stdout 纯 JSON、人用输出走 stderr、code 不本地化」是分层根决策，后续任何输出面改动都必须遵守，属非显然约束，需沉淀防回归。
