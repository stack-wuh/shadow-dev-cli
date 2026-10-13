---
{
  "schema": "shadow-dev/v1",
  "name": "20261013-chore-release-v170",
  "type": "chore",
  "scope": null,
  "status": "reviewed",
  "baseBranch": "main",
  "branch": "chore/20261013-chore-release-v170",
  "files": [
    "README.md",
    "package.json",
    "shadow-docs/changes/20261013-chore-release-v170/brief.md"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": null,
    "issueUrl": null,
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "f72c8dc427d3eb26050cbbc789efda1a091a2245",
    "verifiedAt": "2026-10-13T06:20:15.272Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": null,
    "planHash": "a1727b3471a490117a60681e1c04a6bc30a27d9546504b43ca925da8507d2378",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "README.md",
        "package.json",
        "shadow-docs/changes/20261013-chore-release-v170/brief.md"
      ],
      "message": "chore: v1.7.0 版本号与安装链接 bump（sync 契约变更首次进 release 轨）",
      "title": "chore: v1.7.0 版本号与安装链接 bump（sync 契约变更首次进 release 轨）",
      "body": "## 变更\n- `package.json`：`version` 1.6.1 → 1.7.0\n- `README.md`：bootstrap 安装 URL 版本段同步 `/v1.7.0/`\n- 载体 brief 自身\n\n## 影响\n- 行为/触发面变化：无实现代码改动，仅把已合并的 `fix(sync)`（PR #70）送进 release 轨\n- 走 release 轨的使用者自此可拿到无 brief 依赖的 `sync`；插件侧 `cliVersion` 自此有版本可 pin\n- 明确不受影响的范围：`lib/**`、`.github/workflows/**`、`scripts/**` 未触碰\n- `test/cli.test.mjs` 里的 `v1.6.1` 字面量是 `assertVersion` 负例入参，与本 bump 无关\n\n## 验证\n- 命令与结果：`git diff --stat` = `README.md | 2 +-`、`package.json | 2 +-`，共 2 文件 2 增 2 删\n- `node -p \"require('./package.json').version\"` = `1.7.0`；README 安装 URL 已指向 `/v1.7.0/`\n- 引用扫描：`git grep -l 'v1.6.1'` 命中 4 文件——3 个归档 brief 留痕 + 1 个测试负例字面量；安装轨零残留\n- 覆盖范围核对：`git rev-list --count v1.6.1..HEAD` 实取 3 提交，对外可见的是 `92515be`（PR #70）\n- bump 位依据：本仓 v1.6.1 载体规则「无命令面变化才走 patch」；本次参数契约有变，故进 minor\n- 未覆盖项（明说）：本机不跑全量 `npm test`（约 270s 超 60s 阈值），由 `test.yml` 的 PR 触发补\n- 未覆盖项（明说）：发布链端到端需 tag 落地才可取证实证，已在 brief 结果段登记为待回填项\n\n## 关联\n- Closes #65（其修复由 PR #70 承载，本 PR 把它送进 release 轨）\n- Refs #59\n- brief: shadow-docs/changes/20261013-chore-release-v170/brief.md"
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": null,
    "reason": null
  }
}
---

# 20261013-chore-release-v170

## 动机

v1.6.1 之后 main 上合入一项对外可见的契约变更：`fix(sync)` 解除 brief 硬依赖（PR #70，闭合 issue #65）。`sync` 的调用形态变了——`--name` 由必填降为可选、新增 `--base-branch`、新增拒绝码 `SYNC_UPSTREAM_NOT_FOUND`。不打版，走 release 轨的使用者拿不到它，插件侧 `cliVersion` 也无从 pin，`shadow-dev-release` / `shadow-dev-publish` 的 sync 文档就没有可用的版本锚。

## 复杂度评级

- **评级:** S
- **理由:** 只有两处声明式 bump（`package.json` 的 `version`、`README.md` 的 bootstrap URL 版本段），零实现代码改动、零命令面变化。
- **期望验证深度:** code-read / field——diff 走查 + 版本一致性 + 引用残留扫描；发布链端到端在 tag 落地后回填。

## 覆盖范围

- `package.json`：`version` 1.6.1 → 1.7.0。
- `README.md`：bootstrap 安装 URL 的版本引用同步为 `/v1.7.0/`（打 tag 之前该链接 404 属载体既有时序）。
- 载体 brief 自身。

## 决策

- **bump 位 minor 1.7.0，不是 patch**：本仓 v1.6.1 载体写明的规则是「无命令面变化、无破坏性契约变更」才走 patch。本次参数契约有变（`--name` 放宽 + 新增 `--base-branch` + 新增拒绝码），向后兼容但不等于「无变化」，按 semver 进 minor；tag 名与 README 链接同步用 `/v1.7.0/`。
- 载体只 bump 声明，不碰 `lib/**`；被发布的内容 = 已合并的 `92515be`（fix）+ `f72c8dc`（其归档提交）。
- 交付判定同 v1.6.1：tag 落地后必须核对 Actions `publish` 成功、`releases/tags/v1.7.0` 恰有一个合法名资产、且资产 uploader 是 `github-actions[bot]`（人工 upload 不算这条链成立）。

## 任务

- [x] task-1 — `package.json` — version 1.6.1 → 1.7.0
- [x] task-2 — `README.md` — bootstrap URL 同步 /v1.7.0/
- [x] task-3 — 观察点 — 差异面只两文件；tag 后核对 publish run 与资产（发版后回填）

## 结果

评级 S，取证形态 code-read / field + 发布链端到端（tag 落地后回填）。

- 差异面：`git diff --stat` = `README.md | 2 +-`、`package.json | 2 +-`，共 2 文件 2 增 2 删，无其它文件被牵动；`lib/**` 未被本载体触碰。
- 版本一致：`node -p "require('./package.json').version"` = `1.7.0`；README 安装 URL 已指向 `/v1.7.0/`。
- 引用残留（口径更正）：`git grep -l 'v1.6.1'` 实命中 4 个文件，逐类核清——3 个是 `shadow-docs/changes/archive/**` 里的历史 brief（当时发的就是 1.6.1，属留痕不改），1 个是 `test/cli.test.mjs:1217` 的负例字面量 `assertVersion('1.6.0', 'v1.6.1')`（与 package.json 解耦，不随 bump 变）。安装轨（README、package.json、`.github/workflows/**`、`scripts/**`）零残留。我先把它写成「命中 0」，是错口径，此处留痕更正。
- 覆盖范围核对：`git rev-list --count v1.6.1..HEAD` 实取 3 个提交，其中对外可见的是 `92515be`（fix: sync 解除 brief 硬依赖，PR #70）；另两笔是它的归档提交与本载体 bump，不属内容变更，按规则跳过并在此写明。
- bump 位判定依据：本仓 v1.6.1 载体的规则原文是「patch：两项修复，无命令面变化、无破坏性契约变更」。本次命令面有变（`--name` 放宽 + 新增 `--base-branch` + 新增 `SYNC_UPSTREAM_NOT_FOUND`），故进 minor。
- 发布链端到端：待 tag `v1.7.0` 落地后回填（`gh run view` + `releases/tags/v1.7.0` 资产名与 uploader）。

**未覆盖项**：本机不跑全量 `npm test`（约 270s > 60s 阈值），由本仓 `test.yml` 的 `pull_request` 触发补跑；S 级零实现改动，风险面仅在两个声明字段。
