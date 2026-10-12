---
{
  "schema": "shadow-dev/v1",
  "name": "20261012-chore-gen-pr-template",
  "type": "chore",
  "scope": "tooling",
  "status": "published",
  "baseBranch": "main",
  "branch": "chore/20261012-chore-gen-pr-template",
  "files": [
    "scripts/gen-pr-template.mjs",
    "shadow-docs/changes/20261012-chore-gen-pr-template/brief.md"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 57,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/57",
    "pullRequest": 58,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/58"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "9ebe22d6efd2f47d760b1ca2cceb84a4d4cd4f7a",
    "verifiedAt": "2026-10-12T10:07:33.520Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "pr:58",
    "planHash": "e4766c6e4a2055d4a90fd2c9a963d7ee1b3f02470af5b987accd991dc4740c22",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[chore] PR 模板生成器落进 shadow-dev-cli/scripts",
      "titleRaw": "[chore] PR 模板生成器落进 shadow-dev-cli/scripts",
      "supplement": "",
      "body": "## 动机\nPR 模板的生成脚本按分工属 shadow-dev-cli（确定性脚本动作），此前误放在 shadow-dev-workflow 插件仓，已搬入本仓但一直悬在未跟踪状态，会挡住 `sync`/`archive` 的 `DIRTY_WORKTREE` 门。本 change 把它正式落进版本控制。\n\n## 引用规范\n（brief 缺少该节）\n\n## 决策\n- 脚本而非新命令域：与 `scripts/pack.mjs` 同类，属仓库工具而非用户面 CLI 能力，不进 `commands.mjs` 命令目录，因此不影响插件 `requiresCommands` 与 `cliVersion` 契约。\n- 真源在插件仓（`norms/pr-message.md` + `norms/templates/pr-body.md`），本仓只提供执行；宿主模板是生成物，手改即被 `--check` 判红。\n\n## 任务\n- [x] task-1 — `scripts/gen-pr-template.mjs` — 落盘脚本与自检（缺段/署名尾注/参数错误/真源缺失四条退出路径）\n- [x] task-2 — `docs` — 确认与插件侧 `norms/pr-message.md` 的调用写法一致（`--template` + `--out`）\n\n完整 brief：shadow-docs/changes/20261012-chore-gen-pr-template/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261012-chore-gen-pr-template\",\"type\":\"chore\",\"scope\":\"tooling\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261012-chore-gen-pr-template/brief.md\",\"cliVersion\":\"1.5.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "chore"
      ]
    },
    "release": {
      "files": [
        "scripts/gen-pr-template.mjs",
        "shadow-docs/changes/20261012-chore-gen-pr-template/brief.md"
      ],
      "message": "chore(scripts): PR 模板生成器落进本仓 —— 逐字生成宿主模板并带段落与署名自检",
      "title": "chore(scripts): PR 模板生成器落进本仓 —— 逐字生成宿主模板并带段落与署名自检",
      "body": "## 变更\n- 新增 `scripts/gen-pr-template.mjs`：把插件仓 `norms/templates/pr-body.md` 逐字生成为宿主 `.github/PULL_REQUEST_TEMPLATE.md`；`--template` 显式真源 > `resolvedRoot()` 回退，`--check` 只比对不落盘。\n- 脚本内含三条自检：必需段落缺失、渲染区署名尾注、参数/真源缺失，各自对应稳定退出码。\n\n## 影响\n- 行为/触发面变化：无用户面 CLI 行为变化——脚本不进 `lib/commands.mjs` 命令目录，不动 `cli.mjs` 与 `lib/`，因此不影响插件 `requiresCommands` 与 `cliVersion` 契约。\n- 明确不受影响的范围：`release`/`publish`/`archive`/`bind`/`workflow` 各域零改动；`x.wuh.site` 的宿主模板由本次执行同步到 1430B（与真源逐字一致）。\n- 副作用消除：该文件此前以未跟踪状态躺在仓内，会挡 `sync`/`archive` 的 `DIRTY_WORKTREE`；入库后不再挡。\n\n## 验证\n- 命令与结果：`node scripts/gen-pr-template.mjs --template … --out …` → `generated … (1430B)`；`--check` → `ok … 一致`（exit 0）。缺 `--out` → exit 2；`--template` 指向不存在文件 → exit 3 且不落盘；夹具模板缺 `## 影响` → exit 1 指明真源路径。\n- 署名自检：夹具在 HTML 注释里写 `Co-authored-by:` → exit 0（不误伤规则文字）；同词落到渲染区 → exit 1 并点名 `norms/pr-message.md` 第 5 条。\n- 未覆盖项（明说）：脚本不写进 CI 门，跨仓漂移目前靠人工执行 `--check` 判定；若要把 `--check` 挂进 workflow 的门，另立 change。\n\n## 关联\n- Closes #57\n- brief: shadow-docs/changes/20261012-chore-gen-pr-template/brief.md"
    },
    "commit": {
      "files": [
        "shadow-docs/changes/20261012-chore-gen-pr-template/brief.md"
      ],
      "message": "chore(scripts): brief 收口——任务勾选、结果段回填与 review 结论"
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": "knowledge/release-artifact-pipeline.md",
    "reason": "仓库工具脚本的落位与命令目录边界已在脚本头注释与 brief 决策段写清，无新增长期事实，不建卡"
  }
}
---

# 20261012-chore-gen-pr-template

## 动机

PR 模板的生成脚本按分工属 shadow-dev-cli（确定性脚本动作），此前误放在 shadow-dev-workflow 插件仓，已搬入本仓但一直悬在未跟踪状态，会挡住 `sync`/`archive` 的 `DIRTY_WORKTREE` 门。本 change 把它正式落进版本控制。

## 覆盖范围

- `scripts/gen-pr-template.mjs`：把 `norms/templates/pr-body.md` 逐字生成为宿主 `.github/PULL_REQUEST_TEMPLATE.md`；支持 `--template` 显式真源与 `resolvedRoot()` 回退、`--check` 只比对不落盘、缺段与署名尾注自检。
- 无运行时依赖，不改 `cli.mjs`/`lib/` 任何命令面。

## 决策

- 脚本而非新命令域：与 `scripts/pack.mjs` 同类，属仓库工具而非用户面 CLI 能力，不进 `commands.mjs` 命令目录，因此不影响插件 `requiresCommands` 与 `cliVersion` 契约。
- 真源在插件仓（`norms/pr-message.md` + `norms/templates/pr-body.md`），本仓只提供执行；宿主模板是生成物，手改即被 `--check` 判红。

## 任务

- [x] task-1 — `scripts/gen-pr-template.mjs` — 落盘脚本与自检（缺段/署名尾注/参数错误/真源缺失四条退出路径）
- [x] task-2 — `docs` — 确认与插件侧 `norms/pr-message.md` 的调用写法一致（`--template` + `--out`）

## 结果

**复杂度评级：S**（新增一个无运行时依赖的仓库工具脚本，不改命令面）。按 S 级执行结构、引用与残留扫描 + 四条退出路径的真实观察点。

- 结构：脚本落 `scripts/gen-pr-template.mjs`（3358B），与 `scripts/pack.mjs`、`install-cli.sh` 同级；未进 `lib/commands.mjs` 命令目录 → 不影响插件 `requiresCommands` 与 `cliVersion` 契约。
- 引用：`--template` 缺省时动态 `import('../lib/domains/workflow.mjs')` 复用 `resolvedRoot()`，LINK→CURRENT 与 `workflow status` 同一语义。
- 观察点（真实退出码）：
  - 生成/幂等：对 `x.wuh.site` 宿主模板执行 → `generated: … (1430B)`，随后 `--check` → `ok: … 与 norms/templates/pr-body.md 一致`（exit 0）。
  - 参数门：缺 `--out` → exit 2 `缺少 --out <宿主 .github/PULL_REQUEST_TEMPLATE.md 路径>`。
  - 真源门：`--template` 指向不存在的文件 → exit 3 `--template 指定的文件不存在：…`，不落盘。
  - 自检门：模板缺 `## 影响` → exit 1 `模板缺少必需段落：## 影响（真源：…）`。
  - 署名门：夹具模板在注释里写 `Co-authored-by:` → exit 0 不误伤；同词落到渲染区 → exit 1 `模板渲染区含署名尾注，违反 norms/pr-message.md 第 5 条`。
- 残留：`scripts/` 无临时文件；夹具全部写在系统 temp 目录，未落仓。
- 该脚本此前以未跟踪状态躺在仓内，会挡住 `sync`/`archive` 的 `DIRTY_WORKTREE`；本次落进版本控制后该隐患消除。

