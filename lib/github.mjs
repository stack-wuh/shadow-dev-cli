import { request } from 'node:http'
import { request as requestHttps } from 'node:https'
import { git } from './git.mjs'
import { ext, err } from './errors.mjs'
import { cfg } from './config.mjs'

export function token() {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!t) ext('GITHUB_TOKEN_REQUIRED')
  return t
}

export function api(path, init = {}) {
  const base = new URL(process.env.SHADOW_GITHUB_API_URL || cfg('github.apiBaseUrl') || 'https://api.github.com'), body = init.body || null, ms = Number(process.env.SHADOW_API_TIMEOUT_MS || cfg('github.timeoutMs') || 15000), send = base.protocol === 'https:' ? requestHttps : request
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
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(err('GITHUB_API_ERROR', parsed.message || `HTTP ${res.statusCode}`, 3))
        resolve(parsed)
      })
    })
    const timer = setTimeout(() => req.destroy(new Error('API_TIMEOUT')), ms)
    req.on('error', error => { clearTimeout(timer); reject(err(error.message === 'API_TIMEOUT' ? 'API_TIMEOUT' : 'GITHUB_API_ERROR', error.message, 3)) })
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
    if (u) throw err('GITHUB_REPOSITORY_REQUIRED', `GITHUB_REPOSITORY_REQUIRED: origin (${u}) is not a GitHub remote; set --repository or brief.github.repository`)
  }
  throw err('GITHUB_REPOSITORY_REQUIRED')
}

// 按分支查 PR：state=all 才能同时命中 open 与已 merged 的历史 PR。
// 优先 open，其次最近一条（含 merged/closed）——publish/archive 据此复用，绝不重复开 PR。
export async function findPr(repository, branch, baseBranch) {
  if (!branch) return null
  const qs = new URLSearchParams({ state: 'all', head: `${repository.split('/')[0]}:${branch}`, per_page: '20' })
  const found = await api(`/repos/${repository}/pulls?${qs}`)
  const list = (Array.isArray(found) ? found : []).filter(p => p && p.number && (!baseBranch || !p.base || !p.base.ref || p.base.ref === baseBranch))
  if (!list.length) return null
  const stamp = p => String(p.merged_at || p.closed_at || p.created_at || '')
  return list.find(p => p.state === 'open') || list.slice().sort((a, c) => stamp(c).localeCompare(stamp(a)))[0]
}

export async function pr(b, r) {
  const n = Number(b.data.github?.pullRequest)
  if (n) return api(`/repos/${repository(b, r)}/pulls/${n}`)
  // brief 的 pullRequest 缺失或被早期命令回写清空时，按分支回查并回填，避免归档被 PULL_REQUEST_REQUIRED 卡死
  const found = await findPr(repository(b, r), b.data.branch, b.data.baseBranch || 'main')
  if (!found) throw err('PULL_REQUEST_REQUIRED')
  b.data.github = { ...(b.data.github || {}), pullRequest: found.number, pullRequestUrl: found.html_url || null }
  return found
}

export async function ensurePr(x) {
  // 复用而非新建：已 merged 的 PR 同样命中（此前只查 state=open，分支合并后再 publish 会重复开 PR）
  const existing = await findPr(x.repository, x.branch, x.baseBranch)
  if (existing) return { pr: existing, created: false }
  try {
    const z = await api(`/repos/${x.repository}/pulls`, { method: 'POST', body: JSON.stringify({ title: x.title, body: x.body, head: x.branch, base: x.baseBranch }) })
    return { pr: z, created: true }
  } catch (e) {
    throw err('PR_CREATE_FAILED', `PR_CREATE_FAILED: ${e.message}`, 3)
  }
}
