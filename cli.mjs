#!/usr/bin/env node
import { args } from './lib/args.mjs'
import { out, fail, jsonEnabled } from './lib/output.mjs'
import { plan } from './lib/plan.mjs'
import { root } from './lib/git.mjs'
import { brief, write } from './lib/brief.mjs'
import { confirm, name } from './lib/input.mjs'
import { err } from './lib/errors.mjs'
import { resolveLang } from './lib/i18n.mjs'
import { HELP, COMMANDS } from './lib/commands.mjs'
import { VERSION } from './lib/version.mjs'
import * as human from './lib/human.mjs'
import * as branch from './lib/domains/branch.mjs'
import * as sync from './lib/domains/sync.mjs'
import * as review from './lib/domains/review.mjs'
import * as commit from './lib/domains/commit.mjs'
import * as publish from './lib/domains/publish.mjs'
import * as release from './lib/domains/release.mjs'
import * as reconcile from './lib/domains/reconcile.mjs'
import * as archive from './lib/domains/archive.mjs'
import * as issue from './lib/domains/issue.mjs'
import * as change from './lib/domains/change.mjs'
import * as task from './lib/domains/task.mjs'
import * as inspect from './lib/domains/inspect.mjs'
import * as index from './lib/domains/index.mjs'
import * as workflow from './lib/domains/workflow.mjs'
import * as bind from './lib/domains/bind.mjs'

const DOMAINS = { branch, sync, review, commit, publish, release, reconcile, archive, issue, index }

// execute 与 plan 用同一 planData 重算并对比 hash。带 --name 的域以 brief 里的 planHash 为前置凭证；
// 无 brief 的域（如 index rebuild）--plan-hash 是唯一凭证
async function executeDomain(c, mod, r, o) {
  confirm(o)
  const e = plan(c, await mod.planData(r, o))
  if (o['plan-hash'] && o['plan-hash'] !== e.planHash) throw err('PLAN_HASH_INVALID')
  if (!o.name) {
    if (!o['plan-hash']) throw err('PLAN_HASH_REQUIRED', 'PLAN_HASH_REQUIRED', 2)
    return mod.execute(r, o, e.data)
  }
  const b = brief(r, name(o))
  if (b.data.workflow.planHash !== e.planHash) {
    const stale = !!b.data.workflow.planHash
    throw err(stale ? 'PLAN_HASH_INVALID' : 'PLAN_HASH_REQUIRED', stale ? 'PLAN_HASH_INVALID' : 'PLAN_HASH_REQUIRED', stale ? 1 : 2)
  }
  return mod.execute(r, o, e.data, b)
}

// 域可导出 present(x) 声明 stdout data 的最小投影（哈希/持久化仍用完整 planData）；缺省恒等
async function planDomain(c, mod, r, o) {
  const e = plan(c, await mod.planData(r, o))
  const view = mod.present ? { ...e, data: mod.present(e.data) } : e
  if (!o.name) return view
  const b = brief(r, name(o))
  b.data.workflow.planHash = e.planHash
  mod.persistPlan?.(b, e)
  write(b)
  return view
}

// 概览默认最小面（data.help 恒字符串）；结构化目录经 --full opt-in；组详情恒定返回该组 commands
function helpEnvelope(p, o) {
  const g = p[1]
  if (!g) return { ok: true, command: 'help', data: o.full ? { help: HELP, commands: COMMANDS } : { help: HELP } }
  const commands = Object.fromEntries(Object.entries(COMMANDS).filter(([k]) => k === g || k.startsWith(g + '.')))
  if (!Object.keys(commands).length) throw err('UNKNOWN_COMMAND', `unsupported command: help ${g}`)
  return { ok: true, command: `help.${g}`, data: { help: Object.values(commands).map(e => e.usage).join('\n'), commands } }
}

async function handle(r, p, o) {
  const [d, a, s] = p
  if (d === 'repo' && a === 'inspect') return { ok: true, command: 'repo.inspect', data: inspect.repoState(r) }
  if (d === 'pr' && a === 'inspect') return { ok: true, command: 'pr.inspect', data: await inspect.pullRequest(r, o) }
  if (d === 'conflict' && a === 'inspect') return { ok: true, command: 'conflict.inspect', data: inspect.conflict(r, o) }
  if (d === 'task' && a === 'list') return { ok: true, command: 'task.list', data: task.list(r, o) }
  if (d === 'task' && a === 'set') return { ok: true, command: 'task.set', data: task.set(r, o) }
  if (d === 'change' && a === 'create') return { ok: true, command: 'change.create', data: change.create(r, o) }
  if (d === 'change' && a === 'approve') return { ok: true, command: 'change.approve', data: change.approve(r, o) }
  if (d === 'change' && a === 'list') return { ok: true, command: 'change.list', data: change.list(r, o) }
  // 生态分发域：宿主无关、不要求 git 仓库，r 允许为 null
  if (d === 'workflow') return await workflow.handle(a, o)
  if (d === 'bind') return await bind.handle(a, o)
  if (Object.hasOwn(DOMAINS, d)) {
    const verb = a === 'rebuild' ? s : a, c = a === 'rebuild' ? `${d}.rebuild` : d
    if (verb === 'plan') return await planDomain(c, DOMAINS[d], r, o)
    if (verb === 'execute') return { ok: true, command: `${c}.execute`, data: await executeDomain(c, DOMAINS[d], r, o) }
  }
  throw err('UNKNOWN_COMMAND', `unsupported command: ${p.join(' ')}`)
}

// stdout 恒为单行 JSON 契约；进出场横幅、错误解释、help 人读版只写 stderr（见 lib/human.mjs）
let p = [], o = {}, L = 'zh'
try {
  const parsed = args(process.argv.slice(2))
  p = parsed.p; o = parsed.o
  L = resolveLang(o)
  const helpMode = !p.length || p.includes('--help') || p[0] === 'help'
  // 元命令 version 与 help 同类：不要求 git 仓库，在 root() 之前拦截；--version 先于 help 判定
  const versionMode = p[0] === 'version' && p.length === 1 || ('version' in o && !p.length)
  const t0 = Date.now()
  let v
  if (versionMode) {
    v = { ok: true, command: 'version', data: { version: VERSION } }
    human.printVersion(L, VERSION)
  } else if (helpMode) {
    v = helpEnvelope(p, o)
    human.printHelp(L, v)
  } else {
    human.enter(L, p)
    v = human.decorate(await handle(p[0] === 'workflow' || p[0] === 'bind' ? null : root(), p, o), o)
    human.done(L, v, Date.now() - t0)
  }
  if (jsonEnabled(o)) out(v)
} catch (e) {
  human.error(L, e, p, o)
  if (jsonEnabled(o)) fail(e.code || e.message, e.message, e.status || 1)
  else process.exitCode = e.status || 1
}
