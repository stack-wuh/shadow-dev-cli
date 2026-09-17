---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-fix-missing-arg-hints",
  "type": "fix",
  "scope": "cli,lib/human,lib/i18n,lib/commands,lib/domains",
  "status": "branched",
  "baseBranch": "main",
  "branch": "fix/20260917-fix-missing-arg-hints",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/commands.mjs",
    "lib/domains/change.mjs",
    "lib/human.mjs",
    "lib/i18n.mjs",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 12,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/12",
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
    "checkpoint": "issue:12",
    "planHash": "19859a25948fbde3220e5570c85ae7192411321106a65cfbe5cdca87f2401f16",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "必填参数缺失提示可理解性改造 + change list 发现命令",
      "body": "缺参提示从命令目录派生（flag+desc 单一事实源），24 处 <n> 占位替换为 <change-name>，--name 描述补 shadow-docs/changes/ 指引；新增 change list 发现命令。stdout JSON 错误契约与语言不变性测试保持。",
      "labels": [
        "fix"
      ]
    }
  }
}
---

# 必填参数缺失提示可理解性改造 + change list 发现命令

## 动机

`shadow-dev task list` 缺参时提示「缺少必填参数 --name <变更名>」+「示例: shadow-dev task list --name <n>」，用户无法知道「变更名」是什么、去哪找合法值、什么格式。根因有三：

1. 人用错误层只读 `lib/i18n.mjs` 的 `HINTS[code]`，与命令目录 `lib/commands.mjs` 的 `args.desc`（信息更全）双源并存且前者更差，违反 active 卡片「命令目录是两个通道的单一事实源」约束。
2. 24 个命令的 example 用无意义占位符 `<n>`。
3. CLI 没有任何列出现有变更名的命令，提示没有可执行的发现路径。

## 引用规范

- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout 单行 JSON 是机器契约（按环境路由），人用内容只走 stderr；`lib/commands.mjs` 是 HELP/help JSON/nextStep/错误示例的单一事实源；错误 code 与 nextStep 模板永不本地化。
  - 适用 scope: cli.mjs, lib/output.mjs, lib/human.mjs, lib/i18n.mjs, lib/commands.mjs
- norms/tdd-verification.md
  - 当前结论: 先写失败测试再实现；完成前贴出 lint/test 命令与输出。
  - 适用 scope: 全部代码变更
- knowledge/bug-investigation.md（通用）
  - 当前结论: 复现 → 根因 → 最小修复在同一上下文完成。
  - 适用 scope: cross-project
- norms/code-style.md
  - 当前结论: 渐进式治理，只修与本次直接相关的问题，不顺手扩大范围。
  - 适用 scope: 全仓

## 决策

- **选型:** 方案 A + 方案 B 并入同一变更，分两个 Phase。
  - Phase 1：人用层缺参错误改为**从命令目录派生**——`human.error` 接收已解析 options，对 `*_REQUIRED` 类错误渲染该命令所有缺失必填参数的目录行（`flag * desc`，zh/en 按语言链取用）；`HINTS` 中与之重复的缺参文案降级为兜底。`--name` 的目录描述补全「变更名 = shadow-docs/changes/ 下的子目录名，如 20260917-feature-x」（措辞经确认指向目录+格式示例，不指向 change list）；24 处 example 的 `<n>` 占位符替换为 `<change-name>`。
  - Phase 2：新增 `change list` 发现命令（列出 `shadow-docs/changes/` 下变更的 name/type/status/branch），stdout JSON 契约新增面由测试钉住。
- **对比方案:**
  - 只修 `HINTS.NAME_REQUIRED` 一句文案：治标，双事实源仍在，`--task`/`--files` 等同类问题原样存在。未选。
  - 方案 C（报错时直接列出既有变更名）：破坏人用层最小噪音原则，把查询逻辑混入错误渲染。未选；其诉求由 Phase 2 的 `change list` 承接。
- **理由:** 错误提示从目录派生是 cli-output-contract 单一事实源约束的直接落实，一处维护、全通道生效；stdout JSON 契约面仅 `help` 的 `data.commands[].example` 字符串与新增 `change.list` 两处 additive 变化，错误 `code`/`message`/退出码逐字节不变，语言不变性契约测试保持绿。

## 任务

### Phase 1 — 缺参提示从命令目录派生

- [ ] task-1 — `test/cli.test.mjs` — 先写失败测试：zh 下 `task list` 缺 `--name` 时 stderr 含「变更名」「shadow-docs/changes/」「20260917-feature-x」与 `--name *` 目录行；stdout JSON 的 code/message/exit 逐字节不变
- [ ] task-2 — `lib/human.mjs`、`cli.mjs` — `error()` 增收已解析 options；`*_REQUIRED` 类错误按 flag→option key 映射渲染缺失必填参数行，不再单独 echo 重复 hint
- [ ] task-3 — `lib/commands.mjs`、`lib/i18n.mjs` — `N` 描述补「变更名 = shadow-docs/changes/ 子目录，如 20260917-feature-x」（zh/en）；24 处 example `<n>` → `<change-name>`；`HINTS` 缺参条目收敛为兜底短句
- [ ] task-4 — `test/cli.test.mjs`、README.md — 全量 `node --test` 绿；语言不变性与 QUIET 用例保持；管道/TTY 手工复验（`task list`、`task set` 缺 `--task`）

### Phase 2 — change list 发现命令

- [ ] task-5 — `test/cli.test.mjs`、`lib/domains/change.mjs` — 先钉契约：`change list` 输出 `{ok,command:'change.list',data:{changes:[{name,type,status,branch}]}}`，含 archive 外全部活动变更
- [ ] task-6 — `lib/commands.mjs`、`cli.mjs` — 目录注册 `change.list`（usage/summary/args/example）并接 dispatch；`shadow-dev help` 概览同步出现
- [ ] task-7 — README.md — 命令表补 `change list`

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/cli-output-contract.md
- **理由:** 新增「缺参错误从命令目录 args 派生渲染」的执行约束与 `change list` 契约面；example 占位符规则变更。verified 日期随归档刷新。
