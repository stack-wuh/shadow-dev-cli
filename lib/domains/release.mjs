import { git, repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, fileList } from '../input.mjs'
import { ext } from '../errors.mjs'
import { repository, ensurePr } from '../github.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r), w = b.data.workflow.release || {}
  return {
    name: n,
    files: fileList(o.files ?? w.files),
    message: o.message ?? w.message ?? null,
    title: o.title ?? w.title ?? n,
    body: o.body ?? w.body ?? '',
    repository: repository(b, r),
    branch: b.data.branch || q.branch,
    baseBranch: b.data.baseBranch || 'main',
    head: q.head,
    brief: b.data,
    repo: q,
  }
}

export async function execute(r, o, x, b) {
  let commit = null
  if (!['committed', 'published'].includes(b.data.status)) {
    if (!x.message || !x.files.length) throw Error('COMMIT_INPUT_REQUIRED')
    if (x.files.some(f => ['.', '-A', '--all'].includes(f) || f.startsWith('../') || f.startsWith('/'))) throw Object.assign(Error('UNSUPPORTED_OPERATION'), { status: 4 })
    git(r, ['add', '--', ...x.files])
    git(r, ['commit', '-m', x.message])
    b.data.status = 'committed'
    b.data.workflow.checkpoint = git(r, ['rev-parse', 'HEAD'])
  }
  commit = b.data.workflow.checkpoint
  try { git(r, ['push', '-u', 'origin', x.branch], { timeout: 120000 }) } catch { ext('GIT_PUSH_FAILED') }
  const { pr: z, created } = await ensurePr(x)
  b.data.github.pullRequest = z.number
  b.data.github.pullRequestUrl = z.html_url
  b.data.status = 'published'
  b.data.workflow.checkpoint = `pr:${z.number}`
  write(b)
  return { commit, number: z.number, url: z.html_url, created }
}
