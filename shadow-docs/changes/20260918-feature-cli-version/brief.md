---
{
  "schema": "shadow-dev/v1",
  "name": "20260918-feature-cli-version",
  "type": "feature",
  "scope": "cli",
  "status": "published",
  "baseBranch": "main",
  "branch": "feature/20260918-feature-cli-version",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/args.mjs",
    "lib/commands.mjs",
    "lib/human.mjs",
    "lib/i18n.mjs",
    "lib/version.mjs",
    "package.json",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 27,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/27",
    "pullRequest": 28,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/28"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "c32f32ad373ae449b29d55d10e4bf655c6379bac",
    "verifiedAt": "2026-09-18T03:40:27.336Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "pr:28",
    "planHash": "e91178e0aff22b5c13aa226a7ef74bdf6e1e1797baef91d512d5c44bdb7c645c",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] CLI version 命令——运行时版本自检",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\n插件侧 bootstrap 以 package.json cliVersion + CURRENT 指针锁定安装版本，但「当前跑的是哪个 CLI」在 CLI 本身无自证手段：agent 排障、双仓开发（link 轨）都只能翻指针文件确认。version 与 help 同属不依赖仓库的元命令，应补齐。\n\n## 引用规范\n- cli-output-contract：新增输出必须二选一（stdout JSON 契约 / stderr 人用层）；COMMANDS 目录是 HELP、help JSON、人用提示的单一事实源。\n- install-distribution：LINK → CURRENT 双轨指针解析——version 只做展示，不参与指针逻辑。\n\n## 决策\n- COMMANDS 新增平铺目录条目 `version`（usage `version`，任意目录可用；HELP 派生加单段 key 守卫，保持既有 `domain.action` 分组行格式不变）。\n- 入口在 helpMode 之前拦截 versionMode：`shadow-dev version` 与 `--version` 皆命中，不要求 git 仓库，输出 `{\"ok\":true,\"command\":\"version\",\"data\":{\"version\":...}}`。\n- 版本号运行时读同源 package.json（复用 issue-render 的 `readFileSync(new URL('../package.json', import.meta.url))` 形态），零漂移，无编译期注入。\n- 人用层向 stderr 输出版本行（语言随 --lang，stdout JSON 与语言无关）。`--version` 在 args 白名单登记为无值布尔。\n- 版本 bump 1.2.0→1.3.0 随本变更提交；合入后 tag v1.3.0、pack.mjs 产物上 GitHub Release。\n\n## 任务\n- [ ] lib/version.mjs + COMMANDS 登记与 HELP 派生守卫 — lib/version.mjs,lib/commands.mjs — 目录单源\n- [ ] 入口 versionMode 拦截与参数/输出层接入 — cli.mjs,lib/args.mjs,lib/i18n.mjs,lib/human.mjs — 任意目录可用\n- [ ] 契约测试：JSON 形态、flag 别名、仓库内外、HELP 行与语言不变性 — test/cli.test.mjs — 钉死契约\n- [ ] README 命令表与 package.json 版本 1.3.0 — README.md,package.json — 文档随代码\n\n完整 brief：shadow-docs/changes/20260918-feature-cli-version/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20260918-feature-cli-version\",\"type\":\"feature\",\"scope\":\"cli\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20260918-feature-cli-version/brief.md\",\"cliVersion\":\"1.2.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "feature"
      ]
    },
    "release": {
      "files": [
        "README.md",
        "cli.mjs",
        "lib/args.mjs",
        "lib/commands.mjs",
        "lib/human.mjs",
        "lib/i18n.mjs",
        "lib/version.mjs",
        "package.json",
        "shadow-docs/changes/20260918-feature-cli-version/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "feat(cli): version command for runtime self-check - catalog entry first HELP row, entry intercept before root, package.json is the version source (v1.3.0)",
      "title": "feat(cli): version command (v1.3.0)",
      "body": ""
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": null,
    "reason": "版本事实由 README/help/COMMANDS 目录承载，不构成独立执行约束"
  }
}
---

# CLI version 命令——运行时版本自检

## 动机

插件侧 bootstrap 以 package.json cliVersion + CURRENT 指针锁定安装版本，但「当前跑的是哪个 CLI」在 CLI 本身无自证手段：agent 排障、双仓开发（link 轨）都只能翻指针文件确认。version 与 help 同属不依赖仓库的元命令，应补齐。

## 引用规范

- cli-output-contract：新增输出必须二选一（stdout JSON 契约 / stderr 人用层）；COMMANDS 目录是 HELP、help JSON、人用提示的单一事实源。
- install-distribution：LINK → CURRENT 双轨指针解析——version 只做展示，不参与指针逻辑。

## 决策

- COMMANDS 新增平铺目录条目 `version`（usage `version`，任意目录可用；HELP 派生加单段 key 守卫，保持既有 `domain.action` 分组行格式不变）。
- 入口在 helpMode 之前拦截 versionMode：`shadow-dev version` 与 `--version` 皆命中，不要求 git 仓库，输出 `{"ok":true,"command":"version","data":{"version":...}}`。
- 版本号运行时读同源 package.json（复用 issue-render 的 `readFileSync(new URL('../package.json', import.meta.url))` 形态），零漂移，无编译期注入。
- 人用层向 stderr 输出版本行（语言随 --lang，stdout JSON 与语言无关）。`--version` 在 args 白名单登记为无值布尔。
- 版本 bump 1.2.0→1.3.0 随本变更提交；合入后 tag v1.3.0、pack.mjs 产物上 GitHub Release。

## 任务

- [x] lib/version.mjs + COMMANDS 登记与 HELP 派生守卫 — lib/version.mjs,lib/commands.mjs — 目录单源
- [x] 入口 versionMode 拦截与参数/输出层接入 — cli.mjs,lib/args.mjs,lib/i18n.mjs,lib/human.mjs — 任意目录可用
- [x] 契约测试：JSON 形态、flag 别名、仓库内外、HELP 行与语言不变性 — test/cli.test.mjs — 钉死契约
- [x] README 命令表与 package.json 版本 1.3.0 — README.md,package.json — 文档随代码
