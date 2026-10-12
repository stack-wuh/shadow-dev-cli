import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, fileList, prParams } from '../input.mjs'
import { repository, token } from '../github.mjs'
import { commitStep, pushAndOpenPr, briefStateCommit, pushTip } from '../steps.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r), w = b.data.workflow.release || {}
  // 与 publish 同源：标题与正文必须显式给出（或回退上一次 plan 的持久值），CLI 不再代劳
  const { title, body } = prParams(o, w, 'release plan')
  return {
    name: n,
    files: fileList(o.files ?? w.files),
    message: o.message ?? w.message ?? null,
    title,
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
  // 前置凭证校验：commit 是不可逆的本地动作，必须在它之前确认能推送/建 PR，
  // 否则缺 token 会留下「已提交、未推送」的半状态（见 lib/plan.mjs norm 的 2026-10-12 实证）。
  token()
  const commit = ['committed', 'published'].includes(b.data.status) ? b.data.workflow.checkpoint : commitStep(r, x, b)
  const z = await pushAndOpenPr(r, x, b)
  write(b)
  const briefCommit = briefStateCommit(r, b, `docs(shadow): brief 最终态——published, PR #${z.number}`)
  if (briefCommit) pushTip(r, x.branch)
  return { commit, ...z, briefCommit }
}
