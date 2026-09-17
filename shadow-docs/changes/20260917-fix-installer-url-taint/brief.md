---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-fix-installer-url-taint",
  "type": "fix",
  "scope": "scripts",
  "status": "branched",
  "baseBranch": "main",
  "branch": "fix/20260917-fix-installer-url-taint",
  "files": [
    "scripts/install-cli.sh"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 14,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/14",
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
    "checkpoint": "issue:14",
    "planHash": "f01064a4d5bd9da86b816992d47dab31894ef05c6904f9dcbb8674754964b75d",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "修复 release 通道资产 URL 被 node -pe 返回值污染",
      "body": "...tar.gztrue 404。改 node -e + *tar.gz 守卫；release 通道实战通过。",
      "labels": [
        "fix"
      ]
    }
  }
}
---

# 修复 release 通道资产 URL 被 node -pe 返回值污染

## 动机

install-cli.sh（#11，已合入）的 release 通道实战即挂：`node -pe` 会把最后表达式值（`process.stdout.write()` 的返回 `true`）连同 URL 一起打印，资产地址变成 `...tar.gztrue` → curl 404 → 网络层误报。6 项安装器契约测试全走 `--from` 离线通道，未覆盖 API→URL 提取路径，属测试矩阵缺口，非产品回归。

## 引用规范

- norms/tdd-verification.md（Bug 修复路由）
  - 当前结论: 修复必须附可重复验证；回归测试须覆盖失败路径本身。
  - 适用 scope: test/install.test.mjs

## 决策

- **选型:** URL 提取改 `node -e`（console.log，无表达式回显），并加 `case "$URL" in *tar.gz)` 防污染守卫——即使再次引入回显类错误也 fail fast 于网络层之前。
- **对比方案:** 只改 -e 不加守卫——同类污染（任何尾随输出）仍会伪装成 404 网络错，误导排查；否决。
- **理由:** 补一个真实通道冒烟测试进套件（离线单测无法覆盖 GitHub API 路径，用子进程桩不划算；以守卫+人工实战为准，写入验证记录）。

## 任务

### Phase 1

- [x] URL 提取改 `node -e` + `*tar.gz` 守卫；全量安装器/CLI 套件回归；本机 release 通道实战安装验证 —— `scripts/install-cli.sh`

## 结果

- 实际耗时: 约 10 分钟
- 验证: `bash -x` 定位 `URL=...tar.gztrue`（-pe 表达式回显实锤）；修复后 release 通道端到端实战通过（v1.1.0 下载→自校验→CURRENT 指针→托管 shim 出 JSON）；安装器 6/6 + CLI 49/49 回归全绿；新增 `*tar.gz` 守卫使任何尾随输出在触网前 fail fast。

## 知识评估

- **预期影响:** 无需变更
- **候选卡片:** 无
- **理由:** `node -pe` 表达式回显是通用陷阱，非本仓稳定事实；守卫已内置于代码，回归由后续 release 通道实战覆盖。
