import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { name } from '../input.mjs'
import { pr } from '../github.mjs'
import { buildIndex } from '../indexer.mjs'
import { brief, write, xp } from '../brief.mjs'
import { repo } from '../git.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  if (b.data.review?.conclusion !== 'passed' || b.data.review.verifiedCommit !== q.head) throw Error('REVIEW_NOT_PASSED')
  const x = await pr(b, r)
  if (!x.merged) throw Error('PR_NOT_MERGED')
  return { name: n, pullRequest: x.number, head: q.head }
}

export function execute(r, o, x, b) {
  const n = name(o)
  b.data.status = 'archived'
  b.data.workflow.checkpoint = `merged-pr:${x.pullRequest}`
  write(b)
  const dest = dirname(xp(r, n))
  mkdirSync(dirname(dest), { recursive: true })
  renameSync(dirname(b.path), dest)
  writeFileSync(join(r, 'shadow-docs', 'INDEX.md'), buildIndex(r))
  return { path: xp(r, n) }
}
