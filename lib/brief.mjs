import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const ap = (r, n) => join(r, 'shadow-docs', 'changes', n, 'brief.md')
export const xp = (r, n) => join(r, 'shadow-docs', 'changes', 'archive', n, 'brief.md')

export function brief(r, n, arch = false) {
  const path = arch ? xp(r, n) : ap(r, n)
  if (!existsSync(path)) throw Error('BRIEF_NOT_FOUND')
  const t = readFileSync(path, 'utf8'), e = t.indexOf('\n---\n', 4)
  if (e < 0) throw Error('BRIEF_FRONTMATTER_REQUIRED')
  return { path, data: JSON.parse(t.slice(4, e)), body: t.slice(e + 5) }
}

export function write(b) {
  mkdirSync(dirname(b.path), { recursive: true })
  const t = b.path + `.tmp-${process.pid}`
  writeFileSync(t, `---\n${JSON.stringify(b.data, null, 2)}\n---\n${b.body}`)
  renameSync(t, b.path)
}

export function tasks(s) {
  return [...s.matchAll(/^\s*- \[([ xX])\]\s+(.+)$/gm)].map((m, i) => ({ id: `task-${i + 1}`, done: m[1].toLowerCase() === 'x', text: m[2] }))
}
