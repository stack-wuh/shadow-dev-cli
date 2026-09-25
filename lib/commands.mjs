// 命令目录：单一事实源。HELP 字符串、help JSON、stderr 人用提示与 nextStep 全部由此派生。
// summary/args.desc 提供 zh/en 双版（机器流不本地化，人用层按语言取用）；next 为稳定英文命令模板，{x} 由执行结果填充。
const f = (flag, required, zh, en) => ({ flag, required, desc: { zh, en } })
const c = (usage, zh, en, args, example, next = null) => ({ usage, summary: { zh, en }, args, example, next })
const N = f('--name', true, '变更名（shadow-docs/changes/ 下的子目录，如 20260917-feature-x）', 'change name (subdirectory under shadow-docs/changes/, e.g. 20260917-feature-x)')
const CF = f('--confirm', true, '写操作显式确认', 'explicit confirmation for mutating commands')
const PH = f('--plan-hash', false, '缺省时读取 brief 中持久化的 planHash', 'defaults to the planHash persisted in the brief')
const T = f('--title', false, '标题，缺省为变更名', 'title, defaults to change name')
const B = f('--body', false, '正文', 'body text')
const FI = f('--files', false, '逗号分隔文件列表（反斜杠自动归一为正斜杠）', 'comma-separated file list (backslashes normalized)')
const M = f('--message', false, '提交信息', 'commit message')

export const COMMANDS = {
  'version': c('version', 'CLI 版本（任意目录可用，不要求 git 仓库）', 'CLI version (any directory, no git repository required)', [], 'shadow-dev version'),
  'repo.inspect': c('repo inspect', '查看仓库状态（分支、HEAD、脏文件）', 'show repository state (branch, HEAD, dirty files)', [], 'shadow-dev repo inspect'),
  'change.create': c('change create', '创建变更 brief', 'create a change brief', [N, f('--type', false, 'feature|fix|build|chore|docs|refactor|style|test，默认 feat', 'one of feature|fix|build|chore|docs|refactor|style|test, default feat'), f('--scope', false, '影响范围', 'scope'), f('--base-branch', false, '基线分支，默认 main', 'base branch, default main'), FI, f('--body-file', false, 'brief 正文来源文件', 'file supplying the brief body'), f('--repository', false, 'GitHub owner/repo', 'GitHub owner/repo'), CF], 'shadow-dev change create --name <change-name> --type feature --confirm', 'change approve --name {name} --confirm'),
  'change.approve': c('change approve', '批准 brief（draft → proposed）', 'approve the brief (draft → proposed)', [N, CF], 'shadow-dev change approve --name <change-name> --confirm', 'branch plan --name {name}'),
  'change.list': c('change list', '列出变更的名称、类型、状态与分支（默认只列活动）', 'list changes with name, type, status and branch (active only by default)', [f('--all', false, '同时包含已归档变更（与 --archived 同传时按 --all 处理）', 'include archived changes as well (--all wins when both are passed)'), f('--archived', false, '只列已归档变更', 'list archived changes only')], 'shadow-dev change list'),
  'issue.plan': c('issue plan', '预览由 brief 确定性渲染的统一结构 issue（stdout 只回摘要）', 'plan the unified-structure issue rendered from the brief (stdout carries a lean summary)', [N, f('--title', false, '标题覆盖，缺省 = [type] 前缀 + brief H1，回落变更名', 'title override; default = [type] prefix + brief H1, falling back to the change name'), f('--body', false, '可选「补充」节内容；正文骨架由 brief 分节自动渲染', 'optional 补充 section text; the skeleton is rendered from brief sections'), f('--labels', false, '逗号分隔标签', 'comma-separated labels')], 'shadow-dev issue plan --name <change-name> --labels feature', 'issue execute --name {name} --plan-hash {planHash} --confirm'),
  'issue.execute': c('issue execute', '创建 GitHub issue（正文读 brief 快照与 plan 校验）', 'create the GitHub issue (body re-derived from the brief and hash-checked)', [N, PH, CF], 'shadow-dev issue execute --name <change-name> --confirm', null),
  'branch.plan': c('branch plan', '预览建功能分支', 'plan creating the feature branch', [N], 'shadow-dev branch plan --name <change-name>', 'branch execute --name {name} --confirm'),
  'branch.execute': c('branch execute', '从基线分支创建并切换', 'create and switch to the feature branch', [N, PH, CF], 'shadow-dev branch execute --name <change-name> --confirm', null),
  'sync.plan': c('sync plan', '预览 fast-forward 同步上游', 'plan a fast-forward sync with upstream', [N], 'shadow-dev sync plan --name <change-name>', 'sync execute --name {name} --confirm'),
  'sync.execute': c('sync execute', 'fetch 后仅 fast-forward 合并上游', 'fetch then ff-only merge upstream', [N, PH, CF], 'shadow-dev sync execute --name <change-name> --confirm', null),
  'conflict.inspect': c('conflict inspect', '检查与其他 active brief 的文件重叠', 'check file overlaps with other active briefs', [N], 'shadow-dev conflict inspect --name <change-name>', null),
  'task.list': c('task list', '列出 brief 任务清单', 'list the brief task checklist', [N], 'shadow-dev task list --name <change-name>', null),
  'task.set': c('task set', '勾选/取消任务', 'tick or untick a task', [N, f('--task', true, '任务 id，如 task-3', 'task id, e.g. task-3'), f('--state', true, 'todo|done', 'todo|done'), CF], 'shadow-dev task set --name <change-name> --task task-1 --state done --confirm', null),
  'review.plan': c('review plan', '预览审查记录', 'plan the review record', [N], 'shadow-dev review plan --name <change-name>', 'review execute --name {name} --conclusion passed --confirm'),
  'review.execute': c('review execute', '写入审查结论与知识评估（任务未全部勾选会被拒绝）', 'persist review conclusion and knowledge action (blocked until all tasks are done)', [N, f('--conclusion', false, 'passed|blocked，默认 passed', 'passed|blocked, default passed'), f('--knowledge', false, '新增|更新|废弃|无需变更', 'knowledge action: 新增|更新|废弃|无需变更'), f('--target', false, '知识卡片路径', 'knowledge card path'), f('--reason', false, '知识动作理由', 'knowledge action reason'), PH, CF], 'shadow-dev review execute --name <change-name> --conclusion passed --confirm', null),
  'commit.plan': c('commit plan', '预览按显式文件列表提交', 'plan an explicit-file-list commit', [N, f('--files', true, '逗号分隔文件列表', 'comma-separated file list'), f('--message', true, '提交信息', 'commit message')], 'shadow-dev commit plan --name <change-name> --files a.mjs,b.mjs --message "fix: x"', 'commit execute --name {name} --files {files} --message "{message}" --confirm'),
  'commit.execute': c('commit execute', '提交并写 checkpoint（参数须与 plan 完全一致）', 'commit and write checkpoint (args must match the plan exactly)', [N, FI, M, PH, CF], 'shadow-dev commit execute --name <change-name> --files a.mjs --message "fix: x" --confirm', null),
  'publish.plan': c('publish plan', '预览推送分支并创建/复用 PR', 'plan pushing the branch and creating/reusing the PR', [N, T, B], 'shadow-dev publish plan --name <change-name> --title "标题"', 'publish execute --name {name} --title "{title}" --body "{body}" --confirm'),
  'publish.execute': c('publish execute', '推送分支并创建/复用 PR（参数须与 plan 完全一致）', 'push and create/reuse the PR (args must match the plan exactly)', [N, T, B, PH, CF], 'shadow-dev publish execute --name <change-name> --confirm', 'archive plan --name {name}'),
  'release.plan': c('release plan', '预览提交+推送+PR 复合发布', 'plan the commit+push+PR composite release', [N, FI, M, T, B], 'shadow-dev release plan --name <change-name> --files a.mjs --message "feat: x" --title "标题"', 'release execute --name {name} --confirm'),
  'release.execute': c('release execute', '执行复合发布（缺省参数回退 brief workflow.release）', 'run the composite release (params default to the stored workflow.release plan)', [N, FI, M, T, B, PH, CF], 'shadow-dev release execute --name <change-name> --confirm', 'archive plan --name {name}'),
  'pr.inspect': c('pr inspect', '查看 brief 关联 PR', 'inspect the PR linked to the brief', [N], 'shadow-dev pr inspect --name <change-name>', null),
  'reconcile.plan': c('reconcile plan', '预览 brief 状态与实际进度对齐', 'plan reconciling brief state with actual progress', [N], 'shadow-dev reconcile plan --name <change-name>', 'reconcile execute --name {name} --confirm'),
  'reconcile.execute': c('reconcile execute', '回写对齐后的状态', 'persist the reconciled state', [N, PH, CF], 'shadow-dev reconcile execute --name <change-name> --confirm', null),
  'archive.plan': c('archive plan', '预览归档（要求 review passed 且 PR merged）', 'plan archiving (requires review passed and PR merged)', [N], 'shadow-dev archive plan --name <change-name>', 'archive execute --name {name} --confirm'),
  'archive.execute': c('archive execute', '移入 archive 并重建 INDEX', 'move into archive and rebuild INDEX', [N, PH, CF], 'shadow-dev archive execute --name <change-name> --confirm', null),
  'index.rebuild.plan': c('index rebuild plan', '预览变更索引重建', 'plan rebuilding the change index', [], 'shadow-dev index rebuild plan', 'index rebuild execute --plan-hash {planHash} --confirm'),
  'index.rebuild.execute': c('index rebuild execute', '重建 INDEX.md（无 brief 域，--plan-hash 为唯一凭证）', 'rebuild INDEX.md (briefless command: --plan-hash is the only credential)', [f('--plan-hash', true, 'index rebuild plan 的输出', 'hash from index rebuild plan'), CF], 'shadow-dev index rebuild execute --plan-hash <hash> --confirm', null),
  'workflow.plan': c('workflow plan', '预览 workflow 产物安装（--release/--from/latest 三路解析）', 'plan the workflow artifact install (--release/--from/latest)', [f('--release', false, '固定 release tag，缺省取 latest', 'pin a release tag; defaults to latest'), f('--from', false, '本地目录或 tarball（离线安装）', 'local dir or tarball (offline install)'), f('--prefix', false, '覆盖安装前缀', 'override the install prefix')], 'shadow-dev workflow plan', 'workflow execute --plan-hash {planHash} --confirm'),
  'workflow.execute': c('workflow execute', '物化产物并切指针（先冒烟后落盘，留 PREVIOUS 供回滚）', 'materialize the artifact and flip pointers (smoke first, PREVIOUS kept for rollback)', [f('--plan-hash', true, 'workflow plan 的输出', 'hash from workflow plan'), f('--release', false, '固定 release tag', 'pin a release tag'), f('--from', false, '本地目录或 tarball', 'local dir or tarball'), f('--prefix', false, '覆盖安装前缀', 'override the install prefix'), CF], 'shadow-dev workflow execute --plan-hash <hash> --confirm', 'bind plan --host auto'),
  'workflow.rollback': c('workflow rollback', '回滚到上一版（离线，PREVIOUS/CURRENT 对调）', 'roll back to the previous version (offline pointer swap)', [CF, f('--prefix', false, '覆盖安装前缀', 'override the install prefix')], 'shadow-dev workflow rollback --confirm', null),
  'workflow.status': c('workflow status', '查看 current/previous/linked 与解析出的产物根', 'show current/previous/linked and the resolved artifact root', [f('--prefix', false, '覆盖安装前缀', 'override the install prefix')], 'shadow-dev workflow status', null),
  'workflow.link': c('workflow link', 'link 直通轨：指向本机 checkout，改动即生效', 'link track: point at a local checkout, edits take effect immediately', [f('--dir', true, '产物目录（含 marketplace.json/package.json/skills）', 'artifact dir with marketplace.json/package.json/skills'), f('--prefix', false, '覆盖安装前缀', 'override the install prefix'), CF], 'shadow-dev workflow link --dir <path> --confirm', 'bind plan --host auto'),
  'workflow.unlink': c('workflow unlink', '移除 LINK，回落 CURRENT 版本', 'remove the LINK pointer and fall back to CURRENT', [f('--prefix', false, '覆盖安装前缀', 'override the install prefix'), CF], 'shadow-dev workflow unlink --confirm', null),
  'bind.plan': c('bind plan', '预览按 adapters/<host>.json 把 skills 绑入宿主目录（--host auto 探测）', 'plan binding skills into host dirs via adapters/<host>.json (--host auto detects)', [f('--host', false, 'auto|claude-code|zcode…，缺省 auto', 'auto|claude-code|zcode…; defaults to auto'), f('--prefix', false, '覆盖安装前缀', 'override the install prefix')], 'shadow-dev bind plan --host auto', 'bind execute --plan-hash {planHash} --confirm'),
  'bind.execute': c('bind execute', '执行绑定（复制 + sidecar 托管标记，非托管同名目录拒绝覆盖）', 'run the binding (copy + sidecar marker; unmanaged targets are refused)', [f('--plan-hash', true, 'bind plan 的输出', 'hash from bind plan'), f('--host', false, 'auto|claude-code|zcode…', 'auto|claude-code|zcode…'), f('--prefix', false, '覆盖安装前缀', 'override the install prefix'), CF], 'shadow-dev bind execute --plan-hash <hash> --confirm', 'bind status'),
  'bind.status': c('bind status', '查看各宿主的绑定与托管状态', 'show bind and managed state per host', [f('--prefix', false, '覆盖安装前缀', 'override the install prefix')], 'shadow-dev bind status', null),
  'bind.unbind': c('bind unbind', '按 sidecar 移除托管 skills 与标记', 'remove managed skills and the sidecar per the record', [f('--host', true, '宿主名，如 claude-code', 'host name, e.g. claude-code'), f('--prefix', false, '覆盖安装前缀', 'override the install prefix'), CF], 'shadow-dev bind unbind --host claude-code --confirm', null),
}

// HELP 由目录派生，保持既有的分组行格式（`branch plan|execute`），向后兼容既有断言；
// 单段 key（如 version）是平铺元命令，整行即命令名
export const HELP = (() => {
  const rows = [], index = new Map()
  for (const key of Object.keys(COMMANDS)) {
    const parts = key.split('.')
    if (parts.length === 1) { rows.push([key, null]); continue }
    const base = parts.slice(0, -1).join(' '), action = parts.at(-1)
    if (!index.has(base)) { index.set(base, rows.length); rows.push([base, []]) }
    rows[index.get(base)][1].push(action)
  }
  return rows.map(([base, actions]) => (actions === null ? base : `${base} ${actions.join('|')}`)).join('\n')
})()
