---
{
  "schema": "shadow-dev/v1",
  "name": "20260925-chore-bootstrap-v14",
  "type": "chore",
  "scope": "distribution",
  "status": "branched",
  "baseBranch": "main",
  "branch": "chore/20260925-chore-bootstrap-v14",
  "files": [
    "package.json",
    "scripts/bootstrap.sh",
    "shadow-docs/knowledge/install-distribution.md"
  ],
  "github": {
    "repository": null,
    "issue": null,
    "issueUrl": null,
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
    "checkpoint": null,
    "planHash": "8dfc9ec451e8fce3900c32f521be889b3a740dfd4eb5428ebb4957be4eae97b9",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "package.json",
        "scripts/bootstrap.sh",
        "shadow-docs/changes/20260925-chore-bootstrap-v14/brief.md",
        "shadow-docs/knowledge/install-distribution.md"
      ],
      "message": "chore(cli): bootstrap 一键装机 + v1.4.0 发版 + install-distribution 卡更新(双产物契约/adapters/命名冲突/release 非任务)",
      "title": "20260925-chore-bootstrap-v14",
      "body": ""
    }
  }
}
---

# bootstrap 一键装机 + CLI v1.4.0 发版 + install-distribution 卡更新

## 动机

workflow/bind 域已合并(PR #31)但 CLI 最新 release 仍是 v1.3.0,新域不在任何发布产物里;新机器装机缺统一入口(装 CLI → workflow install → bind 三段手工)。本 change 补 bootstrap 脚本、发 v1.4.0、把 PR #31/#20/#19 沉淀的知识写回 install-distribution 卡。

## 引用规范

- shadow-docs/knowledge/install-distribution.md
  - 当前结论: 双轨、指针语义、冒烟前置、托管 guard——bootstrap 与 workflow/bind 域全部沿用
  - 适用 scope: scripts/bootstrap.sh、lib/domains/workflow.mjs、lib/domains/bind.mjs

## 决策

- **选型:** `scripts/bootstrap.sh` 复用 install-cli.sh 装 CLI(复用其双轨/指针/回滚),再编排 workflow plan→execute 与 bind plan→execute 两段凭证链;宿主缺省 claude-code(原生),可传参覆盖;发版 v1.4.0(tag 挂 tarball,bootstrap 以 raw@$TAG 引用 install-cli.sh)
- **对比方案:** bootstrap 自带物化逻辑(否决——与 install-cli.sh 重复,双份维护);不做脚本只写文档(否决——一条命令的装机体验是分发反转的终点)
- **理由:** 装机链路的每一环都复用已验证机制;脚本只做编排不做实现

## 任务

### Phase 1
- [x] bootstrap 脚本 — `scripts/bootstrap.sh` — 装 CLI → workflow 物化 → bind 绑定,编排两段 plan/execute 凭证链
- [x] 版本升 1.4.0 — `package.json` — 配对发版
- [x] 知识落卡 — `shadow-docs/knowledge/install-distribution.md` — 双产物契约/adapters/命名冲突教训/release 不作为 task/readdir 确定化

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新(本 change 即落卡动作本身)
- **候选卡片:** shadow-docs/knowledge/install-distribution.md
- **理由:** 见任务 3
