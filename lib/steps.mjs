import { git } from './git.mjs'
import { ext, err } from './errors.mjs'
import { ensurePr } from './github.mjs'

// 共享 git 提交步骤：显式文件边界校验、提交并回写 brief 状态；write(b) 由调用方负责
export function commitStep(r, x, b) {
  if (!x.message || !x.files.length) throw err('COMMIT_INPUT_REQUIRED')
  if (x.files.some(f => ['.', '-A', '--all'].includes(f) || f.startsWith('../') || f.startsWith('/'))) throw err('UNSUPPORTED_OPERATION', 'UNSUPPORTED_OPERATION', 4)
  git(r, ['add', '--', ...x.files])
  git(r, ['commit', '-m', x.message])
  b.data.status = 'committed'
  b.data.workflow.checkpoint = git(r, ['rev-parse', 'HEAD'])
  return b.data.workflow.checkpoint
}

// 共享发布步骤：推送分支并创建或复用 PR
export async function pushAndOpenPr(r, x, b) {
  try { git(r, ['push', '-u', 'origin', x.branch], { timeout: 120000 }) } catch { ext('GIT_PUSH_FAILED') }
  const { pr: z, created } = await ensurePr(x)
  b.data.github.pullRequest = z.number
  b.data.github.pullRequestUrl = z.html_url
  b.data.status = 'published'
  b.data.workflow.checkpoint = `pr:${z.number}`
  return { number: z.number, url: z.html_url, created }
}

// 零 dirty 不变量：状态写盘晚于内容 commit 是生命周期的固有顺序（PR 号只能在 push 后得知），
// 每次最终态 write(b) 之后由本函数补一笔 docs commit，保证「状态变动↔对应 commit」且工作树不留脏文件。
// 幂等：brief 相对 HEAD 无差异时返回 null——续跑不造空 commit。
export function briefStateCommit(r, b, message) {
  const rel = `shadow-docs/changes/${b.data.name}/brief.md`
  if (git(r, ['status', '--porcelain', '--', rel]) === '') return null
  git(r, ['add', '--', rel])
  git(r, ['commit', '-m', message])
  return git(r, ['rev-parse', 'HEAD'])
}

// 补提交后的分支同步推送：PR 自动纳入最终态；失败语义与首推一致
export function pushTip(r, branch) {
  try { git(r, ['push', '-u', 'origin', branch], { timeout: 120000 }) } catch { ext('GIT_PUSH_FAILED') }
}
