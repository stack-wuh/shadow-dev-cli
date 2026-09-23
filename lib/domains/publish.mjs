import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'
import { repository } from '../github.mjs'
import { pushAndOpenPr } from '../steps.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  // PR 正文缺省携带 Closes #N：brief 有关联 issue 时，PR 合入即自动关闭该 issue
  // （此前缺省空正文导致 issue 悬空）；显式 --body 仍优先，plan/execute 同源保持哈希一致
  const issue = b.data.github && b.data.github.issue
  const body = o.body || (issue ? `Closes #${issue}\n\n完整 brief：shadow-docs/changes/${n}/brief.md` : '')
  return { name: n, repository: repository(b, r), branch: b.data.branch || q.branch, baseBranch: b.data.baseBranch || 'main', title: o.title || n, body, head: q.head, brief: b.data }
}

export async function execute(r, o, x, b) {
  const z = await pushAndOpenPr(r, x, b)
  write(b)
  return z
}
