import { createHash } from 'node:crypto'

// canon 输出必须与键的插入顺序无关：planHash 只由数据内容决定
export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon)}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`)}}`
  return JSON.stringify(v)
}

export function hash(v) { return createHash('sha256').update(canon(v)).digest('hex') }

// plan 对比前剥离 plan 产物本身，保证 plan 与 execute 重算结果一致。
// 剥离边界=「plan 自身的副作用」：workflow 凭证字段，以及 repo 的易变 worktree 快照
// （changedFiles/clean 会因 plan 写回 brief 而变化；dirty 行为检查仍由 sync 等命令域在 planData 内联执行，安全语义不丢）
export function norm(d) {
  if (!d || typeof d !== 'object') return d
  let v = d
  if (d.brief && d.brief.workflow) {
    v = { ...v, brief: { ...d.brief, workflow: { ...d.brief.workflow } } }
    delete v.brief.workflow.planHash
    delete v.brief.workflow.release
    delete v.brief.workflow.issuePlan
    delete v.brief.workflow.commit
  }
  if (d.repo && (d.repo.changedFiles !== undefined || d.repo.clean !== undefined)) {
    v = { ...v, repo: { ...v.repo } }
    delete v.repo.changedFiles
    delete v.repo.clean
  }
  return v
}

export function plan(c, d) { return { ok: true, command: `${c}.plan`, planHash: hash({ command: c, data: norm(d) }), data: d } }
