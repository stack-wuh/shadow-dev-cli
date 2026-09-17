---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-feature-help-compact-noise",
  "type": "feature",
  "scope": "cli.mjs,lib",
  "status": "archived",
  "baseBranch": "main",
  "branch": "feature/20260917-feature-help-compact-noise",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/args.mjs",
    "lib/human.mjs",
    "shadow-docs/knowledge/cli-output-contract.md",
    "shadow-docs/menu.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 7,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/7",
    "pullRequest": 8,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/8"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "dc345d5dc9d63a1ce6ee478070bbae87cec39ff2",
    "verifiedAt": "2026-09-17T08:25:18.380Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:8",
    "planHash": "93cf17e6e0c59f5fc6429d40f16833cb39421dbeb2aaf0d1e561c8cdd4c0e550",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "help 输出减噪：默认摘要，--full 展开结构化目录",
      "body": "交互终端实测反馈：help 默认全量 JSON 噪音过大。概览默认只留 data.help 字符串（恒形状），结构化明细经 --full opt-in；组详情不变。更新 cli-output-contract 卡片。",
      "labels": [
        "feature"
      ]
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/cli-output-contract.md",
    "reason": "输出面规则扩展：概览默认最小面（data.help 字符串），结构化 commands 经 --full opt-in"
  }
}
---

# help 输出减噪：默认摘要，--full 展开结构化目录

## 动机

#2 给人用层交付后，交互终端实测反馈暴露新问题：`shadow-dev --help` 默认把 27 条命令的全量 JSON（双语 desc、示例、next 模板）一次性砸进 stdout，人看到红框噪音，机器其实只需要按需取用。默认面应该匹配默认受众：人跑 `--help` 要的是表（已在 stderr），agent 要目录时才付全量。

## 引用规范

- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout 恒为单行 JSON 契约，与语言/环境无关；人用层只走 stderr；code 不本地化。
  - 适用 scope: cli.mjs, lib/args.mjs, lib/human.mjs — 本变更只收缩 stdout 默认面，不触碰双通道分层；卡片需随 ship 更新（知识动作=更新）。
- norms/code-style.md
  - 当前结论: 渐进式治理；公共能力从稳定公开入口导出。
  - 适用 scope: lib/args.mjs、cli.mjs

## 决策

- **选型:** `--full` 视图开关——`help` 概览默认 `data: { help: HELP }`（恒字符串形态，零结构噪音）；`shadow-dev help --full` 才附带 `data.commands` 全目录。`help <命令>` 组详情保持 `{help, commands}` 不变（组面本就小且面向查询）。stderr 人用表不受影响。
- **对比方案:** ① 回到裸字符串 `data: HELP`——丢 `data.help` 稳定形态，#2 刚立的字段又变卦，否；② TTY 下省略 stdout JSON——环境依赖输出，方案 B 死灰，违反 cli-output-contract，否；③ 永远全量不动——无视实测反馈，否。
- **理由:** 默认即契约的"最小充分面"：概览 JSON 一屏可读（<200 字节），agent 需要目录时显式 `--full` 付费。`data.help` 类型跨版本稳定，#2 的向后兼容承诺不回收，只是把 `commands` 降级为 opt-in。

## 任务

### Phase 1 — 契约测试先行（TDD）

- [x] 改造存量 help 测试：默认概览 `data.commands` 不存在、`--full` 才有全目录、`data.help` 恒为字符串；组详情结构不变 —— `test/cli.test.mjs`
- [x] 存量 47 项中受影响断言同步适配，其余保持绿色 —— `test/cli.test.mjs`

### Phase 2 — 实现

- [x] `args()` 布尔参数表加入 `full` —— `lib/args.mjs`
- [x] `helpEnvelope`：概览默认 `{help}`，`o.full` 时加 `commands`；组详情路径不变；`human.printHelp` 概览改从 COMMANDS 直读渲染 —— `cli.mjs` `lib/human.mjs`

### Phase 3 — 文档与知识

- [x] README help 段落更新（默认摘要 / --full 展开 / 组详情） —— `README.md`
- [x] 更新卡片 `cli-output-contract.md`（help 输出面规则 + source 追加本 brief）与 menu 关键词 —— `shadow-docs/knowledge/cli-output-contract.md` `shadow-docs/menu.md`

## 结果

- 实际耗时: 约 15 分钟
- 验证: `node --test` 47/47 通过（help 契约改造后全量回归）；实测默认概览 stdout 348 字节（改造前 17,300，降噪 98%），`--full` 全目录 17,300 不变；stderr 中文表不受影响；修复编辑过程遗留的 human.mjs 双循环头语法错误（`node --check` 当场拦截）。

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/cli-output-contract.md
- **理由:** 输出面规则新增"概览默认最小面、结构化明细 opt-in（--full）"条款，是该卡片的直接扩展；同卡合并，不新增。
