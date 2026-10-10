---
{
  "schema": "shadow-dev/v1",
  "name": "20261010-feature-brief-scope-amend",
  "type": "feature",
  "scope": "cli-infrastructure",
  "status": "committed",
  "baseBranch": "main",
  "branch": "feature/20261010-feature-brief-scope-amend",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/commands.mjs",
    "lib/domains/change.mjs",
    "lib/i18n.mjs",
    "shadow-docs/changes/20261010-feature-brief-scope-amend/brief.md",
    "shadow-docs/knowledge/brief-state-commit.md",
    "shadow-docs/knowledge/plan-credential-chain.md",
    "shadow-docs/menu.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": null,
    "issue": null,
    "issueUrl": null,
    "pullRequest": 50,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/50"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "c4ba9131c37a7fc5a7ae193a45b32abc3edb7f84",
    "verifiedAt": "2026-10-10T07:34:56.180Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "44629d89d7a0d5c7f33e0465476f6be2a9750f77",
    "planHash": "6c4f6da75d3061ae8be3ac62dc864aed76de47890858144e23c5f96903ff6337",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "README.md",
        "cli.mjs",
        "lib/commands.mjs",
        "lib/domains/change.mjs",
        "lib/i18n.mjs",
        "shadow-docs/changes/20261010-feature-brief-scope-amend/brief.md",
        "shadow-docs/knowledge/brief-state-commit.md",
        "shadow-docs/knowledge/plan-credential-chain.md",
        "shadow-docs/menu.md",
        "test/cli.test.mjs"
      ],
      "message": "feat(change): 实现期扩面登记命令 change amend——扩面必作废 passed review",
      "title": "feat(change): 实现期扩面登记 change amend + 归档门旁路防护",
      "body": ""
    },
    "commit": {
      "files": [
        "README.md",
        "lib/commands.mjs",
        "lib/domains/change.mjs",
        "lib/i18n.mjs",
        "shadow-docs/changes/20261010-feature-brief-scope-amend/brief.md"
      ],
      "message": "feat(change): amend 增 --base-branch 纠偏，解掉 PR 复用与归档证据的锁死点"
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/plan-credential-chain.md,shadow-docs/knowledge/brief-state-commit.md",
    "reason": "直接命令族新增 change amend 成员：其无 planHash（凭证链卡）与无 commit 职责（零 dirty 卡）的归属是两卡适用边界的既有结论细化，不新建竞争卡；amend 作废 passed review 的裁决由 test/cli.test.mjs 的 I1 契约用例长期钉住"
  }
}
---

# brief 实现期扩面登记：change amend 命令与 review 作废语义

## 动机

`files` 集只在 `change create` 时写入（`lib/domains/change.mjs:21`），此后**没有任何命令能修订它**。后果在 `shadow-dev-workflow` 侧真实发生：`.github/workflows/*` 属于 change `20261010-build-quality-gate` 的声明集，而需要它转绿的却是下游堆叠的 `20261010-feature-workflow-context-map`——那条分支的 brief 并不声明这两个文件。于是「合规的做法」与「能生效的做法」分裂：要么越界改未声明文件，要么把改动堆在另一条分支上再靠 cherry-pick 搬运。

第二层损失更结构性：`conflict inspect`（`lib/domains/inspect.mjs:17-21`）完全靠各 brief 的 `data.files` 求交集算重叠。扩面一旦发生且不登记，**两条 change 的真实重叠对机器失明**，本仓引以为傲的「active change 冲突预检」当场失效。

第三层是门被旁路的风险：`archive` 只校验 `review.conclusion === 'passed'` 且 `review.verifiedCommit === HEAD`（`lib/domains/archive.mjs:12`）。`review` 不记录它当时覆盖了哪些文件，所以「审完之后扩面」在现有语义下不会触动任何门——归档照样通过，而新增文件从未被审。

本 change 补上这个缺口：给 brief 一个可登记的扩面入口，并让扩面**必然作废 review 结论**，把上面三层漏洞一次性堵死。

**非目标：** 不 bump 版本号（版本与发版准备按既有模式另立 chore，参照 CLI 仓 #48）；不改 `shadow-dev-workflow` 仓的 `docs/cli-guide.md` 与 skills 引用（消费方另立 change，遵循「生产方先发布、消费方再声明」）；不开放 `--type` 与 `--base-branch`（前者对应已建 issue 的 label、后者对应已建分支与 PR base，改了即与远端事实不一致）；不给 CLI 自身 `requiresCommands` 扩项（该字段属于被消费的 workflow 产物，且尚无消费方引用新命令）。

## 复杂度评级

- **评级:** M（按 norms/tdd-verification.md 三要素）
- **理由:** 契约变更＝新增一个公开命令与一份稳定 JSON 输出面（不改任何既有命令的语义与参数）；触及面＝单个命令域 + 命令注册 + 错误码文案 + README + 两张既有卡的适用边界 + 测试，全部在 `cli-infrastructure` scope 内且无跨仓联动；可发现性＝纯本地单文件原子写，无网络、无外部运行时、无平台差异，本机可全量取证。三项均不达 L（不改分支与远端语义、不触既有命令的行为契约、无仅在特定运行时暴露的路径）。
- **期望验证深度:** unit（一条不变量契约测试）+ runtime（本机真跑 create→approve→amend→review→archive 的通过路径与拒绝路径）

## 引用规范

- `norms/code-style.md`（通用）
  - 当前结论: 最小改动、单一职责、不顺手重构无关内容；渐进式治理不扩大范围。
  - 适用 scope: lib/domains/change.mjs 与命令注册的新增方式——只加 `amend`，不重写 `create`/`approve`。
- `norms/tdd-verification.md`（通用，分级验证制）
  - 当前结论: S/M/L 三级，评级可议、强度与评级匹配不可议；2026-10-09 裁决后 M 级默认不新建测试文件，但确需长期钉住的不变量应写测试并在 brief 写明钉的是哪条；既有测试必须保持绿。
  - 适用 scope: 本 change 的唯一新增用例，钉的是「扩面必作废 review 结论」这条不可让的门（见「任务」Phase 3 与不变量 I1）。
- `shadow-docs/knowledge/plan-credential-chain.md`
  - 当前结论: 凭证链适用于所有走 `DOMAINS` 统一通道的 plan/execute 命令域；**不适用于直接命令**（`change create/approve`、`task set`、`repo inspect`），它们无哈希凭证。新增可持久化 flag 时必须三处同步 `persistPlan`/`norm`/回退读取。
  - 适用 scope: 决定 `amend` 的实现形态——按直接命令实现，因此不进 DOMAINS 通道、不引入 planHash、不需要三处同步。
- `shadow-docs/knowledge/brief-state-commit.md`
  - 当前结论: 「零 dirty」只约束 commit/publish/release/archive 四域的 execute 端点；明确**不适用于 `task set`/`change create` 等直接命令**；无差异时返回 null 不造空提交。
  - 适用 scope: `amend` 只写盘不提交（与 `task set` 同族）；同时把「无差异幂等」搬进 `amend` 的语义（不变量 I2）。
- `shadow-docs/knowledge/brief-frontmatter-crlf.md`
  - 当前结论: 读容忍 CRLF、写回恒 LF；任何触碰 brief 读写的变更必须保持该行为并有 round-trip 覆盖。
  - 适用 scope: `amend` 经 `write(b)` 落盘，测试覆盖 CRLF brief 的读-改-写。
- `shadow-docs/knowledge/cli-output-contract.md`
  - 当前结论: stdout 只回 JSON 契约、人读层走 stderr；`data.nextStep` 是稳定英文模板供 agent 消费；错误 code 永不本地化，只本地化提示文案。
  - 适用 scope: 新命令的输出面、`nextStep` 分支与 `AMEND_INPUT_REQUIRED` 的 zh/en 文案。
- `shadow-docs/knowledge/install-distribution.md` · `knowledge/distribution-capability-contract.md`（通用）
  - 当前结论: 跨仓演进顺序＝消费方先行兼容、生产方随后声明；兼容判定用能力名不用版本号；`requiresCommands` 为产物侧可选第四件。
  - 适用 scope: 本 change 不动 `requiresCommands`，也不动 workflow 仓文档——引用新命令是下一个 change 的事。
- `rules/iron-laws.md` 分支纪律 · `rules/behavior.md` §2
  - 当前结论: main 不接受直接 commit，先建功能分支；只实现当前需要的，不为未来灵活性加参数。
  - 适用 scope: 分支流程；以及「只开 `--files` 与 `--scope`」的参数面收敛。

## 决策

- **选型:** 方案 A —— `change amend` 作**直接命令**，与 `change create/approve`、`task set` 同族。参数 `--name`（必填）、`--files`（必填，逗号分隔，**全集替换**语义，复用 `fileList()` 的反斜杠归一与排序）、`--scope`（可选）、`--confirm`（必填）。输出 `{name, files, added, removed, reviewReset, changed}`，`nextStep` 按 `reviewReset` 指向 `review plan` 或 `commit plan`。失败面新增稳定码 `AMEND_INPUT_REQUIRED`。
- **review 作废语义:** `review.conclusion === 'passed'` 时，amend 生效即将其重置为 `{conclusion: 'pending', verifiedCommit: null, verifiedAt: null}`（回落到 `change.mjs:23` 的初始形态），使 `archive` 立刻以 `REVIEW_NOT_PASSED` 拒绝。
- **对用户裁决的一处精确化（非静默跨级）:** 用户裁定「amend 一律打回 pending」。本设计将其精确为「**有实际差异时**一律打回」——`--files`/`--scope` 与现值完全相同则返回 `changed: false`、不写盘、不动 review。理由：无差异写盘不引入任何未审内容，此时作废 review 只会诱使执行者「amend 一次再重审一次」空转，反而稀释重审信号；而「不静默制造差异」与 `brief-state-commit.md` 的「无差异返回 null 不造空 commit」是同一条纪律。安全目标（扩面必重审）不受影响。
- **对比方案:**
  - **方案 B（走 DOMAINS 统一通道，plan/execute + planHash）:** 未选。凭证链是为「两段式外部写」准备的；amend 是本地单文件原子写，走通道就得三处同步 `persistPlan`/`norm`/回退读取，属「为未来灵活性加参数」（`rules/behavior.md` §2）。
  - **方案 C（不加命令，改由 `commit execute` 自动把未声明文件并入 `files`）:** 未选。commit 的语义从「按显式清单提交」膨胀为清单同步器；且登记晚于动手，`conflict inspect` 的盲区窗口依旧存在——正是本次事故的根因形态。
  - **方案 D（amend 不作废 review，仅 warn）:** 未选，用户已否。那会让 amend 成为归档门的旁路（`passed` + `verifiedCommit === HEAD` 仍成立）。
  - **只开 `--files`、不开 `--scope`:** 未选。`scope` 与 `files` 同源描述「这个变更的边界在哪」，只允许改一个必然造成元数据与实际不符；再开一次命令的成本比留一个漂移口子低。
- **理由:** 直接命令形态与本仓既有的 `task set` 完全同构（读 brief → 改 `data` → `write` → 返回摘要），零新增机制即可登记扩面；而「扩面即作废 review」把唯一的真风险（未审内容混进归档）交给既有的 `archive` 门自动拦截，不需要新建第二套门。

## 不变量（验收对象）

| ID | 不变量 | 观察点形态 |
|---|---|---|
| I1 | 有差异的 amend 必使 `passed` review 失效，`archive plan` 随即以 `REVIEW_NOT_PASSED` 拒绝 | `test/cli.test.mjs` 契约用例 + 本机真跑 |
| I2 | 无差异 amend 幂等：`changed:false`、不写盘、不动 review | 契约用例 + 文件 mtime/内容比对 |
| I3 | `files` 语义为全集替换并输出 `added`/`removed` 差量；反斜杠入参归一为正斜杠 | 契约用例断言三个集合 |
| I4 | brief 经 amend 落盘后仍为纯 LF（读容忍 CRLF） | 契约用例 CRLF round-trip |
| I5 | `conflict inspect` 能看见 amend 后的新集合（重叠不再失明） | 本机真跑两条 change 的 inspect 输出 |
| I6 | 缺 `--files` 或缺 `--confirm` 一律拒绝且退出码非零（2 为凭证类） | 拒绝路径真跑 |
| I7 | 既有命令行为零变化：`change create/approve/list`、`review`、`archive`、`reconcile` 用例全绿 | `npm test` 全量 |

## 任务

### Phase 1 — 命令域与注册

- [x] `amend` 实现 — `lib/domains/change.mjs` — 新增导出 `amend(r, o)`：`name(o)` + `confirm(o)`；`o.files` 缺失即 `err('AMEND_INPUT_REQUIRED', ..., 2)`；`brief(r, n)` 读入 → `fileList(o.files)` 归一 → 与 `b.data.files` 求 `added`/`removed` → 与 `o.scope` 一并判差异 → 无差异返回 `{changed:false, ...}` 不调 `write` → 有差异则赋 `files`（可选赋 `scope`）、`review.conclusion === 'passed'` 时重置为 pending 初始形态、`write(b)` → 返回 `{name, files, added, removed, reviewReset, changed:true, nextStep}`。
- [x] 命令注册 — `lib/commands.mjs` — 在 `change` 组内新增 `c('change amend', ...)` 条目：zh/en 摘要、参数面 `--name`/`--files`/`--scope`/`--confirm`、usage 与示例、静态 nextStep 指向 `commit plan`（动态 `nextStep` 由域返回覆盖）。
- [x] 错误码文案 — `lib/i18n.mjs` — `HINTS` 增 `AMEND_INPUT_REQUIRED` 的 zh/en 一句人话（说明 `--files` 为逗号分隔全集）。

### Phase 2 — 文档口径与边界列举

- [x] 命令参考 — `README.md` — `change create | approve | list` 行补 `amend`，并加一句「扩面会作废 review 结论，需重新 review 才能归档」。
- [x] 凭证链边界 — `shadow-docs/knowledge/plan-credential-chain.md` — 「适用边界」的直接命令列举加入 `change amend`，说明其无哈希凭证的归属理由。
- [x] 零 dirty 边界 — `shadow-docs/knowledge/brief-state-commit.md` — 「适用边界」的「不适用于直接命令」列举加入 `change amend`，并把「无差异不制造变更」与本域的 I2 呼应一句。
- [x] 项目路由 — `shadow-docs/menu.md` — 「brief 读写」行关键词补 `amend 扩面 scope 修订 未声明文件 conflict 失明`，保证后续同类任务能路由到上述两卡。

### Phase 3 — 不变量测试与收口

- [x] 契约测试 — `test/cli.test.mjs` — 覆盖 I1（amend 后 `review.conclusion` 为 pending 且 `archive plan` 报 `REVIEW_NOT_PASSED`）、I2（无差异 `changed:false` 且 review 不动）、I3（`added`/`removed` 与反斜杠归一）、I4（CRLF round-trip 后纯 LF）；钉的是 I1 这条归档门旁路防护，属「需长期钉住的不变量」。
- [x] 观察点执行与记录 — `shadow-docs/changes/20261010-feature-brief-scope-amend/brief.md` — 本机真跑并记输出：`npm test` 全绿（I7）；在临时仓库 fixture 内 create→approve→amend→review passed→amend 扩面→`archive plan` 拒绝（I1）；同轮 `--files` 原值重放（I2）；`conflict inspect` 前后对比（I5）；缺 `--files`/缺 `--confirm` 拒绝（I6）。

## 结果

- 实际耗时: 约 90 分钟（含两轮全量取证的等待）
- 验证: M 级——新增 5 条契约用例（其中 I1 为长期钉住的不变量）+ 既有测试保持绿 + 本机真跑通过/拒绝路径。

### 不变量观察点（本机真实输出）

| ID | 观察点与结果 |
|---|---|
| I1 | `node --test --test-name-pattern='change amend' test/cli.test.mjs` → `# tests 5 / # pass 5 / # fail 0`；用例内断言 `review.conclusion → "pending"`、`verifiedCommit → null`，并真跑 `archive plan` 得 `{"ok":false,"error":{"code":"REVIEW_NOT_PASSED"}}`（status 1）；`--help` 仍派生出 `change create\|approve\|amend\|list` |
| I2 | `is idempotent when nothing changes` green：`changed:false`、`reviewReset:false`、`nextStep:null`，且落盘全文与调用前逐字节相等（不写盘） |
| I3 | `--files 'lib\a.js,src/example.js'` → `files:["lib/a.js","src/example.js"]`、`added:["lib/a.js"]`、`removed:[]`；收缩为 `lib/a.js` 时 `removed:["src/example.js"]` ✓ 复用 `fileList()` 归一 |
| I4 | brief 全文改 CRLF 后 amend → 落盘不含 CR ✓ |
| I5 | **自证**：本 change 自己撞上所修缺口——`cli.mjs`（`handle()` 里 `change` 无通用分发，新增动词必须改路由）不在 create 时的 9 文件声明集内。用新命令登记：`change amend --files <10 项>` → `{"added":["cli.mjs"],"removed":[],"reviewReset":false,"changed":true,"nextStep":"conflict inspect --name 20261010-feature-brief-scope-amend"}`；随后 `conflict inspect` → `{"overlaps":[]}`，新集合已进入重叠计算输入 |
| I6 | `--files` 缺失与 `--files ''` → 均 `AMEND_INPUT_REQUIRED` 且退出码 2；缺 `--confirm` → `CONFIRMATION_REQUIRED` 退出码 2 ✓ |
| I7 | `test/cli.test.mjs` 全量 TAP → `# tests 104 / # pass 103 / # fail 1`；`test/install.test.mjs` → `# tests 8 / # skipped 8`、exit 0。套件总盘 **112 例**（改动前 `cli.test.mjs` 99 + `install` 8，改动后 104 + 8） |

### 唯一失败的定性与替代观察点

`workflow release track resolves latest release and downloads the asset via the API`（`test/cli.test.mjs:1154`）失败在其**fixture 造包步**：`Command failed: bash -c tar -czf "$1" -C "$2" shadow-dev-workflow pack …`，`duration_ms 198` 即抛错，未触达任何针对本 change 代码的断言。独立复现与排除：

- 本机 `bash` 解析到 `C:\Windows\system32\bash.exe`（WSL，未安装任何发行版）；直接跑 `bash -c "tar -czf …"` → 退出码 1；原生 `tar.exe` 干同一活 → 退出码 0、产物生成。
- 同因使 `install.test.mjs` 全部 8 例 `# SKIP bash unavailable`。两者早于本 change 存在（上一 change 的 brief 已记「install-cli 7 例本机不可取证——沙箱禁网」，属同族环境缺口）。
- **替代观察点（已回填）**：本 PR 的 CI run [38035086789](https://github.com/stack-wuh/shadow-dev-cli/actions/runs/38035086789) → `test` 矩阵 **9/9 pass**（ubuntu/macos/windows × node 20/22/24，`pass=9 fail=0`）。windows 三项通过即反向坐实本机判红的唯一成因是「PATH 上 `bash` 解析到无发行版的 WSL」而非本 change 的代码——有 Git Bash 的环境里同一条 fixture 正常执行。本机 `install.test.mjs` 8 例仍为 `# SKIP bash unavailable`。

### 顺带发现的两处既有弱点（不在本 change 处置，另立）

1. `test/cli.test.mjs:1154` 未像 `install.test.mjs` 那样先探测 bash 可用性——环境缺 bash 时判红而非 SKIP，正是「可发现性最差的一类回归」。
2. 本机 `~/.local/bin/shadow-dev.cmd` 是**旧代 shim**（只读 `CURRENT`），而 `scripts/install-cli.sh:106-111` 现已生成 `LINK→CURRENT` 两段解析版；因此 README 承诺的「双仓开发即时生效」在本机失效，本次实现与取证全程需 `node cli.mjs` 直驱。修法是重装 shim（环境动作），非代码缺陷。

### 与 brief 声明的一处偏差（非静默）

task-2 原文写「静态 nextStep 指向 `commit plan`（动态 `nextStep` 由域返回覆盖）」。实现取的是**目录 `next` 留 null + 由域返回动态 `nextStep`**：`reviewReset` 时指向 `review plan`，仅扩面未影响 review 时指向 `conflict inspect`，无差异时为 `null`。理由：`commit plan` 对 amend 的三种后继都不是正确建议，而 `human.decorate` 在目录 `next` 非 null 时会**覆盖**域返回值，留 null 才能让分支建议成立；这与 `worktree.inspect` 的既有做法同构。I1/I3/I5 的三条真跑输出即该偏差的证据。

### 生命周期状态

`change create` → `change approve`（proposed）→ `branch execute`（`feature/20261010-feature-brief-scope-amend`；M 级按 `worktree inspect` 的 `recommendation:"inline"` 走分支，不建 worktree）→ 实现 → `change amend` 自登记扩面 → 全量取证。

## Phase 4 追加：`--base-branch` 纠偏能力（推翻原「不开放 baseBranch」的决定）

- **触发事实**：在 `shadow-dev-workflow` 给 PR #44 推 CI 修复时，`publish` 没复用 #44 而是新建了 PR #45。根因在 `lib/github.mjs` 的 `findPr(repository, branch, baseBranch)` **按 base 过滤候选**，而那条 brief 声明的 `baseBranch` 是堆叠上游分支 `build/…`，PR #44 的 base 是 `main` → 被设计性排除。
- **为什么推翻原决定**：立项时我以「改了会与已建分支/PR base 不一致」排除 `--base-branch`。事实相反——**`baseBranch` 写错时唯一出路就是改它**：不改则 `publish` 永远找不到那条 PR（且会重复开 PR）、`archive` 永远拿不到 merged 证据（`PULL_REQUEST_REQUIRED`/`PR_NOT_MERGED`），而手改 frontmatter 属受管状态禁令。原决定等于把使用者锁在自己修不了的错误里。
- **实现与拒绝路径（本机真实输出）**：与现值相同 → 幂等 `changed:false` 不写盘；等于变更自身分支名 → `INVALID_BASE_BRANCH: --base-branch must differ from the change branch feature/…`；空白 → 同码 `must not be empty`；命令目录与 help 已含新参数：`flags: --name --files --scope --base-branch --confirm`。
- **不自欺设计**：`baseBranch` 实际变更且 brief 已关联 PR 时，输出带 `warnings`，要求去 GitHub 改该 PR 的 base 或关闭它——`findPr` 的过滤条件不会因声明改了而迁移历史 PR，静默改基线只会把不一致留给下一次 `publish`。
- **文件集未扩**：本追加全落在原声明的 10 个文件内，无需再次 amend。
- **按用户指令未新增测试文件**：上述四条路径以本机真跑为证据；回归依赖 CI 三平台矩阵跑既有 104+8 例（判据＝新增参数不破坏既有用例）。

## 知识评估

- **预期影响:** 更新（不新增）
- **候选卡片:** `shadow-docs/knowledge/plan-credential-chain.md`（适用边界列举）、`shadow-docs/knowledge/brief-state-commit.md`（适用边界列举 + 无差异纪律呼应）
- **理由:** 本 change 的事实增量是「直接命令族新增一个成员」及其与既有门的关系，属两卡既有结论的边界细化；按 `norms/knowledge-cards.md`「能更新不新增」与「同 scope 下不得存在相互冲突的 active 结论」，新建一张 `amend` 专卡会与两卡的适用边界形成竞争。「扩面必作废 review」这条新裁决本身落在代码与测试里（I1），待被真实使用一次后再决定是否升格为卡片结论。
