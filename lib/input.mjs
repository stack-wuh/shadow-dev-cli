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

export function readBody(o, n) {
  if (!o['body-file']) return `\n# ${n}\n\n## 任务\n\n`
  const p = o['body-file']
  if (!existsSync(p)) throw err('BODY_FILE_NOT_FOUND', `BODY_FILE_NOT_FOUND: file not readable: ${p}`)
  const c = readFileSync(p, 'utf8').trim()
  if (!c) throw err('BODY_FILE_EMPTY', 'BODY_FILE_EMPTY: --body-file content must not be blank')
  return `\n${c}\n`
}
