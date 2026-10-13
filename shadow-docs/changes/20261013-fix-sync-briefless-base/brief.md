---
{
  "schema": "shadow-dev/v1",
  "name": "20261013-fix-sync-briefless-base",
  "type": "fix",
  "scope": null,
  "status": "published",
  "baseBranch": "main",
  "branch": "fix/20261013-fix-sync-briefless-base",
  "files": [
    "README.md",
    "lib/commands.mjs",
    "lib/domains/sync.mjs",
    "shadow-docs/changes/20261013-fix-sync-briefless-base/brief.md"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": null,
    "issueUrl": null,
    "pullRequest": 70,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/70"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "e5d83a9a04a68003f2b82e21c08f02703a4955f9",
    "verifiedAt": "2026-10-13T04:19:09.758Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "pr:70",
    "planHash": "2291cd9e4f75d0e08deb989a055249cf3b69ed3e1509d9d3fb166582f5d1565b",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "README.md",
        "lib/commands.mjs",
        "lib/domains/sync.mjs",
        "shadow-docs/changes/20261013-fix-sync-briefless-base/brief.md"
      ],
      "message": "fix: sync 解除 brief 硬依赖，基线取 --base-branch > brief > 当前分支",
      "title": "fix: sync 解除 brief 硬依赖，基线取 --base-branch > brief > 当前分支",
      "body": "## 变更\n- `lib/domains/sync.mjs`：基线解析改为 `--base-branch` > `brief.baseBranch` > 当前分支\n- brief 缺失不再阻断 sync；`origin/<base>` 不可解析时以 `SYNC_UPSTREAM_NOT_FOUND` 响亮拒绝\n- `lib/commands.mjs`：sync 两键的 `--name` 由必填降为可选，新增 `--base-branch`\n- `sync plan` 的 nextStep 改为无 brief 形态 `sync execute --plan-hash {planHash} --confirm`\n- `README.md`：sync 行同步新调用形态与基线解析序\n\n## 影响\n- 行为/触发面变化：squash 合并后的收口不再需要人工 `git merge --ff-only`\n- 在基线分支上 `sync plan` + `sync execute --plan-hash <hash> --confirm` 即可闭合\n- 代价显式化：非当前分支的基线必须传 `--base-branch`，原先由 brief 代答\n- 明确不受影响的范围：`cli.mjs` harness 与凭证模型零改动\n- 带 `--name` 且 brief 在盘的旧调用形态行为不变；`--name` 降为可选是放宽，旧写法不会失败\n\n## 验证\n- 观察点脚本（真实临时仓 + bare remote，不入库）逐条覆盖 6 条不变量，含三条拒绝路径\n- INV-1 无 brief 可 plan：`planHash 96c5f0a6…`；execute 后 `head` 与远端 tip 逐字相等\n- INV-2 `--base-branch release/9` 压过 brief 的 `baseBranch: main`\n- INV-4 无 brief 时脏树仍 `DIRTY_WORKTREE`；INV-6 未知 base → `SYNC_UPSTREAM_NOT_FOUND`\n- INV-3 有 brief 时基线仍取 brief；本地分叉 → `SYNC_NOT_FAST_FORWARD`\n- INV-5 带 brief 通路仍把 planHash 写入 brief：`equal: true`\n- 参考回归：`node --test --test-name-pattern \"sync (plan|fetches|blocks)\"` 6/6 绿\n- 未覆盖项：全量 `npm test` 本机约 270s，超 60s 阈值未在本机跑，由 `test.yml` 的 PR 触发补\n- 未覆盖项：#59 的 `verifiedCommit` 漂移那一半不放宽，属设计内的门，归档前在 main 重跑 review\n\n## 关联\n- Closes #65\n- Refs #59\n- brief: shadow-docs/changes/20261013-fix-sync-briefless-base/brief.md"
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": null,
    "reason": null
  }
}
---

# 20261013-fix-sync-briefless-base

## 动机

squash 合并后收口时 `sync` 两头卡死（issue #59），#65 已证明浅修复被 harness 的 `readBrief` + `write` 两处堵死、出路只能是改契约。现场是：调用者已经站在基线分支上，而 brief 只在 ff 之后才落到工作树——于是 `sync` 恰好在它唯一被需要的场景里必然 `BRIEF_NOT_FOUND`，人只能退回裸 `git merge --ff-only`（本会话已这样绕过 6 次）。

## 复杂度评级

- **评级:** L
- **理由:** 改的是 `sync` 命令域的对外参数契约（`--name` 由必填降为可选、新增 `--base-branch`、新增拒绝码 `SYNC_UPSTREAM_NOT_FOUND`）。命中 `norms/verification.md` 三要素的「契约变更」与「命令域行为」；改坏要到合并后收口路径才炸，可发现性差。
- **期望验证深度:** runtime——真实临时仓 + 真实 remote + 真实 plan/execute 端到端跑，不停在 code-read。
- **取证策略:** observation（默认形态）。**不用 assert-first**：本轮先按 L 选了 assert-first 并新建 4 条套件断言，被用户裁定驳回——`norms/verification.md` 的默认取证形态就是观察点，assert-first 是可选项且须 propose 时由人批准，不得默认新建测试。断言改动已全部回退（`git checkout -- test/cli.test.mjs`），取证改由下方一次性观察点脚本产出，脚本落在临时目录、不入库。

## 领域模型

- **限界上下文:** 变更生命周期收口（merged → 本地基线同步 → 归档）
- **统一语言增量:** 「基线分支 base」与「上游 upstream」分离——upstream 恒为 `origin/<base>`；`sync` 的输入是 base，不是 brief。base 解析优先级恒为 `--base-branch` > `brief.baseBranch` > 当前分支。
- **不变量:**
  - INV-1 brief 不是 sync 的前置条件：`shadow-docs/changes/<n>/brief.md` 不存在时 `sync plan` 不得以 `BRIEF_NOT_FOUND` 结束，且 `sync execute --plan-hash` 仍能完成 ff。
  - INV-2 base 解析优先级恒为 `--base-branch` > `brief.baseBranch` > 当前分支；显式入参永远压过 brief。
  - INV-3 仅快进语义不变：`sync execute` 仍只做 `git merge --ff-only`，分叉一律 `SYNC_NOT_FAST_FORWARD`。
  - INV-4 零脏树门不放宽：非 `shadow-docs/` 的脏文件仍 `DIRTY_WORKTREE`，无 brief 时同样生效。
  - INV-5 凭证语义不扩张：brief 在盘上时 planHash 仍写入 brief（带 `--name` 的既有通路零改动）；无 brief 时 `--plan-hash` 为唯一凭证，复用无 brief 域既有机制，不改 harness。
  - INV-6 base 不可解析时响亮失败：`origin/<base>` 不存在 → `SYNC_UPSTREAM_NOT_FOUND` 并带出 base，绝不退化成空操作。
- **领域事件:** `sync.planned`（base / from / to / upstream）、`sync.fast-forwarded`（head 前移）

## 引用规范

- `norms/verification.md`
  - 当前结论: 三层职责分离；默认取证形态是观察点，assert-first 为 L 级可选且须 propose 批准；regression 探针仅在 CI 实测 ≤ 60s 的仓里作硬门槛。
  - 适用 scope: `lib/domains/sync.mjs`, `README.md`
  - 与本变更的关系: 评级、取证形态与门槛适用性的依据（本变更正是被这条 norm 驳回了一次）。

## 覆盖范围

- `lib/domains/sync.mjs`：base 三级优先解析、brief 缺失不再抛错、`origin/<base>` 缺失响亮拒绝；plan 数据补 `base` 字段，无 `--name` 时 `name` 恒为 null。
- `lib/commands.mjs`：`sync.plan` / `sync.execute` 的 `--name` 降为可选、新增 `--base-branch`、`sync plan` 的 nextStep 改为无 brief 形态。
- `README.md`：sync 行改为新调用形态与基线解析序。
- 载体 brief 自身。

## 决策

- 采纳 #65 的方案 **B**，不采纳 A（新增 `transientPlan` seam 并改 `sync execute` 对外形态）与 C（把收口定义为纯人工，等于承认 CLI 不覆盖该路径）。
- **harness 零改动**：`planDomain` / `executeDomain` 的 `!o.name` 分支已是无 brief 域凭证通路，缺陷只在 `sync.mjs` 自己硬调 `brief()`。这条是 B 比 A 窄的实证依据，也是本 change 只碰 3 个实现文件的原因。
- `--name` 保留可用（旧 SKILL 写法与既有流程不炸），仅从必填降为可选。
- **#59 的另一半不在本 change 放宽**：squash 后 `verifiedCommit` 与 HEAD 漂移导致归档前须在 main 重跑 review，这是设计内的门，不是缺陷。本 change 只解除 sync 卡死，并在 issue 中显式拆分记录，不偷偷改 archive 门。
- 本仓无 `scripts/check-brief.mjs`（guard 探针在 workflow 宿主仓）；`npm test` 全量约 270s > 60s 阈值，全量回归由本仓 `test.yml` 的 `pull_request` 触发补跑，缺口在此登记不静默免除。

## 任务

### Phase 1 · sync 域解 brief

- [x] task-1 — `lib/domains/sync.mjs` — base 三级优先解析 + brief 缺失不抛 + `SYNC_UPSTREAM_NOT_FOUND`
- [x] task-2 — `lib/commands.mjs` — sync 两键的参数契约与 nextStep 模板

### Phase 2 · 观察点取证

- [x] task-3 — 临时脚本 `obs.mjs`（不入库）— 每条 `INV-n` 一个真实观察点，含 INV-3b/INV-4/INV-6 三条拒绝路径

### Phase 3 · 文档对齐

- [x] task-4 — `README.md` — sync 行与调用形态

## 结果

评级 L，取证策略 observation。观察点脚本：`node /c/Users/596540/AppData/Local/Temp/obs.mjs`（自建临时仓 + bare remote + clone 推进分支，逐条真实调用 `node cli.mjs sync plan/execute --json`）。以下 JSON 均为该脚本的真实输出。

- **INV-1**（无 brief 可 plan 并 ff）
  - `sync plan` → `{"rc":0,"data":{"name":null,"base":"main","from":"6cbccb5d…","to":"202f40af…","upstream":"origin/main"},"planHash":"96c5f0a64310"}`，`extra: remoteTip=202f40afeadeb3e38d93397f1e380e68430c2c98`
  - `sync execute --plan-hash 96c5f0a6… --confirm` → `{"rc":0,"data":{"head":"202f40afeadeb3e38d93397f1e380e68430c2c98"}}`，`extra: noteMainOnDisk=true headEqTip=true`——`--plan-hash` 为唯一凭证即可 ff，head 与远端 tip 逐字相等。
- **INV-2**（显式入参压过 brief）：brief 的 `baseBranch` 是 `main`，`sync plan --name sample --base-branch release/9` → `{"rc":0,"data":{"name":"sample","base":"release/9","upstream":"origin/release/9","to":"22f47435…"}}`。
- **INV-5**（凭证语义不扩张 / harness 未改）：同上这次 plan 后读 brief frontmatter → `{"briefPlanHash":"b53f9225f221","planHash":"b53f9225f221","equal":true}`；带 `--name` 通路照旧写盘。`cli.mjs` 与 `test/cli.test.mjs` 均无改动（`git diff --stat` 只有 `README.md`、`lib/commands.mjs`、`lib/domains/sync.mjs` 三文件 + 载体 brief）。
- **INV-4**（脏树门不因无 brief 放宽）：删 brief 后改脏 `README.md` → `{"rc":1,"code":"DIRTY_WORKTREE"}`。
- **INV-6**（base 不可解析响亮失败）：`sync plan --base-branch nope/1` → `{"rc":1,"code":"SYNC_UPSTREAM_NOT_FOUND","message":"SYNC_UPSTREAM_NOT_FOUND: origin/nope/1 does not resolve — pass --base-branch <base> explicitly"}`，不退化成空操作。
- **INV-3**（仅快进语义与向后兼容）
  - 有 brief 无 flag：`sync plan --name sample` → `{"rc":0,"data":{"base":"main","upstream":"origin/main"}}`——基线仍取自 brief，旧调用零变化。
  - 分叉拒绝：本地多一枚 commit 后 `sync plan --name sample` → `{"rc":1,"code":"SYNC_NOT_FAST_FORWARD"}`。
- **既有套件**：`test/cli.test.mjs` 本轮未改动（改动已 `git checkout --` 回退）。上一次定向跑留下的参考结论：`node --test --test-name-pattern "sync (plan|fetches|blocks)"` 6/6 绿（含既有两条 sync 断言），用于佐证实现不破坏既有语义。

**未覆盖项（按门槛层显式登记）**

- 全量 `npm test` 本机约 270s > 60s，未在本机跑全量；由本仓 `test.yml`（`pull_request`）在全量套件上补，PR checks 未绿前不视为交付完成。
- 真实 squash 现场的端到端复演就在本 change 自己的收口阶段执行：合并后在 main 上以 `sync plan` + `sync execute --plan-hash` 新形态收口，届时把真实输出追加到本节。
- #59 的 `verifiedCommit` 漂移那一半本 change 不覆盖（设计内的门），在 issue 中拆分记录。

