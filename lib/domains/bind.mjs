// bind 域：把 workflow 产物的 skills 按宿主适配器描述符绑入宿主 skills 发现目录（无 brief 域）。
// 描述符数据化：adapters/<host>.json 随产物分发，新增宿主 = 新增描述符，本域零改动。
// 托管标记走 sidecar（.shadow-dev-workflow.json），不改 SKILL.md 字节；非托管同名目录 guard 拒绝，绝不静默覆盖。
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { err } from '../errors.mjs'
import { plan } from '../plan.mjs'
import { confirm } from '../input.mjs'
import { resolvedRoot } from './workflow.mjs'

const SIDECAR = '.shadow-dev-workflow.json'
const home = () => process.env.SHADOW_WORKFLOW_HOME || homedir()
// 描述符里 ~ 开头的 skillsDir 相对宿主 home 解析；SHADOW_WORKFLOW_HOME 供测试/隔离覆盖
const skillsDirOf = adapter => adapter.skillsDir.replace(/^~(?=\/|$)/, home())
const verOf = root => { try { return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version } catch { return null } }

export function loadAdapters(root) {
  const dir = join(root, 'adapters')
  if (!existsSync(dir)) throw err('ADAPTERS_MISSING', 'ADAPTERS_MISSING: artifact lacks adapters/ (needs a workflow release that ships descriptors)', 1)
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')))
}

const sidecarRead = dir => { try { return JSON.parse(readFileSync(join(dir, SIDECAR), 'utf8')) } catch { return null } }
const dirHash = d => createHash('sha256').update(readdirSync(d).sort().map(f => `${f}:${readFileSync(join(d, f), 'utf8')}`).join('\n')).digest('hex')

export function planData(_r, o) {
  const root = resolvedRoot(o)
  const adapters = loadAdapters(root)
  let selected = o.host && o.host !== 'auto' ? adapters.filter(a => a.host === o.host) : adapters
  if (o.host && o.host !== 'auto' && !selected.length) throw err('HOST_NOT_FOUND', `HOST_NOT_FOUND: no adapter for host "${o.host}"`, 1)
  if (!o.host || o.host === 'auto') selected = selected.filter(a => existsSync(skillsDirOf(a)))
  if (!selected.length) throw err('HOST_NOT_FOUND', 'HOST_NOT_FOUND: no supported host detected on this machine (adapters exist, but no skillsDir present)', 1)
  const hosts = selected.map(a => {
    const dir = skillsDirOf(a)
    const sidecar = sidecarRead(dir)
    const entries = readdirSync(join(root, 'skills')).filter(s => existsSync(join(root, 'skills', s))).sort().map(skill => {
      const exists = existsSync(join(dir, skill))
      const managed = !!(sidecar && sidecar.skills && sidecar.skills[skill])
      return { skill, target: join(dir, skill), exists, managed, blocked: exists && !managed }
    })
    return { host: a.host, tier: a.tier || null, skillsDir: dir, sidecar: !!sidecar, entries }
  })
  return { action: 'bind', artifactRoot: root, version: verOf(root), hosts }
}

export function executeDomain(o) {
  confirm(o)
  const e = plan('bind', planData(null, o))
  if (!o['plan-hash']) throw err('PLAN_HASH_REQUIRED', 'PLAN_HASH_REQUIRED: run `shadow-dev bind plan` first or pass --plan-hash', 2)
  if (o['plan-hash'] !== e.planHash) throw err('PLAN_HASH_INVALID')
  const x = e.data
  const blocked = x.hosts.flatMap(h => h.entries.filter(t => t.blocked).map(t => `${h.host}:${t.skill}`))
  if (blocked.length) throw err('UNMANAGED_TARGET', `UNMANAGED_TARGET: refusing to overwrite unmanaged skill dirs (${blocked.join(', ')}); remove or rename them first`, 1)
  const bound = []
  for (const h of x.hosts) {
    mkdirSync(h.skillsDir, { recursive: true })
    const skills = {}
    for (const t of h.entries) {
      rmSync(t.target, { recursive: true, force: true })
      cpSync(join(x.artifactRoot, 'skills', t.skill), t.target, { recursive: true })
      skills[t.skill] = { hash: dirHash(t.target) }
      bound.push(`${h.host}:${t.skill}`)
    }
    writeFileSync(join(h.skillsDir, SIDECAR), JSON.stringify({ schema: 'shadow-dev-bind/v1', marker: 'managed-by: shadow-dev-workflow', version: x.version, skills }, null, 2))
  }
  return { action: 'bind', bound }
}

export function unbindDomain(o) {
  confirm(o)
  if (!o.host || o.host === 'auto') throw err('HOST_REQUIRED', 'HOST_REQUIRED: pass --host <name> for unbind', 1)
  const root = resolvedRoot(o)
  const adapter = loadAdapters(root).find(a => a.host === o.host)
  if (!adapter) throw err('HOST_NOT_FOUND', `HOST_NOT_FOUND: no adapter for host "${o.host}"`, 1)
  const dir = skillsDirOf(adapter)
  const sidecar = sidecarRead(dir)
  if (!sidecar || !sidecar.skills || !Object.keys(sidecar.skills).length) throw err('NOTHING_TO_UNBIND', `NOTHING_TO_UNBIND: no shadow-dev-workflow managed skills under ${dir}`, 1)
  const removed = Object.keys(sidecar.skills)
  for (const skill of removed) rmSync(join(dir, skill), { recursive: true, force: true })
  rmSync(join(dir, SIDECAR), { force: true })
  return { action: 'unbind', host: o.host, removed }
}

export function statusDomain(o) {
  let root = null
  try { root = resolvedRoot(o) } catch { return { installed: false, hosts: [] } }
  const hosts = loadAdapters(root).map(a => {
    const dir = skillsDirOf(a)
    const sidecar = sidecarRead(dir)
    return { host: a.host, tier: a.tier || null, skillsDir: dir, present: existsSync(dir), managed: sidecar && sidecar.skills ? Object.keys(sidecar.skills) : [] }
  })
  return { installed: true, artifactRoot: root, version: verOf(root), hosts }
}

export async function handle(a, o) {
  if (a === 'plan') return plan('bind', planData(null, o))
  if (a === 'execute') return { ok: true, command: 'bind.execute', data: executeDomain(o) }
  if (a === 'status') return { ok: true, command: 'bind.status', data: statusDomain(o) }
  if (a === 'unbind') return { ok: true, command: 'bind.unbind', data: unbindDomain(o) }
  throw err('UNKNOWN_COMMAND', `unsupported command: bind ${a}`)
}
