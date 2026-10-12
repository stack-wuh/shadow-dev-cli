---
{
  "schema": "shadow-dev/v1",
  "name": "20261012-fix-pr-params-required",
  "type": "fix",
  "scope": "cli-infrastructure",
  "status": "archived",
  "baseBranch": "main",
  "branch": "fix/20261012-fix-pr-params-required",
  "files": [
    "README.md",
    "lib/commands.mjs",
    "lib/domains/publish.mjs",
    "lib/domains/release.mjs",
    "lib/i18n.mjs",
    "lib/input.mjs",
    "shadow-docs/changes/20261012-fix-pr-params-required/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 55,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/55",
    "pullRequest": 56,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/56"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "c00f030fb51956c258d2d571eb1e1b5ccff9b0e6",
    "verifiedAt": "2026-10-12T10:01:38.006Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:56",
    "planHash": "a79c610a28f1044ea9fe48e1f060e0ab850a7497b5ef3d35b1ae9759b8042955",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "README.md",
        "lib/commands.mjs",
        "lib/domains/publish.mjs",
        "lib/domains/release.mjs",
        "lib/i18n.mjs",
        "lib/input.mjs",
        "shadow-docs/changes/20261012-fix-pr-params-required/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "fix(release): PR 标题与正文必须显式给出，禁止 CLI 回落变更名或代写一行 Closes",
      "title": "fix(release): PR 标题与正文必须显式给出，禁止 CLI 回落变更名或代写一行 Closes",
      "body": "## 变更\n- `lib/input.mjs`：新增 `prParams()`（门的唯一实现处）与抽出的 `bodyFile()`；新增 `--body-file`，`--body` 与 `--body-file` 同传即 `BODY_PARAM_CONFLICT`。\n- `lib/domains/release.mjs`：`planData` 的标题/正文取值序改为 显式入参 > brief 持久化的上一次 plan 参数 > 抛 `PR_PARAMS_REQUIRED`；删除「回落变更名」与「自动补一行 Closes + brief 路径」两条 CLI 自行编造的路径。\n- `lib/domains/publish.mjs`：同一道门（`publish` 不读持久参数，只有显式入参一个来源）。\n- `lib/commands.mjs`：`release.plan` / `publish.plan` 的 `--title` `--body` 标必填并加 `--body-file`；execute 侧文案改为「缺省回退 brief 持久化的上一次 plan 参数」。\n- `lib/i18n.mjs`：`PR_PARAMS_REQUIRED` 与 `BODY_PARAM_CONFLICT` 的中英人话提示。\n- `README.md`：`publish plan` 示例补 `--body-file`，标注标题与正文必填。\n- `test/cli.test.mjs`：新增门用例；原「CLI 自动补 Closes」用例改名并反转断言；6 处既有调用补 `--body`。\n- brief 与实现对齐（动机/覆盖范围/决策/结果四段按落地事实重写，结果段回填观察点）。\n\n## 影响\n- 行为/触发面变化：`release plan` 与 `publish plan` 缺 `--title` 或 `--body`（`--body-file`）时不再产出一份能跑的脏载荷，而是 exit 1 + `code=PR_PARAMS_REQUIRED`，缺失项一次列全；失败发生在任何盘写之前，无副作用。\n- 被删除的编造源只有两个：标题回落变更名、正文自动补 `Closes #N` + `完整 brief：…`。main 上的 `20261011-fix-webhook-body-limit (#528)` 这类裸 slug 标题与薄正文即出自它们。\n- 不受影响的范围：`execute` 侧参数回退语义完全不动；re-plan 免重传保留（取值仍承认 brief 里人上一次给过的值，见 OP-6：同一 planHash）；`commit` / `archive` / `sync` / `bind` / `workflow` 各域零改动；`planHash` 的输入集不变（title/body 本就在凭证内）。\n- 消费侧：`shadow-dev-workflow` 已同波次更新两处 `release plan` 示例与 `docs/cli-guide.md`、`norms/pr-message.md` 第 1 条；插件的 `cliVersion` pin 属能力契约，随下次发版单独走，不在本 PR。\n\n## 验证\n- 复杂度评级 M。门的行为面用真实命令取证：两参数皆缺 → `PR_PARAMS_REQUIRED`（exit 1，无载荷、无盘写）；只给标题 → 同一码且载荷不含回落 slug；`--body` 与 `--body-file` 同传 → `BODY_PARAM_CONFLICT`；`publish plan` 无参 → 同码、前缀随命令变化。\n- 冒烟与状态不变量：`--body-file` 逐字进载荷（`planHash=50634ebc44650b04f332d0b706c7a812bb6d293788d1d47457331d37d129391f`）；不重传任何参数再 plan → 同一 planHash，回退只承认持久值。\n- 被触及不变量单条探针：`node --test --test-name-pattern planHash` → 3 绿 0 红；`--test-name-pattern \"release execute\"` → 1 绿 0 红。\n- 门槛（非证据）：全量 `node --test test/cli.test.mjs` → 111 用例 110 绿 1 红。唯一红项 `workflow release track resolves latest release and downloads the asset via the API` 是本机环境缺陷：用例 spawn `bash` 做 tar，而 PATH 上的 `bash` 命中 Windows 的 WSL 占位程序；改动前的基线跑红在同一条用例、同一原因。\n- 未覆盖项：未在有真实 WSL/Git Bash 的环境复跑该 workflow 用例；GitHub Actions 的三平台矩阵才是它的实际判定处。\n\n## 关联\n- Closes #55\n- brief: shadow-docs/changes/20261012-fix-pr-params-required/brief.md"
    },
    "issuePlan": {
      "title": "[fix] PR 标题与正文必须显式给出，禁止 CLI 回落变更名或代写一行 Closes",
      "titleRaw": "[fix] PR 标题与正文必须显式给出，禁止 CLI 回落变更名或代写一行 Closes",
      "supplement": "",
      "body": "## 动机\n`release plan` 与 `publish plan` 允许不传 `--title` / `--body`，CLI 会静默回退：标题退成变更名（slug），正文退成一行 `Closes #N` + `完整 brief：…`（`lib/domains/release.mjs` 与 `lib/domains/publish.mjs` 的 `planData`）。这条回退路径就是线上脏格式的直接来源——main 上的 `20261011-fix-webhook-body-limit (#528)`、`20261008-refactor-component-standard (#522)` 等裸 slug 标题与薄正文均由它产生。用户 2026-10-12 裁定：PR 标题与正文必须显式给出，**不允许缺省**。\n\n把约定变成机器门槛是本 change 的唯一目的：缺 `--title` 或 `--body` 时 `plan` 阶段即拒绝，而不是生成一份能跑的脏载荷。\n\n## 引用规范\n（brief 缺少该节）\n\n## 决策\n- 门槛放 plan，且**只承认「人给过的值」**：取值序 显式入参 > `workflow.release` 持久值 > 拒绝。被删的是两个编造源，不是 re-plan 免重传。planHash 已把 title/body 计入凭证（`knowledge/plan-credential-chain.md`），在 plan 拒绝即零副作用。\n  - 保留持久化回退的实证理由：`test/cli.test.mjs` 的 `zero-dirty: release rerun cycles converge`（`:971`）与 `:1713` 断言「重跑 plan 不逐字重传」；砍掉会把网络失败的恢复成本抬高一档，与本 change 目标无关。\n  - 备选「plan 一律必须显式重传」被否：与上述既有语义冲突，且不消除任何脏格式——编造只发生在无值可回退时。\n- `Closes #N` 不再由 CLI 代劳（已落地）：issue 关联属正文结构的一部分，已由 `shadow-dev-workflow` 的 `norms/pr-message.md` 第 4 条规定由人/AI 写进 `关联` 段。CLI 静默补一行等于替调用方写正文，正是本次要消除的行为。风险：issue 悬空回归——已由 `pr-message.md` 的必需段与 PR 模板兜住，且 `archive` 门仍会因 PR 未 merged 阻断。\n- 单错误码而非两个：缺失项在 message 里列全，调用方一次修完，避免两轮试错。\n\n## 任务\n- [x] Phase 1 契约：`commands.mjs` 参数元数据与 help/README/cli-guide 同源；确认 `args.mjs` 不做 required 校验（现状仅文档字段），校验落在 domain。\n- [x] Phase 2 门：`release.mjs` / `publish.mjs` 删除回退并抛 `PR_PARAMS_REQUIRED`；`input.mjs` 提供 `--body-file` 读取与优先级。\n- [x] Phase 3 探针：`test/cli.test.mjs` 门用例（两缺/单缺/publish 无参/两参数冲突/`--body-file` 生效/re-plan 回退）+ 被触及不变量的单条探针（planHash 只认参数内容、execute 缺凭证不落提交）；真实命令的观察点写入「结果」段。\n- [x] Phase 4 消费侧：同波次更新 `shadow-dev-workflow` 的 `skills/shadow-dev-hotfix/SKILL.md:88` 与 `skills/shadow-dev-publish/SKILL.md:51`（两处示例当前都没有 `--body`，不改会与新门槛冲突）。属跨仓耦合，插件侧单独走一个 change。\n\n完整 brief：shadow-docs/changes/20261012-fix-pr-params-required/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261012-fix-pr-params-required\",\"type\":\"fix\",\"scope\":\"cli-infrastructure\",\"status\":\"reviewed\",\"branch\":\"fix/20261012-fix-pr-params-required\",\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261012-fix-pr-params-required/brief.md\",\"cliVersion\":\"1.5.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "fix"
      ]
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": "knowledge/plan-credential-chain.md",
    "reason": "载荷不得由 CLI 编造这条契约已落在 lib/input.mjs 的 prParams、命令目录与错误码中，并由 OP-1/OP-2/OP-4/OP-6 四个观察点锁定；planHash 仍只认参数内容，既有卡片无需改写"
  }
}
---

# 20261012-fix-pr-params-required

## 动机

`release plan` 与 `publish plan` 允许不传 `--title` / `--body`，CLI 会静默回退：标题退成变更名（slug），正文退成一行 `Closes #N` + `完整 brief：…`（`lib/domains/release.mjs` 与 `lib/domains/publish.mjs` 的 `planData`）。这条回退路径就是线上脏格式的直接来源——main 上的 `20261011-fix-webhook-body-limit (#528)`、`20261008-refactor-component-standard (#522)` 等裸 slug 标题与薄正文均由它产生。用户 2026-10-12 裁定：PR 标题与正文必须显式给出，**不允许缺省**。

把约定变成机器门槛是本 change 的唯一目的：缺 `--title` 或 `--body` 时 `plan` 阶段即拒绝，而不是生成一份能跑的脏载荷。

## 覆盖范围

- `lib/domains/release.mjs`：`planData` 的标题/正文取值序改为 **显式入参 > brief 持久化的上一次 plan 参数（`workflow.release`）> 抛 `PR_PARAMS_REQUIRED`**；删除 `?? n`（回落变更名）与 `?? Closes 模板`（CLI 代写正文）两条编造回退。
- `lib/domains/publish.mjs`：同一门（`publish` 不读 brief 持久参数，故只有显式入参一个来源）；`publish execute` 的回退语义不变。
- 新错误码 `PR_PARAMS_REQUIRED`（一个码带缺失项列表，调用方一次修完）：机器契约形如 `PR_PARAMS_REQUIRED: release plan requires --title and --body (or --body-file) — the CLI no longer derives them from the change name`；`publish plan` 同码，前缀换 `publish plan`。
- `lib/commands.mjs`：`release.plan` / `publish.plan` 的 `--title` / `--body` 标为 required，help 去掉「缺省为变更名」表述（对外表述必须与行为同源，否则等于教人用回退）。
- `lib/input.mjs`：新增 `prParams()`（门的唯一实现处）与抽出的 `bodyFile()`；新增 `--body-file`（多行 PR 正文在 Windows 下用 `--body "…"` 传不可靠：cmd 引号与换行会切碎）。与 `change.create --body-file` 同一读法，文件缺失 `BODY_FILE_NOT_FOUND`、空内容 `BODY_FILE_EMPTY`；`--body` 与 `--body-file` 同传即 `BODY_PARAM_CONFLICT`（拒绝，不做优先级猜测）。
- `lib/i18n.mjs`：`PR_PARAMS_REQUIRED` 与 `BODY_PARAM_CONFLICT` 两句人话提示（中英对照）。
- `lib/commands.mjs`：`release.plan`/`publish.plan` 的 `--title`/`--body` 标必填、加 `--body-file`；execute 侧参数文案改为「缺省回退 brief 持久化的上一次 plan 参数」，示例同步。
- `README.md`：`publish plan` 示例补 `--body-file` 并注「标题与正文必填」。插件侧 `docs/cli-guide.md` 的表属 Phase 4 跨仓，不在本仓改。
- `test/cli.test.mjs`：新增门用例（两参数皆缺 → 缺失项列全；只给标题 → 仍拒且载荷不含回落标题；`publish plan` 无参 → 同码；`--body` 与 `--body-file` 同传 → 冲突；`--body-file` 逐字进载荷；re-plan 免重传 → 回退持久值）。原 `publish defaults the PR body to Closes #N` 用例改名并**反转断言**为「正文由调用方显式给出」——被删除的行为若继续锁进测试，等于把缺陷固化成契约。另有 6 处既有 `publish plan`/`release plan` 调用补上 `--body`。

**不在范围内**：`execute` 侧参数回退语义一律不动。re-plan 免重传同样保留——门只禁止 **CLI 自行编造**（回落变更名、自动补 `Closes`），不禁止承认人上一次给过的值。

## 决策

- 门槛放 plan，且**只承认「人给过的值」**：取值序 显式入参 > `workflow.release` 持久值 > 拒绝。被删的是两个编造源，不是 re-plan 免重传。planHash 已把 title/body 计入凭证（`knowledge/plan-credential-chain.md`），在 plan 拒绝即零副作用。
  - 保留持久化回退的实证理由：`test/cli.test.mjs` 的 `zero-dirty: release rerun cycles converge`（`:971`）与 `:1713` 断言「重跑 plan 不逐字重传」；砍掉会把网络失败的恢复成本抬高一档，与本 change 目标无关。
  - 备选「plan 一律必须显式重传」被否：与上述既有语义冲突，且不消除任何脏格式——编造只发生在无值可回退时。
- `Closes #N` 不再由 CLI 代劳（已落地）：issue 关联属正文结构的一部分，已由 `shadow-dev-workflow` 的 `norms/pr-message.md` 第 4 条规定由人/AI 写进 `关联` 段。CLI 静默补一行等于替调用方写正文，正是本次要消除的行为。风险：issue 悬空回归——已由 `pr-message.md` 的必需段与 PR 模板兜住，且 `archive` 门仍会因 PR 未 merged 阻断。
- 单错误码而非两个：缺失项在 message 里列全，调用方一次修完，避免两轮试错。

## 任务

- [x] Phase 1 契约：`commands.mjs` 参数元数据与 help/README/cli-guide 同源；确认 `args.mjs` 不做 required 校验（现状仅文档字段），校验落在 domain。
- [x] Phase 2 门：`release.mjs` / `publish.mjs` 删除回退并抛 `PR_PARAMS_REQUIRED`；`input.mjs` 提供 `--body-file` 读取与优先级。
- [x] Phase 3 探针：`test/cli.test.mjs` 门用例（两缺/单缺/publish 无参/两参数冲突/`--body-file` 生效/re-plan 回退）+ 被触及不变量的单条探针（planHash 只认参数内容、execute 缺凭证不落提交）；真实命令的观察点写入「结果」段。
- [x] Phase 4 消费侧：同波次更新 `shadow-dev-workflow` 的 `skills/shadow-dev-hotfix/SKILL.md:88` 与 `skills/shadow-dev-publish/SKILL.md:51`（两处示例当前都没有 `--body`，不改会与新门槛冲突）。属跨仓耦合，插件侧单独走一个 change。

## 结果

**复杂度评级：M**（改的是 `plan` 的输入契约与错误面，未触及不变量集合本身）。验证强度 = 冒烟 + 每条被触及不变量一个观察点 + 走查；套件全绿只作门槛，不当证据。

### 门的行为面（真实命令 + 真实输出，`D:\works\shadow-dev-cli` @ `fix/20261012-fix-pr-params-required`）

- **OP-1 两参数皆缺** → `release plan --name … --files README.md --message "fix(ci): x" --json`
  `{"ok":false,"error":{"code":"PR_PARAMS_REQUIRED","message":"PR_PARAMS_REQUIRED: release plan requires --title and --body (or --body-file) — the CLI no longer derives them from the change name"}}`，退出码 1，无载荷产出、无盘写。
- **OP-2 只给标题**（覆盖拒绝路径的另一支）→ 同一码，message 收窄为 `requires --body (or --body-file)`；且 stdout **不含** `"title": "20261012-fix-pr-params-required"`——证明回落变更名这条编造路径已断。
- **OP-3 两正文源同传** → `--body` 与 `--body-file` 同时给出：`{"code":"BODY_PARAM_CONFLICT"}`，拒绝，不做优先级猜测。
- **OP-4 publish 同门** → `publish plan --name … --json`：`PR_PARAMS_REQUIRED: publish plan requires --title and --body (or --body-file)`，前缀随命令变化，一码两源。
- **OP-5 `--body-file` 逐字进载荷（冒烟）** → plan 绿，`planHash=50634ebc…391f`，载荷 `body` 完整等于文件内容（`## 变更\n- 观察点用正文：标题与正文必须显式给出`），未被 cmd 引号切碎。
- **OP-6 re-plan 免重传（覆盖状态不变量）** → 不重传任何参数再 `release plan`：status 0，且 `planHash` 与 OP-5 **逐字相同**（`50634ebc…391f`）——回退只承认 brief `workflow.release` 里人上一次给的值，断点续跑语义未被砍。

### 被触及不变量

- `INV：planHash 只认参数内容` → `node --test --test-name-pattern planHash test/cli.test.mjs`：**3 绿 0 红**（含「CLI 自身状态推进与 HEAD 快照不作废 plan」）。
- `INV：execute 缺凭证不落提交` → `node --test --test-name-pattern "release execute" test/cli.test.mjs`：**1 绿 0 红**。
- `INV：载荷参数不得由 CLI 编造`（本次新增的不变量）→ 由 OP-1/OP-2/OP-4 三个真实拒绝路径 + OP-6 的合法回退共同覆盖：编造被禁、人的值仍被承认。

### 门槛（非证据）

- 全量套件 `node --test test/cli.test.mjs`：**111 用例 110 绿 1 红**（`C:\Users\596540\AppData\Local\Temp\cli-test-run3.txt`）。
- 唯一红项 `workflow release track resolves latest release and downloads the asset via the API` 是**本机环境缺陷**：用例 spawn `bash` 做 tar，而 PATH 上的 `bash` 命中 Windows 的 WSL 占位程序（输出为 UTF-16 的「未安装 Linux 的 Windows 子系统」）。改动前的基线跑（同一命令）红在同一条用例、同一原因，与本 change 无关。
- 被新门挡住的 3 条旧用例（`publish defaults the PR body to Closes #N`、`publish reuses an existing open PR`、`release execute commits, pushes and creates the PR in one step`）已按新契约修断言/补参数，不是回归。

### 消费侧与规范（Phase 4，跨仓）

- `shadow-dev-workflow` 侧已同步：`skills/shadow-dev-hotfix/SKILL.md:88`、`skills/shadow-dev-publish/SKILL.md:51` 两处 `release plan` 示例补 `--title`/`--body-file`；`docs/cli-guide.md` 的 `release plan`/`publish plan` 表与端到端示例补必填说明；`norms/pr-message.md` 第 1 条由「约定要求」改写为「CLI 已设硬门」并写清取值序与两个错误码。
- **待办（非本仓）**：`package.json` 的 `cliVersion` pin 是能力契约——`--body-file` 与新门属新能力，插件侧要 bump pin 并单独走一个 change/发版，才能保证「装了旧 CLI 的宿主不会按新规范传参后吃 `UNKNOWN` 式失败」。本 change 不代劳改 pin。

### PR 与 review

待回填：`review plan/execute` 结论、issue 与 PR 链接（按 `norms/pr-message.md` 第 3 条，出 PR 前需先有可追溯的 issue）。

