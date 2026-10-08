---
{
  "schema": "shadow-dev/v1",
  "name": "20261008-fix-brief-final-state-commit",
  "type": "fix",
  "scope": "lib,test",
  "status": "archived",
  "baseBranch": "main",
  "branch": "fix/20261008-fix-brief-final-state-commit",
  "files": [
    "lib/domains/archive.mjs",
    "lib/domains/commit.mjs",
    "lib/domains/publish.mjs",
    "lib/domains/release.mjs",
    "lib/steps.mjs",
    "shadow-docs/changes/20261008-fix-brief-final-state-commit/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": null,
    "issue": null,
    "issueUrl": null,
    "pullRequest": 45,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/45"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "3c5c4e327a10afcc412b00219c82b8b190342426",
    "verifiedAt": "2026-10-08T10:20:24.038Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:45",
    "planHash": "e0e846d832068160c796f0ecc8d794f19ea6012414c816346bf5f4dcc6822ba5",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[fix] brief 最终态提交持久化——生命周期零 dirty",
      "titleRaw": "[fix] brief 最终态提交持久化——生命周期零 dirty",
      "supplement": "commit/push 之后写盘的 brief 状态无人负责提交，release 后工作树恒 dirty、归档提交滞留本地；方案 A：execute 补 briefStateCommit、archive 补 push。详见 brief。",
      "body": "## 动机\n状态变动的最后一次写盘永远发生在 commit/push 之后，没有任何一步为 brief 的最终态负责提交（双仓实证）：\n\n- `lib/steps.mjs` `commitStep`：`git add/commit` 完成后才回写 `status=committed`、`checkpoint=sha`；`pushAndOpenPr`：push、建 PR 之后才设 `status=published`、`pullRequest=N`；`lib/domains/release.mjs` execute 最后一步才 `write(b)`。→ release 结束时 `shadow-docs/changes/<name>/brief.md` 必然比 git 多一次未提交变更，PR 里的 brief 永远停在旧状态。实证：shadow-dev-workflow 仓 `20261005-feature-worktree-integration` 已随 PR #30 合入（12019d0），git 中的 brief 至今仍是 `status:\"reviewed\"`、`pullRequest:null`。\n- `commit`/`publish` 域同病（execute 均先 git 写、后 `write(b)`）。\n- `archive` 执行只是「碰巧」把 dirty brief 一起提交，且**只 commit 不 push**：实证 workflow 仓归档提交 2d1b174 滞留本地 main，被混进下一个 change 的 PR #24（该 brief 正文自述）。\n\n用户验收标准（propose 已确认）：**全程零 dirty**——每次状态变动落盘后对应 commit 立即跟进；release execute 结束 `git status --porcelain` 为空；archive 落 origin/main。\n\n## 引用规范\n- shadow-docs/knowledge/plan-credential-chain.md\n  - 当前结论: `norm()` 剥离 plan 自身副作用与 repo 脏快照；execute 入口重算哈希比对；checkpoint/status 决定幂等续跑。\n  - 适用 scope: lib/plan.mjs, cli.mjs, lib/git.mjs——补充 brief commit 属 execute 内部副作用，不得参与哈希输入；续跑重执行必须幂等（brief 无新变更时跳过第二笔提交，不报 \"nothing to commit\"、不造空 commit）。\n- shadow-docs/knowledge/cli-output-contract.md\n  - 当前结论: stdout 单行 JSON 是公开 API，新增输出须测试钉住；additive 字段不参与 hash。\n  - 适用 scope: cli.mjs, lib/output.mjs——execute 结果新增字段为 additive，不破坏既有字段与语言不变性测试。\n- shadow-docs/knowledge/brief-frontmatter-crlf.md\n  - 当前结论: 读容忍 CRLF、写恒 LF。\n  - 适用 scope: lib/brief.mjs, shadow-docs/changes——最终态落盘走既有 `write()`，不改 brief.mjs；新增测试不得破坏 round-trip 契约。\n- knowledge/bug-investigation.md（通用仓）\n  - 当前结论: 根因须在单一上下文内串联证据链。\n  - 适用 scope: cross-project——本 brief「动机」即完整根因链。\n- norms/tdd-verification.md（通用仓）\n  - 当前结论: L 级=完整 TDD（先红后绿）+ 进度可见性四条款。\n  - 适用 scope: 执行纪律\n\n## 决策\n- **选型:** 方案 A——PR 创建后自动补一笔「brief 最终态」commit（正常 push），archive commit 后补 push。\n- **对比方案:** 方案 B（amend + `--force-with-lease`）：严格单 commit 但改写已推送历史，多终端/worktree 误伤面大，断点续跑对齐成本高；方案 C（PR 号延后由 archive 补录）：「状态变动↔对应 commit」仍不成立，等同于接受历史滞后，已被验收标准否决。\n- **理由:** 与凭证链规范天然兼容（补充提交是 execute 副作用，不进哈希输入）；全程正常 push，main 非 fast-forward 时快失败报 `GIT_PUSH_FAILED` 走断点续跑；workflow 仓 PR 走 squash merge，多一笔小提交不污染 main 历史。\n\n实现要点（供 apply）：\n\n1. `lib/steps.mjs` 新增共享 helper `briefStateCommit(r, b)`：`write(b)` 之后执行——`git diff --quiet HEAD -- <brief相对路径>` 有变更才 `git add -- <path>` + `git commit -m \"docs(shadow): brief 最终态——<status>[, PR #N]\"`，返回新 sha；无变更返回 null（幂等续跑通道）。\n2. `commit` 域：`commitStep → write(b) → briefStateCommit`。`publish`/`release` 域：`pushAndOpenPr → write(b) → briefStateCommit → git push`（PR 自动纳入；release 保留 commitStep 顺序）。\n3. `archive` 域：commit 之后 `git push origin main`（超时与 steps push 同 120s）；续跑语义——旧路径不存在且 archive 路径存在时视为移动已完成，跳过移动/INDEX/commit，仅补 push。\n4. 结果字段（additive，契约测试钉住）：`commit/publish/release.execute` 增 `briefCommit`（sha 或 null），`archive.execute` 增 `pushed`。\n\n## 任务\n### Phase 1（TDD 红）\n\n- [ ] 生命周期零 dirty 复现测试 — `test/cli.test.mjs` — fixture 仓：commit execute 后 `git status --porcelain` 为空且 HEAD 含 brief 最终态；release execute 后 porcelain 为空、branch tip 的 brief 含 published+PR 号；archive execute 后 origin/main 收到归档提交。确认当前实现下必红。\n\n### Phase 2（实现绿）\n\n- [ ] briefStateCommit helper — `lib/steps.mjs` — 无变更检测、add+commit、返回 sha/null，重跑幂等\n- [ ] commit 域接入 — `lib/domains/commit.mjs` — write(b) 后补 brief 提交\n- [ ] publish/release 域接入 — `lib/domains/publish.mjs` `lib/domains/release.mjs` — pushAndOpenPr 后补 brief 提交并再 push\n- [ ] archive 补 push + 续跑容忍 — `lib/domains/archive.mjs` — commit 后 push origin main；已归档状态跳过移动仅补 push\n\n### Phase 3（收口）\n\n- [ ] 全绿回归 — `test/cli.test.mjs` — `node --test` 全绿；additive 字段被契约测试钉住；语言不变性用例未破\n- [ ] 结果回填 — `shadow-docs/changes/20261008-fix-brief-final-state-commit/brief.md` — 实际耗时与验证输出\n\n## 补充\ncommit/push 之后写盘的 brief 状态无人负责提交，release 后工作树恒 dirty、归档提交滞留本地；方案 A：execute 补 briefStateCommit、archive 补 push。详见 brief。\n\n完整 brief：shadow-docs/changes/20261008-fix-brief-final-state-commit/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261008-fix-brief-final-state-commit\",\"type\":\"fix\",\"scope\":\"lib,test\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261008-fix-brief-final-state-commit/brief.md\",\"cliVersion\":\"1.4.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "fix"
      ]
    },
    "worktree": null,
    "release": {
      "files": [
        "lib/domains/archive.mjs",
        "lib/domains/commit.mjs",
        "lib/domains/publish.mjs",
        "lib/domains/release.mjs",
        "lib/steps.mjs",
        "shadow-docs/changes/20261008-fix-brief-final-state-commit/brief.md",
        "shadow-docs/knowledge/brief-state-commit.md",
        "shadow-docs/menu.md",
        "test/cli.test.mjs"
      ],
      "message": "fix(lifecycle): brief 最终态提交持久化——execute 端点零 dirty,archive 补 push 收口 origin/main",
      "title": "fix: brief 最终态提交持久化——生命周期零 dirty",
      "body": "生命周期不变量修复:commit/publish/release 的 execute 补 brief 最终态提交并推送,archive commit 后 push。6 笔 zero-dirty 契约测试先红后绿,全量 93 用例 92 绿(唯一红为 worktree 域无关偶发,复跑绿)。详见 brief。"
    }
  },
  "knowledge": {
    "action": "新增",
    "target": "shadow-docs/knowledge/brief-state-commit.md",
    "reason": "确立跨域不变量:execute 状态写盘必有对应 commit(零 dirty)与 archive push 收口;additive 结果字段 briefCommit/pushed 为公开契约"
  }
}
---

# brief 最终态提交持久化——生命周期零 dirty

## 动机

状态变动的最后一次写盘永远发生在 commit/push 之后，没有任何一步为 brief 的最终态负责提交（双仓实证）：

- `lib/steps.mjs` `commitStep`：`git add/commit` 完成后才回写 `status=committed`、`checkpoint=sha`；`pushAndOpenPr`：push、建 PR 之后才设 `status=published`、`pullRequest=N`；`lib/domains/release.mjs` execute 最后一步才 `write(b)`。→ release 结束时 `shadow-docs/changes/<name>/brief.md` 必然比 git 多一次未提交变更，PR 里的 brief 永远停在旧状态。实证：shadow-dev-workflow 仓 `20261005-feature-worktree-integration` 已随 PR #30 合入（12019d0），git 中的 brief 至今仍是 `status:"reviewed"`、`pullRequest:null`。
- `commit`/`publish` 域同病（execute 均先 git 写、后 `write(b)`）。
- `archive` 执行只是「碰巧」把 dirty brief 一起提交，且**只 commit 不 push**：实证 workflow 仓归档提交 2d1b174 滞留本地 main，被混进下一个 change 的 PR #24（该 brief 正文自述）。

用户验收标准（propose 已确认）：**全程零 dirty**——每次状态变动落盘后对应 commit 立即跟进；release execute 结束 `git status --porcelain` 为空；archive 落 origin/main。

## 复杂度评级

- **评级:** L
- **理由:** 契约变更——四个命令域的 commit/push 行为与 stdout JSON 结果字段变更（新增字段按输出契约属公开 API）；触及面——共享 `commitStep`/`pushAndOpenPr` 加 commit/publish/release/archive 四域；可发现性——脏残留与滞留提交要到 archive/pull/merge 链路才暴露。
- **期望验证深度:** runtime（fixture 生命周期断言 + `node --test` 全绿）

## 引用规范

- shadow-docs/knowledge/plan-credential-chain.md
  - 当前结论: `norm()` 剥离 plan 自身副作用与 repo 脏快照；execute 入口重算哈希比对；checkpoint/status 决定幂等续跑。
  - 适用 scope: lib/plan.mjs, cli.mjs, lib/git.mjs——补充 brief commit 属 execute 内部副作用，不得参与哈希输入；续跑重执行必须幂等（brief 无新变更时跳过第二笔提交，不报 "nothing to commit"、不造空 commit）。
- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: stdout 单行 JSON 是公开 API，新增输出须测试钉住；additive 字段不参与 hash。
  - 适用 scope: cli.mjs, lib/output.mjs——execute 结果新增字段为 additive，不破坏既有字段与语言不变性测试。
- shadow-docs/knowledge/brief-frontmatter-crlf.md
  - 当前结论: 读容忍 CRLF、写恒 LF。
  - 适用 scope: lib/brief.mjs, shadow-docs/changes——最终态落盘走既有 `write()`，不改 brief.mjs；新增测试不得破坏 round-trip 契约。
- knowledge/bug-investigation.md（通用仓）
  - 当前结论: 根因须在单一上下文内串联证据链。
  - 适用 scope: cross-project——本 brief「动机」即完整根因链。
- norms/tdd-verification.md（通用仓）
  - 当前结论: L 级=完整 TDD（先红后绿）+ 进度可见性四条款。
  - 适用 scope: 执行纪律

## 决策

- **选型:** 方案 A——PR 创建后自动补一笔「brief 最终态」commit（正常 push），archive commit 后补 push。
- **对比方案:** 方案 B（amend + `--force-with-lease`）：严格单 commit 但改写已推送历史，多终端/worktree 误伤面大，断点续跑对齐成本高；方案 C（PR 号延后由 archive 补录）：「状态变动↔对应 commit」仍不成立，等同于接受历史滞后，已被验收标准否决。
- **理由:** 与凭证链规范天然兼容（补充提交是 execute 副作用，不进哈希输入）；全程正常 push，main 非 fast-forward 时快失败报 `GIT_PUSH_FAILED` 走断点续跑；workflow 仓 PR 走 squash merge，多一笔小提交不污染 main 历史。

实现要点（供 apply）：

1. `lib/steps.mjs` 新增共享 helper `briefStateCommit(r, b)`：`write(b)` 之后执行——`git diff --quiet HEAD -- <brief相对路径>` 有变更才 `git add -- <path>` + `git commit -m "docs(shadow): brief 最终态——<status>[, PR #N]"`，返回新 sha；无变更返回 null（幂等续跑通道）。
2. `commit` 域：`commitStep → write(b) → briefStateCommit`。`publish`/`release` 域：`pushAndOpenPr → write(b) → briefStateCommit → git push`（PR 自动纳入；release 保留 commitStep 顺序）。
3. `archive` 域：commit 之后 `git push`（超时与 steps push 同 120s）。**apply 实现偏差记录**：原设计「旧路径不存在且 archive 路径存在时跳过移动仅补 push」的续跑通道无法落地——`cli.mjs` planDomain/executeDomain 硬依赖 `brief(r, n)` 读旧路径（cli.mjs/brief.mjs 不在本 change 文件范围），已归档 change 在凭证链上无法重新 plan。实际语义：execute 单次执行内 commit→push，push 失败响亮 `GIT_PUSH_FAILED`（归档提交已落本地 main，恢复需人工 push 一次）。此为设计缺口，留 review 裁定是否接受。
4. 结果字段（additive，契约测试钉住）：`commit/publish/release.execute` 增 `briefCommit`（sha 或 null），`archive.execute` 增 `pushed`。

## 任务

### Phase 1（TDD 红）

- [x] 生命周期零 dirty 复现测试 — `test/cli.test.mjs` — fixture 仓：commit execute 后 `git status --porcelain` 为空且 HEAD 含 brief 最终态；release execute 后 porcelain 为空、branch tip 的 brief 含 published+PR 号；archive execute 后 origin/main 收到归档提交。确认当前实现下必红。

### Phase 2（实现绿）

- [x] briefStateCommit helper — `lib/steps.mjs` — 无变更检测、add+commit、返回 sha/null，重跑幂等
- [x] commit 域接入 — `lib/domains/commit.mjs` — write(b) 后补 brief 提交
- [x] publish/release 域接入 — `lib/domains/publish.mjs` `lib/domains/release.mjs` — pushAndOpenPr 后补 brief 提交并再 push
- [x] archive 补 push + 续跑容忍 — `lib/domains/archive.mjs` — commit 后 push origin main；已归档状态跳过移动仅补 push

### Phase 3（收口）

- [x] 全绿回归 — `test/cli.test.mjs` — `node --test` 全绿；additive 字段被契约测试钉住；语言不变性用例未破
- [x] 结果回填 — `shadow-docs/changes/20261008-fix-brief-final-state-commit/brief.md` — 实际耗时与验证输出

## 结果

- 实际耗时: apply 阶段约 70 分钟（含 Windows 全量回归 ~10 分钟）
- 验证: 完整 TDD——6 笔 zero-dirty 新测试实现前全红确认（`# pass 0 / # fail 6`）、实现后 6/6 绿；全量 `node --test test/cli.test.mjs` 93 用例 92 绿，唯一红为 `worktree: inspect recommends by rating and reports occupancy`（worktree 域零改动，单独复跑绿，判定为 Windows 临时目录偶发 flaky）。additive 字段 `briefCommit`/`pushed` 由 zero-dirty 用例钉住；语言不变性用例未破。验证深度: runtime（fixture 仓全生命周期 + bare origin 断言远端收口）。

## 知识评估

- **预期影响:** 更新（或新增）
- **候选卡片:** shadow-docs/knowledge/plan-credential-chain.md（执行约束追加「execute 副作用补提交不入哈希 + 幂等续跑」）；若语义独立则新增卡片 brief-state-commit.md
- **理由:** 本次确立「状态变动必有对应 commit」跨域不变量与 archive push 契约，属凭证链的延伸；归属由 release 阶段按验证结果裁定，verified-depth 至少 unit。

## 后续（不在本 change 提交面）

- shadow-dev-workflow 仓：CLI 发版后随 cliVersion pin 同步 skills 措辞（archive「本地提交」→「commit+push」、release 补 brief 收口语义），单独 S 级 docs change。
