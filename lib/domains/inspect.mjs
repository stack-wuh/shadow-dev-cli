import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { repo } from '../git.mjs'
import { brief } from '../brief.mjs'
import { name } from '../input.mjs'
import { pr } from '../github.mjs'

export function repoState(r) {
  return repo(r)
}

export async function pullRequest(r, o) {
  return pr(brief(r, name(o)), r)
}

export function conflict(r, o) {
  const n = name(o), files = new Set(brief(r, n).data.files || []), base = join(r, 'shadow-docs', 'changes'), overlaps = []
  for (const e of readdirSync(base, { withFileTypes: true }).filter(x => x.isDirectory() && x.name !== n && x.name !== 'archive')) {
    try {
      const fs = (brief(r, e.name).data.files || []).filter(x => files.has(x)).sort()
      if (fs.length) overlaps.push({ change: e.name, files: fs })
    } catch {}
  }
  return { overlaps }
}
