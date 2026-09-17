import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, fileList } from '../input.mjs'
import { repository } from '../github.mjs'
import { commitStep, pushAndOpenPr } from '../steps.mjs'

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

export function persistPlan(b, e) {
  b.data.workflow.release = { files: e.data.files, message: e.data.message, title: e.data.title, body: e.data.body }
}

export async function execute(r, o, x, b) {
  const commit = ['committed', 'published'].includes(b.data.status) ? b.data.workflow.checkpoint : commitStep(r, x, b)
  const z = await pushAndOpenPr(r, x, b)
  write(b)
  return { commit, ...z }
}
