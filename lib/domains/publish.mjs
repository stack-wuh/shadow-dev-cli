import { git, repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'
import { ext } from '../errors.mjs'
import { repository, ensurePr } from '../github.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  return { name: n, repository: repository(b, r), branch: b.data.branch || q.branch, baseBranch: b.data.baseBranch || 'main', title: o.title || n, body: o.body || '', head: q.head, brief: b.data }
}

export async function execute(r, o, x, b) {
  try { git(r, ['push', '-u', 'origin', x.branch], { timeout: 120000 }) } catch { ext('GIT_PUSH_FAILED') }
  const { pr: z, created } = await ensurePr(x)
  b.data.github.pullRequest = z.number
  b.data.github.pullRequestUrl = z.html_url
  b.data.status = 'published'
  b.data.workflow.checkpoint = `pr:${z.number}`
  write(b)
  return { number: z.number, url: z.html_url, created }
}
