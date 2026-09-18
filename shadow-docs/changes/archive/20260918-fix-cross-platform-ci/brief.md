---
{
  "schema": "shadow-dev/v1",
  "name": "20260918-fix-cross-platform-ci",
  "type": "fix",
  "scope": null,
  "status": "archived",
  "baseBranch": "main",
  "branch": "fix/20260918-fix-cross-platform-ci",
  "files": [],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 25,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/25",
    "pullRequest": 26,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/26"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "29a8844ef29d97bd585f5a83c6d01c809a40b419",
    "verifiedAt": "2026-09-18T02:33:30.110Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:26",
    "planHash": "ebf10504db37f2c755cbcf2c9127b34b66557bec69b1564f6195a3c57fe888cd",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[fix] 跨平台 CI 绿灯：钉死测试的 locale 与 tar 可执行依赖",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\nmain 的 CI 矩阵在 macos/windows 仍有两簇恒红（ubuntu 已由 #23 转绿）：①`cli.test.mjs` 用例 20（TTY）断言 stderr 含中文「命令一览」，但语言链 `locale 探测 > zh` 在 en-US runner 上渲染英文——PR #10 引入的 locale 依赖，本地中文机掩盖；已用 `SHADOW_DEV_LANG=en` 本地复现同款断言失败。②`install.test.mjs` 全部用例在 windows runner 死于 `makeTarball`：node 直接 spawn 的 `tar` 绑到 System32 bsdtar，读不了 toUnix 产出的 MSYS `/tmp` 路径（38b1364 起即存在）。两簇都是**测试侧**缺陷，运行时行为正确。红 CI 继续让真实回归裸奔。\n\n## 引用规范\n- shadow-docs/knowledge/cli-output-contract.md\n  - 当前结论: 语言链 `--lang` > `SHADOW_DEV_LANG` > locale 探测 > 默认 zh，只影响 stderr 文案\n  - 适用 scope: 测试必须显式固定语言（--lang / SHADOW_DEV_LANG），不得依赖 runner locale\n- shadow-docs/knowledge/install-distribution.md\n  - 当前结论: shim/产物断言是平台分支的；跨平台命令要在设计上可移植\n  - 适用 scope: test/install.test.mjs\n- norms/tdd-verification.md\n  - 当前结论: 先复现红（本地 SHADOW_DEV_LANG=en 已复现 ①；②的权威红源是 windows CI 矩阵）再修\n\n## 决策\n- **选型:** ①用例 20 的 `runTty(['--help'])` 显式传 `SHADOW_DEV_LANG=zh`（断言中文通道）；②`makeTarball` 的 tar 改在 bash 内执行（`bash -c \"tar ...\"`），与安装器本体同源（install-cli.sh 里 tar 天然由 bash 解析，Windows 下命中 git 的 GNU tar），测试与实现走同一条解析路径。\n- **对比方案:** ①改成\"按 locale 断言中英文任一\"被否——非确定性断言是反模式；②toUnix 产 Windows 原生路径给 bsdtar 被否——`-C` 参数与包内 POSIX 路径又需要 MSYS 形态，两头不讨好；根治是统一交给 bash 解析。\n- **理由:** 测试向契约要确定性：语言显式声明、工具链与生产路径一致；均不动运行时代码。\n\n## 任务\n### Phase 1\n\n- [ ] task-1 — `test/cli.test.mjs` — 用例 20 的 plain（无 --json 的 TTY help）runTty 显式 `SHADOW_DEV_LANG=zh`；本地 `SHADOW_DEV_LANG=en` 强制下先跑红（已复现）后转绿\n- [ ] task-2 — `test/install.test.mjs` — `makeTarball` 的 `spawnSync('tar',...)` 改为 `spawnSync('bash', ['-c', ...])`；本地 8 用例保持绿\n\n### Phase 2\n\n- [ ] task-3 — PR 上 CI 9 格矩阵（ubuntu/macos/windows × 20/22/24）全绿作为权威验证；失败则在同一调查上下文内修到绿\n\n完整 brief：shadow-docs/changes/20260918-fix-cross-platform-ci/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20260918-fix-cross-platform-ci\",\"type\":\"fix\",\"scope\":null,\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20260918-fix-cross-platform-ci/brief.md\",\"cliVersion\":\"1.2.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "fix"
      ]
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/cli-output-contract.md",
    "reason": "语言链约束追加测试侧 locale 显式钉定条款；install-distribution 卡片同批追加 tar-via-bash 可移植性约束（两卡片均已随本变更更新）"
  }
}
---

# 跨平台 CI 绿灯：钉死测试的 locale 与 tar 可执行依赖

## 动机

main 的 CI 矩阵在 macos/windows 仍有两簇恒红（ubuntu 已由 #23 转绿）：①`cli.test.mjs` 用例 20（TTY）断言 stderr 含中文「命令一览」，但语言链 `locale 探测 > zh` 在 en-US runner 上渲染英文——PR #10 引入的 locale 依赖，本地中文机掩盖；已用 `SHADOW_DEV_LANG=en` 本地复现同款断言失败。②`install.test.mjs` 全部用例在 windows runner 死于 `makeTarball`：node 直接 spawn 的 `tar` 绑到 System32 bsdtar，读不了 toUnix 产出的 MSYS `/tmp` 路径（38b1364 起即存在）。两簇都是**测试侧**缺陷，运行时行为正确。红 CI 继续让真实回归裸奔。

## 引用规范

- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: 语言链 `--lang` > `SHADOW_DEV_LANG` > locale 探测 > 默认 zh，只影响 stderr 文案
  - 适用 scope: 测试必须显式固定语言（--lang / SHADOW_DEV_LANG），不得依赖 runner locale
- shadow-docs/knowledge/install-distribution.md
  - 当前结论: shim/产物断言是平台分支的；跨平台命令要在设计上可移植
  - 适用 scope: test/install.test.mjs
- norms/tdd-verification.md
  - 当前结论: 先复现红（本地 SHADOW_DEV_LANG=en 已复现 ①；②的权威红源是 windows CI 矩阵）再修

## 决策

- **选型:** ①用例 20 的 `runTty(['--help'])` 显式传 `SHADOW_DEV_LANG=zh`（断言中文通道）；②`makeTarball` 的 tar 改在 bash 内执行（`bash -c "tar ..."`），与安装器本体同源（install-cli.sh 里 tar 天然由 bash 解析，Windows 下命中 git 的 GNU tar），测试与实现走同一条解析路径。
- **对比方案:** ①改成"按 locale 断言中英文任一"被否——非确定性断言是反模式；②toUnix 产 Windows 原生路径给 bsdtar 被否——`-C` 参数与包内 POSIX 路径又需要 MSYS 形态，两头不讨好；根治是统一交给 bash 解析。
- **理由:** 测试向契约要确定性：语言显式声明、工具链与生产路径一致；均不动运行时代码。

## 任务

### Phase 1

- [x] task-1 — `test/cli.test.mjs` — 用例 20 的 plain（无 --json 的 TTY help）runTty 显式 `SHADOW_DEV_LANG=zh`；本地 `SHADOW_DEV_LANG=en` 强制下先跑红（已复现）后转绿
- [x] task-2 — `test/install.test.mjs` — `makeTarball` 的 `spawnSync('tar',...)` 改为 `spawnSync('bash', ['-c', ...])`；本地 8 用例保持绿

### Phase 2

- [x] task-3 — PR 上 CI 9 格矩阵（ubuntu/macos/windows × 20/22/24）全绿作为权威验证；失败则在同一调查上下文内修到绿

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/cli-output-contract.md
- **理由:** 语言链约束需追加"测试必须显式固定语言，禁止依赖 runner locale"的执行约束；安装卡片验证方式补"tar 经 bash 解析"的可移植性约束
