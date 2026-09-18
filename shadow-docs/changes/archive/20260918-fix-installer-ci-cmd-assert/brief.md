---
{
  "schema": "shadow-dev/v1",
  "name": "20260918-fix-installer-ci-cmd-assert",
  "type": "fix",
  "scope": null,
  "status": "archived",
  "baseBranch": "main",
  "branch": "fix/20260918-fix-installer-ci-cmd-assert",
  "files": [],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 22,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/22",
    "pullRequest": 23,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/23"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "6a507eea5d7fcf1a4041a53dc33519049d29e5d2",
    "verifiedAt": "2026-09-18T01:31:08.815Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:23",
    "planHash": "ead0e48f10d6fccb3b185ce7741b72f939e8afb3c5e278bccce18477ff388284",
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
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/install-distribution.md",
    "reason": "验证方式钉住 .cmd 平台分支语义，防跨平台恒假断言再次让 CI 门禁失真"
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

- 实际耗时: 约 25 分钟
- 验证: PR #23 CI 矩阵（run 35295650490）——ubuntu 20/22/24 **首次全绿**；macos 安装器用例全绿；本变更零新增失败（全部为红→绿方向）。本地 win `node --test test/install.test.mjs` exit=0。合并 `8140eff`。
- 记录在案的两个更老的存量 CI 问题（不在本变更范围，各自需独立变更处理）：
  1. `cli.test.mjs` 用例 20（TTY suppresses stdout JSON）在 macos/windows 恒失败——源自 PR #10（tty-human-default），`runTty` 用 `--input-type=module -e` 覆写 `process.stdout.isTTY` 的手法在非 win 平台行为不同，需单独调查。
  2. windows 安装器用例在 `makeTarball` 第一步断言即失败——node 直 spawn 的 `tar` 在 Windows runner 绑到 System32 bsdtar，读不了 toUnix 产出的 MSYS `/tmp` 路径；早于本变更（fix/20260917-fix-missing-arg-hints 的 run 同样红）。修法方向：tar 改走 `bash -c` 内执行或产物路径全程用原生 Windows 形态。
- 遗留: README「安装与分发」的 link 双轨说明仍在工作区未落地（与并发变更 20260917-feature-unified-issue-structure 交叉，随其提交或由后续 docs 变更补交）。

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/install-distribution.md
- **理由:** 卡片验证方式需钉住 `.cmd` 平台分支语义，防再次写出跨平台恒假断言
