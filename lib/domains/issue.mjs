import { api, repository } from '../github.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'
import { repo } from '../git.mjs'
import { err } from '../errors.mjs'
import { renderIssueBody } from '../issue-render.mjs'

// 正文由 renderIssueBody 从 brief 现算（非陈旧快照）：brief 变动会体现在 bodySha256 → planHash，
// 触发 PLAN_HASH_INVALID，「刷新 = 重跑 plan」天然成立。全文仍持久化进 issuePlan 供人读取。
export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r), w = b.data.workflow.issuePlan || {}
  const titleRaw = o.title ?? w.titleRaw ?? null
  const supplement = o.body ?? w.supplement ?? ''
  const rendered = renderIssueBody(b, { titleRaw, supplement })
  return {
    name: n,
    title: rendered.title,
    titleRaw,
    supplement,
    body: rendered.body,
    sections: rendered.sections,
    bodyBytes: rendered.bodyBytes,
    bodySha256: rendered.bodySha256,
    labels: String(o.labels ?? w.labels ?? '').split(',').filter(Boolean).sort(),
    repository: repository(b, r),
    brief: b.data,
    repo: q,
  }
}

export function persistPlan(b, e) {
  const d = e.data
  b.data.workflow.issuePlan = { title: d.title, titleRaw: d.titleRaw, supplement: d.supplement, body: d.body, labels: d.labels }
}

// stdout 最小投影：重字段（全文/brief/repo/raw 输入）不进机器契约，「预览即提交」由 bodySha256 承担
export function present(d) {
  return { name: d.name, title: d.title, labels: d.labels, repository: d.repository, bodyBytes: d.bodyBytes, bodySha256: d.bodySha256, sections: d.sections }
}

export async function execute(r, o, x, b) {
  if (!x.title) throw err('ISSUE_TITLE_REQUIRED')
  const z = await api(`/repos/${x.repository}/issues`, { method: 'POST', body: JSON.stringify({ title: x.title, body: x.body, labels: x.labels }) })
  b.data.github.repository = x.repository
  b.data.github.issue = z.number
  b.data.github.issueUrl = z.html_url
  b.data.workflow.checkpoint = `issue:${z.number}`
  write(b)
  return { number: z.number, url: z.html_url }
}
