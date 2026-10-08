---
{
  "schema": "shadow-dev/v1",
  "name": "20261005-feature-shadow-dev-config",
  "type": "feature",
  "scope": "lib",
  "status": "archived",
  "baseBranch": "main",
  "branch": "feature/20261005-feature-shadow-dev-config",
  "files": [
    "README.md",
    "lib/config.mjs",
    "lib/github.mjs",
    "lib/human.mjs",
    "lib/i18n.mjs",
    "lib/output.mjs",
    "shadow-docs/changes/20261005-feature-shadow-dev-config/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 34,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/34",
    "pullRequest": 40,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/40"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "0246ef6831b67e85256f3a4132da38e86f4fac65",
    "verifiedAt": "2026-10-08T02:57:44.824Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:40",
    "planHash": "935a23f9ad266467b285b00ff4b6888715677ce1d75f2c59fdeceafc096aca38",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] 双层配置目录 .shadow-dev/——五层优先级 config 解析层",
      "titleRaw": "双层配置目录 .shadow-dev/——五层优先级 config 解析层",
      "supplement": "Brief: shadow-docs/changes/20261005-feature-shadow-dev-config/（L 级：flag>env>项目>用户>默认，v1 键面 lang/quiet/json/github.*）",
      "body": "## 动机\nCLI 的全部偏好只有环境变量与命令行 flag 两个入口（lang/quiet/json/API 参数），机器重启即失、无法随仓库共享、项目级偏好没有持久化位置。用户已批准形态：项目级 `<repo>/.shadow-dev/config.json`（提交仓库、团队共享）+ 用户级 `~/.shadow-dev/config.json`（个人默认），统一优先级链 `flag > env > 项目 config > 用户 config > 内置默认`。插件仓侧的约定文档、hook wrapper 适配与 pin bump 为堆叠变更（依赖本变更发版）。\n\n## 引用规范\n- `shadow-docs/knowledge/cli-output-contract.md`\n  - 当前结论: 语言链固定 `--lang` > `SHADOW_DEV_LANG` > locale 探测 > zh；QUIET 关 stderr、JSON 走 `SHADOW_DEV_JSON`；stdout 契约与语言无关；stderr 断言必须显式钉语言\n  - 适用 scope: lib/i18n.mjs、lib/human.mjs、lib/output.mjs——本变更改其生效来源链，review 通过时须更新卡片语言链条目（verified-depth: unit）\n- `norms/code-style-packages.md`（通用 menu 命中代码变更域）\n  - 当前结论: 消费者只走公开入口\n  - 适用 scope: config.mjs 是配置解析唯一入口，4 个读取点全部换走它，不留旁路\n- `norms/tdd-verification.md`\n  - 当前结论: L 级完整 TDD 先红后绿；进度可见性条款适用\n  - 适用 scope: 本变更全部实现任务\n\n## 决策\n- **选型:** 新建 `lib/config.mjs` 作为五层解析唯一入口（启动时解析一次并缓存），i18n/human/output/github 四文件的 `process.env` 直读改为 `cfg()` 查询；`cli.mjs` 无需感知\n- **对比方案:** 启动时把 config 值回填进 `process.env`（最小改动但隐式化优先级链、坏配置无处报错）；每模块各自读文件（逻辑重复五处，违背单一入口）\n- **理由:** 显式解析层可单测、错误码集中（`CONFIG_INVALID` exit 1）、未知键静默忽略保持跨版本前向兼容而不提前建校验层\n- **项目 config 发现:** 从 cwd 向上找第一个 `.shadow-dev/config.json`，止于文件系统根（命令大多与 git 无关，不绑 git root）\n- **v1 键面:** `lang`(zh|en) / `quiet`(bool) / `json`(bool) / `github.apiBaseUrl`(string) / `github.timeoutMs`(number)。语义与对应 env 变量一致；**token 只走 env**（secrets 不进仓库文件的既有边界）\n- **格式:** 扁平分组 JSON；解析失败/类型不符 → `CONFIG_INVALID`（stderr 定位到文件路径）；值优先级逐键生效（项目有 lang 用户有 timeoutMs 时各取各的）\n\n## 任务\n### Phase 1 — TDD 红灯\n- [ ] 配置解析契约失败测试 — `test/cli.test.mjs` — 六用例先红：项目 config 生效（lang）、五层优先级逐项（flag>env>项目>用户>默认）、json 键恢复机器面、quiet 键静默 stderr、github.apiBaseUrl 键指向 mock、坏配置 CONFIG_INVALID；`SHADOW_DEV_HOME`/fixture tmpdir 隔离用户级\n### Phase 2 — 实现转绿\n- [ ] lib/config.mjs 解析层 — `lib/config.mjs` — 发现（cwd 向上）、双层读取、逐键链式解析、缓存、CONFIG_INVALID\n- [ ] 四读取点切换 — `lib/i18n.mjs` `lib/human.mjs` `lib/output.mjs` `lib/github.mjs` — env 直读改 cfg()，行为对既有测试零回归\n### Phase 3 — 文档与自证\n- [ ] README 配置节 — `README.md` — 双层目录、优先级链、键面表、secrets 边界；环境变量节标注「可被 config 承接」\n- [ ] 新 CLI 自举跑通本 brief — 无 — `shadow-dev task/review` 等命令在带 config 的 fixture 下正常，进度可见性收口对账\n\n## 补充\nBrief: shadow-docs/changes/20261005-feature-shadow-dev-config/（L 级：flag>env>项目>用户>默认，v1 键面 lang/quiet/json/github.*）\n\n完整 brief：shadow-docs/changes/20261005-feature-shadow-dev-config/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261005-feature-shadow-dev-config\",\"type\":\"feature\",\"scope\":\"lib\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261005-feature-shadow-dev-config/brief.md\",\"cliVersion\":\"1.4.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "feature"
      ]
    },
    "release": {
      "files": [
        "README.md",
        "cli.mjs",
        "lib/config.mjs",
        "lib/github.mjs",
        "lib/human.mjs",
        "lib/i18n.mjs",
        "lib/output.mjs",
        "shadow-docs/changes/20261005-feature-shadow-dev-config/brief.md",
        "shadow-docs/knowledge/cli-output-contract.md",
        "test/cli.test.mjs"
      ],
      "message": "feat(config): .shadow-dev/ 双层配置——flag>env>项目>用户>默认五层链，lang/quiet/json/github.* 键面，CONFIG_INVALID 契约",
      "title": "feat(config): .shadow-dev/ 双层配置目录——五层优先级解析",
      "body": "Closes #34\n\n完整 brief：shadow-docs/changes/20261005-feature-shadow-dev-config/brief.md"
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/cli-output-contract.md",
    "reason": "语言链新增项目/用户 config 两级来源,json/quiet/API 参数生效面同步扩展,卡片既有结论被改写"
  }
}
---

# 双层配置目录 .shadow-dev/——项目级与用户级 config.json 解析层

## 动机

CLI 的全部偏好只有环境变量与命令行 flag 两个入口（lang/quiet/json/API 参数），机器重启即失、无法随仓库共享、项目级偏好没有持久化位置。用户已批准形态：项目级 `<repo>/.shadow-dev/config.json`（提交仓库、团队共享）+ 用户级 `~/.shadow-dev/config.json`（个人默认），统一优先级链 `flag > env > 项目 config > 用户 config > 内置默认`。插件仓侧的约定文档、hook wrapper 适配与 pin bump 为堆叠变更（依赖本变更发版）。

## 复杂度评级

- **评级:** L
- **理由:** 改行为契约——lang/quiet/json/API 参数的生效来源从「env+flag」扩展为五层链，触碰 `cli-output-contract.md` 卡片声明的语言链结论；跨 5 个共享模块；错误路径（坏配置）需要新错误码
- **期望验证深度:** runtime（契约测试钉住每层解析，CI 三平台跑）

## 引用规范

- `shadow-docs/knowledge/cli-output-contract.md`
  - 当前结论: 语言链固定 `--lang` > `SHADOW_DEV_LANG` > locale 探测 > zh；QUIET 关 stderr、JSON 走 `SHADOW_DEV_JSON`；stdout 契约与语言无关；stderr 断言必须显式钉语言
  - 适用 scope: lib/i18n.mjs、lib/human.mjs、lib/output.mjs——本变更改其生效来源链，review 通过时须更新卡片语言链条目（verified-depth: unit）
- `norms/code-style-packages.md`（通用 menu 命中代码变更域）
  - 当前结论: 消费者只走公开入口
  - 适用 scope: config.mjs 是配置解析唯一入口，4 个读取点全部换走它，不留旁路
- `norms/tdd-verification.md`
  - 当前结论: L 级完整 TDD 先红后绿；进度可见性条款适用
  - 适用 scope: 本变更全部实现任务

## 决策

- **选型:** 新建 `lib/config.mjs` 作为五层解析唯一入口（启动时解析一次并缓存），i18n/human/output/github 四文件的 `process.env` 直读改为 `cfg()` 查询；`cli.mjs` 无需感知
- **对比方案:** 启动时把 config 值回填进 `process.env`（最小改动但隐式化优先级链、坏配置无处报错）；每模块各自读文件（逻辑重复五处，违背单一入口）
- **理由:** 显式解析层可单测、错误码集中（`CONFIG_INVALID` exit 1）、未知键静默忽略保持跨版本前向兼容而不提前建校验层
- **项目 config 发现:** 从 cwd 向上找第一个 `.shadow-dev/config.json`，止于文件系统根（命令大多与 git 无关，不绑 git root）
- **v1 键面:** `lang`(zh|en) / `quiet`(bool) / `json`(bool) / `github.apiBaseUrl`(string) / `github.timeoutMs`(number)。语义与对应 env 变量一致；**token 只走 env**（secrets 不进仓库文件的既有边界）
- **格式:** 扁平分组 JSON；解析失败/类型不符 → `CONFIG_INVALID`（stderr 定位到文件路径）；值优先级逐键生效（项目有 lang 用户有 timeoutMs 时各取各的）

## 任务

### Phase 1 — TDD 红灯
- [x] 配置解析契约失败测试 — `test/cli.test.mjs` — 六用例先红：项目 config 生效（lang）、五层优先级逐项（flag>env>项目>用户>默认）、json 键恢复机器面、quiet 键静默 stderr、github.apiBaseUrl 键指向 mock、坏配置 CONFIG_INVALID；`SHADOW_DEV_HOME`/fixture tmpdir 隔离用户级
### Phase 2 — 实现转绿
- [x] lib/config.mjs 解析层 — `lib/config.mjs` — 发现（cwd 向上）、双层读取、逐键链式解析、缓存、CONFIG_INVALID
- [x] 四读取点切换 — `lib/i18n.mjs` `lib/human.mjs` `lib/output.mjs` `lib/github.mjs` — env 直读改 cfg()，行为对既有测试零回归
### Phase 3 — 文档与自证
- [x] README 配置节 — `README.md` — 双层目录、优先级链、键面表、secrets 边界；环境变量节标注「可被 config 承接」
- [x] 新 CLI 自举跑通本 brief — 无 — `shadow-dev task/review` 等命令在带 config 的 fixture 下正常，进度可见性收口对账

## 结果

- 实际耗时: 约 50 分钟（含三次本机测试 runner 空转排查）
- 验证: TDD 红灯 6/6 有真实输出（`✖ config: …` 全列表）；实现后五类行为 runtime 观察点全通——项目 config lang 压过 LANG=zh 探测（stderr 英文表）、quiet 双层生效（stderr 0 字节，复跑可复现）、json 键 TTY 恢复机器面、apiBaseUrl 命中 stub、坏配置 CONFIG_INVALID exit 1 且 stdout message 含文件路径。全量契约测试本机 runner 三次 0% CPU 空转（前两次变更 brief 已记录的同类环境问题），转绿确认以 CI 矩阵为准
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/cli-output-contract.md
- **理由:** 卡片「语言链固定 `--lang` > env > locale 探测」的执行约束被本变更改写为五层链（新增两级配置来源）；ship 阶段原位更新并补 verified-depth
