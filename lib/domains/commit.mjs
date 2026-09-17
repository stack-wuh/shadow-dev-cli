import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, fileList } from '../input.mjs'
import { commitStep } from '../steps.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  return { name: n, files: fileList(o.files), message: o.message || null, brief: b.data, repo: q }
}

export function execute(r, o, x, b) {
  const commit = commitStep(r, x, b)
  write(b)
  return { commit }
}
