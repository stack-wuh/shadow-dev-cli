---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-feature-tty-human-default",
  "type": "feature",
  "scope": "cli.mjs,lib",
  "status": "proposed",
  "baseBranch": "main",
  "branch": null,
  "files": [
    "README.md",
    "cli.mjs",
    "lib/human.mjs",
    "lib/output.mjs",
    "shadow-docs/knowledge/cli-output-contract.md",
    "shadow-docs/menu.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 9,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/9",
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
    "checkpoint": "issue:9",
    "planHash": "3b465a0a2be42f724fc9a72998f3445419f963e2347e03708ab1ce829f1a36b4",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "交互终端默认人用视图，JSON 经 --json 显式开启",
      "body": "终端里默认只见人用层（表/进度/下一步），stdout JSON 仅在非TTY、--json 或 SHADOW_DEV_JSON=1 时输出；agent 管道路径零破坏。plan 收场行透出 planHash 兜底 PTY 场景。更新 cli-output-contract 卡片（修订 stdout 恒 JSON 条款）。依赖 #8（help-compact）先合。",
      "labels": [
        "feature"
      ]
    }
  }
}
---

# 交互终端默认人用视图，JSON 经 --json 显式开启

## 动机

实测反馈（红框噪音）证明方案 A 的「stdout 恒 JSON」在人类终端上仍是硬伤：人敲一条 `shadow-dev help` 就要吞一行机器流。产品诉求变更为**双通道按受众自动路由**：管道/重定向（agent、脚本）保持 JSON 默认不变；交互终端默认只呈现 stderr 人用层、stdout 静默；`--json`（或 `SHADOW_DEV_JSON=1`）在任何环境强制回 JSON 单行契约。当年否掉「裸 TTY 双模式」的两个理由——PTY 撕裂契约、planHash 不可恢复——分别用「人用收场行透出 planHash」与「技能侧 --json 显式化」兜底。

## 引用规范

- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout 恒为单行 JSON 契约，人用层只走 stderr。
  - 适用 scope: 本变更**修订**该规则为「JSON 面按环境+显式开关出现」，ship 时原位更新卡片（知识动作=更新）。双通道内容同源（commands.mjs）不变。
- norms/code-style.md
  - 当前结论: 渐进式治理；输出判定收敛到单一纯函数，不散落 isTTY 检查。
  - 适用 scope: lib/output.mjs、cli.mjs

## 决策

- **选型:** 判定规则 `jsonEnabled = !isTTY || o.json || env SHADOW_DEV_JSON==='1'`；输出出口收敛为 `output.emit(v, o)`（打印与 exitCode 一起管）。TTY 抑制 JSON 时，人用收场行必须透出机器可恢复的关键值（`planHash`、写操作 checkpoint 摘要）；`--json` 输出保持单行不美化。
- **对比方案:** ① 全环境默认人用、agent 也要 `--json`——直接打爆所有现有技能与 47 项测试的调用形态，否；② `--json` 输出 pretty 多行——把机器面变成视觉件，agent 解析脆弱，人可 `| jq`，否；③ 维持方案 A——无视明确产品诉求，否。
- **理由:** 管道默认不变 = 存量 agent/测试零破坏；TTY 默认人用 = 人类终端零噪音；显式开关 = 逃生门与脚本在终端的安全阀。planHash 透出把 PTY 风险收敛到「agent 在 PTY 且不带 --json」的残余场景，技能文档统一加 `--json` 消除。

## 任务

### Phase 1 — 契约测试先行（TDD）

- [ ] `jsonEnabled` 纯函数单测：pipe 无 flag=true、TTY 无 flag=false、TTY+--json=true、env 强制=true —— `test/cli.test.mjs` `lib/output.mjs`
- [ ] 存量 47 项 subprocess 测试保持绿色（spawnSync 管道非 TTY 路径），新增断言：管道无 `--json` 仍出 JSON、有 `--json` 单行不 pretty —— `test/cli.test.mjs`

### Phase 2 — 实现

- [ ] `lib/output.mjs`：新增 `jsonEnabled`/`emit`，`out`/`fail` 收拢 —— `lib/output.mjs`
- [ ] `cli.mjs` 出口改 `emit(v, o)`；`lib/human.mjs` 收场行透出 `planHash`（plan 信封存在时）与写结果 checkpoint —— `cli.mjs` `lib/human.mjs`
- [ ] `--json` 从"无操作兼容参数"升级为契约开关，README「--json」段落改写 —— `README.md`

### Phase 3 — 回归与文档知识

- [ ] README 输出模型段落更新（管道默认/TTY 默认/开关）；全量回归 —— `README.md` `test/cli.test.mjs`
- [ ] 更新卡片 `cli-output-contract.md`（新规则 + source 追加）与 menu 关键词 —— `shadow-docs/knowledge/cli-output-contract.md` `shadow-docs/menu.md`

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/cli-output-contract.md
- **理由:** 「stdout 恒 JSON」是卡片首条结论，本变更将其修订为「按环境+显式开关路由」，必须原位更新防止旧结论误导后续变更；双通道同源、code 不本地化等其余条款不变。

## 非目标

- 彩色输出、交互式问答（inquirer 类）、TTY 下 pretty JSON。
