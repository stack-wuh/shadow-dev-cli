---
{
  "schema": "shadow-dev/v1",
  "name": "20261008-feature-artifact-capability-contract",
  "type": "feature",
  "scope": "lib/domains/workflow.mjs,lib/commands.mjs,test",
  "status": "archived",
  "baseBranch": "main",
  "branch": "feature/20261008-feature-artifact-capability-contract",
  "files": [
    "README.md",
    "lib/commands.mjs",
    "lib/domains/workflow.mjs",
    "lib/errors.mjs",
    "lib/human.mjs",
    "lib/i18n.mjs",
    "shadow-docs/knowledge/install-distribution.md",
    "shadow-docs/menu.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 46,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/46",
    "pullRequest": 47,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/47"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "0fd64f40ca74261333b881f9ee4310df0c4d9745",
    "verifiedAt": "2026-10-09T14:06:23.116Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:47",
    "planHash": "ac475b8eb83d6ba018e3b3676d7a1d2e40c4630a21febd3f48e7284d888df0af",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] 产物能力契约：workflow 产物自声明 requiresCommands，CLI 物化前断言",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\n分发权威正在从「workflow 插件引导 CLI」反转为「CLI 驱动 workflow 内容」（用户已定：一律走 CLI，后续以引导网页为入口）。反转的前提是删除 workflow 仓的 `cliVersion` pin 与 SessionStart 自举 hook——但 pin 一删，「skills 引用的命令在已安装 CLI 里不存在」这件事就再没有任何机制兜住。实证：pin 为 `v1.4.0`（已安装版），而 propose/apply/archive 三个 skill 已在指挥 `worktree inspect|plan|execute|remove`，worktree 域只在 main 上、v1.5.0 从未发布；skill 里的降级写法「命令不可用时直接走 branch」让缺口静默化。\n\n本变更把版本兼容从「静态 pin」升级为「运行时能力断言」：产物自声明它需要哪些命令，CLI 在物化落盘前拿自身 `COMMANDS` 目录比对，不满足就响亮拒绝且指针不动。这是反转的承重墙，必须先落地。\n\n## 引用规范\n- `shadow-docs/knowledge/install-distribution.md`\n  - 当前结论: 双轨模型（release 物化轨 / link 直通轨）；**指针落盘前置校验不可绕过**——物化轨冒烟不过则 `CURRENT` 不动；workflow 产物消费契约三件必备（`marketplace.json`/`package.json`/`skills/`）+ `adapters/`（≥v6.3.1）；**pack 清单与消费方契约两处同源登记**；**release 不作为 brief task**（机械门禁要求全任务勾选，发布在 review 之后，写成 task 会死锁）。\n  - 适用 scope: `lib/domains/workflow.mjs`, `test/cli.test.mjs`\n- `shadow-docs/knowledge/cli-output-contract.md`\n  - 当前结论: 新增输出必须二选一（stdout JSON 契约=公开 API 需测试钉住 / stderr 人用层）；`lib/commands.mjs` 是两通道单一事实源；`nextStep`/新增字段为 additive 且不得参与 hash 输入；错误 code 永不本地化；**stderr 文案断言必须显式钉 `--lang`**（CI runner locale 会改变渲染语言）。\n  - 适用 scope: `lib/domains/workflow.mjs`, `lib/commands.mjs`, `lib/human.mjs`, `README.md`\n- `shadow-docs/knowledge/plan-credential-chain.md`\n  - 当前结论: 无 brief 域以 `--plan-hash` 为唯一凭证，plan/execute 用同一 planData 重算对比；易变字段须由 `plan.norm()` 剥离后再入 hash。\n  - 适用 scope: `lib/domains/workflow.mjs`（能力断言发生在 execute 的 planData 重算之后，不得改变 hash 输入语义）\n- `norms/tdd-verification.md`\n  - 当前结论: L 级完整 TDD——先写能复现失败的测试并确认失败，再最小实现；无失败测试记录视为未开始；进度可见性（开工报数、逐完成一行、卡点先报）。\n  - 适用 scope: 全流程\n- `norms/knowledge-cards.md`\n  - 当前结论: 能更新现有卡时不新增；更新须补 `verified-depth` + `verified-scope`，`runtime` 声明必须附可追溯观察点。\n  - 适用 scope: `shadow-docs/knowledge/`\n\n## 决策\n- **选型:** 方案 A——**CLI-first**。CLI 侧新增产物能力断言并发版（v1.5.0）；随后 workflow 仓 change 才声明 `requiresCommands` 并删除 `cliVersion` pin / SessionStart hook / vendored install-cli.sh。\n- **对比方案:**\n  - 方案 B（workflow-first，即我上一轮表格原顺序：先删 pin 与 hook）：未选。删除后、能力校验上线前存在窗口，期间「内容要求未发布命令」既无 pin 也无断言，与本次要消灭的缺陷同类。\n  - 方案 C（双仓同一 change）：未选。违反一 PR 一仓与小步快跑，且 CLI 需发版、workflow 不需，发布节奏不同；跨仓接缝本来就该按「消费方先行兼容、生产方随后声明」的顺序演进。\n  - 方案 A 变体（CLI 侧继续读 pin / 维护 cliVersion 兼容矩阵）：未选。pin 是静态断言，需要每次发版人工同步（本轮已实证同步失败：README 写 v1.1.0、pin v1.4.0、skills 要 v1.5.0）；能力名是产物与 CLI 之间唯一会自然保持同步的货币。\n- **理由:** 兼容判定发生在**装不装得下来**这个不可绕过的关口，复用既有「冒烟不过则指针不动」的安全语义，零新机制；缺省（产物未声明 `requiresCommands`）视为兼容，旧产物零破坏；`workflow status` 暴露 `missingCommands` 让引导网页有一个可读的健康信号。\n\n## 任务\n### Phase 1 — 先红（确认失败）\n\n- [x] 契约用例·拒绝路径 — `test/cli.test.mjs` — fixture 产物 package.json 声明 `requiresCommands: [\"worktree.inspect\"]`，跑 `workflow execute --from <fixture>`：断言 exit 1、错误码 `ARTIFACT_INCOMPATIBLE`、`CURRENT`/`PREVIOUS` 内容不变、目标版本目录不残留（stderr 断言显式钉 `--lang zh`）。**先跑，确认为红。**\n- [x] 契约用例·缺省兼容 — `test/cli.test.mjs` — 无 `requiresCommands` 字段的既有 fixture 仍成功物化并切指针（当前实现应已满足，跑绿作为回归钉）。\n- [x] 契约用例·status 投影 — `test/cli.test.mjs` — `workflow status` 新增 `artifactVersion`/`cliVersion`/`missingCommands`（additive，缺省空数组）且参与 stdout 契约。先红。\n\n### Phase 2 — 最小实现转绿\n\n- [x] 能力断言落点 — `lib/domains/workflow.mjs` — 物化校验段（现 `verify()` / `verOf()` 附近、冒烟之前或同段）读取产物 `package.json.requiresCommands`，与 `lib/commands.mjs` 导出的 `COMMANDS` 键集合比对；缺失即 `err('ARTIFACT_INCOMPATIBLE', …, 1)`，不写指针。link 轨同样断言。\n- [x] status 与 plan 投影 — `lib/domains/workflow.mjs` — `status`/`resolvedRoot` 消费同一判定函数，产出上述三字段；`present()` 保持最小投影（不整段回显产物目录）。\n- [x] 目录与文档同源 — `lib/commands.mjs`, `README.md` — 新错误码进退出码表（1 类：产物/校验），`workflow execute` 的 args.desc 与示例同步；README「核心机制/排障」两表登记 `ARTIFACT_INCOMPATIBLE` 的处置（升级 CLI）。\n\n### Phase 3 — 收口\n\n- [x] 错误面登记 — `lib/errors.mjs`, `lib/human.mjs`, `lib/i18n.mjs` — 新码的 HINTS 短句与 zh/en 文案（stdout 不本地化，stderr 双版）。\n- [ ] 全量回归 — `test/cli.test.mjs` — `npm test` 全绿；**执行环境以 CI `test.yml`（ubuntu/macos/windows × node 20/22/24）为准**：开发机本机 `node --test` 在 git-fixture 前置组即挂死（spec reporter 0 用例回报完成），全绿证据＝CI run 链接。同时确认 hash 输入未因新增字段漂移（`plan.norm()` 语义不变）。\n- [x] 跨仓顺序验证 — `test/cli.test.mjs` — 用 `--from` 造一个「声明了当前 CLI 不存在的命令」的产物目录，手跑一次完整 plan→execute，贴出拒绝输出作为 runtime 观察点。\n\n完整 brief：shadow-docs/changes/20261008-feature-artifact-capability-contract/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261008-feature-artifact-capability-contract\",\"type\":\"feature\",\"scope\":\"lib/domains/workflow.mjs,lib/commands.mjs,test\",\"status\":\"committed\",\"branch\":\"feature/20261008-feature-artifact-capability-contract\",\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261008-feature-artifact-capability-contract/brief.md\",\"cliVersion\":\"1.4.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "feature"
      ]
    },
    "commit": {
      "files": [
        "shadow-docs/changes/20261008-feature-artifact-capability-contract/brief.md"
      ],
      "message": "docs(shadow): 结果段回填——CI 9/9 + runtime 10/10 证据"
    },
    "release": {
      "files": [
        "shadow-docs/changes/20261008-feature-artifact-capability-contract/brief.md"
      ],
      "message": "docs(shadow): review 结论重钉至最终提交 5dc4825（CI run 37864859648 9/9）",
      "title": "[feature] 产物能力契约：workflow 产物自声明 requiresCommands，CLI 物化前断言 (#46)",
      "body": "Closes #46\n\n完整 brief：shadow-docs/changes/20261008-feature-artifact-capability-contract/brief.md"
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/install-distribution.md",
    "reason": "卡片更新已随 PR #47 合入 main；本次为归档前置的 verifiedCommit 重钉（main=0fd64f4），验证证据仍为 CI 9/9（run 37864139301）+ runtime 10/10"
  }
}
---

# 产物能力契约：workflow 产物自声明 requiresCommands，CLI 物化前断言

## 动机

分发权威正在从「workflow 插件引导 CLI」反转为「CLI 驱动 workflow 内容」（用户已定：一律走 CLI，后续以引导网页为入口）。反转的前提是删除 workflow 仓的 `cliVersion` pin 与 SessionStart 自举 hook——但 pin 一删，「skills 引用的命令在已安装 CLI 里不存在」这件事就再没有任何机制兜住。实证：pin 为 `v1.4.0`（已安装版），而 propose/apply/archive 三个 skill 已在指挥 `worktree inspect|plan|execute|remove`，worktree 域只在 main 上、v1.5.0 从未发布；skill 里的降级写法「命令不可用时直接走 branch」让缺口静默化。

本变更把版本兼容从「静态 pin」升级为「运行时能力断言」：产物自声明它需要哪些命令，CLI 在物化落盘前拿自身 `COMMANDS` 目录比对，不满足就响亮拒绝且指针不动。这是反转的承重墙，必须先落地。

## 复杂度评级

- **评级:** L
- **理由:** 三要素——①契约变更：产物消费契约新增必备项（`requiresCommands`）+ 新增错误码 + `workflow status` stdout 契约新增字段，且是跨仓接缝；②触及面：分发域核心（`lib/domains/workflow.mjs`）与命令目录单一事实源（`lib/commands.mjs`）；③可发现性：坏在「装不上/旧 CLI 才可见」，运行时路径依赖外部产物与真实文件系统，静态读码看不出来。
- **期望验证深度:** runtime（隔离 `SHADOW_WORKFLOW_PREFIX` + `--from` fixture 产物做真实物化，观察拒绝路径下 CURRENT/PREVIOUS 字节不变、放行路径正常切指针）

## 引用规范

- `shadow-docs/knowledge/install-distribution.md`
  - 当前结论: 双轨模型（release 物化轨 / link 直通轨）；**指针落盘前置校验不可绕过**——物化轨冒烟不过则 `CURRENT` 不动；workflow 产物消费契约三件必备（`marketplace.json`/`package.json`/`skills/`）+ `adapters/`（≥v6.3.1）；**pack 清单与消费方契约两处同源登记**；**release 不作为 brief task**（机械门禁要求全任务勾选，发布在 review 之后，写成 task 会死锁）。
  - 适用 scope: `lib/domains/workflow.mjs`, `test/cli.test.mjs`
- `shadow-docs/knowledge/cli-output-contract.md`
  - 当前结论: 新增输出必须二选一（stdout JSON 契约=公开 API 需测试钉住 / stderr 人用层）；`lib/commands.mjs` 是两通道单一事实源；`nextStep`/新增字段为 additive 且不得参与 hash 输入；错误 code 永不本地化；**stderr 文案断言必须显式钉 `--lang`**（CI runner locale 会改变渲染语言）。
  - 适用 scope: `lib/domains/workflow.mjs`, `lib/commands.mjs`, `lib/human.mjs`, `README.md`
- `shadow-docs/knowledge/plan-credential-chain.md`
  - 当前结论: 无 brief 域以 `--plan-hash` 为唯一凭证，plan/execute 用同一 planData 重算对比；易变字段须由 `plan.norm()` 剥离后再入 hash。
  - 适用 scope: `lib/domains/workflow.mjs`（能力断言发生在 execute 的 planData 重算之后，不得改变 hash 输入语义）
- `norms/tdd-verification.md`
  - 当前结论: L 级完整 TDD——先写能复现失败的测试并确认失败，再最小实现；无失败测试记录视为未开始；进度可见性（开工报数、逐完成一行、卡点先报）。
  - 适用 scope: 全流程
- `norms/knowledge-cards.md`
  - 当前结论: 能更新现有卡时不新增；更新须补 `verified-depth` + `verified-scope`，`runtime` 声明必须附可追溯观察点。
  - 适用 scope: `shadow-docs/knowledge/`

## 决策

- **选型:** 方案 A——**CLI-first**。CLI 侧新增产物能力断言并发版（v1.5.0）；随后 workflow 仓 change 才声明 `requiresCommands` 并删除 `cliVersion` pin / SessionStart hook / vendored install-cli.sh。
- **对比方案:**
  - 方案 B（workflow-first，即我上一轮表格原顺序：先删 pin 与 hook）：未选。删除后、能力校验上线前存在窗口，期间「内容要求未发布命令」既无 pin 也无断言，与本次要消灭的缺陷同类。
  - 方案 C（双仓同一 change）：未选。违反一 PR 一仓与小步快跑，且 CLI 需发版、workflow 不需，发布节奏不同；跨仓接缝本来就该按「消费方先行兼容、生产方随后声明」的顺序演进。
  - 方案 A 变体（CLI 侧继续读 pin / 维护 cliVersion 兼容矩阵）：未选。pin 是静态断言，需要每次发版人工同步（本轮已实证同步失败：README 写 v1.1.0、pin v1.4.0、skills 要 v1.5.0）；能力名是产物与 CLI 之间唯一会自然保持同步的货币。
- **理由:** 兼容判定发生在**装不装得下来**这个不可绕过的关口，复用既有「冒烟不过则指针不动」的安全语义，零新机制；缺省（产物未声明 `requiresCommands`）视为兼容，旧产物零破坏；`workflow status` 暴露 `missingCommands` 让引导网页有一个可读的健康信号。

## 任务

### Phase 1 — 先红（确认失败）

- [x] 契约用例·拒绝路径 — `test/cli.test.mjs` — fixture 产物 package.json 声明 `requiresCommands: ["worktree.inspect"]`，跑 `workflow execute --from <fixture>`：断言 exit 1、错误码 `ARTIFACT_INCOMPATIBLE`、`CURRENT`/`PREVIOUS` 内容不变、目标版本目录不残留（stderr 断言显式钉 `--lang zh`）。**先跑，确认为红。**
- [x] 契约用例·缺省兼容 — `test/cli.test.mjs` — 无 `requiresCommands` 字段的既有 fixture 仍成功物化并切指针（当前实现应已满足，跑绿作为回归钉）。
- [x] 契约用例·status 投影 — `test/cli.test.mjs` — `workflow status` 新增 `artifactVersion`/`cliVersion`/`missingCommands`（additive，缺省空数组）且参与 stdout 契约。先红。

### Phase 2 — 最小实现转绿

- [x] 能力断言落点 — `lib/domains/workflow.mjs` — 物化校验段（现 `verify()` / `verOf()` 附近、冒烟之前或同段）读取产物 `package.json.requiresCommands`，与 `lib/commands.mjs` 导出的 `COMMANDS` 键集合比对；缺失即 `err('ARTIFACT_INCOMPATIBLE', …, 1)`，不写指针。link 轨同样断言。
- [x] status 与 plan 投影 — `lib/domains/workflow.mjs` — `status`/`resolvedRoot` 消费同一判定函数，产出上述三字段；`present()` 保持最小投影（不整段回显产物目录）。
- [x] 目录与文档同源 — `lib/commands.mjs`, `README.md` — 新错误码进退出码表（1 类：产物/校验），`workflow execute` 的 args.desc 与示例同步；README「核心机制/排障」两表登记 `ARTIFACT_INCOMPATIBLE` 的处置（升级 CLI）。

### Phase 3 — 收口

- [x] 错误面登记 — `lib/errors.mjs`, `lib/human.mjs`, `lib/i18n.mjs` — 新码的 HINTS 短句与 zh/en 文案（stdout 不本地化，stderr 双版）。
- [x] 全量回归 — `test/cli.test.mjs` — `npm test` 全绿；**执行环境以 CI `test.yml`（ubuntu/macos/windows × node 20/22/24）为准**：开发机本机 `node --test` 在 git-fixture 前置组即挂死（spec reporter 0 用例回报完成），全绿证据＝CI run 链接。同时确认 hash 输入未因新增字段漂移（`plan.norm()` 语义不变）。
- [x] 跨仓顺序验证 — `test/cli.test.mjs` — 用 `--from` 造一个「声明了当前 CLI 不存在的命令」的产物目录，手跑一次完整 plan→execute，贴出拒绝输出作为 runtime 观察点。

## 非目标

- 不在本 change 动 workflow 仓（删 pin/hook/vendored installer、补 `adapters/codex.json`、README 命令面纠偏）——紧随其后的独立 change。
- 不做 `template/` 目录与 `project init|doctor|upgrade`——第三个 change。
- 不改 `bind` 语义与 sidecar 格式；不引入版本号兼容矩阵。
- 发版（tag + GitHub Release）不作为 task：按 install-distribution 卡的既有教训，发布在 review 之后的交付环节执行。

## 结果

- 实际耗时: ≈75 分钟墙钟（其中 ~12 分钟耗在本机 `node --test` 挂死定位与重试；含 CI 等待 ~6 分钟）
- 验证:
  - **全量回归（task-8，期望深度 runtime）= CI**：`gh pr checks 47` → **9/9 pass**（ubuntu/macos/windows × node 20/22/24，`node --test test/cli.test.mjs test/install.test.mjs` 共 105 用例）。两次 run 均 `completed success`：run 37864130964（push 触发）、run 37864139301（PR 触发），https://github.com/stack-wuh/shadow-dev-cli/actions/runs/37864139301
  - **契约用例 4 条**：实现前逐条红（`not ok`/断言不符），实现后 `--test-name-pattern='capability contract'` 收敛 `# pass 4 # fail 0`；已包含在上述 CI 全绿内。
  - **runtime 直跑取证 10/10**（绕开本机 runner，逐次 spawn 有限重试）：plan 预览 `missingCommands`、兼容产物放行（CURRENT 6.3.0→7.0.0）、越权产物 execute `exit 1 ARTIFACT_INCOMPATIBLE`、拒绝后 `CURRENT` 不动且无 `shadow-dev-workflow-9.9.9` 残留目录、link 轨拒绝且 `LINK` 不写、`status` 三元组 `artifactVersion/cliVersion/missingCommands`、zh 拒绝指引走 stderr 且 stdout 的 code 不本地化。
  - **本机限制（非代码缺陷）**：`npm test` 全量在本机 240s 报警 ×2 不收敛，spec reporter 显示 0 条用例回报完成、卡死在 git-fixture 前置组；抽跑期失败签名全部是 `status:null`/`JSON.parse('')`（子进程被 139 打死），无一条断言值不符。已作为待写回信号提交 review。
- 交付: issue #46 · PR #47（`feature/20261008-feature-artifact-capability-contract`）
- 信号提案（review 第 9 项，**随本 change 输出但不在本 change 落文件**——CLI 仓尚无 `shadow-docs/signals.md`，建档需独立小 change，遵守「只修改 brief 声明文件」）：
  1. negative · 权重 3 · 深度 runtime · 域/scope：验证工具链 · 本仓测试。`node --test` 全量在开发机不可信：139 段错误使被 spawn 的 CLI 子进程返回 `status:null`（表现为 `JSON.parse('')` 假失败），runner 还可能整体挂死（spec reporter 0 用例回报）。**且绝不要用 `out=$(node --test …)` 收集**——子进程被信号打死时孤儿子进程仍持有管道写端，命令替换永不返回（本 change 实踩两次，各白等约 5 分钟）。改法：`perl -e 'alarm N; exec @ARGV'` 加界 + 输出重定向到文件 + 全量回归以 CI `test.yml` 为准。退役条件：换机/Node 升级后 139 消失，或测试改为不 spawn 子进程。
  2. negative · 权重 2 · 深度 unit · 域/scope：CLI 自身开发 · 命令入口。`shadow-dev` shim 解析到**已装版本**（本次 1.4.0），不是工作树代码——1.4.0 缺 PR #45「execute 端点零 dirty」，用它跑 `commit` 会残留脏 brief，需额外一条 commit 收口。改法：本仓自测一律 `node cli.mjs …`，或先 `bash scripts/install-cli.sh link <本仓>` 把 shim 钉到工作树。退役条件：发布 v1.5.0 且本机 shim ≥ v1.5.0。
  3. negative · 权重 2 · 深度 unit · 域/scope：Knowledge/brief 编辑 · `shadow-docs/changes/*/brief.md`。brief 正文与 frontmatter 的 `workflow.issuePlan.body` 是**同一份散文的两处副本**，对任务行做字符串替换会先命中快照（文件里快照在正文之前）；本 change 实踩过一次。改法：替换须锚定 frontmatter 之外的正文区间，改完再跑一次 `issue plan` 让快照按正文重渲染。退役条件：issue 快照不再内嵌正文全文。

## 知识评估

- **预期影响:** 更新
- **候选卡片:** `shadow-docs/knowledge/install-distribution.md`
- **理由:** 卡片已登记「workflow 产物消费契约三件必备 + pack 清单与消费方契约两处同源」，本变更把消费契约扩展为「三件必备 + 可选能力声明 `requiresCommands`，缺省兼容」，并新增「物化前能力断言不可绕过」的执行约束——属既有稳定事实的原位演进，不另立新卡（knowledge-cards：能更新不新增）。更新时补 `verified-depth: runtime` 与观察点（隔离前缀下拒绝/放行两路径的指针字节与错误输出）。跨项目经验（「内容产物自声明能力、安装器断言，替代静态版本 pin」）待本 change 落地并验证后，再评估是否上浮进 workflow 仓 `knowledge/`。
