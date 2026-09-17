#!/usr/bin/env node
import { args, HELP } from './lib/args.mjs'
import { out, fail } from './lib/output.mjs'
import { plan } from './lib/plan.mjs'
import { root } from './lib/git.mjs'
import { brief, write } from './lib/brief.mjs'
import { confirm, name } from './lib/input.mjs'
import { err } from './lib/errors.mjs'
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
  if (b.data.workflow.planHash !== e.planHash) throw err(b.data.workflow.planHash ? 'PLAN_HASH_INVALID' : 'PLAN_HASH_REQUIRED', b.data.workflow.planHash ? 'PLAN_HASH_INVALID' : 'PLAN_HASH_REQUIRED', b.data.workflow.planHash ? 1 : 2)
  return mod.execute(r, o, e.data, b)
}

async function planDomain(c, mod, r, o) {
  const e = plan(c, await mod.planData(r, o))
  if (!o.name) return e
  const b = brief(r, name(o))
  b.data.workflow.planHash = e.planHash
  mod.persistPlan?.(b, e)
  write(b)
  return e
}

async function handle(r, p, o) {
  const [d, a, s] = p
  if (!d || d === 'help') return out({ ok: true, command: 'help', data: HELP })
  if (d === 'repo' && a === 'inspect') return out({ ok: true, command: 'repo.inspect', data: inspect.repoState(r) })
  if (d === 'pr' && a === 'inspect') return out({ ok: true, command: 'pr.inspect', data: await inspect.pullRequest(r, o) })
  if (d === 'conflict' && a === 'inspect') return out({ ok: true, command: 'conflict.inspect', data: inspect.conflict(r, o) })
  if (d === 'task' && a === 'list') return out({ ok: true, command: 'task.list', data: task.list(r, o) })
  if (d === 'task' && a === 'set') return out({ ok: true, command: 'task.set', data: task.set(r, o) })
  if (d === 'change' && a === 'create') return out({ ok: true, command: 'change.create', data: change.create(r, o) })
  if (d === 'change' && a === 'approve') return out({ ok: true, command: 'change.approve', data: change.approve(r, o) })
  if (Object.hasOwn(DOMAINS, d)) {
    const verb = a === 'rebuild' ? s : a, c = a === 'rebuild' ? `${d}.rebuild` : d
    if (verb === 'plan') return out(await planDomain(c, DOMAINS[d], r, o))
    if (verb === 'execute') return out({ ok: true, command: `${c}.execute`, data: await executeDomain(c, DOMAINS[d], r, o) })
  }
  return fail('UNKNOWN_COMMAND', `unsupported command: ${p.join(' ')}`)
}

try {
  const { p, o } = args(process.argv.slice(2))
  if (p.includes('--help') || !p.length) out({ ok: true, command: 'help', data: HELP })
  else await handle(root(), p, o)
} catch (e) {
  fail(e.code || e.message, e.message, e.status || 1)
}
