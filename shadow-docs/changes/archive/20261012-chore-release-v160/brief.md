---
{
  "schema": "shadow-dev/v1",
  "name": "20261012-chore-release-v160",
  "type": "chore",
  "scope": "distribution",
  "status": "archived",
  "baseBranch": "main",
  "branch": "chore/20261012-chore-release-v160",
  "files": [
    "README.md",
    "package.json",
    "shadow-docs/changes/20261012-chore-release-v160/brief.md"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 60,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/60",
    "pullRequest": 61,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/61"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "26e3c90eb839bd354a1b833e42ed0e67944b6bbf",
    "verifiedAt": "2026-10-12T11:11:11.287Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:61",
    "planHash": "679e8f1e577a8426b2ea15afc0dd52c2d2b3132d2de1612f4bd10918de6fe774",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[chore] 发版载体 v1.6.0：把 PR 必填门与 5 项已合并能力交付出去",
      "titleRaw": "[chore] 发版载体 v1.6.0：把 PR 必填门与 5 项已合并能力交付出去",
      "supplement": "",
      "body": "## 动机\nv1.5.0（2026-10-09 发版）之后 main 已累积 8 个提交，含一处对调用方可见的行为收紧（`release/publish plan` 的 `--title`/`--body` 必填 + 新增 `--body-file`）、`change amend` 扩面登记、`pr inspect` 回查回填、worktree 回收与 planHash 稳定性修复。这些能力目前只存在于源码轨，走 release 轨安装的用户拿不到；插件侧 `norms/pr-message.md` 已按新门写规范，pin 也必须随这次发版才能对齐。\n\n## 引用规范\n（brief 缺少该节）\n\n## 决策\n- 版本号 **1.6.0**（minor）：含 `feat(change)` 与一处收紧既有调用契约的行为变化，未到 major；`major` 留给命令面重构。\n- 只 bump `package.json` 的 `version`。本仓无宿主清单，插件侧 `cliVersion` pin 属能力契约，由 shadow-dev-workflow 的独立 change 在本次 tag/Release 完成后对齐，不与发版载体混交。\n- tag 与 GitHub Release 由用户执行（本 CLI 尚无发版命令键，见插件 `shadow-dev-publish` SKILL §5 的委托清单），本 change 只把 bump 落进 main。\n\n## 任务\n- [ ] task-1 — `package.json` — version 1.5.0 → 1.6.0，单文件改动\n- [ ] task-2 — `README.md` — 复核示例与新门一致（`--body-file` 已补），不改行为\n\n完整 brief：shadow-docs/changes/20261012-chore-release-v160/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261012-chore-release-v160\",\"type\":\"chore\",\"scope\":\"distribution\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261012-chore-release-v160/brief.md\",\"cliVersion\":\"1.5.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "chore"
      ]
    },
    "release": {
      "files": [
        "README.md",
        "package.json",
        "shadow-docs/changes/20261012-chore-release-v160/brief.md"
      ],
      "message": "chore(release): v1.6.0 版本号与安装链接 bump（PR 必填门 + 5 项已合并能力）",
      "title": "chore(release): v1.6.0 版本号与安装链接 bump（PR 必填门 + 5 项已合并能力）",
      "body": "## 变更\n- `package.json`：`version` 1.5.0 → 1.6.0（v1.5.0 之后 main 已累积 8 个提交，其中含对调用方可见的行为收紧与新能力）。\n- `README.md`：bootstrap 安装 URL 的版本引用同步为 `/v1.6.0/`（安装文档必须指向将要存在的 tag，先合并后打 tag 的既有时序）。\n- brief：发版载体自身的动机、覆盖范围、决策与结果段。\n\n## 影响\n- 行为/触发面变化：走 release 轨安装的用户这次能拿到 `release/publish plan` 的标题与正文必填门、`--body-file`、`change amend` 扩面登记、`pr inspect` 按分支回查回填、worktree 未提交 brief 搬运、planHash 只认参数内容。\n- 明确不受影响的命令面与契约：本 change 零代码改动，只 bump 版本与安装链接；`commands.mjs` 命令键集合不变 → 插件 `requiresCommands` 判定结果不变。\n- 回滚方式：tag 未打之前，revert 这两个文件即可；tag 已打则按 `shadow-dev-workflow` 的产物回滚轨退回上一版本目录（CURRENT/PREVIOUS 指针语义）。\n- pin 不在本 PR：插件侧 `cliVersion` 属能力契约，须等本次 tag/Release 完成后再由 shadow-dev-workflow 的独立 change 对齐，不与发版载体混交。\n\n## 验证\n- 命令与结果：`git diff --stat` 仅 `package.json` 与 `README.md` 各一行 + brief；`git show HEAD:package.json` 解析出 `1.6.0`；README 全文再无 `v1.5.0` 残留。\n- 覆盖范围核对：`shadow-dev change list` 实取 v1.5.0 之后落进 main 的 change（`#49` `#50` `#51` `#53` `#54` `#56`），逐条判定为对外内容变更；纯 `shadow-docs/` 归档提交与载体自身跳过并写明理由。\n- 未覆盖项（明说）：tag、GitHub Release 与 Actions 发布链不在本 PR 内——本 CLI 尚无发版命令键，按插件 `shadow-dev-publish` SKILL §5 由用户执行委托清单，结果回传后回填「结果」段。\n\n## 关联\n- Closes #60\n- brief: shadow-docs/changes/20261012-chore-release-v160/brief.md"
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": "knowledge/release-artifact-pipeline.md",
    "reason": "常规 minor 发版载体，资产名契约与冒烟语义未变，安装 URL 随版本 bump 属既有同源要求"
  }
}
---

# 20261012-chore-release-v160

## 动机

v1.5.0（2026-10-09 发版）之后 main 已累积 8 个提交，含一处对调用方可见的行为收紧（`release/publish plan` 的 `--title`/`--body` 必填 + 新增 `--body-file`）、`change amend` 扩面登记、`pr inspect` 回查回填、worktree 回收与 planHash 稳定性修复。这些能力目前只存在于源码轨，走 release 轨安装的用户拿不到；插件侧 `norms/pr-message.md` 已按新门写规范，pin 也必须随这次发版才能对齐。

## 覆盖范围

本次对外交付的已合并/待合并 change：

- `20261012-fix-pr-params-required`（PR #56，已合并 `c00f030`）：PR 标题与正文必填，禁止 CLI 编造。
- `20261012-chore-gen-pr-template`（PR #58）：`scripts/gen-pr-template.mjs` 落进本仓。
- 已在 v1.5.0 之后合并的 `#49` `#50` `#51` `#53` `#54`：`pr inspect` 回填、`change amend`、worktree 未提交 brief 搬运、planHash 只认参数内容。
- 跳过项：纯 `shadow-docs/` 的归档提交与本次载体自身（无对外内容变更）。

## 决策

- 版本号 **1.6.0**（minor）：含 `feat(change)` 与一处收紧既有调用契约的行为变化，未到 major；`major` 留给命令面重构。
- 只 bump `package.json` 的 `version`。本仓无宿主清单，插件侧 `cliVersion` pin 属能力契约，由 shadow-dev-workflow 的独立 change 在本次 tag/Release 完成后对齐，不与发版载体混交。
- tag 与 GitHub Release 由用户执行（本 CLI 尚无发版命令键，见插件 `shadow-dev-publish` SKILL §5 的委托清单），本 change 只把 bump 落进 main。

## 任务

- [x] task-1 — `package.json` — version 1.5.0 → 1.6.0，单文件改动
- [x] task-2 — `README.md` — 复核示例与新门一致（`--body-file` 已补），不改行为

## 结果

**复杂度评级：S**（单文件声明式 bump）。验证 = 执行结构 + 引用残留扫描 + 版本一致性观察点。

- 版本一致：`package.json.version = 1.6.0`。README **确实硬编码了版本引用**（bootstrap 安装 URL 指向 `…/shadow-dev-cli/v1.5.0/scripts/bootstrap.sh`），已随本次 bump 同步到 `/v1.6.0/`；该链接在 tag 打出来之前会 404，属发版载体的既有时序（先合并后打 tag）。
- 覆盖范围核对：`shadow-dev change list` 实测 v1.5.0 之后落进 main 的 change 为 `#49` `#50` `#51` `#53` `#54` 与本次的 `#56`；发版载体自身与纯 `shadow-docs/` 归档提交不属对外内容，已在「覆盖范围」写明跳过理由。
- tag 与 Release 不在本 change 的盘内动作里：本 CLI 尚无发版命令键，按 `shadow-dev-publish` SKILL §5 输出委托清单交用户执行，执行结果（tag、run 链接、Release URL、冒烟输出）在此回填。

待回填：PR 链接、tag/Release 委托结果。
