---
{
  "schema": "shadow-dev/v1",
  "name": "20261012-fix-bind-dirhash-subdirs",
  "type": "fix",
  "scope": "bind-domain",
  "status": "branched",
  "baseBranch": "main",
  "branch": "fix/20261012-fix-bind-dirhash-subdirs",
  "files": [
    "lib/domains/bind.mjs",
    "shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 63,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/63",
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
    "checkpoint": "issue:63",
    "planHash": "b25dafe34dd4c43d6835f48e8da44c6c83183dc88673661e8d0d91fb44a43139",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[fix] bind 的 dirHash 遇技能子目录抛 EISDIR，改为递归收集文件",
      "titleRaw": "[fix] bind 的 dirHash 遇技能子目录抛 EISDIR，改为递归收集文件",
      "supplement": "关联既有 issue #62：本 change 即其修复载体。",
      "body": "## 动机\n`lib/domains/bind.mjs` 的 `dirHash` 用 `readdirSync(skill 目录)` 后对每个条目直接 `readFileSync`。技能目录里一旦出现子目录（按需加载用的 `references/`、`templates/` 等），`readFileSync` 读到目录即抛 `EISDIR: illegal operation on a directory, read`，`bind execute` 整体崩——绑定这条分发路径被一个隐式约束（「技能目录必须扁平」）锁死，而该约束既没写在任何契约里，也没有门拦着。\n\nGitHub issue #62 记录了复刻实测。\n\n## 引用规范\n（brief 缺少该节）\n\n## 决策\n- 修实现而非改约定：`cpSync(..., { recursive: true })` 早已递归复制，产物侧 `pack.mjs` 也递归收录目录——唯独哈希这一处假设扁平，属实现不一致而非设计选择。\n- 键序用相对路径字典序（非 `readdirSync` 返回序），保证 Windows/POSIX 与不同创建序下 sidecar 哈希一致，与既有「确定性输出」契约同源（见 `bind copies managed skills…` 用例里对字典序的断言）。\n- 不改 sidecar schema：只是哈希值算得更全，老宿主重绑一次即刷新。\n\n## 任务\n- [ ] task-1 — `lib/domains/bind.mjs` — dirHash 递归化 + 相对路径字典序归一\n- [ ] task-2 — `test/cli.test.mjs` — 子目录绑定用例 + 「子目录内容变化必须改哈希」的反证 + unbind 递归清除\n- [ ] task-3 — 观察点 — 复现旧崩溃的最小复刻、新用例通过、既有 bind/workflow 用例不回归\n\n## 补充\n关联既有 issue #62：本 change 即其修复载体。\n\n完整 brief：shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261012-fix-bind-dirhash-subdirs\",\"type\":\"fix\",\"scope\":\"bind-domain\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md\",\"cliVersion\":\"1.6.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "bug"
      ]
    },
    "release": {
      "files": [
        "lib/domains/bind.mjs",
        "shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "fix(bind): dirHash 递归收集文件，技能目录含子目录不再抛 EISDIR",
      "title": "fix(bind): dirHash 递归收集文件，技能目录含子目录不再抛 EISDIR",
      "body": "## 变更\n- `lib/domains/bind.mjs`：`dirHash` 改为递归收集文件，键用相对路径并以正斜杠归一、按字典序拼接后求 sha256；附注释说明旧实现为何假设扁平是错的。\n- `test/cli.test.mjs`：新增「技能目录含子目录时哈希与绑定仍成立」用例，含三条反证（子目录内容参与指纹、同内容重绑哈希稳定、`unbind` 递归删除）。\n\n## 影响\n- 行为/触发面变化：`bind execute` 不再因技能目录里存在子目录（`references/`、`templates/` 等）而抛 `EISDIR` 崩；sidecar 的哈希值算得更全（子目录内容进入指纹），因此**首次重绑时托管技能目录的哈希会变**——这是内容指纹的正常刷新，schema 与形态（64 位十六进制）不变。\n- 明确不受影响的范围：命令目录零变化，无新命令键 → 插件 `requiresCommands` 与 `cliVersion` 判定不受影响；`cpSync` 的递归复制行为本就如此，本次只是让指纹与之同口径；`bind plan` 的 blocked/entries 判定不变；宿主既有扁平技能目录的哈希不受影响（无子目录时集合等同）。\n- 解除了插件侧一条落位约束：`shadow-dev-workflow` 的 `norms/pr-message.md` 里「规范/模板不得放 `skills/*/` 子目录」这条是基于本缺陷写的，需等含本修复的版本发布后由插件另立 change 撤除——本 PR 不代劳。\n- 回滚方式：revert 即恢复旧 `dirHash`，新用例会随之判红（正是它锁住的行为）。\n\n## 验证\n- 缺陷复刻（改前）：把 `dirHash` 临时换回旧实现跑新用例 → `✖ bind: 技能目录含子目录时哈希与绑定仍成立`，报错原文 `✗ EISDIR: EISDIR`，`bind execute` exit 1。用例确实看得见缺陷。\n- 修复后：`node --test --test-name-pattern bind test/cli.test.mjs` → 3 用例 3 绿 0 红，既有的 `bind copies managed skills with a sidecar…` 不回归。\n- 反证三条：只改 `references/step-01.md` 内容重绑 → 哈希必须变；同内容连续重绑两次 → 哈希逐字相同；`unbind` 后含子目录的技能目录不存在。\n- 未覆盖项（明说）：本地只跑了 bind 子集；全量套件与 `windows/macos/ubuntu × node 20/22/24` 矩阵由本 PR 的 `test.yml` 判定。\n\n## 关联\n- Ref https://github.com/stack-wuh/shadow-dev-cli/issues/62（缺陷来源，本 PR 为其修复载体）\n- Closes #63\n- brief: shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md"
    }
  }
}
---

# 20261012-fix-bind-dirhash-subdirs

## 动机

`lib/domains/bind.mjs` 的 `dirHash` 用 `readdirSync(skill 目录)` 后对每个条目直接 `readFileSync`。技能目录里一旦出现子目录（按需加载用的 `references/`、`templates/` 等），`readFileSync` 读到目录即抛 `EISDIR: illegal operation on a directory, read`，`bind execute` 整体崩——绑定这条分发路径被一个隐式约束（「技能目录必须扁平」）锁死，而该约束既没写在任何契约里，也没有门拦着。

GitHub issue #62 记录了复刻实测。

## 覆盖范围

- `lib/domains/bind.mjs`：`dirHash` 改为**递归收集文件**，键用相对路径并以正斜杠归一（跨平台同哈希），条目按路径字典序排序后拼接求 sha256。托管标记语义不变：仍是「绑定后目标目录的内容指纹」，写进 sidecar。
- `test/cli.test.mjs`：新增用例——技能目录含 `references/` 子目录时 bind plan/execute 均通过、子目录随绑定复制、改子目录内容后 sidecar 哈希必须变化（证明递归真的参与指纹），unbind 递归清除。
- 不改命令面、不加命令键：插件侧 `requiresCommands` 与 `cliVersion` 契约不受影响。

## 决策

- 修实现而非改约定：`cpSync(..., { recursive: true })` 早已递归复制，产物侧 `pack.mjs` 也递归收录目录——唯独哈希这一处假设扁平，属实现不一致而非设计选择。
- 键序用相对路径字典序（非 `readdirSync` 返回序），保证 Windows/POSIX 与不同创建序下 sidecar 哈希一致，与既有「确定性输出」契约同源（见 `bind copies managed skills…` 用例里对字典序的断言）。
- 不改 sidecar schema：只是哈希值算得更全，老宿主重绑一次即刷新。

## 任务

- [x] task-1 — `lib/domains/bind.mjs` — dirHash 递归化 + 相对路径字典序归一
- [x] task-2 — `test/cli.test.mjs` — 子目录绑定用例 + 「子目录内容变化必须改哈希」的反证 + unbind 递归清除
- [x] task-3 — 观察点 — 复现旧崩溃的最小复刻、新用例通过、既有 bind/workflow 用例不回归

## 结果

评级 M：行为缺陷修复 + 用例反证，不改命令面。

- **缺陷复刻（改前）**：把 `dirHash` 临时换回旧实现后跑新用例 → `✖ bind: 技能目录含子目录时哈希与绑定仍成立`，报错原文 `✗ EISDIR: EISDIR`（`bind execute` exit 1）。证明用例真能看见这个缺陷，不是摆设。
- **修复后**：`node --test --test-name-pattern bind` → **3 用例 3 绿 0 红**，含既有的 `bind copies managed skills with a sidecar…` 不回归。
- **子目录参与指纹的反证**：只改 `references/step-01.md` 内容后重绑，sidecar 哈希必须变化（`assert.notEqual`）；同内容连续重绑两次哈希逐字相同（字典序键，与 `readdirSync` 返回序无关）。
- **形态不变**：sidecar 的 `hash` 仍是 `^[0-9a-f]{64}---
{
  "schema": "shadow-dev/v1",
  "name": "20261012-fix-bind-dirhash-subdirs",
  "type": "fix",
  "scope": "bind-domain",
  "status": "branched",
  "baseBranch": "main",
  "branch": "fix/20261012-fix-bind-dirhash-subdirs",
  "files": [
    "lib/domains/bind.mjs",
    "shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 63,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/63",
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
    "checkpoint": "issue:63",
    "planHash": "ab69056398d4a9f4cab8fcc6495f076421fce90a2cfa09a3f14f6d9b392b82f2",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[fix] bind 的 dirHash 遇技能子目录抛 EISDIR，改为递归收集文件",
      "titleRaw": "[fix] bind 的 dirHash 遇技能子目录抛 EISDIR，改为递归收集文件",
      "supplement": "关联既有 issue #62：本 change 即其修复载体。",
      "body": "## 动机\n`lib/domains/bind.mjs` 的 `dirHash` 用 `readdirSync(skill 目录)` 后对每个条目直接 `readFileSync`。技能目录里一旦出现子目录（按需加载用的 `references/`、`templates/` 等），`readFileSync` 读到目录即抛 `EISDIR: illegal operation on a directory, read`，`bind execute` 整体崩——绑定这条分发路径被一个隐式约束（「技能目录必须扁平」）锁死，而该约束既没写在任何契约里，也没有门拦着。\n\nGitHub issue #62 记录了复刻实测。\n\n## 引用规范\n（brief 缺少该节）\n\n## 决策\n- 修实现而非改约定：`cpSync(..., { recursive: true })` 早已递归复制，产物侧 `pack.mjs` 也递归收录目录——唯独哈希这一处假设扁平，属实现不一致而非设计选择。\n- 键序用相对路径字典序（非 `readdirSync` 返回序），保证 Windows/POSIX 与不同创建序下 sidecar 哈希一致，与既有「确定性输出」契约同源（见 `bind copies managed skills…` 用例里对字典序的断言）。\n- 不改 sidecar schema：只是哈希值算得更全，老宿主重绑一次即刷新。\n\n## 任务\n- [ ] task-1 — `lib/domains/bind.mjs` — dirHash 递归化 + 相对路径字典序归一\n- [ ] task-2 — `test/cli.test.mjs` — 子目录绑定用例 + 「子目录内容变化必须改哈希」的反证 + unbind 递归清除\n- [ ] task-3 — 观察点 — 复现旧崩溃的最小复刻、新用例通过、既有 bind/workflow 用例不回归\n\n## 补充\n关联既有 issue #62：本 change 即其修复载体。\n\n完整 brief：shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261012-fix-bind-dirhash-subdirs\",\"type\":\"fix\",\"scope\":\"bind-domain\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261012-fix-bind-dirhash-subdirs/brief.md\",\"cliVersion\":\"1.6.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "bug"
      ]
    }
  }
}
---

# 20261012-fix-bind-dirhash-subdirs

## 动机

`lib/domains/bind.mjs` 的 `dirHash` 用 `readdirSync(skill 目录)` 后对每个条目直接 `readFileSync`。技能目录里一旦出现子目录（按需加载用的 `references/`、`templates/` 等），`readFileSync` 读到目录即抛 `EISDIR: illegal operation on a directory, read`，`bind execute` 整体崩——绑定这条分发路径被一个隐式约束（「技能目录必须扁平」）锁死，而该约束既没写在任何契约里，也没有门拦着。

GitHub issue #62 记录了复刻实测。

## 覆盖范围

- `lib/domains/bind.mjs`：`dirHash` 改为**递归收集文件**，键用相对路径并以正斜杠归一（跨平台同哈希），条目按路径字典序排序后拼接求 sha256。托管标记语义不变：仍是「绑定后目标目录的内容指纹」，写进 sidecar。
- `test/cli.test.mjs`：新增用例——技能目录含 `references/` 子目录时 bind plan/execute 均通过、子目录随绑定复制、改子目录内容后 sidecar 哈希必须变化（证明递归真的参与指纹），unbind 递归清除。
- 不改命令面、不加命令键：插件侧 `requiresCommands` 与 `cliVersion` 契约不受影响。

## 决策

- 修实现而非改约定：`cpSync(..., { recursive: true })` 早已递归复制，产物侧 `pack.mjs` 也递归收录目录——唯独哈希这一处假设扁平，属实现不一致而非设计选择。
- 键序用相对路径字典序（非 `readdirSync` 返回序），保证 Windows/POSIX 与不同创建序下 sidecar 哈希一致，与既有「确定性输出」契约同源（见 `bind copies managed skills…` 用例里对字典序的断言）。
- 不改 sidecar schema：只是哈希值算得更全，老宿主重绑一次即刷新。

## 任务

- [ ] task-1 — `lib/domains/bind.mjs` — dirHash 递归化 + 相对路径字典序归一
- [ ] task-2 — `test/cli.test.mjs` — 子目录绑定用例 + 「子目录内容变化必须改哈希」的反证 + unbind 递归清除
- [ ] task-3 — 观察点 — 复现旧崩溃的最小复刻、新用例通过、既有 bind/workflow 用例不回归

## 结果

，schema 未动；`unbind` 递归删除含子目录的技能目录。
- 命令面零变化：未新增命令键 → 插件 `requiresCommands` 与 `cliVersion` 判定不受影响。
- 门槛：本地跑的是 bind 子集；全量套件与三平台矩阵由 `test.yml`（`pull_request` 触发）判。
- 后继（不在本 PR）：本修复解除了插件侧「规范/模板不得放 `skills/*/` 子目录」的落位约束（写在其 `norms/pr-message.md`）。撤除那条文本要等含本修复的 CLI 版本发布后才生效，需另立插件 change。
