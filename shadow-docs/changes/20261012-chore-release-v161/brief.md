---
{
  "schema": "shadow-dev/v1",
  "name": "20261012-chore-release-v161",
  "type": "chore",
  "scope": "distribution",
  "status": "published",
  "baseBranch": "main",
  "branch": "chore/20261012-chore-release-v161",
  "files": [
    "README.md",
    "package.json",
    "shadow-docs/changes/20261012-chore-release-v161/brief.md"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 68,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/68",
    "pullRequest": 69,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/69"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "2a066cbe5302fc60995b7e6058db3792d01f8e54",
    "verifiedAt": "2026-10-12T12:36:23.430Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "pr:69",
    "planHash": "b19e4aa825f8b9396d4225a839ae27d7f9f44fd4ccc03e0b3a4993c904398f75",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[chore] 发版载体 v1.6.1：首次用自动发布链产出资产",
      "titleRaw": "[chore] 发版载体 v1.6.1：首次用自动发布链产出资产",
      "supplement": "",
      "body": "## 动机\nv1.6.0 之后 main 已合入两项对外可见的变化：`fix(bind)` 让 `bind execute` 不再因技能子目录抛 `EISDIR`（PR #64），`build(ci)` 补上 CLI 自己的发布链（PR #67，`publish.yml` + `scripts/publish.mjs`）。发布链只有在下一次真实 `release: published` 事件上才被端到端执行——不打版，等于这个修复从未被验证过。\n\n## 引用规范\n（brief 缺少该节）\n\n## 决策\n- **bump 位 patch**：两项都是缺陷修复/工具补齐，无新命令键、无参数契约变更 → 不进 minor。`requiresCommands` 与宿主清单不受影响（本仓无宿主清单）。\n- 本载体的**首要交付物是验证**：tag 打出后必须核对 Actions 的 `publish-release` 绿、`releases/tags/v1.6.1` 恰有一个合法名资产、且不再需要人工 `gh release upload`。任一不成立即视为未交付。\n- 与 v1.6.0 的差异：v1.6.0 的资产是我手工 pack + upload 的；v1.6.1 必须由新链自动产出，才算这条发布链真的落地。\n\n## 任务\n- [ ] task-1 — `package.json` — version 1.6.0 → 1.6.1\n- [ ] task-2 — `README.md` — bootstrap URL 同步 /v1.6.1/\n- [ ] task-3 — 观察点 — 差异面只两文件；tag 后核对 publish-release run 与资产（发版后回填）\n\n完整 brief：shadow-docs/changes/20261012-chore-release-v161/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261012-chore-release-v161\",\"type\":\"chore\",\"scope\":\"distribution\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261012-chore-release-v161/brief.md\",\"cliVersion\":\"1.6.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "chore"
      ]
    },
    "release": {
      "files": [
        "README.md",
        "package.json",
        "shadow-docs/changes/20261012-chore-release-v161/brief.md"
      ],
      "message": "chore(release): v1.6.1 版本号与安装链接 bump（首次由发布链自动产出资产）",
      "title": "chore(release): v1.6.1 版本号与安装链接 bump（首次由发布链自动产出资产）",
      "body": "## 变更\n- `package.json`：`version` 1.6.0 → 1.6.1。\n- `README.md`：bootstrap 安装 URL 同步为 `/v1.6.1/`。\n- 载体 brief（动机、覆盖范围、决策、任务、结果）。\n\n## 影响\n- 交付内容：`#64` 让 `bind execute` 不再因技能目录含子目录抛 `EISDIR`；`#67` 为 CLI 补上发布链（`publish.yml` + `scripts/publish.mjs`：版本权威 → pack → 资产名契约 → 上传 → 回读）。\n- **本载体的真正目的是端到端验证那条发布链**：v1.6.0 的资产是我手工 `pack.mjs` + `gh release upload` 补的；v1.6.1 必须由 Actions 自动产出，否则等于发布链从未被证明可用。\n- 明确不受影响的范围：零代码改动，`lib/` 与 `cli.mjs` 未动、命令目录不变 → 插件 `requiresCommands` 判定不受影响；`install-cli.sh` 与 `scripts/pack.mjs` 未改；`test.yml` 触发矩阵不变。\n- 时序：README 的 `/v1.6.1/` 链接在本 PR 合并并打 tag 之前 404，属发版载体既有时序（先合并、后打 tag）。\n- 回滚方式：revert 本 PR 即把版本与安装链接退回 1.6.0；未打 tag 前无外部产物影响。\n\n## 验证\n- 差异面：`git diff --stat` 仅 `README.md`、`package.json` 各 1 行；无旁逸文件。\n- 版本一致：`package.json.version = 1.6.1`；README 安装 URL 指向 `/v1.6.1/`；全仓无残留 `/v1.6.0/` 引用。\n- 覆盖范围核对：`git rev-list --count v1.6.0..HEAD` = 4，其中两笔为归档提交（不属对外内容变更，已在此说明跳过理由），可见变更为 `#64`、`#67`。\n- 未覆盖项（明说）：本 PR 无法自证发布链——`publish-release` 只在 `release: published` 事件上运行。合并后打 tag 的验收点为：Actions `publish-release` 绿 + `releases/tags/v1.6.1` 恰有一个 `shadow-dev-cli-v1.6.1.tar.gz`，且无人工上传介入；不成立即视为未交付并回填原因。\n\n## 关联\n- Closes #68\n- brief: shadow-docs/changes/20261012-chore-release-v161/brief.md"
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": "knowledge/install-distribution.md",
    "reason": "常规 patch 发版载体；发布链事实已由 #67 的脚本与用例承载，不新建卡"
  }
}
---

# 20261012-chore-release-v161

## 动机

v1.6.0 之后 main 已合入两项对外可见的变化：`fix(bind)` 让 `bind execute` 不再因技能子目录抛 `EISDIR`（PR #64），`build(ci)` 补上 CLI 自己的发布链（PR #67，`publish.yml` + `scripts/publish.mjs`）。发布链只有在下一次真实 `release: published` 事件上才被端到端执行——不打版，等于这个修复从未被验证过。

## 覆盖范围

- `package.json`：`version` 1.6.0 → 1.6.1（patch：两项修复，无命令面变化、无破坏性契约变更）。
- `README.md`：bootstrap 安装 URL 的版本引用同步为 `/v1.6.1/`（安装文档必须指向即将存在的 tag；打 tag 之前该链接 404 属载体既有时序）。
- 载体 brief 自身。

## 决策

- **bump 位 patch**：两项都是缺陷修复/工具补齐，无新命令键、无参数契约变更 → 不进 minor。`requiresCommands` 与宿主清单不受影响（本仓无宿主清单）。
- 本载体的**首要交付物是验证**：tag 打出后必须核对 Actions 的 `publish-release` 绿、`releases/tags/v1.6.1` 恰有一个合法名资产、且不再需要人工 `gh release upload`。任一不成立即视为未交付。
- 与 v1.6.0 的差异：v1.6.0 的资产是我手工 pack + upload 的；v1.6.1 必须由新链自动产出，才算这条发布链真的落地。

## 任务

- [x] task-1 — `package.json` — version 1.6.0 → 1.6.1
- [x] task-2 — `README.md` — bootstrap URL 同步 /v1.6.1/
- [x] task-3 — 观察点 — 差异面只两文件；tag 后核对 publish-release run 与资产（发版后回填）

## 结果

评级 S（两处声明式 bump）。取证 = 差异面 + 版本一致性 + 发布链端到端（tag 落地后回填）。

- 差异面：`git diff --stat` = `README.md | 2 +-`、`package.json | 2 +-`，共 2 文件 2 增 2 删，无其它文件被牵动。
- 版本一致：`node -pe "require('./package.json').version"` = `1.6.1`；README 安装 URL 已指向 `/v1.6.1/`，全仓再无 `/v1.6.0/` 引用（`git grep v1\.6\.0` 为空）。
- 覆盖范围核对：`git rev-list --count v1.6.0..HEAD` 实取 4 个提交，其中对外可见的两项为 `#64`（bind dirHash）与 `#67`（发布链）；另两笔是它们的归档提交，不属内容变更，按规则跳过并在此写明。
- **待回填**：tag `v1.6.1` 与 Release 落地后，核对 Actions 的 `publish-release` 结论、`releases/tags/v1.6.1` 的资产名与数量。这一步是本载体的真实交付物。
