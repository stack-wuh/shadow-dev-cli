import { git, repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name } from '../input.mjs'
import { err } from '../errors.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  return { name: n, branch: `${b.data.type}/${n}`, baseBranch: b.data.baseBranch || 'main', brief: b.data, repo: q }
}

export function execute(r, o, x, b) {
  // 非 base 分支必须响亮失败：静默跳过会让 brief 记录 branched 而实际没建分支（状态与现实脱节）
  if (x.repo.branch !== x.baseBranch) throw err('NOT_ON_BASE_BRANCH', `NOT_ON_BASE_BRANCH: current=${x.repo.branch || '(detached)'} base=${x.baseBranch}`)
  git(r, ['switch', '-c', x.branch])
  b.data.branch = x.branch
  b.data.status = 'branched'
  write(b)
  return { branch: x.branch }
}
