import { git, repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  return { name: n, branch: `${b.data.type}/${n}`, baseBranch: b.data.baseBranch || 'main', brief: b.data, repo: q }
}

export function execute(r, o, x, b) {
  if (x.repo.branch === x.baseBranch) git(r, ['switch', '-c', x.branch])
  b.data.branch = x.branch
  b.data.status = 'branched'
  write(b)
  return { branch: x.branch }
}
