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
