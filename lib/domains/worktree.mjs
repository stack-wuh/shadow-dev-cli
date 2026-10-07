import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { git, repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'
import { err } from '../errors.mjs'

// macOS 上 mkdtemp 的 /var 与 git 输出的 /private/var 指向同一路径；比对统一走 realpath。
// Windows 上 git 可能输出 C:/ 正斜杠甚至 MSYS /c/ 形式；node 24 的 realpathSync 还会返回 \\?\C:\ 扩展长度形式。
// 比对统一 canon:剥扩展前缀、归一分隔符、win32 忽略盘符/路径大小写。
const msys = p => /^\/([a-z])\//i.test(p) ? `${p[1].toUpperCase()}:/${p.slice(3)}` : p
const rp = p => { try { return realpathSync(p) } catch { return resolve(p) } }
const canon = p => {
  let s = rp(msys(p)).replace(/^\\\\\?\\([a-zA-Z]:)/i, '$1')
  return process.platform === 'win32' ? s.replaceAll('\\', '/').toLowerCase() : s
}

// git worktree list --porcelain 快照；porcelain 首条即主工作区，branch 已剥 refs/heads/ 前缀。
// 行尾宽容处理:Windows 上 git 输出 CRLF,\r 若残留会挂在 path 尾使 existsSync/比较恒失败。
export function list(r) {
  const out = []
  let cur = null
  for (const line of git(r, ['worktree', 'list', '--porcelain']).split(/\r?\n/)) {
    if (line.startsWith('worktree ')) { if (cur) out.push(cur); cur = { path: resolve(r, line.slice(9).trim()), branch: null, detached: false } }
    else if (line.startsWith('branch ')) cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '')
    else if (line === 'detached') cur.detached = true
  }
  if (cur) out.push(cur)
  return out.map((w, i) => ({ ...w, primary: i === 0 }))
}

function activeBriefs(r) {
  const out = []
  const base = join(r, 'shadow-docs', 'changes')
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'archive') continue
    try { out.push({ dir: e.name, data: brief(r, e.name).data }) } catch { /* 解析失败目录跳过,与 conflict 同规则 */ }
  }
  return out
}

function cleanIn(dir) {
  if (!existsSync(dir)) return null
  try { return git(dir, ['status', '--porcelain']) === '' } catch { return null }
}

// 只读检视:worktree 清单 + 归属反查 + 按 brief 复杂度评级的并行建议
export function state(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  const actives = activeBriefs(r)
  const worktrees = list(r).map(w => ({
    path: w.path,
    branch: w.branch,
    current: canon(w.path) === canon(r),
    clean: cleanIn(w.path),
    occupiedBy: actives.find(c => (c.data.workflow?.worktree && canon(c.data.workflow.worktree) === canon(w.path)) || (c.data.branch && c.data.branch === w.branch))?.dir || null,
  }))
  const mine = b.data.workflow?.worktree
  const hasMine = !!mine && worktrees.some(w => canon(w.path) === canon(mine) && w.clean !== null)
  const rating = /评级:\**\s*([SML])/.exec(b.body)?.[1] || null
  const recommendation = hasMine ? 'reuse' : rating === 'L' ? 'create' : 'inline'
  const nextStep = recommendation === 'create'
    ? `worktree plan --name ${n} --path <dir>`
    : recommendation === 'reuse' ? `work on ${mine}` : `branch plan --name ${n}`
  return { name: n, rating, recommendation, currentBranch: q.branch, worktrees, nextStep }
}

// 创建:brief 有 branch 则挂载既有分支,否则随 worktree add 派生新分支;path 必填
export function planData(r, o) {
  const n = name(o), b = brief(r, n).data, q = repo(r)
  const path = o.path
  if (!path) throw err('PATH_REQUIRED', `PATH_REQUIRED: pass --path <dir> for the new worktree of ${n}`, 1)
  const abs = resolve(r, path)
  const branch = b.branch || `${b.type}/${n}`
  const base = b.baseBranch || 'main'
  const mount = git(r, ['branch', '--list', branch]) !== ''
  const taken = existsSync(abs) && readdirSync(abs).length > 0
  const existing = b.workflow?.worktree && existsSync(b.workflow.worktree) ? b.workflow.worktree : null
  return { name: n, path: abs, branch, base, mount, taken, existing, brief: b, repo: q }
}

export function present(x) {
  const { brief, repo, ...v } = x
  return v
}

export function execute(r, o, x, b) {
  if (x.taken) throw err('WORKTREE_PATH_TAKEN', `WORKTREE_PATH_TAKEN: ${x.path} exists and is not empty`, 1)
  if (x.existing) throw err('WORKTREE_EXISTS', `WORKTREE_EXISTS: change already has a worktree at ${x.existing}; remove it first`, 1)
  git(r, x.mount ? ['worktree', 'add', x.path, x.branch] : ['worktree', 'add', '-b', x.branch, x.path, x.base])
  b.data.branch = x.branch
  if (b.data.status === 'draft' || b.data.status === 'proposed') b.data.status = 'branched'
  b.data.workflow.worktree = x.path
  write(b)
  return { branch: x.branch, path: x.path, mounted: x.mount }
}

// 回收:对象是 brief 记录的 workflow.worktree;脏工作区响亮拒绝,不做隐式删除
export function removePlanData(r, o) {
  const n = name(o), b = brief(r, n).data, q = repo(r)
  const path = b.workflow?.worktree
  if (!path || !existsSync(path)) throw err('WORKTREE_NOT_FOUND', `WORKTREE_NOT_FOUND: ${n} has no recorded worktree${path ? ` (missing dir: ${path})` : ''}`, 1)
  const dirty = cleanIn(path) === false
  return { name: n, path, dirty, brief: b, repo: q }
}

export function removePresent(x) {
  const { brief, repo, ...v } = x
  return v
}

export function removeExecute(r, o, x, b) {
  if (x.dirty) throw err('WORKTREE_DIRTY', `WORKTREE_DIRTY: ${x.path} has uncommitted changes; commit or clean it first`, 1)
  git(r, ['worktree', 'remove', x.path])
  b.data.workflow.worktree = null
  write(b)
  return { path: x.path, removed: true }
}
