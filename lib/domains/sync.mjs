import { git, repo } from '../git.mjs'
import { brief } from '../brief.mjs'
import { ext, err } from '../errors.mjs'

// 基线分支解析优先级恒为：--base-branch > brief.baseBranch > 当前分支。
// brief 不是 sync 的前置条件：squash 合并后收口时调用者已站在基线分支上，而 brief 只在 ff
// 之后才落到工作树——把 brief 当硬凭证会让 sync 恰好在它唯一被需要的场景里必然
// BRIEF_NOT_FOUND（issue #59 / #65）。显式代价：非当前分支的基线必须传 --base-branch。
function baseBranch(r, o, current) {
  if (o['base-branch']) return String(o['base-branch'])
  if (!o.name) return current
  try {
    return brief(r, o.name).data.baseBranch || current
  } catch (e) {
    if (e.code !== 'BRIEF_NOT_FOUND') throw e
    return current
  }
}

export async function planData(r, o) {
  const q = repo(r)
  const dirty = q.changedFiles.filter(x => !x.startsWith('shadow-docs/'))
  if (dirty.length) throw err('DIRTY_WORKTREE')
  try { git(r, ['fetch', 'origin', '--prune'], { timeout: 120000 }) } catch { ext('GIT_FETCH_FAILED') }
  const base = baseBranch(r, o, q.branch)
  const upstream = `origin/${base}`
  let to
  try {
    to = git(r, ['rev-parse', upstream])
  } catch {
    throw err('SYNC_UPSTREAM_NOT_FOUND', `SYNC_UPSTREAM_NOT_FOUND: ${upstream} does not resolve — pass --base-branch <base> explicitly`, 1)
  }
  try { git(r, ['merge-base', '--is-ancestor', q.head, to]) } catch { throw err('SYNC_NOT_FAST_FORWARD') }
  return { name: o.name ?? null, base, from: q.head, to, upstream }
}

export function execute(r, o, x) {
  try { git(r, ['merge', '--ff-only', x.to]) } catch { ext('GIT_FAST_FORWARD_FAILED') }
  return { head: git(r, ['rev-parse', 'HEAD']) }
}
