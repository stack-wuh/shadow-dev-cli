import { git, repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, fileList } from '../input.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  return { name: n, files: fileList(o.files), message: o.message || null, brief: b.data, repo: q }
}

export function execute(r, o, x, b) {
  if (!x.message || !x.files.length) throw Error('COMMIT_INPUT_REQUIRED')
  if (x.files.some(f => ['.', '-A', '--all'].includes(f) || f.startsWith('../') || f.startsWith('/'))) throw Object.assign(Error('UNSUPPORTED_OPERATION'), { status: 4 })
  git(r, ['add', '--', ...x.files])
  git(r, ['commit', '-m', x.message])
  b.data.status = 'committed'
  b.data.workflow.checkpoint = git(r, ['rev-parse', 'HEAD'])
  write(b)
  return { commit: b.data.workflow.checkpoint }
}
