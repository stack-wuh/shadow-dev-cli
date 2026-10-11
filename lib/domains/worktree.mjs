import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { git, repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'
import { err } from '../errors.mjs'

// macOS 上 mkdtemp 的 /var 与 git 输出的 /private/var 指向同一路径；比对统一走 realpath。
// Windows 三重形态差:mkdtemp 返回 8.3 短名(RUNNER~1)、git 登记长名(runneradmin)、node24 realpath 带 \\?\ 前缀。
// realpathSync.native(GetFinalPathNameByHandle)展开短名并归一这些形态;普通 realpathSync 只走 GetFullPathName 不展开短名。
// canon 再统一分隔符与盘符大小写,比较不依赖任何单一形态作契约。
const msys = p => /^\/([a-z])\//i.test(p) ? `${p[1].toUpperCase()}:/${p.slice(3)}` : p
const rp = p => { try { return realpathSync.native(p) } catch { try { return realpathSync(p) } catch { return resolve(p) } } }
const canon = p => {
  let s = rp(msys(p)).replace(/^\\\\\?\\([a-zA-Z]:)/i, '$1')
  return process.platform === 'win32' ? s.replaceAll('\\', '/').toLowerCase() : s
}

// brief 在文件系统上只有一个合法位置：它当前归属的那棵树。
// `change create` 刚写的 brief 是未跟踪文件，而 `git worktree add` 从基线派生新树——新树里没有它，
// 于是 task set/review/commit 一律 BRIEF_NOT_FOUND（实测：内容包 L 级变更被迫放弃专属 workspace）。
// 解法是**迁移而非复制**：复制会留下两份可各自演进的受管状态（=数据分裂），比报错更糟。
const briefRel = n => join('shadow-docs', 'changes', n)
const tracked = (r, rel) => git(r, ['ls-files', '--', rel]) !== ''
function treeMap(dir) {
  const out = {}
  ;(function walk(d, prefix) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) walk(join(d, e.name), rel)
      else out[rel] = readFileSync(join(d, e.name), 'utf8')
    }
  })(dir, '')
  return out
}
// 先复制并逐文件校验一致，再删源：迁移任何一步失败都不允许留下半个 brief。
function relocate(fromRoot, toRoot, n) {
  const rel = briefRel(n), src = join(fromRoot, rel), dst = join(toRoot, rel)
  if (!existsSync(src) || existsSync(dst)) return false
  const before = treeMap(src)
  mkdirSync(dirname(dst), { recursive: true })
  cpSync(src, dst, { recursive: true })
  if (JSON.stringify(before) !== JSON.stringify(treeMap(dst))) {
    rmSync(dst, { recursive: true, force: true })
    throw err('RELOCATION_MISMATCH', `RELOCATION_MISMATCH: brief 迁往 ${dst} 校验不一致，已回退并保留源 ${src}`, 1)
  }
  rmSync(src, { recursive: true, force: true })
  return true
}
// 定位 brief：主工作树优先，否则在登记的 worktree 里找唯一副本。
function locateRoot(r, n) {
  if (existsSync(join(r, briefRel(n)))) return r
  for (const w of list(r)) if (w.path !== r && existsSync(join(w.path, briefRel(n)))) return w.path
  throw err('BRIEF_NOT_FOUND')
}
// 归属与脏检查要排除 brief 自身：它是 CLI 管理的载体，不是用户的未提交工作
const dirtyBesidesBrief = (dir, n) => {
  const rel = briefRel(n)
  try { return git(dir, ['status', '--porcelain', '--', '.', `:(exclude)${rel}`]) !== '' } catch { return null }
}

// git worktree list --porcelain 快照；porcelain 首条即主工作区，branch 已剥 refs/heads/ 前缀。
// 行尾宽容处理:Windows 上 git 输出 CRLF,\r 若残留会挂在 path 尾使 existsSync/比较恒失败。
// 跨树定位 brief：worktree 域是唯一需要「看见别的树」的域，其余域按 cwd 所在树读写。
export function locateBrief(r, o) { const n = name(o); return brief(locateRoot(r, n), n) }

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

// 变更发现覆盖主工作树与全部 worktree：brief 迁移后若只扫主树，归属反查会失明
// （occupiedBy 认不出、同名 change 可被重复创建）。同名的活动 brief 以先找到的为准。
function activeBriefs(r) {
  const out = [], seen = new Set()
  const roots = [r, ...list(r).map(w => w.path).filter(p => p !== r && existsSync(p))]
  for (const root of roots) {
    const base = join(root, 'shadow-docs', 'changes')
    if (!existsSync(base)) continue
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === 'archive' || seen.has(e.name)) continue
      try { out.push({ dir: e.name, data: brief(root, e.name).data }); seen.add(e.name) } catch { /* 解析失败目录跳过,与 conflict 同规则 */ }
    }
  }
  return out
}

function cleanIn(dir, n = null) {
  if (!existsSync(dir)) return null
  if (n) { const d = dirtyBesidesBrief(dir, n); return d === null ? null : !d }
  try { return git(dir, ['status', '--porcelain']) === '' } catch { return null }
}

// 只读检视:worktree 清单 + 归属反查 + 按 brief 复杂度评级的并行建议
export function state(r, o) {
  const n = name(o), b = locateBrief(r, o), q = repo(r)
  const actives = activeBriefs(r)
  const worktrees = list(r).map(w => ({
    path: w.path,
    branch: w.branch,
    current: canon(w.path) === canon(r),
    clean: cleanIn(w.path),
    occupiedBy: actives.find(c => (c.data.workflow?.worktree && canon(c.data.workflow.worktree) === canon(w.path)) || (c.data.branch && c.data.branch === w.branch))?.dir || null,
  }))
  const mine = b.data.workflow?.worktree
  // 路径匹配即 reuse;clean 状态只是附加情报——Windows runner 上 git status 偶发失败(防病毒/瞬锁)不得否决已有 workspace
  const hasMine = !!mine && worktrees.some(w => canon(w.path) === canon(mine) && existsSync(w.path))
  const rating = /评级:\**\s*([SML])/.exec(b.body)?.[1] || null
  const recommendation = hasMine ? 'reuse' : rating === 'L' ? 'create' : 'inline'
  const nextStep = recommendation === 'create'
    ? `worktree plan --name ${n} --path <dir>`
    : recommendation === 'reuse' ? `work on ${mine}` : `branch plan --name ${n}`
  return { name: n, rating, recommendation, currentBranch: q.branch, worktrees, nextStep }
}

// 创建:brief 有 branch 则挂载既有分支,否则随 worktree add 派生新分支;path 必填
export function planData(r, o) {
  const n = name(o), b = locateBrief(r, o).data, q = repo(r)
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
  // 未跟踪的 brief 不随 worktree add 出现：把它迁进新树，让它成为唯一真相。
  // 已跟踪（稳态）时一行都不动，零回归面。
  const rel = briefRel(b.data.name)
  const relocated = existsSync(join(r, rel)) && !tracked(r, rel) ? relocate(r, x.path, b.data.name) : false
  return { branch: x.branch, path: x.path, mounted: x.mount, relocated }
}

// 回收:对象是 brief 记录的 workflow.worktree;脏工作区响亮拒绝,不做隐式删除
export function removePlanData(r, o) {
  const n = name(o), b = locateBrief(r, o).data, q = repo(r)
  const path = b.workflow?.worktree
  if (!path || !existsSync(path)) throw err('WORKTREE_NOT_FOUND', `WORKTREE_NOT_FOUND: ${n} has no recorded worktree${path ? ` (missing dir: ${path})` : ''}`, 1)
  // 脏判定排除 brief 本身：专属 workspace 里未提交的 brief 是 CLI 载体，不是用户改动，
  // 否则回收永远判 WORKTREE_DIRTY，唯一真相会随目录一起被删或永远搬不走
  const dirty = dirtyBesidesBrief(path, n) === true
  return { name: n, path, dirty, brief: b, repo: q }
}

export function removePresent(x) {
  const { brief, repo, ...v } = x
  return v
}

export function removeExecute(r, o, x, b) {
  if (x.dirty) throw err('WORKTREE_DIRTY', `WORKTREE_DIRTY: ${x.path} has uncommitted changes; commit or clean it first`, 1)
  // 回收不得吞掉唯一真相：主树没有 brief 而工作树有（未提交的迁移态）时先搬回主树再删目录
  const rel = briefRel(b.data.name)
  const relocatedBack = !existsSync(join(r, rel)) && existsSync(join(x.path, rel))
  if (relocatedBack) relocate(x.path, r, b.data.name)
  git(r, ['worktree', 'remove', x.path])
  const home = brief(r, b.data.name)
  home.data.workflow.worktree = null
  write(home)
  return { path: x.path, removed: true, relocatedBack }
}
