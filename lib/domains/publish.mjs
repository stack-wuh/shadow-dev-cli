import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, prParams } from '../input.mjs'
import { repository, token } from '../github.mjs'
import { pushAndOpenPr, briefStateCommit, pushTip } from '../steps.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  // 标题与正文必须显式给出：publish 无 brief 持久化参数源，缺省即拒绝（issue 关联由正文的 Closes #N 承担）
  const { title, body } = prParams(o, {}, 'publish plan')
  return { name: n, repository: repository(b, r), branch: b.data.branch || q.branch, baseBranch: b.data.baseBranch || 'main', title, body, head: q.head, brief: b.data }
}

export async function execute(r, o, x, b) {
  // 同 release：先在能建 PR 的前提下再推分支，避免缺凭证时把分支推上去、PR 却建不出来
  token()
  const z = await pushAndOpenPr(r, x, b)
  write(b)
  const briefCommit = briefStateCommit(r, b, `docs(shadow): brief 最终态——published, PR #${z.number}`)
  if (briefCommit) pushTip(r, x.branch)
  return { ...z, briefCommit }
}
