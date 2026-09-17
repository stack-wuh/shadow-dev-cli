import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const ap = (r, n) => join(r, 'shadow-docs', 'changes', n, 'brief.md')
export const xp = (r, n) => join(r, 'shadow-docs', 'changes', 'archive', n, 'brief.md')

// 读取容忍 LF/CRLF（Windows core.autocrlf 检出与手工编辑），写回恒为 LF
export function brief(r, n, arch = false) {
  const path = arch ? xp(r, n) : ap(r, n)
  if (!existsSync(path)) throw Error('BRIEF_NOT_FOUND')
  const t = readFileSync(path, 'utf8'), open = /^---\r?\n/.exec(t)
  if (!open) throw Error('BRIEF_FRONTMATTER_REQUIRED')
  const s = open[0].length, e = /\r?\n---\r?\n/.exec(t.slice(s))
  if (!e) throw Error('BRIEF_FRONTMATTER_REQUIRED')
  return { path, data: JSON.parse(t.slice(s, s + e.index)), body: t.slice(s + e.index + e[0].length) }
}

export function write(b) {
  mkdirSync(dirname(b.path), { recursive: true })
  const t = b.path + `.tmp-${process.pid}`
  writeFileSync(t, `---\n${JSON.stringify(b.data, null, 2)}\n---\n${b.body.replaceAll('\r\n', '\n')}`)
  renameSync(t, b.path)
}

export function tasks(s) {
  return [...s.matchAll(/^\s*- \[([ xX])\]\s+(.+)$/gm)].map((m, i) => ({ id: `task-${i + 1}`, done: m[1].toLowerCase() === 'x', text: m[2] }))
}
