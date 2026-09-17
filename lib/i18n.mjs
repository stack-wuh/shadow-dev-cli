import { err } from './errors.mjs'

// 语言解析链：--lang > SHADOW_DEV_LANG > 系统 locale > 默认 zh。错误 code 永不本地化，只本地化提示文案。
const UI = {
  zh: {
    enter: '▶ [进场] {cmd}',
    done: '✅ [完成] {cmd} · {ms}ms',
    planHash: '   planHash: {hash}',
    next: '⤷ 下一步: {step}',
    error: '✗ {code}: {hint}',
    example: '  示例: {example}',
    helpHead: 'shadow-dev 命令一览（单命令详情: shadow-dev help <命令>）',
    globals: '  全局参数: --lang zh|en（或 SHADOW_DEV_LANG）· SHADOW_DEV_QUIET=1 关闭本提示层 · 管道默认输出 JSON 契约，交互终端用 --json 显式开启',
  },
  en: {
    enter: '▶ [enter] {cmd}',
    done: '✅ [done] {cmd} · {ms}ms',
    planHash: '   planHash: {hash}',
    next: '⤷ next: {step}',
    error: '✗ {code}: {hint}',
    example: '  example: {example}',
    helpHead: 'shadow-dev commands (detail: shadow-dev help <command>)',
    globals: '  global: --lang zh|en (or SHADOW_DEV_LANG) · SHADOW_DEV_QUIET=1 silences this layer · stdout JSON is default in pipes, opt in with --json on a TTY',
  },
}

// 每个稳定 code 一句人话解释（zh/en），缺失时回退 code 本身
export const HINTS = {
  UNKNOWN_COMMAND: { zh: '未知命令；运行 shadow-dev help 查看命令目录', en: 'unknown command; run shadow-dev help for the command list' },
  INVALID_LANG: { zh: '--lang 只支持 zh 或 en', en: '--lang accepts zh or en only' },
  NOT_GIT_REPOSITORY: { zh: '当前目录不在 git 仓库内', en: 'not inside a git repository' },
  NAME_REQUIRED: { zh: '缺少必填参数 --name <变更名>', en: 'missing required flag --name <change>' },
  CHANGE_EXISTS: { zh: '同名变更已存在（shadow-docs/changes/<name>）', en: 'a change with this name already exists under shadow-docs/changes' },
  BRIEF_NOT_FOUND: { zh: 'brief 不存在；先运行 shadow-dev change create --name <变更名>', en: 'brief not found; run shadow-dev change create --name <change> first' },
  BRIEF_FRONTMATTER_REQUIRED: { zh: 'brief 缺少 --- 包裹的 frontmatter', en: 'brief is missing its --- frontmatter block' },
  BODY_FILE_NOT_FOUND: { zh: '--body-file 指向的文件不存在', en: 'the --body-file path does not exist' },
  BODY_FILE_EMPTY: { zh: '--body-file 内容为空', en: 'the --body-file content is empty' },
  CONFIRMATION_REQUIRED: { zh: '写操作必须显式携带 --confirm', en: 'mutating commands require --confirm' },
  PLAN_HASH_REQUIRED: { zh: '先运行同命令的 plan（planHash 会持久化进 brief），或显式传 --plan-hash', en: 'run the plan command first (its hash persists in the brief), or pass --plan-hash' },
  PLAN_HASH_INVALID: { zh: 'plan 与 execute 之间输入已变化；重新运行 plan（commit/publish/release 等参数须与 plan 完全一致）', en: 'inputs changed between plan and execute; run plan again (commit/publish/release args must match exactly)' },
  DIRTY_WORKTREE: { zh: '工作区存在业务改动；先 commit 或还原后重试', en: 'worktree has non-shadow-docs changes; commit or restore them first' },
  SYNC_NOT_FAST_FORWARD: { zh: '当前分支不是上游祖先，禁止自动合并分叉', en: 'HEAD is not an ancestor of upstream; diverged history needs manual handling' },
  GIT_FETCH_FAILED: { zh: 'git fetch 失败或超时（检查网络与凭据）', en: 'git fetch failed or timed out (check network and credentials)' },
  GIT_PUSH_FAILED: { zh: 'git push 失败或超时（检查网络与凭据）', en: 'git push failed or timed out (check network and credentials)' },
  COMMIT_INPUT_REQUIRED: { zh: '缺少 --files 或 --message（只按显式文件列表提交）', en: '--files and --message are required (explicit file lists only)' },
  UNSUPPORTED_OPERATION: { zh: '不支持 . / -A / 绝对路径等隐式或越界提交，逐个列出文件', en: 'implicit or out-of-tree paths (. , -A, absolute) are rejected; list files explicitly' },
  TASKS_NOT_COMPLETE: { zh: '任务清单未全部勾选；用 shadow-dev task set 完成后重试', en: 'task checklist incomplete; finish it with shadow-dev task set' },
  TASK_NOT_FOUND: { zh: '--task 序号超出任务清单范围', en: '--task index is beyond the task list' },
  INVALID_TASK: { zh: '参数应为 --task task-<N> 且 --state todo|done', en: 'expected --task task-<N> with --state todo|done' },
  INVALID_CONCLUSION: { zh: '--conclusion 只支持 passed 或 blocked', en: '--conclusion accepts passed or blocked' },
  INVALID_KNOWLEDGE: { zh: '--knowledge 只支持 新增|更新|废弃|无需变更', en: '--knowledge accepts 新增|更新|废弃|无需变更' },
  REVIEW_NOT_PASSED: { zh: 'review 未通过或 HEAD 已变化；重新运行 review', en: 'review not passed for this HEAD; run review again' },
  PR_NOT_MERGED: { zh: '关联 PR 尚未合并；先在 GitHub 合并再归档', en: 'the linked PR is not merged yet; merge it on GitHub first' },
  PULL_REQUEST_REQUIRED: { zh: 'brief 未关联 PR；先 publish', en: 'brief has no linked PR; run publish first' },
  ISSUE_TITLE_REQUIRED: { zh: '缺少 --title（或在 plan 中持久化）', en: '--title is missing (or persisted from issue plan)' },
  GITHUB_TOKEN_REQUIRED: { zh: '未设置 GITHUB_TOKEN/GH_TOKEN 环境变量', en: 'GITHUB_TOKEN or GH_TOKEN environment variable is required' },
  GITHUB_REPOSITORY_REQUIRED: { zh: '无法确定 GitHub 仓库；传 --repository 或设置 brief.github.repository', en: 'cannot resolve the GitHub repository; pass --repository or set brief.github.repository' },
  GITHUB_API_ERROR: { zh: 'GitHub API 返回错误', en: 'the GitHub API returned an error' },
  PR_CREATE_FAILED: { zh: '创建 PR 失败（多为分支未推送或凭据问题）', en: 'PR creation failed (branch not pushed or credential issue)' },
  API_TIMEOUT: { zh: 'GitHub API 超时（SHADOW_API_TIMEOUT_MS 可调）', en: 'GitHub API timed out (tune SHADOW_API_TIMEOUT_MS)' },
}

export function resolveLang(o) {
  if (o.lang !== undefined && o.lang !== 'zh' && o.lang !== 'en') throw err('INVALID_LANG', `INVALID_LANG: expected zh|en, got "${o.lang}"`, 2)
  if (o.lang) return o.lang
  const env = process.env.SHADOW_DEV_LANG
  if (env === 'zh' || env === 'en') return env
  const loc = String(process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || (globalThis.Intl?.DateTimeFormat?.().resolvedOptions?.().locale) || '').toLowerCase()
  if (loc.startsWith('en')) return 'en'
  return 'zh'
}

export function ui(L, key, p = {}) {
  let s = UI[L]?.[key] ?? UI.zh[key] ?? key
  for (const [k, v] of Object.entries(p)) s = s.replaceAll(`{${k}}`, String(v ?? ''))
  return s
}

export function hint(L, code) {
  const h = HINTS[code]
  return h ? h[L] : code
}
