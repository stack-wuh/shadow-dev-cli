import { repo } from '../git.mjs'
import { brief, write } from '../brief.mjs'
import { name, fileList } from '../input.mjs'
import { commitStep } from '../steps.mjs'

export async function planData(r, o) {
  const n = name(o), b = brief(r, n), q = repo(r)
  const saved = b.data.workflow.commit || {}
  // 未重传参数时回退持久化值（release 同款模式）：execute 免逐字重传 --files/--message
  return { name: n, files: fileList(o.files ?? saved.files), message: o.message ?? saved.message ?? null, brief: b.data, repo: q }
}

export function persistPlan(b, e) {
  b.data.workflow.commit = { files: e.data.files, message: e.data.message }
}

export function execute(r, o, x, b) {
  const commit = commitStep(r, x, b)
  write(b)
  return { commit }
}
