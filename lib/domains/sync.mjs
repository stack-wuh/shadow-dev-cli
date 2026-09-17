import { git, repo } from '../git.mjs'
import { brief } from '../brief.mjs'
import { name } from '../input.mjs'
import { ext, err } from '../errors.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  const dirty = q.changedFiles.filter(x => !x.startsWith('shadow-docs/'))
  if (dirty.length) throw err('DIRTY_WORKTREE')
  try { git(r, ['fetch', 'origin', '--prune'], { timeout: 120000 }) } catch { ext('GIT_FETCH_FAILED') }
  const up = `origin/${b.data.baseBranch || q.branch}`, to = git(r, ['rev-parse', up])
  try { git(r, ['merge-base', '--is-ancestor', q.head, to]) } catch { throw err('SYNC_NOT_FAST_FORWARD') }
  return { name: n, from: q.head, to, upstream: up }
}

export function execute(r, o, x) {
  try { git(r, ['merge', '--ff-only', x.to]) } catch { ext('GIT_FAST_FORWARD_FAILED') }
  return { head: git(r, ['rev-parse', 'HEAD']) }
}
