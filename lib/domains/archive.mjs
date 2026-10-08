import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { name } from '../input.mjs'
import { pr } from '../github.mjs'
import { buildIndex } from '../indexer.mjs'
import { brief, write, xp } from '../brief.mjs'
import { git, repo } from '../git.mjs'
import { err, ext } from '../errors.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  if (b.data.review?.conclusion !== 'passed' || b.data.review.verifiedCommit !== q.head) throw err('REVIEW_NOT_PASSED')
  const x = await pr(b, r)
  if (!x.merged) throw err('PR_NOT_MERGED')
  return { name: n, pullRequest: x.number, head: q.head }
}

export function execute(r, o, x, b) {
  const n = name(o)
  b.data.status = 'archived'
  b.data.workflow.checkpoint = `merged-pr:${x.pullRequest}`
  write(b)
  const dest = dirname(xp(r, n))
  mkdirSync(dirname(dest), { recursive: true })
  const source = dirname(b.path)
  // 旧目录仅在被 git 追踪时才需要暂存删除：change 从未入 commit（如 release 文件清单遗漏）时
  // 移动后旧路径无物可加，硬加会 pathspec fatal 并把归档卡在半落状态
  const tracked = git(r, ['ls-files', '--', source]).trim().length > 0
  renameSync(source, dest)
  writeFileSync(join(r, 'shadow-docs', 'INDEX.md'), buildIndex(r))
  // 归档落本地 commit：半落状态（INDEX 改 + 旧目录删 + 新目录未跟踪）对 AI 与人都易漏提交
  const staged = ['shadow-docs/INDEX.md', `shadow-docs/changes/archive/${n}`]
  if (tracked) staged.unshift(`shadow-docs/changes/${n}`)
  git(r, ['add', '--', ...staged])
  git(r, ['commit', '-m', `docs(shadow): 归档 ${n}——PR #${x.pullRequest} 已合入 main，brief 移入 archive 并重建 INDEX`])
  // 归档必须落 origin/main：滞留本地的归档提交会被下一个 change 的 PR 顺带合入（workflow 仓 2d1b174 实证）
  try { git(r, ['push'], { timeout: 120000 }) } catch { ext('GIT_PUSH_FAILED') }
  return { path: xp(r, n), pushed: true }
}
