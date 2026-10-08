---
{
  "schema": "shadow-dev/v1",
  "name": "20261005-feature-worktree-domain",
  "type": "feature",
  "scope": "lib,cli",
  "status": "archived",
  "baseBranch": "feature/20261005-feature-shadow-dev-config",
  "branch": "feature/20261005-feature-worktree-domain",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/commands.mjs",
    "lib/domains/worktree.mjs",
    "lib/i18n.mjs",
    "shadow-docs/changes/20261005-feature-worktree-domain/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": null,
    "issue": null,
    "issueUrl": null,
    "pullRequest": 37,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/37"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "dfc6d0ad99f829effdae1a835408d226965bd1ec",
    "verifiedAt": "2026-10-08T02:58:33.894Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:37",
    "planHash": "7b934384cbaae87a2d6ef1724a4a31c80623c083b9ee546330807a8e575d77a7",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] git worktree 域——并行变更独立工作区",
      "titleRaw": "git worktree 域——并行变更独立工作区",
      "supplement": "Brief: shadow-docs/changes/20261005-feature-worktree-domain/（L 级堆叠于 config PR；inspect/plan/execute/remove + 三错误码）",
      "body": "## 动机\nshadow 工作流是串行的单 checkout 模型：L 级变更与 hotfix 并行时全靠切分支腾挪——本会话实证三次 stash 硬扛（brief 跨分支搬运、DU 冲突、清理孤儿项）。git worktree 让每个 active change 拥有独立目录；CLI 需要补齐 inspect/plan/execute 三段，把「检测空闲 worktree → 按评级建议 → 创建/回收」纳入确定性执行层。插件侧 skills 集成为堆叠的后续变更。\n\n## 引用规范\n- `shadow-docs/knowledge/plan-credential-chain.md`\n  - 当前结论: planHash 剥离 plan 副作用字段；execute 以 brief.workflow.planHash 为前置凭证重算对比\n  - 适用 scope: worktree plan/execute 凭证链（workflow.worktree 由 execute 写回，不参与剥离——plan 时恒为旧值，execute 重算一致）\n- `shadow-docs/knowledge/cli-output-contract.md`\n  - 当前结论: stdout 单行 JSON 契约 + stderr 人用层；命令目录单一事实源\n  - 适用 scope: 5 个命令的 catalog 注册、HINTS 错误码、nextStep 稳定模板\n- `norms/tdd-verification.md`\n  - 当前结论: L 级完整 TDD 先红后绿；进度可见性\n  - 适用 scope: 全部实现任务\n\n## 决策\n- **选型:** 单域 `lib/domains/worktree.mjs` 四命令：`inspect`（只读：worktree 清单 + 每 worktree 的 branch/clean/current + 占用 change 反查 + 按 brief 评级给 recommendation/nextStep）；`plan/execute`（创建：path 必填；brief.branch 空则 `git worktree add -b <type>/<name> <path> <base>` 并回写 branch+status=branched，branch 已存在则挂载模式；回写 `workflow.worktree=<path>`）；`remove plan/execute`（以 workflow.worktree 为对象；dirty 拒绝 WORKTREE_DIRTY；目录已消失则 `git worktree prune` 幂等清字段）\n- **对比方案:** 只读 inspect + 手动 git（写操作旁路 CLI，违反铁律 6）；worktree 自动选路径 `<repo>/.worktrees/<name>`（隐式路径不可见、与 install 布局冲突，v1 显式 `--path` 更好）\n- **理由:** worktree 创建不要求当前在 base 分支——这正是它替代切分支腾挪的价值；分支存在性探测（`git branch --list`）plan 期入 planData 保证 plan→execute 复现一致\n- **错误码:** WORKTREE_PATH_TAKEN / WORKTREE_DIRTY / WORKTREE_NOT_FOUND；v1 不加 `--force`（脏 worktree 拒绝，不做隐式删除）\n- **规范遵循说明:** recommendation 三值（inline/reuse/create）按评级 S/M→inline、L 无空闲→create、L 有空闲→reuse；nextStep 英文稳定模板\n\n## 任务\n### Phase 1 — TDD 红灯\n- [ ] worktree 域失败测试 — `test/cli.test.mjs` — 六用例先红：execute 新建（branch 派生+目录出现+brief 回写）／挂载已有分支／path 被占 WORKTREE_PATH_TAKEN／remove 干净成功清字段／remove 脏拒绝 WORKTREE_DIRTY／inspect 三态建议与占用反查\n\n### Phase 2 — 实现转绿\n- [ ] lib/domains/worktree.mjs — `lib/domains/worktree.mjs` — inspect/planData/execute/remove 四函数 + present 最小投影\n- [ ] 命令注册与目录 — `cli.mjs` `lib/commands.mjs` `lib/i18n.mjs` — DOMAINS/handle 路由、5 条 catalog、3 个 HINTS 错误码\n\n### Phase 3 — 文档与自证\n- [ ] README 命令参考 — `README.md` — worktree 域表格与并行变更说明；本 brief 全程由带 worktree 域前的新 CLI 管理，实现后 `shadow-dev help worktree --json` 冒烟\n\n## 补充\nBrief: shadow-docs/changes/20261005-feature-worktree-domain/（L 级堆叠于 config PR；inspect/plan/execute/remove + 三错误码）\n\n完整 brief：shadow-docs/changes/20261005-feature-worktree-domain/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261005-feature-worktree-domain\",\"type\":\"feature\",\"scope\":\"lib,cli\",\"status\":\"draft\",\"branch\":null,\"baseBranch\":\"feature/20261005-feature-shadow-dev-config\",\"briefPath\":\"shadow-docs/changes/20261005-feature-worktree-domain/brief.md\",\"cliVersion\":\"1.4.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "feature"
      ]
    },
    "release": {
      "files": [
        "README.md",
        "cli.mjs",
        "lib/commands.mjs",
        "lib/domains/worktree.mjs",
        "lib/i18n.mjs",
        "shadow-docs/changes/20261005-feature-worktree-domain/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "feat(worktree): git worktree 域——inspect 按评级建议、plan/execute 创建挂载、remove 脏拒绝回收;路径 realpath 归一",
      "title": "feat(worktree): 并行变更独立工作区域（inspect/create/remove）",
      "body": ""
    },
    "commit": {
      "files": [
        "lib/domains/worktree.mjs",
        "shadow-docs/changes/20261005-feature-worktree-domain/brief.md"
      ],
      "message": "fix(worktree): porcelain 解析容 CRLF 行尾——Windows path 尾随\\r 致 existsSync 恒 false,inspect reuse 误判"
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": null,
    "reason": null
  }
}
---

# git worktree 域——并行变更的独立工作区管理

## 动机

shadow 工作流是串行的单 checkout 模型：L 级变更与 hotfix 并行时全靠切分支腾挪——本会话实证三次 stash 硬扛（brief 跨分支搬运、DU 冲突、清理孤儿项）。git worktree 让每个 active change 拥有独立目录；CLI 需要补齐 inspect/plan/execute 三段，把「检测空闲 worktree → 按评级建议 → 创建/回收」纳入确定性执行层。插件侧 skills 集成为堆叠的后续变更。

## 复杂度评级

- **评级:** L
- **理由:** 新增行为契约（命令域 + brief workflow.worktree 字段 + 新错误码），git 写操作（worktree add/remove），宿主 repo 状态面扩展
- **期望验证深度:** runtime（契约测试 + 真实 git worktree 操作可观察）

## 引用规范

- `shadow-docs/knowledge/plan-credential-chain.md`
  - 当前结论: planHash 剥离 plan 副作用字段；execute 以 brief.workflow.planHash 为前置凭证重算对比
  - 适用 scope: worktree plan/execute 凭证链（workflow.worktree 由 execute 写回，不参与剥离——plan 时恒为旧值，execute 重算一致）
- `shadow-docs/knowledge/cli-output-contract.md`
  - 当前结论: stdout 单行 JSON 契约 + stderr 人用层；命令目录单一事实源
  - 适用 scope: 5 个命令的 catalog 注册、HINTS 错误码、nextStep 稳定模板
- `norms/tdd-verification.md`
  - 当前结论: L 级完整 TDD 先红后绿；进度可见性
  - 适用 scope: 全部实现任务

## 决策

- **选型:** 单域 `lib/domains/worktree.mjs` 四命令：`inspect`（只读：worktree 清单 + 每 worktree 的 branch/clean/current + 占用 change 反查 + 按 brief 评级给 recommendation/nextStep）；`plan/execute`（创建：path 必填；brief.branch 空则 `git worktree add -b <type>/<name> <path> <base>` 并回写 branch+status=branched，branch 已存在则挂载模式；回写 `workflow.worktree=<path>`）；`remove plan/execute`（以 workflow.worktree 为对象；dirty 拒绝 WORKTREE_DIRTY；目录已消失则 `git worktree prune` 幂等清字段）
- **对比方案:** 只读 inspect + 手动 git（写操作旁路 CLI，违反铁律 6）；worktree 自动选路径 `<repo>/.worktrees/<name>`（隐式路径不可见、与 install 布局冲突，v1 显式 `--path` 更好）
- **理由:** worktree 创建不要求当前在 base 分支——这正是它替代切分支腾挪的价值；分支存在性探测（`git branch --list`）plan 期入 planData 保证 plan→execute 复现一致
- **错误码:** WORKTREE_PATH_TAKEN / WORKTREE_DIRTY / WORKTREE_NOT_FOUND；v1 不加 `--force`（脏 worktree 拒绝，不做隐式删除）
- **规范遵循说明:** recommendation 三值（inline/reuse/create）按评级 S/M→inline、L 无空闲→create、L 有空闲→reuse；nextStep 英文稳定模板

## 任务

### Phase 1 — TDD 红灯
- [x] worktree 域失败测试 — `test/cli.test.mjs` — 六用例先红：execute 新建（branch 派生+目录出现+brief 回写）／挂载已有分支／path 被占 WORKTREE_PATH_TAKEN／remove 干净成功清字段／remove 脏拒绝 WORKTREE_DIRTY／inspect 三态建议与占用反查

### Phase 2 — 实现转绿
- [x] lib/domains/worktree.mjs — `lib/domains/worktree.mjs` — inspect/planData/execute/remove 四函数 + present 最小投影
- [x] 命令注册与目录 — `cli.mjs` `lib/commands.mjs` `lib/i18n.mjs` — DOMAINS/handle 路由、5 条 catalog、3 个 HINTS 错误码

### Phase 3 — 文档与自证
- [x] README 命令参考 — `README.md` — worktree 域表格与并行变更说明；本 brief 全程由带 worktree 域前的新 CLI 管理，实现后 `shadow-dev help worktree --json` 冒烟

## 结果

- 实际耗时: 约 90 分钟（含本机 runner 反复空转排查与 CI 断言缺陷定位）
- 验证: TDD 红灯 6/6 有真实输出后实现；手动 runtime 全链路观察通过——inspect 三态（create→reuse 翻转、occupiedBy=demo、clean 标记）、create（分支派生+目录生成+brief 回写）、挂载既有分支、非空 path WORKTREE_PATH_TAKEN、脏 WORKTREE_DIRTY 拒绝、干净回收清字段；路径归一含 realpath（macOS /var vs /private/var）。本机 node --test/直跑反复 0% CPU 挂起，转绿权威判据=CI：本 PR 以 config+worktree 用例全绿为准；main 基线既有 windows bind/workflow tar 失败不计入本变更。附带：config 语言断言措辞误写在 PR #35 修正（commit 2ce75c2，内容同步于本分支测试文件）
- 验证: TDD 红灯 6/6 后实现；CI 两轮反馈真缺陷并修复——① realpathSync import 缺失（stash 时序）② Windows porcelain CRLF：path 尾挂 \r 致 existsSync 假、hasMine 恒 false（#38 全平台复现，split(/\r?\n/)+trim 修复；同轮加 canon 归一 MSYS/正斜杠/盘符大小写）。macOS 手动全链路冒烟通过。转绿以 #39→#38 CI 为准

## 知识评估

- **预期影响:** 无需变更
- **候选卡片:** 无
- **理由:** 新增命令域为独立产品面（README/catalog 承载）；凭证链与输出契约卡片结论不被改写，仅被复用
