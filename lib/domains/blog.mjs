import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { join, resolve } from 'node:path'
import { err } from '../errors.mjs'
import { cfg } from '../config.mjs'
import { api } from '../github.mjs'
import { parseFrontmatter, parseList } from '../frontmatter.mjs'

// blog publish 域：收编 blog 仓发布脚本（frontmatter → Issue → server 即时同步）。
// 无 brief 域：--plan-hash 为唯一凭证（沿 index rebuild 先例）；不要求 git 仓库，文件按 cwd 解析。
// 解析链 flag > env > .env(cwd) > 项目/用户 config > 内置默认；token 恒走 env 或 .env，不进配置文件。

const DEFAULT_REPOSITORY = 'stack-wuh/blog'
const DEFAULT_SYNC_URL = 'http://localhost:3200'
const SYNC_TIMEOUT_MS = 15000

function envFile() {
  let raw = ''
  try { raw = readFileSync(join(process.cwd(), '.env'), 'utf8') } catch { return {} }
  const pick = k => { const m = raw.match(new RegExp(k + '=([^"\\n]+|"[^"\\n]*")')); return m ? m[1].replace(/^"|"$/g, '') : undefined }
  return { GITHUB_TOKEN: pick('GITHUB_TOKEN'), SYNC_URL: pick('SYNC_URL') }
}

export async function planData(r, o) {
  if (!o.file) throw err('BLOG_FILE_REQUIRED', 'BLOG_FILE_REQUIRED: pass --file <article.md>', 2)
  const abs = resolve(process.cwd(), String(o.file))
  if (!existsSync(abs)) throw err('BLOG_FILE_NOT_FOUND', `BLOG_FILE_NOT_FOUND: ${abs}`, 1)
  const raw = readFileSync(abs, 'utf8')
  const { data, content } = parseFrontmatter(raw)
  const title = String(data.title ?? '').trim()
  if (!title) throw err('BLOG_TITLE_REQUIRED', 'BLOG_TITLE_REQUIRED: frontmatter must declare title', 1)
  const labels = parseList(data.labels)
  const meta = {}
  if (data.summary) meta.summary = String(data.summary)
  if (data.cover) meta.cover = String(data.cover)
  if (data.keywords) meta.keywords = parseList(data.keywords)
  const block = Object.keys(meta).length ? `\n\n<!-- wuh-site-metadata: ${JSON.stringify(meta)} -->` : ''
  const body = content.trim() + block
  const env = envFile()
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN && env.GITHUB_TOKEN) process.env.GITHUB_TOKEN = env.GITHUB_TOKEN
  return {
    file: abs,
    fileHash: createHash('sha256').update(raw).digest('hex'),
    title,
    labels,
    repository: o.repository || cfg('blog.repository') || DEFAULT_REPOSITORY,
    syncUrl: o['sync-url'] || process.env.SYNC_URL || env.SYNC_URL || cfg('blog.syncUrl') || DEFAULT_SYNC_URL,
    body,
    bodyBytes: Buffer.byteLength(body),
    bodySha256: createHash('sha256').update(body).digest('hex'),
  }
}

export function present(x) {
  const { body, ...lean } = x
  return lean
}

export async function execute(r, o, x) {
  const issue = await api(`/repos/${x.repository}/issues`, { method: 'POST', body: JSON.stringify({ title: x.title, body: x.body, labels: x.labels }) })
  const sync = await syncPing(`${x.syncUrl}/v2/webhook/sync/${issue.number}`)
  return { repository: x.repository, issue: { number: issue.number, url: issue.html_url }, sync }
}

// 尽力而为：与脚本语义一致，同步失败只记录、不影响发布结果（Issue 已创建，webhook 会兜底）
function syncPing(url) {
  return new Promise(done => {
    let settled = false
    const finish = v => { if (!settled) { settled = true; done(v) } }
    let req
    try {
      req = (url.startsWith('https:') ? httpsRequest : httpRequest)(new URL(url), { method: 'POST', headers: { 'content-length': '0' } }, res => {
        res.resume()
        clearTimeout(timer)
        finish({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode })
      })
    } catch (e) { return finish({ ok: false, error: e.message }) }
    const timer = setTimeout(() => req.destroy(new Error('API_TIMEOUT')), SYNC_TIMEOUT_MS)
    req.on('error', e => { clearTimeout(timer); finish({ ok: false, error: e.code || e.message }) })
    req.end()
  })
}
