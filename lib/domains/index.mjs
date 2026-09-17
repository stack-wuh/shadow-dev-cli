import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildIndex } from '../indexer.mjs'

export async function planData(r) {
  return { content: buildIndex(r), current: existsSync(join(r, 'shadow-docs', 'INDEX.md')) ? readFileSync(join(r, 'shadow-docs', 'INDEX.md'), 'utf8') : '' }
}

export function execute(r, o, x) {
  writeFileSync(join(r, 'shadow-docs', 'INDEX.md'), x.content)
  return { path: 'shadow-docs/INDEX.md' }
}
