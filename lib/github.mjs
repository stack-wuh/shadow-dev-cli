import { request } from 'node:http'
import { request as requestHttps } from 'node:https'
import { git } from './git.mjs'
import { ext } from './errors.mjs'

export function token() {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!t) ext('GITHUB_TOKEN_REQUIRED')
  return t
}

export function api(path, init = {}) {
  const base = new URL(process.env.SHADOW_GITHUB_API_URL || 'https://api.github.com'), body = init.body || null, ms = Number(process.env.SHADOW_API_TIMEOUT_MS || 15000), send = base.protocol === 'https:' ? requestHttps : request
  return new Promise((resolve, reject) => {
    const req = send(new URL(path, base), {
      method: init.method || 'GET',
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token()}`, 'content-type': 'application/json', 'user-agent': 'shadow-dev', ...(body ? { 'content-length': Buffer.byteLength(body) } : {}) },
    }, res => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { raw += chunk })
      res.on('end', () => {
        clearTimeout(timer)
        let parsed = {}
        try { parsed = raw ? JSON.parse(raw) : {} } catch {}
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(Object.assign(Error(parsed.message || `HTTP ${res.statusCode}`), { code: 'GITHUB_API_ERROR', status: 3 }))
        resolve(parsed)
      })
    })
    const timer = setTimeout(() => req.destroy(new Error('API_TIMEOUT')), ms)
    req.on('error', error => { clearTimeout(timer); reject(Object.assign(Error(error.message), { code: error.message === 'API_TIMEOUT' ? 'API_TIMEOUT' : 'GITHUB_API_ERROR', status: 3 })) })
    if (body) req.write(body)
    req.end()
  })
}

export function repository(b, r) {
  if (b.data.github?.repository) return b.data.github.repository
  if (r) {
    let u = null
    try { u = git(r, ['remote', 'get-url', 'origin']) } catch {}
    const m = u && u.match(/github\.com[:/](.+?)(?:\.git)?\/?$/)
    if (m) return m[1]
    if (u) throw Object.assign(Error(`GITHUB_REPOSITORY_REQUIRED: origin (${u}) is not a GitHub remote; set --repository or brief.github.repository`), { code: 'GITHUB_REPOSITORY_REQUIRED' })
  }
  throw Error('GITHUB_REPOSITORY_REQUIRED')
}

export async function pr(b, r) {
  const n = Number(b.data.github?.pullRequest)
  if (!n) throw Error('PULL_REQUEST_REQUIRED')
  return api(`/repos/${repository(b, r)}/pulls/${n}`)
}

export async function ensurePr(x) {
  const qs = new URLSearchParams({ state: 'open', head: `${x.repository.split('/')[0]}:${x.branch}`, base: x.baseBranch }), found = await api(`/repos/${x.repository}/pulls?${qs}`)
  if (found[0]) return { pr: found[0], created: false }
  try {
    const z = await api(`/repos/${x.repository}/pulls`, { method: 'POST', body: JSON.stringify({ title: x.title, body: x.body, head: x.branch, base: x.baseBranch }) })
    return { pr: z, created: true }
  } catch (e) {
    throw Object.assign(Error(`PR_CREATE_FAILED: ${e.message}`), { code: 'PR_CREATE_FAILED', status: 3 })
  }
}
