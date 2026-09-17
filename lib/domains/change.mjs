import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { brief, write, ap } from '../brief.mjs'
import { name, confirm, readBody, fileList } from '../input.mjs'
import { err } from '../errors.mjs'

export function create(r, o) {
  confirm(o)
  const n = name(o)
  if (existsSync(ap(r, n))) throw err('CHANGE_EXISTS')
  const b = {
    path: ap(r, n),
    data: {
      schema: 'shadow-dev/v1',
      name: n,
      type: o.type || 'feat',
      scope: o.scope || null,
      status: 'draft',
      baseBranch: o['base-branch'] || 'main',
      branch: null,
      files: fileList(o.files),
      github: { repository: o.repository || null, issue: null, issueUrl: null, pullRequest: null, pullRequestUrl: null },
      review: { conclusion: 'pending', verifiedCommit: null, verifiedAt: null },
      workflow: { operation: null, checkpoint: null, planHash: null, updatedAt: null, lastError: null },
    },
    body: readBody(o, n),
  }
  write(b)
  return { name: n, path: b.path }
}

// 活动变更发现入口：变更名即 shadow-docs/changes/ 下子目录名；archive 与解析失败的目录跳过（与 indexer 同规则）
export function list(r) {
  const base = join(r, 'shadow-docs', 'changes'), changes = []
  if (existsSync(base)) for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'archive') continue
    try {
      const d = brief(r, e.name).data
      changes.push({ name: d.name ?? e.name, type: d.type ?? null, status: d.status ?? null, branch: d.branch ?? null })
    } catch {}
  }
  changes.sort((a, b) => a.name.localeCompare(b.name))
  return { changes }
}

export function approve(r, o) {
  confirm(o)
  const b = brief(r, name(o))
  b.data.status = 'proposed'
  write(b)
  return { name: o.name, status: 'proposed' }
}
