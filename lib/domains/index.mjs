import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { plan } from '../plan.mjs'
import { confirm } from '../input.mjs'
import { buildIndex } from '../indexer.mjs'

function rebuildData(r) {
  return { content: buildIndex(r), current: existsSync(join(r, 'shadow-docs', 'INDEX.md')) ? readFileSync(join(r, 'shadow-docs', 'INDEX.md'), 'utf8') : '' }
}

export function rebuildPlan(r) {
  return plan('index.rebuild', rebuildData(r))
}

export function rebuildExecute(r, o) {
  confirm(o, true)
  const e = plan('index.rebuild', rebuildData(r))
  if (e.planHash !== o['plan-hash']) throw Error('PLAN_HASH_INVALID')
  writeFileSync(join(r, 'shadow-docs', 'INDEX.md'), e.data.content)
  return { path: 'shadow-docs/INDEX.md' }
}
