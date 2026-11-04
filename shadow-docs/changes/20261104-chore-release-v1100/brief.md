---
{
  "schema": "shadow-dev/v1",
  "name": "20261104-chore-release-v1100",
  "type": "chore",
  "scope": "install-distribution",
  "status": "published",
  "baseBranch": "main",
  "branch": "chore/20261104-chore-release-v1100",
  "files": [
    "README.md",
    "package.json",
    "scripts/pack.mjs",
    "shadow-docs/changes/20261104-chore-release-v1100/brief.md"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 80,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/80",
    "pullRequest": 81,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/81"
  },
  "review": {
    "conclusion": "pending",
    "verifiedCommit": null,
    "verifiedAt": null
  },
  "workflow": {
    "operation": null,
    "checkpoint": "pr:81",
    "planHash": "a160091559340d297dcb1a1d703ac211d08de6f267f628d1b5c6ad7b1c77e2aa",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "README.md",
        "package.json",
        "scripts/pack.mjs",
        "shadow-docs/changes/20261104-chore-release-v1100/brief.md"
      ],
      "message": "chore(release): v1.10.0 — tools/qwen-tts 入产物集 + 版本号 bump",
      "title": "chore(release): v1.10.0 — tools/qwen-tts 入产物集 + 版本号 bump",
      "body": "## 变更\n\n- `scripts/pack.mjs`：产物白名单加入 `tools/`，并显式过滤 `.api_key` / `tts-output` / `node_modules` / `.DS_Store`\n- `package.json` 1.9.0 → **1.10.0**；README 安装链接同步 v1.10.0\n\n## 为什么\n\n`shadow-dev-tts` 技能正文写死「工具载体：shadow-dev-cli 仓 `tools/qwen-tts/`」，但 v1.9.0 的 Release 资产解包只有 `cli.mjs / lib / package.json / README.md / LICENSE`——技能装得到、`tts.py` 与 `assemble_track.py` 装不到。本次补齐分发并把 TTS 能力发出去。\n\n## 验证\n\n本地 pack 解包已含 `shadow-dev-cli/tools/qwen-tts/{tts.py,assemble_track.py,README.md,sample.txt,zhi-guo-xiang-poem.txt}`（已实测，见 PR 评论）。发布链审查在 tag 后按 publish 流程核对资产契约与冒烟。\n\nCloses 载体 change `20261104-chore-release-v1100`。"
    },
    "issuePlan": {
      "title": "[chore] 20261104-chore-release-v1100",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\n`shadow-dev-tts` 技能（workflow 仓 PR #82）正文写死「工具载体：shadow-dev-cli 仓 `tools/qwen-tts/`」，但 `scripts/pack.mjs` 的拷贝白名单不含 `tools`，v1.9.0 的 Release 资产解包只有 `cli.mjs / lib / package.json / README.md / LICENSE`。结果是技能装得到、`tts.py` 与 `assemble_track.py` 装不到——按技能走第一步就找不到工具。本次补齐分发并把 TTS 能力发出去。\n\n## 引用规范\n- shadow-docs/knowledge/release-artifact-pipeline.md\n  - 当前结论: tag 必须指向已含 bump 的 main；资产名契约 `^shadow-dev-cli-v[0-9][0-9.]*\\.tar\\.gz$`；版本权威由 package.json 与 tag 对账\n  - 适用 scope: scripts/pack.mjs, scripts/publish.mjs, package.json\n  - 遵循方式: 先合 bump 再打 tag；pack 产物集扩充不改变资产名\n\n## 决策\n- **选型:** pack 白名单加 `tools`；一次 change 同时承载分发修复与 v1.10.0 bump（minor——新增对外交付物）。\n- **对比方案:** ①只 bump 不补 pack——技能指向空位，否决；②把 tts 挪进 lib/ 随 CLI 装——tts 与 CLI 本体零耦合（media-tts 横切实践已如此登记），污染执行层交付面，否决。\n\n## 任务\n- [ ] `scripts/pack.mjs` 白名单加入 `tools`\n- [ ] `package.json` version → 1.10.0；README 安装链接 → v1.10.0\n- [ ] 本地 pack 解包断言含 tools/qwen-tts/tts.py\n- [ ] release → PR → merge → tag v1.10.0 → 发布链审查\n\n完整 brief：shadow-docs/changes/20261104-chore-release-v1100/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261104-chore-release-v1100\",\"type\":\"chore\",\"scope\":\"install-distribution\",\"status\":\"branched\",\"branch\":\"chore/20261104-chore-release-v1100\",\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261104-chore-release-v1100/brief.md\",\"cliVersion\":\"1.9.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": []
    }
  }
}
---

## 动机

`shadow-dev-tts` 技能（workflow 仓 PR #82）正文写死「工具载体：shadow-dev-cli 仓 `tools/qwen-tts/`」，但 `scripts/pack.mjs` 的拷贝白名单不含 `tools`，v1.9.0 的 Release 资产解包只有 `cli.mjs / lib / package.json / README.md / LICENSE`。结果是技能装得到、`tts.py` 与 `assemble_track.py` 装不到——按技能走第一步就找不到工具。本次补齐分发并把 TTS 能力发出去。

## 复杂度评级

- **评级:** S
- **理由:** 纯声明式产物集扩充（pack 白名单加一项）+ 版本号 bump，不改命令面、不改 stdout 契约、不动 lib/。
- **期望验证深度:** code-read
- **取证策略:** 本地 pack 解包断言含 `tools/qwen-tts/tts.py`；发布链冒烟看资产与安装态。

## 引用规范

- shadow-docs/knowledge/release-artifact-pipeline.md
  - 当前结论: tag 必须指向已含 bump 的 main；资产名契约 `^shadow-dev-cli-v[0-9][0-9.]*\.tar\.gz$`；版本权威由 package.json 与 tag 对账
  - 适用 scope: scripts/pack.mjs, scripts/publish.mjs, package.json
  - 遵循方式: 先合 bump 再打 tag；pack 产物集扩充不改变资产名

## 领域模型

- **限界上下文:** `install-distribution`——产物物化集决定「装上去的东西包含什么」。
- **不变量:**
  - **INV-1** 技能正文指向的仓内路径，必须在产物集内可达（本次由 `tools` 入白名单闭合）
  - **INV-2** 密钥与本地产物不入产物：`.api_key` / `tts-output/` 由 `.gitignore` 挡住，pack 只拷 git 跟踪的内容
  - **INV-3** 三份身份同源：package.json version == tag == 资产名版本

## 决策

- **选型:** pack 白名单加 `tools`；一次 change 同时承载分发修复与 v1.10.0 bump（minor——新增对外交付物）。
- **对比方案:** ①只 bump 不补 pack——技能指向空位，否决；②把 tts 挪进 lib/ 随 CLI 装——tts 与 CLI 本体零耦合（media-tts 横切实践已如此登记），污染执行层交付面，否决。

## 任务

- [ ] `scripts/pack.mjs` 白名单加入 `tools`
- [ ] `package.json` version → 1.10.0；README 安装链接 → v1.10.0
- [ ] 本地 pack 解包断言含 tools/qwen-tts/tts.py
- [ ] release → PR → merge → tag v1.10.0 → 发布链审查
