import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, fileList } from '../input.mjs'
import { repository } from '../github.mjs'
import { commitStep, pushAndOpenPr } from '../steps.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r), w = b.data.workflow.release || {}
  // 与 publish 同源：PR 正文缺省携带 Closes #N（brief 有关联 issue 时合并即自动关闭）
  const issue = b.data.github && b.data.github.issue
  const body = o.body ?? w.body ?? (issue ? `Closes #${issue}\n\n完整 brief：shadow-docs/changes/${n}/brief.md` : '')
  return {
    name: n,
    files: fileList(o.files ?? w.files),
    message: o.message ?? w.message ?? null,
    title: o.title ?? w.title ?? n,
    body,
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
