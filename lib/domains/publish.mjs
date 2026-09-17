import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'
import { repository } from '../github.mjs'
import { pushAndOpenPr } from '../steps.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  return { name: n, repository: repository(b, r), branch: b.data.branch || q.branch, baseBranch: b.data.baseBranch || 'main', title: o.title || n, body: o.body || '', head: q.head, brief: b.data }
}

export async function execute(r, o, x, b) {
  const z = await pushAndOpenPr(r, x, b)
  write(b)
  return z
}
