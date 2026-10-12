import { existsSync, readFileSync } from 'node:fs'
import { err } from './errors.mjs'

export function confirm(o, ph = false) {
  if (!o.confirm) throw err('CONFIRMATION_REQUIRED', 'CONFIRMATION_REQUIRED: mutating commands require an explicit --confirm', 2)
  if (ph && !o['plan-hash']) throw err('PLAN_HASH_REQUIRED', 'PLAN_HASH_REQUIRED: run the plan command first or pass --plan-hash', 2)
}

export function name(o) {
  if (!o.name) throw err('NAME_REQUIRED', 'NAME_REQUIRED: pass --name <change-name>, e.g. --name 20260917-feature-x')
  return o.name
}

// Windows 反斜杠入参归一为 git 输出的正斜杠路径，保证与 porcelain/conflict 可比对
export function fileList(v) {
  return String(v ?? '').split(',').map(x => x.trim().replaceAll('\\', '/').replace(/^\.\//, '')).filter(Boolean).sort()
}

// --body-file 读取：缺失/空文件均响亮拒绝，绝不静默给空正文
function bodyFile(p) {
  if (!existsSync(p)) throw err('BODY_FILE_NOT_FOUND', `BODY_FILE_NOT_FOUND: file not readable: ${p}`)
  const c = readFileSync(p, 'utf8').trim()
  if (!c) throw err('BODY_FILE_EMPTY', 'BODY_FILE_EMPTY: --body-file content must not be blank')
  return c
}

export function readBody(o, n) {
  if (!o['body-file']) return `\n# ${n}\n\n## 任务\n\n`
  return `\n${bodyFile(o['body-file'])}\n`
}

// PR 标题与正文：显式入参 > brief 持久化的上一次 plan 参数（断点续跑），两者皆无即拒绝。
// CLI 绝不自行生成标题（曾用变更名）或正文（曾补一行 Closes）——线上裸 slug 标题与薄正文正是那两个回退产出的。
export function prParams(o, w = {}, cmd = 'release plan') {
  if (o.body !== undefined && o['body-file'] !== undefined) throw err('BODY_PARAM_CONFLICT', 'BODY_PARAM_CONFLICT: pass either --body or --body-file, not both')
  const title = String(o.title ?? w.title ?? '')
  const body = o['body-file'] !== undefined ? bodyFile(o['body-file']) : String(o.body ?? w.body ?? '')
  const missing = [!title.trim() && '--title', !body.trim() && '--body (or --body-file)'].filter(Boolean)
  if (missing.length) throw err('PR_PARAMS_REQUIRED', `PR_PARAMS_REQUIRED: ${cmd} requires ${missing.join(' and ')} — the CLI no longer derives them from the change name`)
  return { title: title.trim(), body: body.trim() }
}
