import { createHash } from 'node:crypto'

// canon 输出必须与键的插入顺序无关：planHash 只由数据内容决定
export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon)}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`)}}`
  return JSON.stringify(v)
}

export function hash(v) { return createHash('sha256').update(canon(v)).digest('hex') }

// plan 对比前剥离 plan 产物本身，保证 plan 与 execute 重算结果一致。
// 剥离边界=「plan 自身的副作用」与「CLI 自己的状态推进」，两者都不是用户参数：
//   · workflow 账簿字段（planHash/release/issuePlan/commit/checkpoint/operation/updatedAt/lastError）——
//     plan 与 execute 每次都会写它们，把它们算进哈希等于让门自己把自己判红；
//   · repo 的易变快照（changedFiles/clean/head）——dirty 检查仍由 sync 等命令域在 planData 内联执行，安全语义不丢。
// 2026-10-12 实证：release 半失败（commit 成功、push 因缺 GITHUB_TOKEN 失败）会推进 HEAD，
// 旧写法下 head 参与哈希 → 重试被 PLAN_HASH_INVALID 拒绝 → 只能重跑 plan，于是同一个提交被造了两遍
// （PR #50 里两条同 message 的 commit 即此）。真正要守的是「参数须与 plan 一致」，
// 即 files/message/title/body 与 brief 正文；快照推进不属参数变化。
export function norm(d) {
  if (!d || typeof d !== 'object') return d
  const WORKFLOW_VOLATILE = ['planHash', 'release', 'issuePlan', 'commit', 'checkpoint', 'operation', 'updatedAt', 'lastError']
  const REPO_VOLATILE = ['changedFiles', 'clean', 'head']
  let v = d
  if (d.head !== undefined) { v = { ...v }; delete v.head }
  if (d.brief && d.brief.workflow) {
    v = { ...v, brief: { ...d.brief, workflow: { ...d.brief.workflow } } }
    for (const k of WORKFLOW_VOLATILE) delete v.brief.workflow[k]
  }
  if (d.repo && REPO_VOLATILE.some(k => d.repo[k] !== undefined)) {
    v = { ...v, repo: { ...v.repo } }
    for (const k of REPO_VOLATILE) delete v.repo[k]
  }
  return v
}

export function plan(c, d) { return { ok: true, command: `${c}.plan`, planHash: hash({ command: c, data: norm(d) }), data: d } }
