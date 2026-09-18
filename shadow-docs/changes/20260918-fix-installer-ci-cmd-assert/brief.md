---
{
  "schema": "shadow-dev/v1",
  "name": "20260918-fix-installer-ci-cmd-assert",
  "type": "fix",
  "scope": null,
  "status": "branched",
  "baseBranch": "main",
  "branch": "fix/20260918-fix-installer-ci-cmd-assert",
  "files": [],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 22,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/22",
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
    "checkpoint": "issue:22",
    "planHash": "de68a5b25e152b369e06ce10b5bedfa40cf9888b26eaacb1bacbef49b7e7af05",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[fix] 安装器契约测试 Linux/macOS 恒红：.cmd 断言补平台门",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\n`test/install.test.mjs` 用例 53 无条件断言 `$BIN/shadow-dev.cmd` 存在，但 `.cmd` 按设计只在 MINGW/MSYS/CYGWIN 下生成（`gen_shims` 的 uname 分支）。结果 ubuntu/macos 矩阵自 38b1364（安装器引入）起 **main 分支 CI 持续红色**——红 CI 掩盖真实回归、让后续所有 PR 在坏门禁下合并（#18/#21 均如此）。本变更修复断言本身，恢复 CI 门禁价值。\n\n## 引用规范\n- shadow-docs/knowledge/install-distribution.md\n  - 当前结论: 托管 shim 为 `.sh` 全平台 + `.cmd` 仅 Windows；验证方式登记 8 用例\n  - 适用 scope: scripts/install-cli.sh, test/install.test.mjs\n- norms/tdd-verification.md\n  - 当前结论: 完成前必须有可查验证；本变更的\"红\"在 CI 非 Windows 矩阵（本地 win 恒真无法复现），PR 上 CI 矩阵转绿即验证\n\n## 决策\n- **选型:** 平台门：`platform() === 'win32'` 时才断言 `.cmd` 存在（单行修复，非 win 环境断言 `.cmd` 不存在反而更贴合设计——顺带钉住\"不越平台生成\"）。\n- **对比方案:** 让 `gen_shims` 在 unix 也生成 `.cmd` 被否——unix 下 `.cmd` 无运行语义，为迁就错误断言改正确行为是反模式。\n- **理由:** 断言错、行为对；测试向契约对齐，不是相反。\n\n## 任务\n- [ ] task-1 — `test/install.test.mjs` — 用例 53 的 `.cmd` 断言加平台门（win32 存在 / 其他平台不存在）\n- [ ] task-2 — `scripts/install-cli.sh` 无改动（确认边界）；`shadow-docs/knowledge/install-distribution.md` — 验证方式登记平台分支语义，source 追加本 brief\n\n完整 brief：shadow-docs/changes/20260918-fix-installer-ci-cmd-assert/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20260918-fix-installer-ci-cmd-assert\",\"type\":\"fix\",\"scope\":null,\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20260918-fix-installer-ci-cmd-assert/brief.md\",\"cliVersion\":\"1.2.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "fix"
      ]
    }
  }
}
---

# 安装器契约测试 Linux/macOS 恒红：.cmd 断言补平台门

## 动机

`test/install.test.mjs` 用例 53 无条件断言 `$BIN/shadow-dev.cmd` 存在，但 `.cmd` 按设计只在 MINGW/MSYS/CYGWIN 下生成（`gen_shims` 的 uname 分支）。结果 ubuntu/macos 矩阵自 38b1364（安装器引入）起 **main 分支 CI 持续红色**——红 CI 掩盖真实回归、让后续所有 PR 在坏门禁下合并（#18/#21 均如此）。本变更修复断言本身，恢复 CI 门禁价值。

## 引用规范

- shadow-docs/knowledge/install-distribution.md
  - 当前结论: 托管 shim 为 `.sh` 全平台 + `.cmd` 仅 Windows；验证方式登记 8 用例
  - 适用 scope: scripts/install-cli.sh, test/install.test.mjs
- norms/tdd-verification.md
  - 当前结论: 完成前必须有可查验证；本变更的"红"在 CI 非 Windows 矩阵（本地 win 恒真无法复现），PR 上 CI 矩阵转绿即验证

## 决策

- **选型:** 平台门：`platform() === 'win32'` 时才断言 `.cmd` 存在（单行修复，非 win 环境断言 `.cmd` 不存在反而更贴合设计——顺带钉住"不越平台生成"）。
- **对比方案:** 让 `gen_shims` 在 unix 也生成 `.cmd` 被否——unix 下 `.cmd` 无运行语义，为迁就错误断言改正确行为是反模式。
- **理由:** 断言错、行为对；测试向契约对齐，不是相反。

## 任务

- [x] task-1 — `test/install.test.mjs` — 用例 53 的 `.cmd` 断言加平台门（win32 存在 / 其他平台不存在）
- [x] task-2 — `scripts/install-cli.sh` 无改动（确认边界）；`shadow-docs/knowledge/install-distribution.md` — 验证方式登记平台分支语义，source 追加本 brief

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/install-distribution.md
- **理由:** 卡片验证方式需钉住 `.cmd` 平台分支语义，防再次写出跨平台恒假断言
