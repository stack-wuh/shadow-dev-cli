// workflow 域：shadow-dev-workflow 产物的物化/回滚/直通管理（无 brief 域，--plan-hash 是唯一凭证）。
// 双轨模型与 CLI 自身安装器同构：release 物化轨（拉 tarball → 冒烟 → 版本化目录 → CURRENT/PREVIOUS 指针 → current 稳定入口）
// 与 link 直通轨（LINK 指向本机目录，代码即改即生效）；解析序 LINK → CURRENT，两轨语义互斥不复用。
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { err } from '../errors.mjs'
import { plan } from '../plan.mjs'
import { confirm } from '../input.mjs'

export const REPO = 'stack-wuh/shadow-dev-workflow'

export function prefix(o) { return o.prefix || process.env.SHADOW_WORKFLOW_PREFIX || join(homedir(), '.local', 'share', 'shadow-dev-workflow') }
const readPtr = (p, f) => { try { return readFileSync(join(p, f), 'utf8').trim() || null } catch { return null } }
export const linked = o => readPtr(prefix(o), 'LINK')
export const current = o => readPtr(prefix(o), 'CURRENT')
export const previous = o => readPtr(prefix(o), 'PREVIOUS')

// 消费方（bind 等）解析产物根：LINK 优先，其次 CURRENT 版本目录；都缺失即未安装
export function resolvedRoot(o) {
  const p = prefix(o)
  const l = linked(o)
  if (l && existsSync(l)) return l
  const c = current(o)
  if (c && existsSync(join(p, `shadow-dev-workflow-${c}`))) return join(p, `shadow-dev-workflow-${c}`)
  throw err('WORKFLOW_NOT_INSTALLED', 'WORKFLOW_NOT_INSTALLED: run `shadow-dev workflow plan` + `workflow execute` first', 1)
}

const home = () => process.env.SHADOW_WORKFLOW_HOME || homedir()
const ms = () => Number(process.env.SHADOW_API_TIMEOUT_MS || 15000)

// 公开仓的 release 拉取：token 可选（api.github.com 匿名可读），SHADOW_GITHUB_API_URL 供测试/代理覆盖
async function ghJson(path) {
  const base = process.env.SHADOW_GITHUB_API_URL || 'https://api.github.com'
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'shadow-dev' }
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (t) headers.authorization = `Bearer ${t}`
  let res
  try { res = await fetch(new URL(path, base), { headers, signal: AbortSignal.timeout(ms()) }) } catch (e) { throw err('GITHUB_API_ERROR', `GITHUB_API_ERROR: ${e.name === 'TimeoutError' ? 'API_TIMEOUT' : e.message}`, 3) }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw err(res.status === 404 ? 'RELEASE_NOT_FOUND' : 'GITHUB_API_ERROR', j.message || `HTTP ${res.status}`, 3)
  return j
}

async function download(url, out) {
  let res
  try { res = await fetch(url, { headers: { 'user-agent': 'shadow-dev' }, signal: AbortSignal.timeout(ms()) }) } catch (e) { throw err('DOWNLOAD_FAILED', `DOWNLOAD_FAILED: ${e.name === 'TimeoutError' ? 'API_TIMEOUT' : e.message}`, 3) }
  if (!res.ok) throw err('DOWNLOAD_FAILED', `DOWNLOAD_FAILED: HTTP ${res.status}`, 3)
  writeFileSync(out, Buffer.from(await res.arrayBuffer()))
}

const verOf = d => { try { return JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')).version } catch { throw err('ARTIFACT_INVALID', 'ARTIFACT_INVALID: package.json unreadable', 3) } }

// 产物契约（与 workflow 仓 pack.mjs 布局同源）：marketplace.json/package.json/skills 三件必备
export function requireArtifact(d) {
  if (!existsSync(d) || !statSync(d).isDirectory()) throw err('ARTIFACT_INVALID', `ARTIFACT_INVALID: not a directory: ${d}`, 3)
  for (const f of ['marketplace.json', 'package.json', 'skills']) if (!existsSync(join(d, f))) throw err('ARTIFACT_INVALID', `ARTIFACT_INVALID: missing ${f}`, 3)
}

// 计划：三路同源解析目标版本——--from（目录/tarball）、--release（固定 tag）、latest
export async function planData(_r, o) {
  const base = { action: 'install', prefix: prefix(o), current: current(o), previous: previous(o), linked: linked(o) }
  if (o.from) {
    const src = resolve(o.from)
    if (statSync(src).isDirectory()) { requireArtifact(src); return { ...base, version: verOf(src), source: { dir: src } } }
    const tmp = mkdtempSync(join(tmpdir(), 'wf-plan-'))
    try {
      execFileSync('tar', ['-xzf', src, '-C', tmp])
      const w = join(tmp, 'shadow-dev-workflow')
      requireArtifact(w)
      return { ...base, version: verOf(w), source: { tarball: resolve(src) } }
    } finally { rmSync(tmp, { recursive: true, force: true }) }
  }
  const rel = await ghJson(o.release ? `/repos/${REPO}/releases/tags/${o.release}` : `/repos/${REPO}/releases/latest`)
  const asset = (rel.assets || []).find(a => /^shadow-dev-workflow-v[0-9][0-9.]*\.tar\.gz$/.test(a.name))
  if (!asset) throw err('RELEASE_NOT_FOUND', 'RELEASE_NOT_FOUND: release carries no shadow-dev-workflow tarball asset', 3)
  return { ...base, version: String(rel.tag_name).replace(/^v/, ''), source: { url: asset.browser_download_url, tag: rel.tag_name } }
}

function prune(p, ver) {
  const prev = readPtr(p, 'PREVIOUS')
  for (const d of readdirSync(p)) {
    if (!d.startsWith('shadow-dev-workflow-')) continue
    if (d === `shadow-dev-workflow-${ver}` || (prev && d === `shadow-dev-workflow-${prev}`)) continue
    rmSync(join(p, d), { recursive: true, force: true })
  }
}

export async function executeDomain(o) {
  confirm(o)
  const e = plan('workflow', await planData(null, o))
  if (!o['plan-hash']) throw err('PLAN_HASH_REQUIRED', 'PLAN_HASH_REQUIRED: run `shadow-dev workflow plan` first or pass --plan-hash', 2)
  if (o['plan-hash'] !== e.planHash) throw err('PLAN_HASH_INVALID')
  const x = e.data
  let src = x.source.dir
  let tmp = null
  if (!src) {
    tmp = mkdtempSync(join(tmpdir(), 'wf-dl-'))
    const tgz = join(tmp, 'artifact.tgz')
    if (x.source.tarball) cpSync(x.source.tarball, tgz)
    else await download(x.source.url, tgz)
    execFileSync('tar', ['-xzf', tgz, '-C', tmp])
    src = join(tmp, 'shadow-dev-workflow')
  }
  requireArtifact(src)
  const p = x.prefix, ver = verOf(src)
  const dest = join(p, `shadow-dev-workflow-${ver}`)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(p, { recursive: true })
  cpSync(src, dest, { recursive: true })
  if (tmp) rmSync(tmp, { recursive: true, force: true })
  // 冒烟已过、目录已物化，才动指针：失败路径绝不留半成品
  const cur = readPtr(p, 'CURRENT')
  if (cur && cur !== ver) writeFileSync(join(p, 'PREVIOUS'), `${cur}\n`)
  writeFileSync(join(p, 'CURRENT'), `${ver}\n`)
  prune(p, ver)
  return { action: 'install', version: ver, prefix: p, previous: readPtr(p, 'PREVIOUS') }
}

export function rollbackDomain(o) {
  confirm(o)
  const p = prefix(o)
  const cur = readPtr(p, 'CURRENT'), prev = readPtr(p, 'PREVIOUS')
  if (!prev || !existsSync(join(p, `shadow-dev-workflow-${prev}`))) throw err('NO_PREVIOUS', 'NO_PREVIOUS: no previous version available for rollback', 1)
  if (cur) writeFileSync(join(p, 'PREVIOUS'), `${cur}\n`)
  writeFileSync(join(p, 'CURRENT'), `${prev}\n`)
  return { action: 'rollback', current: prev, previous: cur }
}

export function linkDomain(o) {
  confirm(o)
  if (!o.dir) throw err('DIR_REQUIRED', 'DIR_REQUIRED: pass --dir <path to shadow-dev-workflow checkout>', 1)
  const target = resolve(o.dir)
  requireArtifact(target)
  const p = prefix(o)
  mkdirSync(p, { recursive: true })
  // LINK 只删不写于 install 轨；语义互斥与 CLI 自身安装器同款（unlink 只删 LINK）
  writeFileSync(join(p, 'LINK'), target)
  return { action: 'link', linked: target, prefix: p }
}

export function unlinkDomain(o) {
  confirm(o)
  const p = prefix(o)
  if (!readPtr(p, 'LINK')) throw err('NOT_LINKED', 'NOT_LINKED: no LINK pointer present', 1)
  rmSync(join(p, 'LINK'))
  return { action: 'unlink', current: readPtr(p, 'CURRENT') }
}

export function statusDomain(o) {
  const p = prefix(o)
  const l = readPtr(p, 'LINK')
  const c = readPtr(p, 'CURRENT')
  const resolved = l && existsSync(l) ? l : c && existsSync(join(p, `shadow-dev-workflow-${c}`)) ? join(p, `shadow-dev-workflow-${c}`) : null
  return { prefix: p, current: c, previous: readPtr(p, 'PREVIOUS'), linked: l, resolved }
}

export async function handle(a, o) {
  if (a === 'plan') { const e = plan('workflow', await planData(null, o)); return e }
  if (a === 'execute') return { ok: true, command: 'workflow.execute', data: await executeDomain(o) }
  if (a === 'status') return { ok: true, command: 'workflow.status', data: statusDomain(o) }
  if (a === 'rollback') return { ok: true, command: 'workflow.rollback', data: rollbackDomain(o) }
  if (a === 'link') return { ok: true, command: 'workflow.link', data: linkDomain(o) }
  if (a === 'unlink') return { ok: true, command: 'workflow.unlink', data: unlinkDomain(o) }
  throw err('UNKNOWN_COMMAND', `unsupported command: workflow ${a}`)
}
