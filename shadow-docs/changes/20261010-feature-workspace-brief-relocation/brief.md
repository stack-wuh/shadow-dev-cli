---
{
  "schema": "shadow-dev/v1",
  "name": "20261010-feature-workspace-brief-relocation",
  "type": "feature",
  "scope": "cli-infrastructure",
  "status": "branched",
  "baseBranch": "main",
  "branch": "feature/20261010-feature-workspace-brief-relocation",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/commands.mjs",
    "lib/domains/change.mjs",
    "lib/domains/worktree.mjs",
    "package.json",
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
    "conclusion": "pending",
    "verifiedCommit": null,
    "verifiedAt": null
  },
  "workflow": {
    "operation": null,
    "checkpoint": null,
    "planHash": "cfbedf489b638e9e9811380b177c2f73767f531d25008ed17dcdadcb6487dc63",
    "updatedAt": null,
    "lastError": null,
    "commit": {
      "files": [
        "cli.mjs",
        "lib/commands.mjs",
        "lib/domains/change.mjs",
        "lib/domains/worktree.mjs",
        "shadow-docs/changes/20261010-feature-workspace-brief-relocation/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "feat(worktree): brief 随 workspace 迁移并新增 change amend 范围修订（待 CI 全绿才可合并）"
    }
  }
}
---

# 新立项 change 的执行路径：brief 随 workspace 迁移 + `change amend` 范围修订

## 动机

内容包（shadow-dev-workflow）在一夜之间连着两次撞上执行层的同一个盲区，两次都只能靠改流程规避，而不是被工具解决：

1. **`worktree` 对新立项 change 不可用。** `worktree execute` 用 `git worktree add -b <type>/<name> <path> <base>` 从基线派生工作树，而 `change create` 刚写的 brief 还是**未跟踪文件**——新工作树里根本没有它。后果不是报错难看，是流程直接断：`task set` / `review` / `commit` 全部 `BRIEF_NOT_FOUND`；人工把 brief 拷过去会造成两份受管状态分裂。实证：workflow 仓 `20261010-refactor-domain-driven-workflow` 的 `worktree inspect` 建议 `create`（L 级）却无法执行，只能在 brief「执行期修订」里降级为 inline 分支。现有 5 条 worktree 用例**全部用已提交的 brief 作 fixture**，所以这条真实路径从来没被覆盖。
2. **`change` 域没有范围修订能力。** 命令目录只有 `change create/approve/list`，frontmatter 的 `files` 又禁止手改（受管状态唯一真相在 CLI）。于是实现期发现的合法扩面无处安放：workflow 仓 `20261010-build-quality-gate` 里，`bump-version.mjs` 改了三处 manifest，而声明文件集只有 `package.json`——`check:version` 当场判红，补齐的两个文件只能以「范围修订」写进正文，无法合规进 brief 声明。同轮的信号写回（`shadow-docs/signals.md`）与卡片规范补写也因同样的缺口被迫推迟成 follow-up。

两条合起来是一个事实：**工具的默认路径只服务「brief 已提交」的稳态，不服务「刚立项」的起点**——而每个 change 都从起点开始。

**非目标：** 不改 issue/PR/archive 语义；不改安装器与 shim 布局；不动 `requiresCommands`（本 change 只新增命令键，消费方随后声明，顺序由既有能力契约锁定）；不引入 worktree 自动同步或双向合并（那是分布式状态分裂的开始）。

## 复杂度评级

- **评级:** L
- **理由:** **契约变更**——`worktree execute` 新增 stdout 字段 `relocated`，brief 的**存放位置**成为契约的一部分（workspace 迁移后唯一真相随工作树走），并新增命令键 `change.amend`（能力名进入两侧同步货币）；**触及面**——执行层核心域（`lib/domains/worktree.mjs`、`change.mjs`、`commands.mjs`、`cli.mjs` 分派）+ 与零 dirty 不变量、plan/execute 凭证链直接交互；**可发现性**——迁移逻辑写坏表现为「brief 凭空消失或两份并存」，属最难发现的静默数据损坏。
- **期望验证深度:** runtime（真实 CLI 在临时 git 仓里跑通全链路 + 拒绝路径；既有 24+ 用例保持绿）

## 领域模型

- **限界上下文:** `cli-infrastructure` — shadow-dev 执行层（brief 生命周期、workspace、凭证链、输出面）。上游 `workflow-governance`（内容包，经 `requiresCommands` 能力契约消费本仓命令键），下游三个宿主无关。反腐边界：本 change 不定义内容包的规范语义，只保证「新立项 change」这一状态在工具内可被完整执行。
- **统一语言增量:**
  - **workspace 迁移 relocation**：把某个 change 的**唯一** brief 目录从未跟踪位置整体搬进新工作树（或搬回），迁移后旧位置不存在副本。
  - **受管状态分裂 divergence**：同一 change 出现两份可各自演进的 brief——本域视为数据损坏，不是便利。
  - **范围修订 amend**：对 brief 声明文件集（`files`）的合法事后修订，必须经 CLI，禁止手改 frontmatter。
- **聚合与不变量:**
  - `change brief`（聚合根）：**唯一性**——任一时刻一个 change 只有一份 brief，且位置由 `workflow.worktree` 或当前工作树决定；**迁移完整性**——迁移前后 brief 内容逐字节相等，`branch` / `status` / `workflow.worktree` 已回写后才发生迁移；**可发现性**——`brief()` 在 `workflow.worktree` 指向的树里必须能解析到该 brief。
  - `workspace`：**回收不丢数据**——`worktree remove` 在 brief 尚未提交时先迁回再删目录，绝不把唯一真相随工作树一起删掉；脏工作树仍按 `WORKTREE_DIRTY` 拒绝。
  - `凭证链`：`worktree execute` 的 planHash 覆盖 `--path` 与 brief 内容，迁移行为**不得进入哈希输入**（否则 execute 端必然漂移）；`change amend` 属直接命令（无哈希凭证，与 `change create/approve` 同类），改完 `files` 使既有 planHash 自然失效，重规划即可。
- **领域事件:** `worktree execute` 成功 → brief 归属工作树，后续所有写操作只在该树发生；`worktree remove` → 归属回到主工作树；`change amend` → `files` 更新且 planHash 作废（下一次 execute 前必须重 plan）。

## 引用规范

- `shadow-docs/knowledge/brief-state-commit.md`
  - 当前结论: 新增写 brief 的 execute 域在 `write(b)` 后必须补 `briefStateCommit`，无差异不造空 commit；archive push 失败特例恢复需人工一次 push（因 harness 从旧路径读 brief 会 `BRIEF_NOT_FOUND`）。
  - 适用 scope: `worktree execute/remove` 的迁移点必须与「harness 读旧路径」这条特例对齐——迁移正是该缺陷的通用解法
- `shadow-docs/knowledge/plan-credential-chain.md`
  - 当前结论: `planHash=sha256(canon({command,data:norm(planData)}))`；norm 只剥 plan 自身副作用；`repo.changedFiles/clean` 已剥离；execute 端未持久化 flag 必须与 plan 完全一致。
  - 适用 scope: 迁移不得进入哈希输入；`change amend` 走 direct command 通道（与 `change create` 同族，卡片已声明其无哈希凭证）
- `shadow-docs/knowledge/brief-frontmatter-crlf.md`
  - 当前结论: frontmatter 行尾契约与 autocrlf 处理；解析失败必须响亮 `BRIEF_FRONTMATTER_REQUIRED`。
  - 适用 scope: 迁移用文件级复制，不得改写行尾；`relocated` 后新树内 brief 必须仍可解析
- `shadow-docs/knowledge/cli-output-contract.md`
  - 当前结论: stdout 单行 JSON 契约、stderr 人类层；新增字段属 additive，须同步契约测试。
  - 适用 scope: `worktree.execute` 输出加 `relocated`；`change.amend` 输出加 `files`
- `shadow-docs/knowledge/install-distribution.md` · `distribution-capability-contract`（内容包侧同名卡）
  - 当前结论: 兼容判定用能力名；**跨仓演进顺序＝执行层先发布支持，内容包随后声明**；能力缺失只能 ARTIFACT_INCOMPATIBLE 阻塞。
  - 适用 scope: 本 change 只在执行层新增 `change.amend` 命令键并升版本；内容包是否声明该键属生产方随后的另一次变更，本仓不反向声明内容包的命令需求
- `rules/iron-laws.md` §6（内容包）/ `norms/knowledge-cards.md`
  - 当前结论: 受管状态只能由 CLI 写；一卡一知识单元，新事实建卡并进菜单路由。
  - 适用 scope: 新增 `shadow-docs/knowledge/worktree-brief-relocation.md` 并在 `shadow-docs/menu.md` 加路由

## 决策

- **选型:** **A. 迁移而非复制，且迁移后唯一真相随工作树走**。
  1. `worktree execute`：`git worktree add` 成功并回写 `branch`/`status`/`workflow.worktree` 之后，若该 brief 在主工作树是**未跟踪**状态，则把 `shadow-docs/<change>/` 整目录搬进新工作树并删除源目录（先校验复制内容一致再删），输出 `relocated: true`；已跟踪（稳态）时 `relocated: false`，行为完全不变（零回归面）。
  2. `worktree remove execute`：删除前若工作树里的 brief 在主工作树不存在（或仍是未跟踪态），先把整目录搬回主工作树再 `git worktree remove`，输出 `relocatedBack: true`；脏工作树仍先判 `WORKTREE_DIRTY`，不静默删数据。
  3. `change amend --name --files <逗号分隔> --confirm`：改写 `files`（沿用 `fileList()` 归一：逗号切分、反斜杠转正斜杠、去 `./`、排序去重），空集拒绝（`FILES_REQUIRED`）；命令目录注册 + `cli.mjs` 分派 + help 文案（中英）+ `next` 指向重规划。
  4. 契约测试：未提交 brief 的 create→approve→worktree（迁移发生、新树内 `task set` 可用、主树旧路径不再存在）→ remove（搬回、目录删除、状态字段清空）；`change amend` 正例/空集/缺 confirm；全部复用既有 `fixture()`/`run()` 骨架。
  5. 本仓首次登记 `shadow-docs/domain.md` 上下文地图（`cli-infrastructure` / `install-distribution` / `github-integration` + 上游 `workflow-governance`），使卡片 `domain` 有值域可依；新卡 `worktree-brief-relocation.md` 落 `cli-infrastructure`。
- **对比方案:**
  - **B. 复制（主树保留一份）**：未选。两份受管状态各自演进正是「divergence」，且主树那份永远落后，是更糟的静默数据损坏。
  - **C. 要求先提交 brief 再建 workspace**：未选。把工具缺陷转嫁给流程纪律；而「brief 已提交」恰是本就该支持的稳态，不是每个 change 的起点。
  - **D. 只在文档里写明「新 change 别用 worktree」**：内容包现状就是这样（已导致 L 级变更被迫降级 inline），属规避不是解决。
  - **E. `change create --worktree` 一步到位**：未选。合并两个动作会绕过 plan/execute 两段式，也让 create 承担 git 写；工具职责应保持单一。
- **理由:** 唯一性是不变量，就必须让「brief 在哪里」成为可推导的单一事实；迁移是保持唯一性的最小动作，而 `relocated` 字段把它显式暴露给 stdout 契约与测试。

## 任务

### Phase 1 — brief 随 workspace 迁移
- [x] `worktree execute` 迁移未提交 brief — `lib/domains/worktree.mjs` — 回写状态后判断主树 `git ls-files` 追踪态；未跟踪则整目录搬入新树（先校验一致再删源），输出 `relocated`
- [x] `worktree remove execute` 搬回 — `lib/domains/worktree.mjs` — 删除前把工作树内未提交的 brief 搬回主树，输出 `relocatedBack`；保持 `WORKTREE_DIRTY` 优先拒绝
- [x] 迁移契约与输出注册 — `lib/commands.mjs`, `cli.mjs` — `worktree.execute`/`remove execute` 摘要补迁移语义（中英 help），命令返回值透出 `relocated` / `relocatedBack`
### Phase 2 — 范围修订命令
- [x] `change amend` — `lib/domains/change.mjs`, `cli.mjs` — `--name --files --confirm`；`fileList()` 归一后写 `files`；空集 `FILES_REQUIRED`；brief 不存在走既有 `BRIEF_NOT_FOUND`
- [x] 命令目录与 help — `lib/commands.mjs` — 注册 `change.amend`（含双语 usage 与 `next: release plan`/重规划提示）
### Phase 3 — 测试与知识
- [ ] 契约测试 — `test/cli.test.mjs` — 新增：未提交 brief 的 worktree 迁移全链（迁移后 `task set` 在新树可用、旧路径消失、remove 搬回）+ `change amend` 三例（正例 / 空集 / 缺 confirm）
- [ ] 知识卡与地图 — `shadow-docs/knowledge/worktree-brief-relocation.md`, `shadow-docs/domain.md`, `shadow-docs/menu.md` — 新卡记唯一性与不丢数据的执行约束与验证方式；本仓首次登记上下文地图并加菜单路由
- [ ] 版本与文档 — `package.json`, `README.md` — 1.5.0 → 1.6.0；README 命令表补 `change amend` 与 worktree 迁移语义

## 结果

- 实际耗时: ≈40 分钟（含一轮 139 风暴导致的环境噪声与两次自伤返工）
- 验证状态: **已实现并端到端手工复现；未跑完 CLI 全量测试套件即提交**（用户指示「直接提交」）。GitHub Actions `test.yml`（ubuntu/macos/windows × node 20/22，约 40+ 用例）为既定替代观察点，PR 开出来就会真跑——run 链接待回填本行。

### 已完成并端到端复现（真实输出）

| 不变量 | 观察点 |
|---|---|
| `change brief` 唯一性：brief 随 workspace 迁移且不留第二份 | 临时仓内 `worktree execute` → `{"branch":"fix/demo","path":"/tmp/sdd-repro/wt","mounted":false,"**relocated":true**}`；主树 `ls shadow-docs/changes/demo/brief.md` → **NO**（无第二份），新树内文件在位且 `branch`/`workflow.worktree`/`status=branched` 均已回写 |
| `workspace` 回收不丢数据 | `worktree remove plan` → `dirty:false`（未提交 brief 不再被算作用户脏改动）；`remove execute` → `{"removed":true,"**relocatedBack**":true}`；worktree 目录 `GONE`，主树 brief 回来，`workflow.worktree=null`，`task list` 可读 |
| 稳态零回归 | `worktree execute` 在已提交 brief 场景返回 `relocated:false`（用例 8 正在锁这条，见下方遗留）；`change create` 路径（draft 与 proposed 两种状态）均跑通 |
| 范围修订可用 | `change amend` 契约用例首轮 **通过**：`--files` 归一排序去重 + `added/removed` 回显；`FILES_REQUIRED`、缺 `--confirm` 退出码 2、`BRIEF_NOT_FOUND` 三条拒绝路径全部命中 |

### 尚未完成的验证（明确标注为未验证）

1. **CLI 全量测试套件未跑完**。提交前最后一次 `node --test test/cli.test.mjs` 被中断，因此「既有测试保持绿」这条 M/L 底线**当前无本机证据**。风险集中在 `cli.mjs` 的 `readBrief` 改动——它替换了 `executeDomain`/`planDomain` 两处 `brief(r, name(o))`，影响所有走 plan/execute 的域。**必须在 CI 全绿后才可合并。**
2. 用例 8「tracked brief 不迁移」首轮确定性失败：`fixture()` 造的 brief 本身是未跟踪的，测试前提写错。已改为在用例内真实 `git add + commit` 造出稳态，**改完未复跑**。
3. 用例 6/7 首轮失败（`status=null` 与 `1 !== 0`）复跑后连续两次通过 → 判定为本机 node 139 段错误风暴（命中信号 SGN-004），非逻辑缺陷；该结论仅有复跑两次为证，样本偏小。

### 过程记录（诚实，含自伤）

- **brief 正文编辑锚点再次误命中 frontmatter**：`issuePlan.body` 里含同名正文快照。已固化为「先按 `\n---\n` 切出正文、再在正文里定位锚点」，本轮全部编辑走该切分，未再破坏受管字段。
- **`check` 类命令一次误用**：`commit plan` 后直接 `release execute` 触发 `PLAN_HASH_INVALID`（planHash 属各自域命名空间），重跑 `release plan` 即恢复。
- 为赶进度主动跳过全量测试属**本次授权的范围缩减**，不是验证通过；上面第 1 条按「未验证」处理，不写成「应该没问题」。

### 遗留与后续

- 跨仓顺序受既有能力契约锁定：**执行层先发布 v1.6.0，内容包随后**才能把 `change.amend` 加进 `requiresCommands` 并让 skills 引用它；现在加会 `ARTIFACT_INCOMPATIBLE` 判红（门在做对的事）。
- 其它 brief 的 `locateRoot` 兜底报错提示（非 worktree 域从主树读已迁移 brief 时，`BRIEF_NOT_FOUND` 应提示实际所在 workspace）尚未实现，属易用性改进。


## 知识评估

- **预期影响:** 新增 + 更新
- **未完成项（本轮按要求搁置，须在后续 change 补）**: `shadow-docs/domain.md`（本仓上下文地图）、`shadow-docs/knowledge/worktree-brief-relocation.md`（新卡）与 `shadow-docs/menu.md` 路由、`package.json` 版本 1.5.0→1.6.0、README 命令表。因卡片与地图未落地、版本未升，**本 change 尚不具备发版条件**；brief 声明文件集中这些项对应任务记为未完成。
- **候选卡片:** `shadow-docs/knowledge/worktree-brief-relocation.md`（新增）、`shadow-docs/knowledge/brief-state-commit.md`（原位追加：archive push 失败特例的通用解法是 brief 随 workspace 迁移，追加 source）、`shadow-docs/menu.md`（新卡路由）、`shadow-docs/domain.md`（新增上下文地图）
- **理由:** 「brief 唯一真相随 workspace 迁移、禁止复制、回收不得删数据」是本仓长期执行约束，不是本次变更过程；`brief-state-commit.md` 里已有的 `BRIEF_NOT_FOUND` 特例被本次工作**加强**，属原位更新追加 source，不新建重复卡。`verified-depth` 由 Phase 3 测试真实达到后填写（预期 `unit`/`runtime`：`node --test` 契约测试即为可重复观察点；未达到的深度不虚报）。
