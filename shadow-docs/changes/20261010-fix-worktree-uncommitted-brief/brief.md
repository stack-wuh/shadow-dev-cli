---
{
  "schema": "shadow-dev/v1",
  "name": "20261010-fix-worktree-uncommitted-brief",
  "type": "fix",
  "scope": "cli-infrastructure",
  "status": "committed",
  "baseBranch": "main",
  "branch": "fix/20261010-fix-worktree-uncommitted-brief",
  "files": [
    "cli.mjs",
    "lib/commands.mjs",
    "lib/domains/worktree.mjs",
    "shadow-docs/changes/20261010-fix-worktree-uncommitted-brief/brief.md",
    "shadow-docs/domain.md",
    "shadow-docs/knowledge/brief-state-commit.md",
    "shadow-docs/knowledge/worktree-brief-relocation.md",
    "shadow-docs/menu.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": null,
    "issue": null,
    "issueUrl": null,
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "f8294eb8122eb0e535a42f694863350310bd28a9",
    "verifiedAt": "2026-10-11T09:17:52.061Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "78668be77d6bb210e98834655e29e99e11afd7c1",
    "planHash": "373948e9200ae481eaddb674447eef9b99a5c70e97d05693065b0c9fd6aadba2",
    "updatedAt": null,
    "lastError": null,
    "commit": {
      "files": [
        "cli.mjs",
        "lib/commands.mjs",
        "lib/domains/worktree.mjs",
        "shadow-docs/changes/20261010-fix-worktree-uncommitted-brief/brief.md",
        "shadow-docs/domain.md",
        "shadow-docs/knowledge/brief-state-commit.md",
        "shadow-docs/knowledge/worktree-brief-relocation.md",
        "shadow-docs/menu.md",
        "test/cli.test.mjs"
      ],
      "message": "fix(worktree): 未提交的 brief 随专属 workspace 迁移，回收前搬回主树"
    }
  },
  "knowledge": {
    "action": "新增",
    "target": "shadow-docs/knowledge/worktree-brief-relocation.md",
    "reason": "新增「brief 随专属 workspace 迁移与归属树」卡（唯一性/迁移完整性/载体豁免/回收不丢数据四条执行约束）；原位更新 brief-state-commit.md 建立 archive 特例的根因链接；menu 加路由；本仓首次登记 shadow-docs/domain.md 上下文地图。证据为真实 CLI 端到端 7 步输出（relocated=true、主树无副本、工作树内 task list 可用、dirty=false、relocatedBack=true、worktree 字段归零）；分片探针 27 条 23 pass，4 条失败均为本机 139 打死子进程的 null 状态、无断言失败，已如实标注为未验证。验收口径按用户 2026-10-11 裁定变更：全量测试不再作为门槛，测试文件降级为可选契约探针。"
  }
}
---

# 新立项 change 的执行路径：brief 随专属 workspace 迁移

## 动机

`worktree` 域对**刚立项的 change 不可用**，而每个 change 都从「刚立项」开始。

`worktree execute` 用 `git worktree add -b <type>/<name> <path> <base>` 从基线派生工作树，而 `change create` 刚写的 brief 是**未跟踪文件**——新树里根本没有它。后果不是报错难看，是流程当场断线：`task set` / `review` / `commit` 全部 `BRIEF_NOT_FOUND`，唯一绕过办法是人工把 brief 拷进新树，于是同一 change 出现两份可各自演进的受管状态（状态分裂），比报错更危险。

实证两次，都发生在内容包侧：

1. `20261010-refactor-domain-driven-workflow`：`worktree inspect` 对 L 级变更给 `recommendation:"create"`，但读实现（`lib/domains/worktree.mjs` 的 `execute` 只向主工作区回写 brief，新树从 `base` 派生）后确认不可执行，被迫在 brief 里记「执行期修订」降级为 inline 分支——工具的默认路径与流程规范互相矛盾，执行者只能违反规范之一。
2. 同轮还暴露配套的脏判定缺陷：brief 迁进专属 workspace 后是**未跟踪文件**，`worktree remove` 会因 `WORKTREE_DIRTY` 永远拒绝回收，唯一真相要么随目录被删、要么永远搬不回来。

`change amend`（实现期扩面登记）已由 #50 交付，本 change 只补另一半：**brief 在 workspace 之间的归属迁移**。现有 5 条 worktree 用例的 fixture 里 brief 全部是未跟踪状态却断言它留在主树——即测试前提把「缺陷行为」当成了契约，本 change 同时纠正这条测试基线。

**非目标：** 不做 `change amend`（#50 已实现且带 `reviewReset`/`--scope`/幂等，本 change 完全让位，废弃重复实现）；不 bump 版本（发版是独立 change，先例 `3081206 chore(release): v1.5.0 发版准备`；且 `change.amend` 进入内容包 `requiresCommands` 必须等 v1.6.0 真的发布，见「跨仓顺序」）；不做跨树双向同步或合并（那是状态分裂的开端）；不改 archive 的 push 失败特例语义。

## 复杂度评级

- **评级:** L
- **理由:** **契约变更**——`worktree execute`/`remove execute` 的 stdout 新增 `relocated`/`relocatedBack` 字段，且 **brief 的存放位置成为契约的一部分**（迁移后唯一真相随工作树走，其它域按 cwd 所在树读写）；harness 层 `readBrief` 替换了 `executeDomain`/`planDomain` 两处 `brief(r, name(o))`，触及**所有**走 plan/execute 的域；**触及面**——执行层核心（`lib/domains/worktree.mjs`、`cli.mjs`、`lib/commands.mjs`）+ 内容包 apply 流程的分支策略；**可发现性**——迁移逻辑写坏的表征是「brief 凭空消失或两份并存」，属最难的静默数据损坏，且既有测试基线恰好把错误行为固化为断言。
- **期望验证深度:** runtime（真实 CLI 在临时 git 仓跑通 create→approve→branch→worktree→task set→remove 全链 + 三条拒绝路径；**全量测试套件必须跑绿**——这是上一轮欠的账）

## 领域模型

- **限界上下文:** `cli-infrastructure` — shadow-dev 执行层（brief 生命周期、workspace、plan/execute 凭证链、输出面）。上游 `workflow-governance`（内容包经 `requiresCommands` 能力契约消费本仓命令键），下游三宿主无关。**反腐边界**：本 change 不定义内容包的规范语义，也不新增对外命令键（只在既有 `worktree.*` 命令上增字段，additive）。
- **统一语言增量:**
  - **workspace 迁移 relocation**：把某 change 的**唯一** brief 目录整体搬进其专属工作树（或搬回），迁移后旧位置不留副本。
  - **受管状态分裂 divergence**：同一 change 存在两份可各自演进的 brief——本域定性为数据损坏，不是便利。
  - **归属树 owning tree**：任一时刻决定「`brief(r,n)` 该在哪个目录找」的那棵树；主工作区或某 worktree，二者互斥。
  - **载体豁免 carrier exclusion**：`worktree remove` 的脏判定排除 brief 自身——它是 CLI 的管理载体，不是用户未提交的工作。
- **聚合与不变量（每条须绑定观察点）:**
  - `change brief`：**I1 唯一性**——任一时刻只有一份 brief，主树与新树不同时存在；**I2 迁移完整性**——迁移前后逐文件内容一致，且 `branch`/`status`/`workflow.worktree` 已回写之后才发生迁移；**I3 可发现性**——在归属树内任何按 `--name` 的命令都能解析到该 brief（含跨树的 `worktree inspect/plan/remove`）。
  - `workspace`：**I4 回收不丢数据**——brief 未提交时先搬回主树再删目录；**I5 载体豁免**——未提交 brief 不构成 `WORKTREE_DIRTY`，真实用户改动仍照旧拒绝（既有用例须保持绿）。
  - `稳态零回归`：**I6**——brief 已跟踪（已提交）时 `relocated:false`，主树副本与既有断言一字不变。
- **领域事件:** `worktree execute` 成功 → 归属树切到新工作树，后续写操作只在该树发生；`worktree remove execute` → 归属树切回主工作区并清空 `workflow.worktree`；`change amend`（#50）→ `reviewReset` 作废已 passed 的 review，本 change 与之正交。

## 引用规范

- `shadow-docs/knowledge/plan-credential-chain.md`（#50 已更新）
  - 当前结论: `planHash=sha256(canon({command,data:norm(planData)}))`；norm 剥离边界＝plan 自身副作用（`workflow.planHash/release/issuePlan/commit` 与 `repo.changedFiles/clean`）；脏行为门禁必须在 `planData` 内联执行。
  - 适用 scope: 迁移与 `relocated`/`relocatedBack` **不得进入哈希输入**（否则 execute 端必漂移）；`dirtyBesidesBrief` 属行为门禁，留在 planData 内联
- `shadow-docs/knowledge/brief-state-commit.md`（#50 已更新）
  - 当前结论: 写 brief 的 execute 域在 `write(b)` 后补 `briefStateCommit`，无差异不造空 commit；archive push 失败的特例恢复要人工 push 一次，**根因正是 harness 从旧路径读 brief 会 `BRIEF_NOT_FOUND`**。
  - 适用 scope: 本 change 的 `locateBrief`/`readBrief` 是该特例的通用解法方向，但**不改 archive 语义**，只在 brief 记明关系
- `shadow-docs/knowledge/brief-frontmatter-crlf.md`
  - 当前结论: frontmatter 行尾契约与 autocrlf 处理；解析失败必须响亮 `BRIEF_FRONTMATTER_REQUIRED`；#50 补了 CRLF 回写 LF 的用例。
  - 适用 scope: 迁移用文件级复制，不得改写行尾；迁移后新树内 brief 必须仍可解析
- `shadow-docs/knowledge/cli-output-contract.md`
  - 当前结论: stdout 恒单行 JSON 契约，人类层走 stderr；新增字段属 additive，须同步契约测试。
  - 适用 scope: `worktree.execute`→`relocated`，`worktree.remove.execute`→`relocatedBack`，二者进 help 摘要与用例断言
- `shadow-docs/knowledge/install-distribution.md` · 内容包 `knowledge/distribution-capability-contract.md`
  - 当前结论: 兼容判定用能力名；**跨仓演进顺序＝执行层先发布支持、内容包随后声明**。
  - 适用 scope: 本 change 不新增命令键，故两侧声明均不变；发版归独立 change
- `rules/behavior.md` §6（内容包：不要删你不懂的东西）/ §15（不要用历史覆盖 active Knowledge）
  - 当前结论: 删除/替换存量前先查引用链搞清楚为什么存在。
  - 适用 scope: 既有 5 条 worktree 用例的断言基线要逐条核对，不能整批改写掩盖真实回归

## 决策

- **选型:** **A. 迁移而非复制，归属树唯一，且 harness 尊重域提供的跨树定位器**。
  1. `lib/domains/worktree.mjs`：新增 `briefRel`/`tracked`/`treeMap`/`relocate`/`locateRoot`/`locateBrief`/`dirtyBesidesBrief`。`execute` 在状态回写**之后**，若主树该 brief 为未跟踪则整目录迁入新树（先逐文件校验一致再删源，不一致则回退目标并抛 `RELOCATION_MISMATCH` 保留源），输出 `relocated`；已跟踪时一行不动（I6）。`removeExecute` 在 `git worktree remove` **之前**把未提交的 brief 搬回主树，输出 `relocatedBack`；脏判定改走 `dirtyBesidesBrief`（载体豁免，I5）。`state`/`planData`/`removePlanData` 统一经 `locateBrief` 取 brief，`activeBriefs` 覆盖主树与全部工作树（防止归属反查失明与同名 change 被重复创建）。
  2. `cli.mjs`：`readBrief(mod, r, o)`——域导出 `locateBrief` 时优先用它，否则退回 `brief(r, name(o))`。这是必须的一步：harness 在 `executeDomain`/`planDomain` 里硬按 cwd 所在树读 brief，跨树回收会在进入域逻辑**之前**就 `BRIEF_NOT_FOUND`。其余 13 个域不改（它们按归属树读写正是设计意图）。
  3. 测试基线纠正：既有 5 条用例逐条核对（brief 未跟踪是 fixture 的真实状态，迁移后它们的断言仍成立——回收用例靠 `relocatedBack` 复原），新增 3 条迁移用例锁 I1/I2/I4/I5，并把「稳态」用例改为**真正提交 brief** 后断言 `relocated:false`（原用例把未跟踪误当稳态）。
  4. 知识闭环：新增 `shadow-docs/knowledge/worktree-brief-relocation.md`（唯一性/不丢数据/载体豁免三条执行约束）并加 `shadow-docs/menu.md` 路由；本仓首次登记 `shadow-docs/domain.md` 上下文地图（内容包已在 6.8.0 落地该规范，本仓补上，`domain` 值域＝`cli-infrastructure`/`install-distribution`/`github-integration`）。
- **对比方案:**
  - **B. 复制到新树、主树留一份**：未选。两份受管状态各自演进就是 divergence；`task set` 在 A 树、`review` 在 B 树会产生两个真相，比报错难发现得多。
  - **C. 要求先提交 brief 再建 workspace**：未选。把工具缺陷转嫁为流程纪律，且「brief 已提交」是本就该支持的稳态而非每个 change 的起点；内容包实测两次因此降级 inline。
  - **D. `worktree add` 后自动 `git commit` brief**：未选。提交是显式动作（`commit plan/execute` 带文件集与 planHash 凭证），自动提交会绕过凭证链语义。
  - **E. 复用我上一轮的 `change amend` 简版**：未选，**主动废弃**。#50 的实现严格更强（`reviewReset` 作废已 passed review、`--scope` 同修、幂等短路、CRLF 回写、专用错误码 `AMEND_INPUT_REQUIRED`、5 个用例 + 知识闭环）。旧分支 `feature/20261010-feature-workspace-brief-relocation` 因此不合入，只从中移植 worktree 迁移部分。
- **理由:** brief 的唯一性是既有不变量（`change create` 的 `CHANGE_EXISTS` 门与 `conflict.inspect` 都以「一个变更一份 brief」为前提），要让专属 workspace 可用，唯一诚实的做法是让「归属哪棵树」成为显式概念并可观测，而不是让执行者手工搬文件。

## 任务

### Phase 1 — 迁移实现
- [x] brief 迁入专属工作树 — `lib/domains/worktree.mjs` — `relocate`（逐文件校验一致再删源，失败回退目标并抛 `RELOCATION_MISMATCH`）；`execute` 在状态回写后按主树跟踪态决定是否迁移，输出 `relocated`
- [x] brief 搬回与载体豁免 — `lib/domains/worktree.mjs` — `removeExecute` 删目录前搬回未提交 brief，输出 `relocatedBack`；`dirtyBesidesBrief` 排除 brief 自身，真实脏改动仍 `WORKTREE_DIRTY`
- [x] 跨树定位与发现 — `lib/domains/worktree.mjs`, `cli.mjs`, `lib/commands.mjs` — `locateRoot`/`locateBrief` 覆盖主树与全部工作树，`activeBriefs` 跨树去重；harness `readBrief` 优先用域定位器；两条 worktree help 摘要与双语说明补迁移语义
### Phase 2 — 契约测试与全量回归
- [x] 三条迁移用例 — `test/cli.test.mjs` — 未提交 brief 迁入（I1/I2/I3：新树 `task list` 可用、主树不留副本）；回收搬回（I4/I5：`dirty:false`、`relocatedBack`、`workflow.worktree=null`）；稳态不迁移（I6，先把 brief 真提交再断言 `relocated:false`）
- [x] 不变量探针取证（口径已由用户裁定变更） — `shadow-docs/changes/20261010-fix-worktree-uncommitted-brief/brief.md` — 2026-10-11 用户裁定「完全干掉 TDD，转向 DDD」，**「全量测试套件必须绿」不再是合并门槛**；本条改为对四条不变量取真实观察点：E2E 全链手工复现 + 分片测试作为可选契约探针，探针未绿项如实标注不作伪证
### Phase 3 — 知识闭环与跨仓说明
- [x] 迁移知识与菜单路由 — `shadow-docs/knowledge/worktree-brief-relocation.md`, `shadow-docs/menu.md` — 唯一性/不丢数据/载体豁免三条执行约束 + 适用边界（跨树定位仅 worktree 域，其它域按归属树）+ 验证方式
- [x] 本仓上下文地图 — `shadow-docs/domain.md` — 登记 `cli-infrastructure`/`install-distribution`/`github-integration` 三上下文与上游 `workflow-governance` 的反腐边界，使卡片 `domain` 有值域可依
- [x] 跨仓顺序与偏差记录 — `shadow-docs/changes/20261010-fix-worktree-uncommitted-brief/brief.md` — 结果段记观察点与 `change amend` 让位说明；遗留段写明「`change.amend` 进入内容包 `requiresCommands` 必须等 v1.6.0 发布并升级本机 CLI，否则 `ARTIFACT_INCOMPATIBLE` 判红」

## 结果

- 实际耗时: ≈50 分钟（其中约 30 分钟折在「跑全量测试」上——该目标本身已被用户裁定废除，见下方口径变更）
- **验收口径变更（用户在执行中裁定，非静默降级）**：2026-10-11 指令「给我去掉所有的 TDD，我现在已经完全干掉 TDD 转向 DDD 了」。据此本 change 的完成判据从「108 条用例全绿」改为「四条不变量各有真实观察点」；测试文件保留为**可选契约探针**，不再充当门槛。

- 验证: **L 级＝每条不变量一个可追溯观察点**。主证据是真实 CLI 端到端复现（临时 git 仓，7 步逐个取输出）：

| # | 不变量 | 观察点与真实输出 |
|---|--------|------------------|
| I1 唯一性 | brief 迁入后主树不留副本 | `[1] relocated= True branch= fix/demo` → `[2] 主树是否残留副本 → 无副本（I1 唯一性成立）` |
| I2 迁移完整性 | 状态回写后才迁移，内容一致 | 迁移后的工作树内 brief 解析出 `branch=fix/demo`、`workflow.worktree` 指向新树、`status=branched`；`[3] 工作树内任务可读 → tasks= 1`（I3 可发现性同时成立） |
| I3 可发现性 | 归属树内命令可用，主树跨树可定位 | 上列 `task list` 在工作树内 `tasks=1`；主树 `worktree inspect` → `recommendation:"reuse"`（契约用例同断言） |
| I4 回收不丢数据 | 删目录前先搬回 | `[4] dirty= False` → `[6] relocatedBack= True removed= True` → `[7] 回收后主树 brief: 在 · 工作树: 已删 · worktree 字段: None` |
| I5 载体豁免不放水 | 真实用户改动仍判脏并拒绝回收 | 向工作树写入 `user-work.js` 后重规划 → `dirty= true`；`remove execute` 被拒（用例断言 `WORKTREE_DIRTY`；手工探针那次因未重规划先撞 `PLAN_HASH_INVALID`，属凭证链预期行为——`dirty` 参与 planData） |
| I6 稳态零回归 | 已跟踪 brief 不迁移 | 用例 `tracked brief is left in place`：先 `git add + commit` 真造稳态，再断言 `relocated:false` 且主树副本在 |

- 分片探针结果（沙箱内，27 条一组）：`# tests 27 / # pass 23 / # fail 4`。**4 条失败全部是 `null !== 0`**——子进程被本机 node 139 段错误风暴打死、`spawnSync` 返回 null，非断言失败。含 #50 自带的两条 amend 用例与 `index rebuild plan is stable`、`version stdout …` 各一条，即：这 4 条与本次改动无因果关系，但**在本机无法证明它们绿**（诚实标注为未验证，不当作已通过）。
- 取证环境教训（值得进知识）：`node --test` 在**越权（有网）环境下静默挂死**、在沙箱内 27 条约 23 秒跑完；`tty=true` 会让 `runTty` 的 `spawnSync` 继承父 stdin 而永久阻塞；macOS 无 `setsid`。三者都表现为「无输出」，与真失败无法区分——只能靠分片 + 前台 + 关 stdin 取证。**这正是用户废除「全量必须绿」门槛的现实理由。**
- 交付: 待 push / PR（base＝main，已含 #49/#50）

## 知识评估

- **预期影响:** 新增 + 更新
- **候选卡片:** `shadow-docs/knowledge/worktree-brief-relocation.md`（新增，已落）、`shadow-docs/knowledge/brief-state-commit.md`（原位追加与迁移卡的因果链接，已落）、`shadow-docs/menu.md`（新卡路由，已落）、`shadow-docs/domain.md`（本仓首次登记上下文地图，已落）
- **理由:** 唯一性/不丢数据/载体豁免/归属树是本仓长期执行约束，值得独立成卡；`brief-state-commit.md` 的 archive push 特例被本次工作解释出根因（brief 位置未被当作一等事实），属原位更新追加 source，不建重复卡。**`verified-depth` 如实记 `unit` 而非 `runtime`**：E2E 是真实命令输出，但发生在临时仓而非发布产物上；升 `runtime` 需等 v1.6.0 产物实装。未达到的深度不虚报。
