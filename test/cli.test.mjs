import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const CLI = fileURLToPath(new URL('../cli.mjs', import.meta.url))

function run(args, cwd = process.cwd(), env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

function updateBrief(root, update) {
  const path = join(root, 'shadow-docs', 'changes', 'sample', 'brief.md')
  const text = readFileSync(path, 'utf8')
  const end = text.indexOf('\n---\n', 4)
  const data = JSON.parse(text.slice(4, end))
  update(data)
  writeFileSync(path, `---\n${JSON.stringify(data, null, 2)}\n---\n${text.slice(end + 5)}`)
}

function apiStub(rules) {
  const root = mkdtempSync(join(tmpdir(), 'shadow-api-'))
  const script = join(root, 'server.mjs')
  const portFile = join(root, 'port')
  const logFile = join(root, 'requests.log')
  writeFileSync(script, `
import http from 'node:http'
import { appendFileSync, writeFileSync } from 'node:fs'
const rules = JSON.parse(process.env.RULES)
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    appendFileSync(process.env.LOG_FILE, JSON.stringify({ method: req.method, url: req.url, body }) + '\\n')
    const rule = rules.find(item => item.method === req.method && req.url.startsWith(item.path)) || { status: 404, body: { message: 'not found' } }
    res.writeHead(rule.status || 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(rule.body))
  })
})
server.listen(0, '127.0.0.1', () => writeFileSync(process.env.PORT_FILE, String(server.address().port)))
`)
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, RULES: JSON.stringify(rules), PORT_FILE: portFile, LOG_FILE: logFile },
    stdio: 'ignore',
  })
  for (let i = 0; i < 100 && !existsSync(portFile); i += 1) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
  if (!existsSync(portFile)) throw new Error('API stub did not start')
  return {
    url: `http://127.0.0.1:${readFileSync(portFile, 'utf8')}`,
    requests: () => existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [],
    close: () => child.kill(),
  }
}

function addOrigin(root) {
  const remote = mkdtempSync(join(tmpdir(), 'shadow-remote-'))
  execFileSync('git', ['init', '--bare', '-b', 'main'], { cwd: remote })
  execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: root })
  execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd: root })
  return remote
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'shadow-dev-'))
  execFileSync('git', ['init', '-b', 'main'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root })
  writeFileSync(join(root, 'README.md'), '# fixture\n')
  execFileSync('git', ['add', '--', 'README.md'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root })
  mkdirSync(join(root, 'shadow-docs', 'changes', 'sample'), { recursive: true })
  writeFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), `---
{
  "schema": "shadow-dev/v1",
  "name": "sample",
  "type": "feat",
  "scope": "core",
  "status": "draft",
  "baseBranch": "main",
  "branch": null,
  "files": ["src/example.js"],
  "github": {"repository": null, "issue": null, "issueUrl": null, "pullRequest": null, "pullRequestUrl": null},
  "review": {"conclusion": "pending", "verifiedCommit": null, "verifiedAt": null},
  "workflow": {"operation": null, "checkpoint": null, "planHash": null, "updatedAt": null, "lastError": null}
}
---

# Sample

## 任务

### Phase 1
- [ ] task-1 — \`src/example.js\` — implement
`)
  return root
}

test('help lists deterministic workflow commands', () => {
  const result = run(['--help'])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /repo inspect/)
  assert.match(result.stdout, /reconcile plan/)
  assert.match(result.stdout, /archive plan\|execute/)
})

test('version returns the package version without a git repository', () => {
  const expected = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  const outside = run(['version', '--json'], tmpdir())
  assert.equal(outside.status, 0, outside.stderr)
  const o = JSON.parse(outside.stdout)
  assert.equal(o.ok, true)
  assert.equal(o.command, 'version')
  assert.equal(o.data.version, expected)
  // 仓库内同样可用
  const root = fixture()
  assert.equal(JSON.parse(run(['version', '--json'], root).stdout).data.version, expected)
  // --version 别名与 help 目录行
  assert.equal(JSON.parse(run(['--version', '--json'], tmpdir()).stdout).data.version, expected)
  assert.match(JSON.parse(run(['--help']).stdout).data.help, /^version\n/)
  assert.match(JSON.parse(run(['help', 'version', '--json']).stdout).data.commands.version.usage, /^version$/)
})

test('version stdout is language-invariant while human line localizes', () => {
  const zh = run(['version', '--json', '--lang', 'zh'], tmpdir())
  const en = run(['version', '--json', '--lang', 'en'], tmpdir())
  assert.equal(JSON.stringify(JSON.parse(zh.stdout)), JSON.stringify(JSON.parse(en.stdout)))
  assert.match(zh.stderr, /版本/)
  assert.match(en.stderr, /version/)
})

test('unknown commands return a stable JSON error', () => {
  const result = run(['unknown', '--json'])
  assert.equal(result.status, 1)
  const output = JSON.parse(result.stdout)
  assert.equal(output.ok, false)
  assert.equal(output.error.code, 'UNKNOWN_COMMAND')
})

test('repo inspect returns repository state', () => {
  const root = fixture()
  const result = run(['repo', 'inspect', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.ok, true)
  assert.equal(output.command, 'repo.inspect')
  assert.equal(output.data.branch, 'main')
  assert.equal(output.data.clean, false)
})

test('task set requires explicit confirmation', () => {
  const root = fixture()
  const result = run(['task', 'set', '--name', 'sample', '--task', 'task-1', '--state', 'done', '--json'], root)
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).error.code, 'CONFIRMATION_REQUIRED')
})

test('task set updates the checkbox through the CLI', () => {
  const root = fixture()
  const result = run(['task', 'set', '--name', 'sample', '--task', 'task-1', '--state', 'done', '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  const brief = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
  assert.match(brief, /- \[x\] task-1/)
})

test('index rebuild plan is stable', () => {
  const root = fixture()
  const first = run(['index', 'rebuild', 'plan', '--json'], root)
  const second = run(['index', 'rebuild', 'plan', '--json'], root)
  assert.equal(first.status, 0, first.stderr)
  assert.equal(second.status, 0, second.stderr)
  assert.equal(JSON.parse(first.stdout).planHash, JSON.parse(second.stdout).planHash)
})

test('change create creates a deterministic brief and rejects duplicates', () => {
  const root = fixture()
  const result = run(['change', 'create', '--name', 'new-change', '--type', 'fix', '--scope', 'cli', '--files', 'scripts/a.mjs,test/a.test.mjs', '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  const brief = readFileSync(join(root, 'shadow-docs', 'changes', 'new-change', 'brief.md'), 'utf8')
  assert.match(brief, /"name": "new-change"/)
  assert.equal(run(['change', 'create', '--name', 'new-change', '--confirm', '--json'], root).status, 1)
})

test('change approve transitions draft to proposed', () => {
  const root = fixture()
  const result = run(['change', 'approve', '--name', 'sample', '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.match(readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8'), /"status": "proposed"/)
})

test('change list enumerates active briefs and skips archive and unreadable dirs', () => {
  const root = fixture()
  const result = run(['change', 'list'], root)
  assert.equal(result.status, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.command, 'change.list')
  assert.deepEqual(payload.data.changes, [{ name: 'sample', type: 'feat', status: 'draft', branch: null, archived: false }])
  mkdirSync(join(root, 'shadow-docs', 'changes', 'archive', 'old'), { recursive: true })
  writeFileSync(join(root, 'shadow-docs', 'changes', 'archive', 'old', 'brief.md'), '---\n{"schema":"shadow-dev/v1","name":"old","type":"feat","status":"archived"}\n---\nbody\n')
  mkdirSync(join(root, 'shadow-docs', 'changes', 'broken'), { recursive: true })
  const second = JSON.parse(run(['change', 'list'], root).stdout)
  assert.deepEqual(second.data.changes, [{ name: 'sample', type: 'feat', status: 'draft', branch: null, archived: false }])
})

test('change list --all merges active and archived; --archived scopes to archive', () => {
  const root = fixture()
  mkdirSync(join(root, 'shadow-docs', 'changes', 'archive', 'aaa-old'), { recursive: true })
  writeFileSync(join(root, 'shadow-docs', 'changes', 'archive', 'aaa-old', 'brief.md'), '---\n{"schema":"shadow-dev/v1","name":"aaa-old","type":"feat","status":"archived","branch":null}\n---\nbody\n')
  mkdirSync(join(root, 'shadow-docs', 'changes', 'archive', 'broken'), { recursive: true })
  const both = JSON.parse(run(['change', 'list', '--all'], root).stdout)
  assert.deepEqual(both.data.changes, [
    { name: 'aaa-old', type: 'feat', status: 'archived', branch: null, archived: true },
    { name: 'sample', type: 'feat', status: 'draft', branch: null, archived: false },
  ])
  const only = JSON.parse(run(['change', 'list', '--archived'], root).stdout)
  assert.deepEqual(only.data.changes, [{ name: 'aaa-old', type: 'feat', status: 'archived', branch: null, archived: true }])
  const superset = JSON.parse(run(['change', 'list', '--all', '--archived'], root).stdout)
  assert.deepEqual(superset.data.changes, both.data.changes, 'passing both flags behaves as --all')
})

test('task list exposes stable task identifiers', () => {
  const root = fixture()
  const result = run(['task', 'list', '--name', 'sample', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).data.tasks, [{ id: 'task-1', done: false, text: 'task-1 — `src/example.js` — implement' }])
})

test('file lists normalize Windows backslash separators', () => {
  const root = fixture()
  const created = run(['change', 'create', '--name', 'backslash', '--type', 'fix', '--files', 'lib\\a.js,src\\example.js', '--confirm', '--json'], root)
  assert.equal(created.status, 0, created.stderr)
  const text = readFileSync(join(root, 'shadow-docs', 'changes', 'backslash', 'brief.md'), 'utf8')
  assert.match(text, /"lib\/a.js",\s*"src\/example.js"/)
  const conflict = run(['conflict', 'inspect', '--name', 'sample', '--json'], root)
  assert.equal(conflict.status, 0, conflict.stderr)
  assert.deepEqual(JSON.parse(conflict.stdout).data.overlaps, [{ change: 'backslash', files: ['src/example.js'] }])
})

test('plan to execute survives the clean-tree write of planHash', () => {
  const root = fixture()
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  const planned = run(['branch', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const result = run(['branch', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root)
  assert.equal(result.status, 0, JSON.parse(result.stdout).error?.message)
})

test('porcelain first-line status keeps the full path in changed files', () => {
  const root = fixture()
  writeFileSync(join(root, 'README.md'), '# changed\n')
  const result = run(['repo', 'inspect', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.ok(JSON.parse(result.stdout).data.changedFiles.includes('README.md'))
})

test('human layer: banners and hints on stderr, stdout contract language-invariant', () => {
  const root = fixture()
  const zh = run(['task', 'list', '--name', 'sample', '--lang', 'zh'], root)
  const en = run(['task', 'list', '--name', 'sample', '--lang', 'en'], root)
  assert.equal(zh.status, 0, zh.stderr)
  assert.equal(zh.stdout, en.stdout, 'stdout JSON must be byte-identical across languages')
  assert.match(zh.stderr, /进场|完成/)
  assert.match(en.stderr, /enter|done/i)
})

test('validation errors carry localized usage hints on stderr', () => {
  const result = run(['task', 'set', '--state', 'done', '--confirm'], fixture())
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).error.code, 'NAME_REQUIRED')
  assert.match(result.stderr, /--name/)
})

test('missing required args render from the command catalog on stderr', () => {
  const root = fixture()
  const zh = run(['task', 'list', '--lang', 'zh'], root)
  assert.equal(zh.status, 1)
  const machine = JSON.parse(zh.stdout).error
  assert.equal(machine.code, 'NAME_REQUIRED')
  assert.equal(machine.message, 'NAME_REQUIRED: pass --name <change-name>, e.g. --name 20260917-feature-x', 'stdout machine message is frozen')
  assert.match(zh.stderr, /--name \* 变更名（shadow-docs\/changes\/ 下的子目录，如 20260917-feature-x）/)
  assert.match(zh.stderr, /示例: shadow-dev task list --name <change-name>/)
  const en = run(['task', 'list', '--lang', 'en'], root)
  assert.equal(zh.stdout, en.stdout, 'machine contract stays language-invariant')
  assert.match(en.stderr, /--name \* change name \(subdirectory under shadow-docs\/changes\/, e\.g\. 20260917-feature-x\)/)
  const multi = run(['task', 'set', '--name', 'sample', '--lang', 'zh'], root)
  assert.match(multi.stderr, /--task \* 任务 id，如 task-3/)
  assert.match(multi.stderr, /--state \* todo\|done/)
  assert.match(multi.stderr, /--confirm \* 写操作显式确认/)
})

test('mutating results carry a stable untranslated nextStep in JSON', () => {
  const root = fixture()
  const zh = run(['change', 'approve', '--name', 'sample', '--confirm', '--lang', 'zh'], root)
  const en = run(['change', 'approve', '--name', 'sample', '--confirm', '--lang', 'en'], root)
  assert.equal(zh.status, 0, zh.stderr)
  assert.equal(JSON.parse(zh.stdout).data.nextStep, 'branch plan --name sample')
  assert.equal(JSON.parse(zh.stdout).data.nextStep, JSON.parse(en.stdout).data.nextStep)
  assert.match(en.stderr, /next/i)
})

function runTty(args, cwd = process.cwd(), env = {}) {
  const url = String(new URL('../cli.mjs', import.meta.url))
  const script = `process.stdout.isTTY = true; process.argv = [process.execPath, ${JSON.stringify(CLI)}, ${args.map(a => JSON.stringify(String(a))).join(', ')}]; await import(${JSON.stringify(url)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
}

test('jsonEnabled routes the JSON surface by environment and explicit flags', async () => {
  const { jsonEnabled } = await import('../lib/output.mjs')
  const tty = process.stdout.isTTY, env = process.env.SHADOW_DEV_JSON
  try {
    process.stdout.isTTY = false
    assert.equal(jsonEnabled({}), true, 'pipe default emits JSON')
    assert.equal(jsonEnabled({ json: true }), true)
    process.stdout.isTTY = true
    assert.equal(jsonEnabled({}), false, 'TTY default suppresses JSON')
    assert.equal(jsonEnabled({ json: true }), true, '--json forces JSON on TTY')
    process.stdout.isTTY = undefined
    process.env.SHADOW_DEV_JSON = '1'
    assert.equal(jsonEnabled({}), true, 'env override forces JSON')
  } finally {
    process.stdout.isTTY = tty
    if (env === undefined) delete process.env.SHADOW_DEV_JSON; else process.env.SHADOW_DEV_JSON = env
  }
})

test('TTY suppresses stdout JSON; --json and env restore it; planHash surfaces on stderr', () => {
  // 中文通道断言必须显式钉语言：CI runner locale（mac/windows 为 en）经语言链探测会渲染英文，禁止隐式依赖机器环境
  const plain = runTty(['--help'], process.cwd(), { SHADOW_DEV_LANG: 'zh' })
  assert.equal(plain.status, 0, plain.stderr)
  assert.equal(plain.stdout.trim(), '', 'interactive help must not print JSON')
  assert.match(plain.stderr, /shadow-dev 命令一览/)
  const forced = runTty(['--help', '--json'])
  assert.equal(JSON.parse(forced.stdout).command, 'help')
  const root = fixture()
  assert.equal(JSON.parse(runTty(['repo', 'inspect'], root, { SHADOW_DEV_JSON: '1' }).stdout).command, 'repo.inspect')
  const planned = runTty(['branch', 'plan', '--name', 'sample'], root)
  assert.equal(planned.stdout.trim(), '')
  assert.match(planned.stderr, /planHash: [0-9a-f]{64}/)
  const bogus = runTty(['bogus'], root)
  assert.equal(bogus.status, 1)
  assert.equal(bogus.stdout.trim(), '', 'suppressed errors still exit nonzero without printing')
})

test('help defaults to a compact summary; --full adds the structured catalog', () => {
  const overview = run(['help', '--lang', 'zh'])
  const data = JSON.parse(overview.stdout).data
  assert.equal(typeof data.help, 'string')
  assert.match(data.help, /repo inspect/)
  assert.equal(data.commands, undefined, 'default overview must not embed the full catalog')
  assert.ok(overview.stdout.length < 1024, 'compact overview stdout stays small')
  const full = JSON.parse(run(['help', '--full', '--lang', 'zh']).stdout).data
  assert.equal(full.commands['branch.execute'].usage, 'branch execute')
  assert.deepEqual(Object.keys(full.commands['change.create'].summary).sort(), ['en', 'zh'])
  const detail = JSON.parse(run(['help', 'branch']).stdout)
  assert.equal(detail.command, 'help.branch')
  assert.ok(detail.data.commands['branch.plan'])
  assert.equal(overview.stdout, run(['help', '--lang', 'en']).stdout)
})

test('SHADOW_DEV_QUIET silences the human channel', () => {
  const result = run(['repo', 'inspect', '--lang', 'en'], fixture(), { SHADOW_DEV_QUIET: '1' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
})

test('unknown commands keep stable code with localized stderr', () => {
  const zh = run(['bogus', '--lang', 'zh'], fixture())
  const en = run(['bogus', '--lang', 'en'], fixture())
  assert.equal(JSON.parse(zh.stdout).error.code, 'UNKNOWN_COMMAND')
  assert.equal(zh.stdout, en.stdout)
  assert.match(zh.stderr, /help/)
})

test('invalid --lang is rejected with a usage hint', () => {
  const result = run(['help', '--lang', 'fr'])
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).error.code, 'INVALID_LANG')
})

test('changed files resolve renamed porcelain entries to the new path', () => {
  const root = fixture()
  execFileSync('git', ['mv', 'README.md', 'DOCS.md'], { cwd: root })
  const result = run(['repo', 'inspect', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).data.changedFiles, ['DOCS.md', 'shadow-docs/'])
})

test('brief parsing tolerates CRLF and writes back LF', () => {
  const root = fixture()
  const path = join(root, 'shadow-docs', 'changes', 'sample', 'brief.md')
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\n', '\r\n'))
  const listed = run(['task', 'list', '--name', 'sample', '--json'], root)
  assert.equal(listed.status, 0, listed.stderr)
  assert.deepEqual(JSON.parse(listed.stdout).data.tasks, [{ id: 'task-1', done: false, text: 'task-1 — `src/example.js` — implement' }])
  const set = run(['task', 'set', '--name', 'sample', '--task', 'task-1', '--state', 'done', '--confirm', '--json'], root)
  assert.equal(set.status, 0, set.stderr)
  const raw = readFileSync(path, 'utf8')
  assert.ok(!raw.includes('\r'), 'rewritten brief is LF-normalized')
  assert.match(raw, /- \[x\] task-1/)
})

test('mutating execute commands require confirmation', () => {
  const root = fixture()
  for (const args of [['branch'], ['sync'], ['review'], ['commit'], ['publish'], ['release'], ['reconcile'], ['archive']]) {
    const result = run([...args, 'execute', '--json'], root)
    assert.equal(result.status, 2)
    assert.equal(JSON.parse(result.stdout).error.code, 'CONFIRMATION_REQUIRED')
  }
})

test('branch plan is stable and execute validates its hash', () => {
  const root = fixture()
  const first = run(['branch', 'plan', '--name', 'sample', '--json'], root)
  const second = run(['branch', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(first.status, 0, first.stderr)
  assert.equal(JSON.parse(first.stdout).planHash, JSON.parse(second.stdout).planHash)
  assert.equal(run(['branch', 'execute', '--name', 'sample', '--plan-hash', 'wrong', '--confirm', '--json'], root).status, 1)
  const hash = JSON.parse(first.stdout).planHash
  const result = run(['branch', 'execute', '--name', 'sample', '--plan-hash', hash, '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.match(readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8'), /"status": "branched"/)
})

test('reconcile derives implemented after all tasks are done', () => {
  const root = fixture()
  run(['task', 'set', '--name', 'sample', '--task', 'task-1', '--state', 'done', '--confirm', '--json'], root)
  const planned = run(['reconcile', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  assert.equal(JSON.parse(planned.stdout).data.nextStatus, 'implemented')
  const hash = JSON.parse(planned.stdout).planHash
  const result = run(['reconcile', 'execute', '--name', 'sample', '--plan-hash', hash, '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
})

test('commit uses only explicit files and rejects stale plans', () => {
  const root = fixture()
  writeFileSync(join(root, 'README.md'), '# changed\n')
  const planned = run(['commit', 'plan', '--name', 'sample', '--files', 'README.md', '--message', 'docs: update readme', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const hash = JSON.parse(planned.stdout).planHash
  const stale = run(['commit', 'execute', '--name', 'sample', '--files', 'README.md', '--message', 'docs: changed message', '--plan-hash', hash, '--confirm', '--json'], root)
  assert.equal(stale.status, 1)
  assert.equal(JSON.parse(stale.stdout).error.code, 'PLAN_HASH_INVALID')
  const result = run(['commit', 'execute', '--name', 'sample', '--files', 'README.md', '--message', 'docs: update readme', '--plan-hash', hash, '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'docs: update readme')
})

test('conflict inspect reports overlapping active brief files', () => {
  const root = fixture()
  mkdirSync(join(root, 'shadow-docs', 'changes', 'other'), { recursive: true })
  const source = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8').replace('"name": "sample"', '"name": "other"')
  writeFileSync(join(root, 'shadow-docs', 'changes', 'other', 'brief.md'), source)
  const result = run(['conflict', 'inspect', '--name', 'sample', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).data.overlaps, [{ change: 'other', files: ['src/example.js'] }])
})

test('issue plan is stable and includes GitHub payload', () => {
  const root = fixture()
  execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:owner/repo.git'], { cwd: root })
  const args = ['issue', 'plan', '--name', 'sample', '--title', 'Feature', '--body', 'Details', '--json']
  const first = run(args, root)
  const second = run(args, root)
  assert.equal(first.status, 0, first.stderr)
  assert.equal(JSON.parse(first.stdout).planHash, JSON.parse(second.stdout).planHash)
  assert.equal(JSON.parse(first.stdout).data.title, '[feat] Feature')
  assert.equal(JSON.parse(first.stdout).data.repository, 'owner/repo')
})

const sha256hex = s => createHash('sha256').update(s, 'utf8').digest('hex')

test('issue renderer: deterministic skeleton, [type] prefix, supplement order and metadata channel', async () => {
  const { renderIssueBody } = await import('../lib/issue-render.mjs')
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const b = {
    data: { name: 'n1', type: 'feature', scope: 's1', status: 'proposed', baseBranch: 'main', branch: null },
    body: '# 标题一\r\n\r\n## 动机\r\nwhy\r\n\r\n## 任务\n- [ ] t1\n\n## 结果\ninternal only\n\n## 协调注意\ninternal only 2\n',
  }
  const first = renderIssueBody(b, {})
  assert.deepEqual(renderIssueBody(b, {}), first, 'same input must render byte-identical output')
  assert.equal(first.title, '[feature] 标题一')
  assert.deepEqual(first.sections, ['动机', '-引用规范', '-决策', '任务'])
  assert.ok(first.body.includes('## 动机\nwhy'), 'CRLF source must be normalized into the skeleton')
  assert.ok(first.body.includes('（brief 缺少该节）'), 'missing whitelist section gets placeholder')
  assert.ok(!first.body.includes('internal only'), 'non-whitelist sections are dropped')
  const meta = JSON.parse(first.body.match(/^<!-- shadow-dev:issue-metadata (.+) -->$/m)[1])
  assert.deepEqual(meta, { name: 'n1', type: 'feature', scope: 's1', status: 'proposed', branch: null, baseBranch: 'main', briefPath: 'shadow-docs/changes/n1/brief.md', cliVersion: version, prUrl: null, issueNumber: null })
  assert.match(first.body.trimEnd(), /-->$/, 'metadata comment is the last line')
  assert.equal(renderIssueBody(b, { titleRaw: '[feature] 标题一' }).title, '[feature] 标题一', 'prefix is idempotent')
  const s = renderIssueBody(b, { titleRaw: 'custom', supplement: 'extra note' })
  assert.equal(s.title, '[feature] custom')
  assert.ok(s.body.includes('## 补充\nextra note'))
  assert.ok(s.body.indexOf('## 补充') < s.body.indexOf('完整 brief：'), 'supplement sits before the brief pointer')
})

test('issue plan projects a lean summary; execute posts the rendered skeleton bound to bodySha256', () => {
  const root = fixture()
  execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:owner/repo.git'], { cwd: root })
  const api = apiStub([{ method: 'POST', path: '/repos/owner/repo/issues', body: { number: 7, html_url: 'https://github.test/issues/7' } }])
  try {
    const planned = run(['issue', 'plan', '--name', 'sample', '--labels', 'bug', '--json'], root)
    assert.equal(planned.status, 0, planned.stderr)
    const v = JSON.parse(planned.stdout)
    const d = v.data
    for (const heavy of ['body', 'brief', 'repo', 'titleRaw', 'supplement']) assert.ok(!(heavy in d), `projection must strip ${heavy}`)
    assert.match(d.nextStep, /^issue execute --name sample --plan-hash [0-9a-f]{64} --confirm$/)
    assert.equal(d.title, '[feat] Sample')
    assert.deepEqual(d.sections, ['-动机', '-引用规范', '-决策', '任务'])
    assert.equal(d.bodyBytes, d.bodyBytes | 0)
    const result = run(['issue', 'execute', '--name', 'sample', '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const post = JSON.parse(api.requests()[0].body)
    assert.equal(post.title, '[feat] Sample')
    assert.deepEqual(post.labels, ['bug'])
    assert.match(post.body, /^## 动机\n（brief 缺少该节）/)
    assert.ok(post.body.includes('shadow-dev:issue-metadata'))
    assert.equal(sha256hex(post.body), d.bodySha256, 'POSTed body must match the previewed hash')
    assert.equal(Buffer.byteLength(post.body), d.bodyBytes)
    const persisted = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
    assert.ok(persisted.includes('issuePlan'), 'full body persists in the brief snapshot')
  } finally { api.close() }
})

test('issue plan drifts when the brief body changes; re-plan refreshes the render', () => {
  const root = fixture()
  execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:owner/repo.git'], { cwd: root })
  const planned = run(['issue', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const v1 = JSON.parse(planned.stdout)
  const path = join(root, 'shadow-docs', 'changes', 'sample', 'brief.md')
  writeFileSync(path, readFileSync(path, 'utf8') + '\n## 动机\n补上的动机\n')
  const failed = run(['issue', 'execute', '--name', 'sample', '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: 'http://127.0.0.1:1' })
  assert.equal(failed.status, 1)
  assert.equal(JSON.parse(failed.stdout).error.code, 'PLAN_HASH_INVALID')
  const refreshed = run(['issue', 'plan', '--name', 'sample', '--json'], root)
  const v2 = JSON.parse(refreshed.stdout)
  assert.notEqual(v2.planHash, v1.planHash, 're-plan must produce a new credential')
  assert.notEqual(v2.data.bodySha256, v1.data.bodySha256)
  assert.ok(v2.data.sections.includes('动机'))
  assert.ok(v2.data.sections[0] === '动机')
})
test('unsupported explicit add forms return code 4', () => {
  const root = fixture()
  const planned = run(['commit', 'plan', '--name', 'sample', '--files', '.', '--message', 'bad', '--json'], root)
  const result = run(['commit', 'execute', '--name', 'sample', '--files', '.', '--message', 'bad', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root)
  assert.equal(result.status, 4)
})

test('sync fetches and fast-forwards only', () => {
  const root = fixture()
  const remote = addOrigin(root)
  const other = mkdtempSync(join(tmpdir(), 'shadow-other-'))
  execFileSync('git', ['clone', remote, other])
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: other })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: other })
  writeFileSync(join(other, 'remote.txt'), 'remote\n')
  execFileSync('git', ['add', '--', 'remote.txt'], { cwd: other })
  execFileSync('git', ['commit', '-m', 'remote'], { cwd: other })
  execFileSync('git', ['push', 'origin', 'main'], { cwd: other })
  const planned = run(['sync', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const result = run(['sync', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(join(root, 'remote.txt')), true)
})

test('sync blocks a dirty repository', () => {
  const root = fixture()
  addOrigin(root)
  writeFileSync(join(root, 'README.md'), '# dirty\n')
  const result = run(['sync', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).error.code, 'DIRTY_WORKTREE')
})

test('issue execute requires a token and performs one API request on failure', () => {
  const root = fixture()
  updateBrief(root, data => { data.github.repository = 'owner/repo' })
  const planned = run(['issue', 'plan', '--name', 'sample', '--title', 'Feature', '--body', 'Details', '--json'], root)
  const noToken = run(['issue', 'execute', '--name', 'sample', '--title', 'Feature', '--body', 'Details', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: '', GH_TOKEN: '' })
  assert.equal(noToken.status, 3)
  assert.equal(JSON.parse(noToken.stdout).error.code, 'GITHUB_TOKEN_REQUIRED')
  const api = apiStub([{ method: 'POST', path: '/repos/owner/repo/issues', status: 500, body: { message: 'failed' } }])
  try {
    const failed = run(['issue', 'execute', '--name', 'sample', '--title', 'Feature', '--body', 'Details', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(failed.status, 3)
    assert.equal(api.requests().length, 1)
  } finally { api.close() }
})

test('issue execute persists issue data', () => {
  const root = fixture()
  updateBrief(root, data => { data.github.repository = 'owner/repo' })
  const api = apiStub([{ method: 'POST', path: '/repos/owner/repo/issues', body: { number: 12, html_url: 'https://github.test/issues/12' } }])
  try {
    const args = ['--name', 'sample', '--title', 'Feature', '--body', 'Details']
    const planned = run(['issue', 'plan', ...args, '--json'], root)
    const result = run(['issue', 'execute', ...args, '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const brief = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
    assert.match(brief, /"issue": 12/)
    assert.match(brief, /"checkpoint": "issue:12"/)
  } finally { api.close() }
})

test('issue execute runs without params and derives the repository from origin', () => {
  const root = fixture()
  execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:owner/repo.git'], { cwd: root })
  const api = apiStub([{ method: 'POST', path: '/repos/owner/repo/issues', body: { number: 5, html_url: 'https://github.test/issues/5' } }])
  try {
    const planned = run(['issue', 'plan', '--name', 'sample', '--title', 'Feature', '--body', 'Details', '--labels', 'feat', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(planned.status, 0, planned.stderr)
    assert.equal(JSON.parse(planned.stdout).data.repository, 'owner/repo')
    const result = run(['issue', 'execute', '--name', 'sample', '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const brief = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
    assert.match(brief, /"issue": 5/)
    assert.match(brief, /"repository": "owner\/repo"/)
  } finally { api.close() }
})

test('change create imports a body file, base branch and repository', () => {
  const root = fixture()
  writeFileSync(join(root, 'body.md'), '# 导出\n\n## 动机\n测试\n')
  const result = run(['change', 'create', '--name', 'with-body', '--base-branch', 'develop', '--repository', 'acme/widget', '--body-file', 'body.md', '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  const brief = readFileSync(join(root, 'shadow-docs', 'changes', 'with-body', 'brief.md'), 'utf8')
  assert.match(brief, /"baseBranch": "develop"/)
  assert.match(brief, /"repository": "acme\/widget"/)
  assert.match(brief, /## 动机/)
})

test('pr inspect reads the brief repository and PR number', () => {
  const root = fixture()
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.github.pullRequest = 7 })
  const api = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls/7', body: { number: 7, state: 'open', merged: false } }])
  try {
    const result = run(['pr', 'inspect', '--name', 'sample', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).data.number, 7)
  } finally { api.close() }
})

test('publish pushes normally and creates a PR when none exists', () => {
  const root = fixture()
  addOrigin(root)
  execFileSync('git', ['switch', '-c', 'feat/sample'], { cwd: root })
  writeFileSync(join(root, 'feature.txt'), 'feature\n')
  execFileSync('git', ['add', '--', 'feature.txt'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'feature'], { cwd: root })
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.branch = 'feat/sample' })
  const api = apiStub([
    { method: 'GET', path: '/repos/owner/repo/pulls?', body: [] },
    { method: 'POST', path: '/repos/owner/repo/pulls', body: { number: 9, html_url: 'https://github.test/pulls/9' } },
  ])
  try {
    const args = ['--name', 'sample', '--title', 'Feature']
    const planned = run(['publish', 'plan', ...args, '--json'], root)
    const result = run(['publish', 'execute', ...args, '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(execFileSync('git', ['rev-parse', 'origin/feat/sample'], { cwd: root, encoding: 'utf8' }).trim(), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
    assert.match(readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8'), /"status": "published"/)
    assert.deepEqual(api.requests().map(request => request.method), ['GET', 'POST'])
  } finally { api.close() }
})

test('publish defaults the PR body to Closes #N when the brief has an issue', () => {
  const root = fixture()
  addOrigin(root)
  execFileSync('git', ['switch', '-c', 'feat/sample'], { cwd: root })
  writeFileSync(join(root, 'feature.txt'), 'feature\n')
  execFileSync('git', ['add', '--', 'feature.txt'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'feature'], { cwd: root })
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.branch = 'feat/sample'; data.github.issue = 5 })
  const api = apiStub([
    { method: 'GET', path: '/repos/owner/repo/pulls?', body: [] },
    { method: 'POST', path: '/repos/owner/repo/pulls', body: { number: 9, html_url: 'https://github.test/pulls/9' } },
  ])
  try {
    const args = ['--name', 'sample', '--title', 'Feature']
    const planned = run(['publish', 'plan', ...args, '--json'], root)
    const result = run(['publish', 'execute', ...args, '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const created = api.requests().find(request => request.method === 'POST')
    assert.match(JSON.parse(created.body).body, /Closes #5/)
  } finally { api.close() }
})

test('publish reuses an existing open PR', () => {
  const root = fixture()
  addOrigin(root)
  execFileSync('git', ['switch', '-c', 'feat/sample'], { cwd: root })
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.branch = 'feat/sample' })
  const api = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls?', body: [{ number: 9, html_url: 'https://github.test/pulls/9' }] }])
  try {
    const args = ['--name', 'sample']
    const planned = run(['publish', 'plan', ...args, '--json'], root)
    const result = run(['publish', 'execute', ...args, '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(api.requests().map(request => request.method), ['GET'])
  } finally { api.close() }
})

test('archive blocks an unmerged PR', () => {
  const root = fixture()
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.github.pullRequest = 7; data.review = { conclusion: 'passed', verifiedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), verifiedAt: 'now' } })
  const api = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls/7', body: { number: 7, merged: false } }])
  try {
    const result = run(['archive', 'plan', '--name', 'sample', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 1)
    assert.equal(JSON.parse(result.stdout).error.code, 'PR_NOT_MERGED')
  } finally { api.close() }
})

test('archive moves a reviewed brief after API merge proof and rebuilds index', () => {
  const root = fixture()
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.github.pullRequest = 7; data.review = { conclusion: 'passed', verifiedCommit: head, verifiedAt: 'now' } })
  const api = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls/7', body: { number: 7, merged: true, merged_at: 'now' } }])
  try {
    const env = { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url }
    const archive = run(['archive', 'plan', '--name', 'sample', '--json'], root, env)
    assert.equal(archive.status, 0, archive.stderr)
    const executed = run(['archive', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(archive.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(executed.status, 0, executed.stderr)
    assert.equal(existsSync(join(root, 'shadow-docs', 'changes', 'archive', 'sample', 'brief.md')), true)
    assert.match(readFileSync(join(root, 'shadow-docs', 'INDEX.md'), 'utf8'), /archive\/sample\/brief.md/)
  } finally { api.close() }
})

test('index rebuild execute validates the plan hash', () => {
  const root = fixture()
  const result = run(['index', 'rebuild', 'execute', '--plan-hash', 'wrong', '--confirm', '--json'], root)
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).error.code, 'PLAN_HASH_INVALID')
})

test('reconcile invalidates review when HEAD differs', () => {
  const root = fixture()
  updateBrief(root, data => { data.review = { conclusion: 'passed', verifiedCommit: 'deadbeef', verifiedAt: 'then' }; data.status = 'reviewed' })
  const planned = run(['reconcile', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(JSON.parse(planned.stdout).data.review.conclusion, 'pending')
  const executed = run(['reconcile', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root)
  assert.equal(executed.status, 0, executed.stderr)
})

test('review execute blocks when brief tasks are incomplete', () => {
  const root = fixture()
  const planned = run(['review', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const executed = run(['review', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--conclusion', 'passed', '--confirm', '--json'], root)
  assert.equal(executed.status, 1)
  assert.equal(JSON.parse(executed.stdout).error.code, 'TASKS_NOT_COMPLETE')
  const text = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
  assert.match(text, /"conclusion": "pending"/)
})

test('review execute passes when all brief tasks are done', () => {
  const root = fixture()
  run(['task', 'set', '--name', 'sample', '--task', 'task-1', '--state', 'done', '--confirm', '--json'], root)
  const planned = run(['review', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const executed = run(['review', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--conclusion', 'passed', '--confirm', '--json'], root)
  assert.equal(executed.status, 0, executed.stderr)
  const text = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
  assert.match(text, /"conclusion": "passed"/)
})

test('plan persists the hash so execute runs without copying it', () => {
  const root = fixture()
  const planned = run(['branch', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const result = run(['branch', 'execute', '--name', 'sample', '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  const text = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
  assert.match(text, /"planHash": "[0-9a-f]{64}"/)
  assert.match(text, /"status": "branched"/)
})

test('execute without a prior plan requires one', () => {
  const root = fixture()
  const result = run(['branch', 'execute', '--name', 'sample', '--confirm', '--json'], root)
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).error.code, 'PLAN_HASH_REQUIRED')
})

test('review execute persists the knowledge conclusion for release', () => {
  const root = fixture()
  run(['task', 'set', '--name', 'sample', '--task', 'task-1', '--state', 'done', '--confirm', '--json'], root)
  const planned = run(['review', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const executed = run(['review', 'execute', '--name', 'sample', '--conclusion', 'passed', '--knowledge', '更新', '--target', 'knowledge/ci.md', '--reason', '补充缓存策略', '--confirm', '--json'], root)
  assert.equal(executed.status, 0, executed.stderr)
  const text = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
  assert.match(text, /"action": "更新"/)
  assert.match(text, /"target": "knowledge\/ci\.md"/)
  assert.match(text, /"conclusion": "passed"/)
})

test('release execute commits, pushes and creates the PR in one step, then reuses it', () => {
  const root = fixture()
  const remote = addOrigin(root)
  execFileSync('git', ['switch', '-c', 'feat/sample'], { cwd: root })
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.branch = 'feat/sample'; data.status = 'reviewed'; data.review = { conclusion: 'passed', verifiedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), verifiedAt: 'now' } })
  const api = apiStub([
    { method: 'GET', path: '/repos/owner/repo/pulls?', body: [] },
    { method: 'POST', path: '/repos/owner/repo/pulls', body: { number: 9, html_url: 'https://github.test/pulls/9' } },
  ])
  try {
    const args = ['--name', 'sample', '--files', 'shadow-docs/changes/sample/brief.md', '--message', 'feat: sample', '--title', 'Sample PR']
    const planned = run(['release', 'plan', ...args, '--json'], root)
    assert.equal(planned.status, 0, planned.stderr)
    const result = run(['release', 'execute', '--name', 'sample', '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.data.number, 9)
    assert.equal(output.data.created, true)
    assert.equal(output.data.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
    assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'feat: sample')
    assert.equal(execFileSync('git', ['rev-parse', 'origin/feat/sample'], { cwd: root, encoding: 'utf8' }).trim(), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
    assert.match(readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8'), /"status": "published"/)
    assert.deepEqual(api.requests().map(request => request.method), ['GET', 'POST'])
  } finally { api.close() }
  const reuse = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls?', body: [{ number: 9, html_url: 'https://github.test/pulls/9' }] }])
  try {
    const replanned = run(['release', 'plan', '--name', 'sample', '--json'], root)
    assert.equal(replanned.status, 0, replanned.stderr)
    const rerun = run(['release', 'execute', '--name', 'sample', '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: reuse.url })
    assert.equal(rerun.status, 0, rerun.stderr)
    assert.equal(JSON.parse(rerun.stdout).data.created, false)
    assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'feat: sample')
    assert.deepEqual(reuse.requests().map(request => request.method), ['GET'])
  } finally { reuse.close() }
})

// ---- 20260925-fix-cli-silent-failures：三类静默失败/易错点的行为契约 ----

test('branch execute on a non-base branch fails loudly and leaves the brief untouched', () => {
  const root = fixture()
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  execFileSync('git', ['switch', '-c', 'drift'], { cwd: root })
  const planned = run(['branch', 'plan', '--name', 'sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const result = run(['branch', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root)
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).error.code, 'NOT_ON_BASE_BRANCH')
  const text = readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8')
  assert.doesNotMatch(text, /"status": "branched"/)
  assert.doesNotMatch(text, /"branch": "feat\/sample"/)
})

test('archive execute lands the archive move as a local commit', () => {
  const root = fixture()
  const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim()
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  updateBrief(root, (d) => {
    d.status = 'published'
    d.github = { repository: 'owner/repo', issue: null, issueUrl: null, pullRequest: 9, pullRequestUrl: 'https://github.test/pull/9' }
    d.review = { conclusion: 'passed', verifiedCommit: head(), verifiedAt: '2026-01-01T00:00:00.000Z' }
  })
  const api = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls/9', body: { number: 9, merged: true, state: 'closed' } }])
  try {
    const planned = run(['archive', 'plan', '--name', 'sample', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(planned.status, 0, planned.stderr)
    const before = head()
    const result = run(['archive', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const after = head()
    assert.notEqual(after, before, 'archive must land a local commit')
    const message = execFileSync('git', ['log', '-1', '--format=%B'], { cwd: root }).toString()
    assert.match(message, /docs\(shadow\): 归档 sample——PR #9 已合入 main，brief 移入 archive 并重建 INDEX/)
    const inspect = run(['repo', 'inspect', '--json'], root)
    assert.deepEqual(JSON.parse(inspect.stdout).data.changedFiles, [], 'archive commit must leave the tree clean')
  } finally {
    api.close()
  }
})

test('commit execute reuses persisted files and message without re-passing them', () => {
  const root = fixture()
  writeFileSync(join(root, 'a.js'), 'a\n')
  writeFileSync(join(root, 'b.js'), 'b\n')
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  const planned = run(['commit', 'plan', '--name', 'sample', '--files', 'a.js,b.js', '--message', 'feat: two files', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const result = run(['commit', 'execute', '--name', 'sample', '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stdout)
  const message = execFileSync('git', ['log', '-1', '--format=%B'], { cwd: root }).toString()
  assert.match(message, /feat: two files/)
})
