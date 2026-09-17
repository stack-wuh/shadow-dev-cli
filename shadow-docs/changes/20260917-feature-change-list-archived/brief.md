---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-feature-change-list-archived",
  "type": "feature",
  "scope": null,
  "status": "reviewed",
  "baseBranch": "main",
  "branch": "feature/20260917-feature-change-list-archived",
  "files": [],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 17,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/17",
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "f10148117080397c1d76b75ae12a7492fb7867af",
    "verifiedAt": "2026-09-17T11:59:26.844Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "issue:17",
    "planHash": "e5ee5e90f8f71653279dd3e219f28d4aabf002430d986f6131d74a78871b662a",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "change list 支持查询已归档变更（--all / --archived）",
      "body": "",
      "labels": [
        "feature"
      ]
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/cli-output-contract.md",
    "reason": "本变更直接修订该卡片的 change list 契约条款（opt-in 归档参数与 archived 字段），并已随变更写回卡片"
  }
}
---

# change list 支持查询已归档变更（--all / --archived）

## 动机

`change list` 按现行契约只列活动变更、静默跳过 archive。实际使用中用户的第一个问题就是"做过的提案有哪些"——当前 main 上活动变更为空，`change list` 恒返回 `[]`，8 个已归档提案只能翻 `shadow-docs/changes/archive/` 目录或 `INDEX.md`，CLI 无法回答。需要把归档可见性纳入 `change list`，且不破坏刚钉住的默认输出契约。

## 引用规范

- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout 单行 JSON 为机器契约；`change list` 现约束为"只列活动目录，archive 与解析失败目录静默跳过"——本变更修订该条款为 opt-in 参数形态
  - 适用 scope: cli.mjs, lib/commands.mjs, lib/human.mjs, lib/i18n.mjs, lib/output.mjs
- norms/code-style.md
  - 当前结论: 渐进式治理，只改与本变更相关的；不为未来场景提前抽象（故不新增 path/pullRequest 等未要求字段，不新增互斥错误码）
  - 适用 scope: lib/domains/change.mjs
- norms/tdd-verification.md
  - 当前结论: 先写失败测试确认红，再最小实现转绿
  - 适用 scope: test/cli.test.mjs

## 决策

- **选型:** 扁平合并列表 + 每条 `archived` 布尔字段；`--all` 列活动+归档（按 name 排序），`--archived` 只列归档，默认仍只列活动（条目同样带 `archived:false`，视为契约演进，同步更新既有 deepEqual 钉住用例）。
- **对比方案:** 分组返回 `{changes, archivedChanges}` 未选——同一命令在不同 flag 下 JSON 形状不一致，机器流需分支处理；独立子命令 `change archived` 未选——多一个命令面且"看全部"需跑两次（接口形态已在对齐阶段与用户确认为 opt-in 参数）。
- **理由:** 单数组 + 判别字段是消费者最稳定的形状，jq 过滤即可还原两个视图；双目录扫描直接复用 `lib/indexer.mjs` 既有规则（含 `brief(r, name, archived)` 第三参与解析失败静默跳过），不引入第二套目录遍历事实源；`--all` 与 `--archived` 同传按超集 `--all` 处理，不新增错误码，避免无谓扩大契约面；参数描述进 `COMMANDS` 目录后 help 与缺参提示零成本派生，符合单一事实源约束。

## 任务

### Phase 1（TDD：红 → 绿）

- [x] task-1 — `test/cli.test.mjs` — 新增失败用例：`--all` 返回活动+归档合并且排序、`--archived` 只列归档、默认只列活动；所有条目含 `archived` 布尔；既有 `change list` 用例的 deepEqual 同步补 `archived: false`；跑一遍确认红
- [x] task-2 — `lib/commands.mjs` — `change.list` 目录补 `--all`/`--archived` 参数描述（zh/en，注明同传按 --all），example 不变
- [x] task-3 — `lib/domains/change.mjs`、`cli.mjs` — `list(r, o)` 按参数决定扫描目录集合（复用 indexer 的目录规则与 `brief(r, name, archived)`），条目加 `archived` 字段；`cli.mjs` dispatch 透传 `o`；测试转绿

### Phase 2（文档与知识回写）

- [x] task-4 — `README.md` — 命令表 `change list` 行补 `--all`/`--archived` 说明
- [x] task-5 — `shadow-docs/knowledge/cli-output-contract.md` — 修订执行约束第 3 条为 opt-in 契约（含 `archived` 字段与两参数同传语义），验证方式补新用例名，source 追加本 brief

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/cli-output-contract.md
- **理由:** 本变更直接修订该卡片中 `change list` 的执行约束条款（"只列活动目录，跳过 archive"→ opt-in 参数契约），不新增卡片
