import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { brief } from './brief.mjs'

export function buildIndex(r) {
  const rows = [], base = join(r, 'shadow-docs', 'changes')
  for (const a of [false, true]) {
    const d = a ? join(base, 'archive') : base
    if (!existsSync(d)) continue
    for (const e of readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory() && (a || x.name !== 'archive'))) {
      try { const b = brief(r, e.name, a); rows.push({ n: e.name, s: a ? '✅ 完成' : b.data.status, p: `shadow-docs/changes/${a ? 'archive/' : ''}${e.name}/brief.md` }) } catch {}
    }
  }
  rows.sort((a, b) => a.n.localeCompare(b.n))
  return `# 变更索引\n\n| 变更 | 状态 | 路径 |\n|------|------|------|\n${rows.map(x => `| ${x.n} | ${x.s} | ${x.p} |`).join('\n')}\n`
}
