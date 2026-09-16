import { existsSync, readFileSync } from 'node:fs'

export function confirm(o, ph = false) {
  if (!o.confirm) throw Object.assign(Error('CONFIRMATION_REQUIRED'), { status: 2 })
  if (ph && !o['plan-hash']) throw Object.assign(Error('PLAN_HASH_REQUIRED'), { status: 2 })
}

export function name(o) {
  if (!o.name) throw Error('NAME_REQUIRED')
  return o.name
}

export function readBody(o, n) {
  if (!o['body-file']) return `\n# ${n}\n\n## 任务\n\n`
  const p = o['body-file']
  if (!existsSync(p)) throw Error('BODY_FILE_NOT_FOUND')
  const c = readFileSync(p, 'utf8').trim()
  if (!c) throw Error('BODY_FILE_EMPTY')
  return `\n${c}\n`
}
