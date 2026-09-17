import { existsSync } from 'node:fs'
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

export function approve(r, o) {
  confirm(o)
  const b = brief(r, name(o))
  b.data.status = 'proposed'
  write(b)
  return { name: o.name, status: 'proposed' }
}
