import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { platform, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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

// Git Bash 的 tar/bash 会把 "C:\..." 误读为“远程主机:路径”；传给子进程前统一转正斜杠 POSIX 形态（与 install.test.mjs 同法）
const toUnix = platform() === 'win32' ? (p) => {
  const r = spawnSync('cygpath', ['-u', p], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : p
} : (p) => p

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
    if (rule.rawB64) return (res.writeHead(rule.status || 200, { 'content-type': 'application/octet-stream' }), res.end(Buffer.from(rule.rawB64, 'base64')))
    let out = rule.body
    if (rule.template) out = JSON.parse(JSON.stringify(out).replaceAll('{{BASE}}', 'http://127.0.0.1:' + server.address().port))
    res.writeHead(rule.status || 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(out))
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
  assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'docs(shadow): brief 最终态——committed')
  assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s', 'HEAD~1'], { cwd: root, encoding: 'utf8' }).trim(), 'docs: update readme')
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'zero-dirty: content and brief final state both committed')
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
  addOrigin(root)
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
    assert.equal(output.data.commit, execFileSync('git', ['rev-parse', 'HEAD~1'], { cwd: root, encoding: 'utf8' }).trim())
    assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'docs(shadow): brief 最终态——published, PR #9')
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'zero-dirty: release execute must leave a clean tree')
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
    assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'docs(shadow): brief 最终态——published, PR #9')
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '')
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
  addOrigin(root)
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

test('archive execute survives an untracked change dir and lands the local commit', () => {
  const root = fixture()
  addOrigin(root)
  const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim()
  // brief 保持未追踪（如 release 文件清单遗漏了 change 目录），旧路径在移动后无物可加
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
    const inspect = run(['repo', 'inspect', '--json'], root)
    assert.deepEqual(JSON.parse(inspect.stdout).data.changedFiles, [], 'archive commit must leave the tree clean')
    assert.ok(!existsSync(join(root, 'shadow-docs', 'changes', 'sample')), 'source dir must be gone')
    assert.ok(existsSync(join(root, 'shadow-docs', 'changes', 'archive', 'sample', 'brief.md')), 'brief must land in archive')
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
  const message = execFileSync('git', ['log', '-1', '--format=%B', 'HEAD~1'], { cwd: root }).toString()
  assert.match(message, /feat: two files/)
  assert.match(execFileSync('git', ['log', '-1', '--format=%B'], { cwd: root }).toString(), /docs\(shadow\): brief 最终态——committed/)
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '')
})

// ---- workflow / bind 域：生态分发（无 brief 域，--plan-hash 是唯一凭证；任意目录可用）----

function buildArtifact(dir, version, { adapters = true, skills = ['shadow-dev-propose', 'shadow-dev-apply'], requires = null } = {}) {
  mkdirSync(join(dir, 'skills'), { recursive: true })
  writeFileSync(join(dir, 'marketplace.json'), '{"name":"shadow-dev-workflow-local","plugins":[]}')
  writeFileSync(join(dir, 'package.json'), JSON.stringify(requires ? { name: 'shadow-dev-workflow', version, requiresCommands: requires } : { name: 'shadow-dev-workflow', version }))
  for (const s of skills) {
    mkdirSync(join(dir, 'skills', s), { recursive: true })
    writeFileSync(join(dir, 'skills', s, 'SKILL.md'), `---\nname: ${s}\n---\n\n# ${s}\n`)
  }
  if (adapters) {
    mkdirSync(join(dir, 'adapters'), { recursive: true })
    writeFileSync(join(dir, 'adapters', 'claude-code.json'), JSON.stringify({ schema: 'shadow-dev-adapter/v1', host: 'claude-code', tier: 'native', skillsDir: '~/.claude/skills', skillLayout: '{skillsDir}/{skill}/SKILL.md', bind: { strategy: 'copy', marker: 'managed-by: shadow-dev-workflow' } }))
    writeFileSync(join(dir, 'adapters', 'zcode.json'), JSON.stringify({ schema: 'shadow-dev-adapter/v1', host: 'zcode', tier: 'compatible', skillsDir: '~/.zcode/skills', skillLayout: '{skillsDir}/{skill}/SKILL.md', bind: { strategy: 'copy', marker: 'managed-by: shadow-dev-workflow' } }))
  }
  return dir
}

const wfEnv = root => ({ SHADOW_WORKFLOW_PREFIX: join(root, 'wf-prefix'), SHADOW_WORKFLOW_HOME: join(root, 'home') })

test('help lists workflow and bind ecosystem commands', () => {
  const help = JSON.parse(run(['--help']).stdout).data.help
  assert.match(help, /workflow plan\|execute\|rollback\|status\|link\|unlink/)
  assert.match(help, /bind plan\|execute\|status\|unbind/)
})

test('workflow plan is stable and execute materializes versioned layout with pointers', () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-'))
  const artifact = buildArtifact(join(root, 'artifact'), '6.3.0')
  const env = wfEnv(root)
  const first = run(['workflow', 'plan', '--from', artifact, '--json'], root, env)
  assert.equal(first.status, 0, first.stderr)
  const hash = JSON.parse(first.stdout).planHash
  assert.equal(hash, JSON.parse(run(['workflow', 'plan', '--from', artifact, '--json'], root, env).stdout).planHash, 'plan is stable')
  assert.equal(JSON.parse(first.stdout).data.version, '6.3.0')
  // 凭证链:execute 缺 --plan-hash exit 2,错误 hash exit 1
  assert.equal(run(['workflow', 'execute', '--from', artifact, '--confirm', '--json'], root, env).status, 2)
  assert.equal(run(['workflow', 'execute', '--from', artifact, '--plan-hash', 'wrong', '--confirm', '--json'], root, env).status, 1)
  const done = run(['workflow', 'execute', '--from', artifact, '--plan-hash', hash, '--confirm', '--json'], root, env)
  assert.equal(done.status, 0, done.stderr)
  assert.equal(JSON.parse(done.stdout).data.version, '6.3.0')
  const prefixDir = join(root, 'wf-prefix')
  assert.equal(readFileSync(join(prefixDir, 'CURRENT'), 'utf8').trim(), '6.3.0')
  assert.equal(existsSync(join(prefixDir, 'shadow-dev-workflow-6.3.0', 'skills', 'shadow-dev-propose', 'SKILL.md')), true)
  // 第二版:PREVIOUS 翻转 + current 稳定入口 + 旧版本保留供回滚
  const artifact2 = buildArtifact(join(root, 'artifact2'), '6.3.1')
  const h2 = JSON.parse(run(['workflow', 'plan', '--from', artifact2, '--json'], root, env).stdout).planHash
  assert.equal(run(['workflow', 'execute', '--from', artifact2, '--plan-hash', h2, '--confirm', '--json'], root, env).status, 0)
  assert.equal(readFileSync(join(prefixDir, 'CURRENT'), 'utf8').trim(), '6.3.1')
  assert.equal(readFileSync(join(prefixDir, 'PREVIOUS'), 'utf8').trim(), '6.3.0')
  assert.equal(existsSync(join(prefixDir, 'shadow-dev-workflow-6.3.0')), true)
  // 产物失去契约文件 → execute 重算时 ARTIFACT_INVALID(exit 3)
  rmSync(join(artifact2, 'marketplace.json'))
  assert.equal(run(['workflow', 'execute', '--from', artifact2, '--plan-hash', h2, '--confirm', '--json'], root, env).status, 3)
  // rollback 往返 + status 如实反映(且 status 在任意目录可用)
  const rb = run(['workflow', 'rollback', '--confirm', '--json'], root, env)
  assert.equal(rb.status, 0, rb.stderr)
  assert.equal(JSON.parse(rb.stdout).data.current, '6.3.0')
  const st = JSON.parse(run(['workflow', 'status', '--json'], tmpdir(), env).stdout).data
  assert.equal(st.current, '6.3.0')
  assert.equal(st.previous, '6.3.1')
})

test('workflow link track wins over CURRENT and unlink restores it', () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-link-'))
  const installed = buildArtifact(join(root, 'installed'), '6.3.0')
  const dev = buildArtifact(join(root, 'dev-checkout'), '6.4.0')
  const env = wfEnv(root)
  const h = JSON.parse(run(['workflow', 'plan', '--from', installed, '--json'], root, env).stdout).planHash
  assert.equal(run(['workflow', 'execute', '--from', installed, '--plan-hash', h, '--confirm', '--json'], root, env).status, 0)
  assert.equal(run(['workflow', 'link', '--dir', dev, '--json'], root, env).status, 2, 'link mutates: needs --confirm')
  const lk = run(['workflow', 'link', '--dir', dev, '--confirm', '--json'], root, env)
  assert.equal(lk.status, 0, lk.stderr)
  const st = JSON.parse(run(['workflow', 'status', '--json'], root, env).stdout).data
  assert.equal(st.linked, dev)
  assert.equal(st.resolved, dev, 'LINK wins over CURRENT at resolution')
  assert.equal(run(['workflow', 'link', '--dir', join(root, 'nope'), '--confirm', '--json'], root, env).status, 3, 'target without artifact contract exits 3')
  const un = run(['workflow', 'unlink', '--confirm', '--json'], root, env)
  assert.equal(un.status, 0, un.stderr)
  assert.equal(JSON.parse(run(['workflow', 'status', '--json'], root, env).stdout).data.linked, null)
  assert.equal(JSON.parse(run(['workflow', 'status', '--json'], root, env).stdout).data.resolved, join(root, 'wf-prefix', 'shadow-dev-workflow-6.3.0'))
})

test('workflow release track resolves latest release and downloads the asset via the API', () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-rel-'))
  const staging = join(root, 'staging')
  buildArtifact(join(staging, 'shadow-dev-workflow'), '6.3.1')
  // tar 必须经 bash -c:与安装器/打包用例同一解析路径(install-distribution 卡约束)
  execFileSync('bash', ['-c', 'tar -czf "$1" -C "$2" shadow-dev-workflow', 'pack', toUnix(join(root, 'asset.tgz')), toUnix(staging)])
  const api = apiStub([
    { method: 'GET', path: '/repos/stack-wuh/shadow-dev-workflow/releases/latest', template: true, body: { tag_name: 'v6.3.1', assets: [{ name: 'shadow-dev-workflow-v6.3.1.tar.gz', browser_download_url: '{{BASE}}/releases/download/v6.3.1/shadow-dev-workflow-v6.3.1.tar.gz' }] } },
    { method: 'GET', path: '/releases/download/v6.3.1/shadow-dev-workflow-v6.3.1.tar.gz', rawB64: readFileSync(join(root, 'asset.tgz')).toString('base64') },
  ])
  try {
    const env = { ...wfEnv(root), SHADOW_GITHUB_API_URL: api.url }
    const h = JSON.parse(run(['workflow', 'plan', '--json'], root, env).stdout).planHash
    const done = run(['workflow', 'execute', '--plan-hash', h, '--confirm', '--json'], root, env)
    assert.equal(done.status, 0, done.stderr)
    assert.equal(JSON.parse(done.stdout).data.version, '6.3.1')
    assert.equal(existsSync(join(root, 'wf-prefix', 'shadow-dev-workflow-6.3.1', 'marketplace.json')), true)
  } finally {
    api.close()
  }
})

test('bind copies managed skills with a sidecar, blocks unmanaged targets, unbind removes', () => {
  const root = mkdtempSync(join(tmpdir(), 'bind-'))
  const artifact = buildArtifact(join(root, 'artifact'), '6.3.0')
  const env = wfEnv(root)
  const lk = run(['workflow', 'link', '--dir', artifact, '--confirm', '--json'], root, env)
  assert.equal(lk.status, 0, lk.stderr)
  const skillsDir = join(root, 'home', '.claude', 'skills')
  mkdirSync(join(skillsDir, 'shadow-dev-apply'), { recursive: true })
  writeFileSync(join(skillsDir, 'shadow-dev-apply', 'SKILL.md'), 'foreign\n')
  const plan1 = run(['bind', 'plan', '--host', 'claude-code', '--json'], root, env)
  assert.equal(plan1.status, 0, plan1.stderr)
  const p1 = JSON.parse(plan1.stdout)
  assert.equal(p1.data.hosts[0].entries.find(t => t.skill === 'shadow-dev-apply').blocked, true, 'foreign dir is blocked')
  assert.equal(run(['bind', 'execute', '--host', 'claude-code', '--plan-hash', p1.planHash, '--confirm', '--json'], root, env).status, 1, 'blocked execute exits 1')
  rmSync(join(skillsDir, 'shadow-dev-apply'), { recursive: true, force: true })
  const p2 = JSON.parse(run(['bind', 'plan', '--host', 'claude-code', '--json'], root, env).stdout)
  const ex = run(['bind', 'execute', '--host', 'claude-code', '--plan-hash', p2.planHash, '--confirm', '--json'], root, env)
  assert.equal(ex.status, 0, ex.stderr)
  assert.equal(readFileSync(join(skillsDir, 'shadow-dev-propose', 'SKILL.md'), 'utf8'), `---\nname: shadow-dev-propose\n---\n\n# shadow-dev-propose\n`)
  const sidecar = JSON.parse(readFileSync(join(skillsDir, '.shadow-dev-workflow.json'), 'utf8'))
  assert.equal(sidecar.marker, 'managed-by: shadow-dev-workflow')
  assert.equal(Object.keys(sidecar.skills).length, 2)
  // status 如实列出全部适配器(present 标记);auto 的存在性过滤只作用于 plan
  const st = JSON.parse(run(['bind', 'status', '--json'], root, env).stdout).data
  assert.equal(st.hosts.length, 2)
  // managed = sidecar 键序 = plan entries 的稳定字典序（产品契约:确定性输出,与 readdir/创建序无关）
  assert.deepEqual(st.hosts.find(h => h.host === 'claude-code').managed, ['shadow-dev-apply', 'shadow-dev-propose'])
  assert.equal(st.hosts.find(h => h.host === 'zcode').present, false)
  const ub = run(['bind', 'unbind', '--host', 'claude-code', '--confirm', '--json'], root, env)
  assert.equal(ub.status, 0, ub.stderr)
  assert.equal(existsSync(join(skillsDir, 'shadow-dev-propose')), false)
  assert.equal(existsSync(join(skillsDir, '.shadow-dev-workflow.json')), false)
  assert.equal(run(['bind', 'unbind', '--host', 'claude-code', '--confirm', '--json'], root, env).status, 1, 'second unbind has nothing to remove')
})

// ---- .shadow-dev/ config layers (20261005-feature-shadow-dev-config) ----
function withProjectConfig(root, content) {
  mkdirSync(join(root, '.shadow-dev'), { recursive: true })
  writeFileSync(join(root, '.shadow-dev', 'config.json'), typeof content === 'string' ? content : JSON.stringify(content))
}
function fakeHomeWithConfig(content) {
  const home = mkdtempSync(join(tmpdir(), 'shadow-home-'))
  mkdirSync(join(home, '.shadow-dev'), { recursive: true })
  writeFileSync(join(home, '.shadow-dev', 'config.json'), JSON.stringify(content))
  return { HOME: home, USERPROFILE: home }
}

test('config: project .shadow-dev/config.json feeds the stderr language layer', () => {
  const root = fixture()
  withProjectConfig(root, { lang: 'en' })
  // LANG 探测源指向 zh,无 SHADOW_DEV_LANG 无 flag:配置层未实现时 stderr 走 locale 探测渲染中文
  const r = run(['--help'], root, { LANG: 'zh_CN.UTF-8', SHADOW_DEV_LANG: '', ...fakeHomeWithConfig({}) })
  assert.match(r.stderr, /shadow-dev commands \(/)
  assert.doesNotMatch(r.stderr, /命令一览/)
})

test('config: resolution priority is flag > env > project > user > locale probe', () => {
  const root = fixture()
  const env = { LANG: 'en_US.UTF-8', SHADOW_DEV_LANG: '', ...fakeHomeWithConfig({ lang: 'zh' }) }
  // 1. user config beats locale probe
  assert.match(run(['--help'], root, env).stderr, /命令一览/)
  // 2. project config beats user config
  withProjectConfig(root, { lang: 'en' })
  assert.match(run(['--help'], root, env).stderr, /shadow-dev commands \(/)
  // 3. env beats project config
  assert.match(run(['--help'], root, { ...env, SHADOW_DEV_LANG: 'zh' }).stderr, /命令一览/)
  // 4. flag beats env
  assert.match(run(['--help', '--lang', 'en'], root, { ...env, SHADOW_DEV_LANG: 'zh' }).stderr, /shadow-dev commands \(/)
})

test('config: json key restores the machine surface on TTY', () => {
  const root = fixture()
  withProjectConfig(root, { json: true })
  const r = runTty(['repo', 'inspect'], root, fakeHomeWithConfig({}))
  assert.equal(JSON.parse(r.stdout).command, 'repo.inspect', 'config json:true must emit the JSON contract even on TTY')
})

test('config: quiet key silences the human channel from either layer', () => {
  const root = fixture()
  withProjectConfig(root, { quiet: true })
  assert.equal(run(['--help'], root, fakeHomeWithConfig({})).stderr, '')
  const bare = fixture()
  const r = run(['--help'], bare, fakeHomeWithConfig({ quiet: true }))
  assert.equal(r.stderr, '', 'user-level quiet must silence stderr as well')
  assert.notEqual(r.stdout, '', 'quiet only closes stderr, stdout contract unaffected')
})

test('config: github.apiBaseUrl applies from config when env is absent', () => {
  const root = fixture()
  addOrigin(root)
  updateBrief(root, (b) => { b.github.repository = 'stub-remote/repo'; b.github.pullRequest = 7 })
  const stub = apiStub([{ method: 'GET', path: '/repos/stub-remote/repo/pulls/7', body: { number: 7, state: 'open', merged: false, html_url: 'x' } }])
  try {
    withProjectConfig(root, { github: { apiBaseUrl: stub.url } })
    const r = run(['pr', 'inspect', '--name', 'sample', '--json'], root, { GITHUB_TOKEN: 't', SHADOW_GITHUB_API_URL: '', ...fakeHomeWithConfig({}) })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(JSON.parse(r.stdout).data.number, 7)
    assert.ok(stub.requests().some(q => q.url.startsWith('/repos/stub-remote/repo/pulls/7')))
  } finally { stub.close() }
})

test('config: malformed config.json fails with CONFIG_INVALID and exit 1', () => {
  const root = fixture()
  withProjectConfig(root, '{oops not json')
  const r = run(['repo', 'inspect', '--json'], root, fakeHomeWithConfig({}))
  assert.equal(r.status, 1)
  assert.equal(JSON.parse(r.stdout).error.code, 'CONFIG_INVALID')
  assert.match(r.stderr, /config\.json/)
})

// ---- worktree domain (20261005-feature-worktree-domain) ----
function setRating(root, level) {
  const p = join(root, 'shadow-docs', 'changes', 'sample', 'brief.md')
  writeFileSync(p, readFileSync(p, 'utf8') + `\n## 复杂度评级\n- **评级:** ${level}\n`)
}
const WT_HOME = () => fakeHomeWithConfig({})

test('worktree: execute creates a new worktree with derived branch and writes back the brief', () => {
  const root = fixture()
  const wt = mkdtempSync(join(tmpdir(), 'wt-')); rmSync(wt, { recursive: true, force: true })
  const planned = run(['worktree', 'plan', '--name', 'sample', '--path', wt, '--json'], root, WT_HOME())
  assert.equal(planned.status, 0, planned.stderr)
  const exec = run(['worktree', 'execute', '--name', 'sample', '--path', wt, '--confirm', '--json'], root, WT_HOME())
  assert.equal(exec.status, 0, exec.stderr)
  const body = JSON.parse(exec.stdout).data
  assert.equal(body.branch, 'feat/sample')
  assert.equal(existsSync(join(wt, 'README.md')), true, 'worktree checkout must contain repo files')
  assert.equal(execFileSync('git', ['-C', wt, 'branch', '--show-current'], { encoding: 'utf8' }).trim(), 'feat/sample')
  const b = JSON.parse(readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8').match(/---\n([\s\S]*?)\n---/)[1])
  assert.equal(b.branch, 'feat/sample')
  assert.equal(b.workflow.worktree, wt)
  assert.equal(b.status, 'branched')
})

test('worktree: execute mounts an existing branch', () => {
  const root = fixture()
  execFileSync('git', ['branch', 'feat/sample'], { cwd: root })
  const wt = mkdtempSync(join(tmpdir(), 'wt-')); rmSync(wt, { recursive: true, force: true })
  run(['worktree', 'plan', '--name', 'sample', '--path', wt, '--json'], root, WT_HOME())
  const exec = run(['worktree', 'execute', '--name', 'sample', '--path', wt, '--confirm', '--json'], root, WT_HOME())
  assert.equal(exec.status, 0, exec.stderr)
  assert.equal(existsSync(join(wt, 'README.md')), true)
  assert.equal(execFileSync('git', ['-C', wt, 'branch', '--show-current'], { encoding: 'utf8' }).trim(), 'feat/sample')
})

test('worktree: execute on a taken non-empty path reports WORKTREE_PATH_TAKEN', () => {
  const root = fixture()
  const wt = mkdtempSync(join(tmpdir(), 'wt-'))
  writeFileSync(join(wt, 'busy.txt'), 'occupied\n')
  run(['worktree', 'plan', '--name', 'sample', '--path', wt, '--json'], root, WT_HOME())
  const exec = run(['worktree', 'execute', '--name', 'sample', '--path', wt, '--confirm', '--json'], root, WT_HOME())
  assert.equal(exec.status, 1)
  assert.equal(JSON.parse(exec.stdout).error.code, 'WORKTREE_PATH_TAKEN')
})

test('worktree: remove deletes a clean worktree and clears the brief field', () => {
  const root = fixture()
  const wt = mkdtempSync(join(tmpdir(), 'wt-')); rmSync(wt, { recursive: true, force: true })
  run(['worktree', 'plan', '--name', 'sample', '--path', wt, '--json'], root, WT_HOME())
  assert.equal(run(['worktree', 'execute', '--name', 'sample', '--path', wt, '--confirm', '--json'], root, WT_HOME()).status, 0)
  const planned = run(['worktree', 'remove', 'plan', '--name', 'sample', '--json'], root, WT_HOME())
  assert.equal(planned.status, 0, planned.stderr)
  const removed = run(['worktree', 'remove', 'execute', '--name', 'sample', '--confirm', '--json'], root, WT_HOME())
  assert.equal(removed.status, 0, removed.stderr)
  assert.equal(existsSync(wt), false)
  const b = JSON.parse(readFileSync(join(root, 'shadow-docs', 'changes', 'sample', 'brief.md'), 'utf8').match(/---\n([\s\S]*?)\n---/)[1])
  assert.equal(b.workflow.worktree, null)
})

test('worktree: remove refuses a dirty worktree with WORKTREE_DIRTY', () => {
  const root = fixture()
  const wt = mkdtempSync(join(tmpdir(), 'wt-')); rmSync(wt, { recursive: true, force: true })
  run(['worktree', 'plan', '--name', 'sample', '--path', wt, '--json'], root, WT_HOME())
  run(['worktree', 'execute', '--name', 'sample', '--path', wt, '--confirm', '--json'], root, WT_HOME())
  writeFileSync(join(wt, 'dirt.txt'), 'dirty\n')
  run(['worktree', 'remove', 'plan', '--name', 'sample', '--json'], root, WT_HOME())
  const removed = run(['worktree', 'remove', 'execute', '--name', 'sample', '--confirm', '--json'], root, WT_HOME())
  assert.equal(removed.status, 1)
  assert.equal(JSON.parse(removed.stdout).error.code, 'WORKTREE_DIRTY')
  assert.equal(existsSync(wt), true)
})

// ---------- blog publish 域（收编 blog 仓发布脚本）----------

function blogFixture() {
  const root = mkdtempSync(join(tmpdir(), 'shadow-blog-'))
  mkdirSync(join(root, 'posts'), { recursive: true })
  writeFileSync(join(root, 'posts', 'hello.md'), `---
title: 测试文章
labels: [随笔, 技术]
summary: 摘要A
cover: https://cdn.wuh.site/c.png
keywords: [K1, K2]
---

正文内容。
`)
  return root
}

function blogStub() {
  return apiStub([
    { method: 'POST', path: '/repos/stack-wuh/blog/issues', body: { number: 99, html_url: 'http://127.0.0.1/stack-wuh/blog/issues/99' } },
    { method: 'POST', path: '/v2/webhook/sync/99', status: 200, body: { ok: true } },
  ])
}

test('blog publish: plan previews the article from frontmatter', () => {
  const root = blogFixture()
  const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, { ...fakeHomeWithConfig({}) })
  assert.equal(planned.status, 0, planned.stderr)
  const v = JSON.parse(planned.stdout)
  assert.equal(v.command, 'blog.publish.plan')
  assert.equal(v.ok, true)
  assert.ok(/^[0-9a-f]{64}$/.test(v.planHash))
  const d = v.data
  assert.equal(d.title, '测试文章')
  assert.deepEqual(d.labels, ['随笔', '技术'])
  assert.equal(d.repository, 'stack-wuh/blog')
  assert.equal(d.syncUrl, 'http://localhost:3200')
  assert.ok(d.bodyBytes > 0 && typeof d.bodySha256 === 'string')
  assert.ok(!('body' in d) && !('raw' in d), 'stdout must stay a lean preview')
  assert.match(d.nextStep, /blog publish execute --file .* --plan-hash [0-9a-f]{64} --confirm/)
})

test('blog publish: execute creates the issue then pings the sync endpoint', () => {
  const root = blogFixture()
  const api = blogStub()
  try {
    const env = { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url, SYNC_URL: api.url, ...fakeHomeWithConfig({}) }
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    assert.equal(planned.status, 0, planned.stderr)
    const result = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(result.status, 0, result.stderr)
    const v = JSON.parse(result.stdout)
    assert.equal(v.data.issue.number, 99)
    assert.equal(v.data.sync.ok, true)
    const issueCall = api.requests().find(r => r.url.startsWith('/repos/stack-wuh/blog/issues'))
    assert.ok(issueCall, 'issue POST must hit the API stub')
    const sent = JSON.parse(issueCall.body)
    assert.equal(sent.title, '测试文章')
    assert.deepEqual(sent.labels, ['随笔', '技术'])
    const tail = '\n\n<!-- wuh-site-metadata: {"summary":"摘要A","cover":"https://cdn.wuh.site/c.png","keywords":["K1","K2"]} -->'
    assert.ok(sent.body.endsWith('正文内容。' + tail), sent.body)
    assert.ok(api.requests().some(r => r.method === 'POST' && r.url === '/v2/webhook/sync/99'))
  } finally { api.close() }
})

test('blog publish: edits between plan and execute are rejected', () => {
  const root = blogFixture()
  const api = blogStub()
  try {
    const env = { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url, SYNC_URL: api.url, ...fakeHomeWithConfig({}) }
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    assert.equal(planned.status, 0, planned.stderr)
    writeFileSync(join(root, 'posts', 'hello.md'), readFileSync(join(root, 'posts', 'hello.md'), 'utf8') + '\n追加一段。\n')
    const stale = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(stale.status, 1)
    assert.equal(JSON.parse(stale.stdout).error.code, 'PLAN_HASH_INVALID')
  } finally { api.close() }
})

test('blog publish: input contract errors', () => {
  const root = blogFixture()
  const noFile = run(['blog', 'publish', 'plan', '--json'], root, fakeHomeWithConfig({}))
  assert.equal(noFile.status, 2)
  assert.equal(JSON.parse(noFile.stdout).error.code, 'BLOG_FILE_REQUIRED')
  const missing = run(['blog', 'publish', 'plan', '--file', 'posts/nope.md', '--json'], root, fakeHomeWithConfig({}))
  assert.equal(missing.status, 1)
  assert.equal(JSON.parse(missing.stdout).error.code, 'BLOG_FILE_NOT_FOUND')
  writeFileSync(join(root, 'posts', 'plain.md'), '# 无 frontmatter 的文章\n')
  const noTitle = run(['blog', 'publish', 'plan', '--file', 'posts/plain.md', '--json'], root, fakeHomeWithConfig({}))
  assert.equal(noTitle.status, 1)
  assert.equal(JSON.parse(noTitle.stdout).error.code, 'BLOG_TITLE_REQUIRED')
})

test('blog publish: sync failure stays best-effort', () => {
  const root = blogFixture()
  const api = apiStub([
    { method: 'POST', path: '/repos/stack-wuh/blog/issues', body: { number: 99, html_url: 'http://127.0.0.1/i/99' } },
    { method: 'POST', path: '/v2/webhook/sync/99', status: 500, body: { message: 'boom' } },
  ])
  try {
    const env = { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url, SYNC_URL: api.url, ...fakeHomeWithConfig({}) }
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    const result = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(result.status, 0, result.stderr)
    const v = JSON.parse(result.stdout)
    assert.equal(v.ok, true)
    assert.equal(v.data.issue.number, 99)
    assert.equal(v.data.sync.ok, false)
    assert.equal(v.data.sync.status, 500)
  } finally { api.close() }
})

test('blog publish: .env fallback supplies token and sync url', () => {
  const root = blogFixture()
  const api = blogStub()
  try {
    writeFileSync(join(root, '.env'), `GITHUB_TOKEN=tok-from-dotenv\nSYNC_URL=${api.url}\n`)
    const env = { GITHUB_TOKEN: '', GH_TOKEN: '', SHADOW_GITHUB_API_URL: api.url, ...fakeHomeWithConfig({}) }
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    assert.equal(planned.status, 0, planned.stderr)
    assert.equal(JSON.parse(planned.stdout).data.syncUrl, api.url)
    const result = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).data.issue.number, 99)
  } finally { api.close() }
})

test('blog publish: config chain and flag override', () => {
  const root = blogFixture()
  mkdirSync(join(root, '.shadow-dev'), { recursive: true })
  writeFileSync(join(root, '.shadow-dev', 'config.json'), JSON.stringify({ blog: { repository: 'cfg/repo', syncUrl: 'http://127.0.0.1:9999' } }))
  const base = { ...fakeHomeWithConfig({}) }
  const fromCfg = JSON.parse(run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, base).stdout).data
  assert.equal(fromCfg.repository, 'cfg/repo')
  assert.equal(fromCfg.syncUrl, 'http://127.0.0.1:9999')
  const envWins = JSON.parse(run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, { ...base, SYNC_URL: 'http://127.0.0.1:1234' }).stdout).data
  assert.equal(envWins.syncUrl, 'http://127.0.0.1:1234')
  const flagWins = JSON.parse(run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--repository', 'flag/repo', '--sync-url', 'http://127.0.0.1:4321', '--json'], root, { ...base, SYNC_URL: 'http://127.0.0.1:1234' }).stdout).data
  assert.equal(flagWins.repository, 'flag/repo')
  assert.equal(flagWins.syncUrl, 'http://127.0.0.1:4321')
})

test('blog publish: help and human layer stay contract-clean', () => {
  const listed = run(['--help'])
  assert.match(listed.stdout, /blog publish plan\|execute/)
  const group = run(['help', 'blog', '--json'])
  assert.equal(group.status, 0)
  assert.ok(JSON.parse(group.stdout).data.commands['blog.publish.plan'])
  assert.ok(JSON.parse(group.stdout).data.commands['blog.publish.execute'])
  const errZh = run(['blog', 'publish', 'plan', '--file', 'nope.md', '--json'], blogFixture(), { SHADOW_DEV_LANG: 'zh', ...fakeHomeWithConfig({}) })
  assert.match(errZh.stderr, /BLOG_FILE_NOT_FOUND/)
  assert.match(errZh.stderr, /✗/)
  assert.equal(JSON.parse(errZh.stdout).ok, false)
})

test('worktree: inspect recommends by rating and reports occupancy', () => {
  const root = fixture()
  setRating(root, 'L')
  const bare = JSON.parse(run(['worktree', 'inspect', '--name', 'sample', '--json'], root, WT_HOME()).stdout).data
  assert.equal(bare.recommendation, 'create')
  assert.match(bare.nextStep, /worktree plan --name sample --path/)
  const wt = mkdtempSync(join(tmpdir(), 'wt-')); rmSync(wt, { recursive: true, force: true })
  assert.equal(run(['worktree', 'plan', '--name', 'sample', '--path', wt, '--json'], root, WT_HOME()).status, 0)
  assert.equal(run(['worktree', 'execute', '--name', 'sample', '--path', wt, '--confirm', '--json'], root, WT_HOME()).status, 0)
  const mine = JSON.parse(run(['worktree', 'inspect', '--name', 'sample', '--json'], root, WT_HOME()).stdout).data
  // reuse 只依赖"路径已登记且存在"，clean 是附加情报——Windows 上 git status 偶发失败不得否决已有 workspace
  assert.equal(mine.recommendation, 'reuse', JSON.stringify(mine.worktrees))
  const self = mine.worktrees.find(w => w.branch === 'feat/sample')
  assert.equal(self.occupiedBy, 'sample')
})

// ---- 20261008-fix-brief-final-state-commit:零 dirty 不变量——每次状态变动落盘后必须有对应 commit ----

test('zero-dirty: commit execute lands the brief final state as a follow-up commit and leaves a clean tree', () => {
  const root = fixture()
  writeFileSync(join(root, 'a.js'), 'a\n')
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  const planned = run(['commit', 'plan', '--name', 'sample', '--files', 'shadow-docs/changes/sample/brief.md,a.js', '--message', 'feat: sample', '--json'], root)
  assert.equal(planned.status, 0, planned.stderr)
  const result = run(['commit', 'execute', '--name', 'sample', '--confirm', '--json'], root)
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  const firstCommit = execFileSync('git', ['rev-parse', 'HEAD~1'], { cwd: root, encoding: 'utf8' }).trim()
  assert.equal(output.data.commit, firstCommit, 'commit field stays the content commit')
  assert.equal(typeof output.data.briefCommit, 'string', 'additive briefCommit field carries the final-state commit sha')
  assert.equal(output.data.briefCommit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
  assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'docs(shadow): brief 最终态——committed')
  assert.match(execFileSync('git', ['show', 'HEAD:shadow-docs/changes/sample/brief.md'], { cwd: root, encoding: 'utf8' }), /"status": "committed"/)
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'tree must be clean after commit execute')
})

test('zero-dirty: release execute commits brief published state with PR number and pushes the clean tip', () => {
  const root = fixture()
  addOrigin(root)
  execFileSync('git', ['switch', '-c', 'feat/sample'], { cwd: root })
  writeFileSync(join(root, 'a.js'), 'a\n')
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.branch = 'feat/sample'; data.status = 'reviewed'; data.review = { conclusion: 'passed', verifiedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), verifiedAt: 'now' } })
  const api = apiStub([
    { method: 'GET', path: '/repos/owner/repo/pulls?', body: [] },
    { method: 'POST', path: '/repos/owner/repo/pulls', body: { number: 9, html_url: 'https://github.test/pulls/9' } },
  ])
  try {
    const planned = run(['release', 'plan', '--name', 'sample', '--files', 'shadow-docs/changes/sample/brief.md,a.js', '--message', 'feat: sample', '--title', 'Sample PR', '--json'], root)
    assert.equal(planned.status, 0, planned.stderr)
    const result = run(['release', 'execute', '--name', 'sample', '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(typeof output.data.briefCommit, 'string')
    assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'docs(shadow): brief 最终态——published, PR #9')
    const tipBrief = execFileSync('git', ['show', 'HEAD:shadow-docs/changes/sample/brief.md'], { cwd: root, encoding: 'utf8' })
    assert.match(tipBrief, /"status": "published"/)
    assert.match(tipBrief, /"pullRequest": 9/)
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'tree must be clean after release execute')
    assert.equal(execFileSync('git', ['rev-parse', 'origin/feat/sample'], { cwd: root, encoding: 'utf8' }).trim(), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 'remote tip must carry the final state')
  } finally { api.close() }
})

test('zero-dirty: publish execute commits and pushes brief final state after PR creation', () => {
  const root = fixture()
  addOrigin(root)
  execFileSync('git', ['switch', '-c', 'feat/sample'], { cwd: root })
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  execFileSync('git', ['push', '-u', 'origin', 'feat/sample'], { cwd: root })
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.branch = 'feat/sample'; data.status = 'committed'; data.workflow.checkpoint = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() })
  const api = apiStub([
    { method: 'GET', path: '/repos/owner/repo/pulls?', body: [] },
    { method: 'POST', path: '/repos/owner/repo/pulls', body: { number: 11, html_url: 'https://github.test/pulls/11' } },
  ])
  try {
    const args = ['--name', 'sample', '--title', 'Sample PR', '--body', 'b']
    const planned = run(['publish', 'plan', ...args, '--json'], root)
    assert.equal(planned.status, 0, planned.stderr)
    const result = run(['publish', 'execute', ...args, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(typeof output.data.briefCommit, 'string')
    assert.equal(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), 'docs(shadow): brief 最终态——published, PR #11')
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'tree must be clean after publish execute')
    assert.equal(execFileSync('git', ['rev-parse', 'origin/feat/sample'], { cwd: root, encoding: 'utf8' }).trim(), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
  } finally { api.close() }
})

test('zero-dirty: archive execute pushes the archive commit to origin main', () => {
  const root = fixture()
  const remote = addOrigin(root)
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  updateBrief(root, (d) => {
    d.status = 'published'
    d.github = { repository: 'owner/repo', issue: null, issueUrl: null, pullRequest: 9, pullRequestUrl: 'https://github.test/pull/9' }
    d.review = { conclusion: 'passed', verifiedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), verifiedAt: '2026-01-01T00:00:00.000Z' }
  })
  const api = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls/9', body: { number: 9, merged: true, state: 'closed' } }])
  try {
    const planned = run(['archive', 'plan', '--name', 'sample', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(planned.status, 0, planned.stderr)
    const result = run(['archive', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).data.pushed, true)
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'tree must be clean after archive execute')
    assert.equal(execFileSync('git', ['rev-parse', 'main'], { cwd: remote, encoding: 'utf8' }).trim(), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 'origin/main must carry the archive commit')
  } finally { api.close() }
})

test('zero-dirty: release rerun cycles converge — each replan drift lands exactly one brief commit', () => {
  const root = fixture()
  addOrigin(root)
  execFileSync('git', ['switch', '-c', 'feat/sample'], { cwd: root })
  writeFileSync(join(root, 'a.js'), 'a\n')
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  updateBrief(root, data => { data.github.repository = 'owner/repo'; data.branch = 'feat/sample'; data.status = 'reviewed'; data.review = { conclusion: 'passed', verifiedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), verifiedAt: 'now' } })
  const api = apiStub([
    { method: 'GET', path: '/repos/owner/repo/pulls?', body: [{ number: 9, html_url: 'https://github.test/pulls/9' }] },
  ])
  try {
    const env = { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url }
    assert.equal(run(['release', 'plan', '--name', 'sample', '--files', 'shadow-docs/changes/sample/brief.md,a.js', '--message', 'feat: sample', '--title', 'Sample PR', '--json'], root).status, 0)
    assert.equal(run(['release', 'execute', '--name', 'sample', '--confirm', '--json'], root, env).status, 0)
    const commits = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '')
    // replan 的 planHash 相对已提交内容产生新漂移（head 参与哈希，补提交前移 HEAD）——这笔漂移恰好收口为一笔最终态 commit
    assert.equal(run(['release', 'plan', '--name', 'sample', '--json'], root).status, 0)
    const second = run(['release', 'execute', '--name', 'sample', '--confirm', '--json'], root, env)
    assert.equal(second.status, 0, second.stderr)
    assert.equal(JSON.parse(second.stdout).data.briefCommit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
    assert.equal(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), String(Number(commits) + 1), 'replan drift must land exactly one brief commit')
    assert.match(execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf8' }).trim(), /^docs\(shadow\): brief 最终态——published, PR #9$/)
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '')
    assert.equal(execFileSync('git', ['rev-parse', 'origin/feat/sample'], { cwd: root, encoding: 'utf8' }).trim(), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 'remote tip must stay in sync with the local clean state')
  } finally { api.close() }
})

test('zero-dirty: archive final state (status archived + INDEX entry) is what reaches origin', () => {
  const root = fixture()
  const remote = addOrigin(root)
  execFileSync('git', ['add', '--', 'shadow-docs'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'docs: seed briefs'], { cwd: root })
  updateBrief(root, (d) => {
    d.status = 'published'
    d.github = { repository: 'owner/repo', issue: null, issueUrl: null, pullRequest: 9, pullRequestUrl: 'https://github.test/pull/9' }
    d.review = { conclusion: 'passed', verifiedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), verifiedAt: '2026-01-01T00:00:00.000Z' }
  })
  const api = apiStub([{ method: 'GET', path: '/repos/owner/repo/pulls/9', body: { number: 9, merged: true, state: 'closed' } }])
  try {
    const planned = run(['archive', 'plan', '--name', 'sample', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(planned.status, 0, planned.stderr)
    const result = run(['archive', 'execute', '--name', 'sample', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, { GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url })
    assert.equal(result.status, 0, result.stderr)
    const onRemote = execFileSync('git', ['show', 'main:shadow-docs/changes/archive/sample/brief.md'], { cwd: remote, encoding: 'utf8' })
    assert.match(onRemote, /"status": "archived"/)
    assert.match(onRemote, /"checkpoint": "merged-pr:9"/)
    assert.match(execFileSync('git', ['show', 'main:shadow-docs/INDEX.md'], { cwd: remote, encoding: 'utf8' }), /archive\/sample\/brief\.md/)
  } finally { api.close() }
})

// ---- 产物能力契约（20261008-feature-artifact-capability-contract）----
// 分发权威反转给 CLI 后，「内容要求未发布命令」不再有静态 pin 兜底：
// 产物用 requiresCommands 自声明需求，CLI 在物化落盘前拿自身 COMMANDS 目录断言。

test('workflow capability contract: execute refuses an artifact requiring commands this CLI lacks', () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-cap-'))
  const env = wfEnv(root)
  const prefixDir = join(root, 'wf-prefix')
  // 现场：先装一个兼容版本，拒绝路径必须证明已有指针不动
  const good = buildArtifact(join(root, 'good'), '6.3.0')
  const hg = JSON.parse(run(['workflow', 'plan', '--from', good, '--json'], root, env).stdout).planHash
  assert.equal(run(['workflow', 'execute', '--from', good, '--plan-hash', hg, '--confirm', '--json'], root, env).status, 0)
  const currentBefore = readFileSync(join(prefixDir, 'CURRENT'), 'utf8')

  // 合成命令键：断言不依赖任何具体发布版本——目录里永远不该有这两个键
  const bad = buildArtifact(join(root, 'bad'), '9.9.9', { requires: ['nope.does-not-exist', 'zzz.future.command'] })
  const planned = run(['workflow', 'plan', '--from', bad, '--json'], root, env)
  assert.equal(planned.status, 0, `plan previews incompatibility without failing: ${planned.stderr}`)
  assert.deepEqual(JSON.parse(planned.stdout).data.missingCommands, ['nope.does-not-exist', 'zzz.future.command'])

  const hb = JSON.parse(planned.stdout).planHash
  const refused = run(['workflow', 'execute', '--from', bad, '--plan-hash', hb, '--confirm', '--json'], root, env)
  assert.equal(refused.status, 1, refused.stdout)
  assert.equal(JSON.parse(refused.stdout).error.code, 'ARTIFACT_INCOMPATIBLE')
  assert.match(JSON.parse(refused.stdout).error.message, /zzz\.future\.command/)
  assert.equal(readFileSync(join(prefixDir, 'CURRENT'), 'utf8'), currentBefore, 'CURRENT untouched on refusal')
  assert.equal(existsSync(join(prefixDir, 'shadow-dev-workflow-9.9.9')), false, 'no half-materialized version dir')
  // 人用层：拒绝与升级指引走 stderr，语言显式钉 zh（CI runner locale 会改渲染语言）
  const human = run(['workflow', 'execute', '--from', bad, '--plan-hash', hb, '--confirm', '--lang', 'zh'], root, env)
  assert.match(human.stderr, /ARTIFACT_INCOMPATIBLE/)

  // 能力齐备的产物必须放行（放在拒绝路径断言之后，避免污染「指针不动」的现场）
  const okArtifact = buildArtifact(join(root, 'ok'), '7.0.0', { requires: ['worktree.inspect'] })
  const hOk = JSON.parse(run(['workflow', 'plan', '--from', okArtifact, '--json'], root, env).stdout).planHash
  assert.equal(run(['workflow', 'execute', '--from', okArtifact, '--plan-hash', hOk, '--confirm', '--json'], root, env).status, 0)
  const st = JSON.parse(run(['workflow', 'status', '--json'], root, env).stdout).data
  assert.equal(st.artifactVersion, '7.0.0')
  assert.deepEqual(st.missingCommands, [])
})

test('workflow capability contract: artifacts without requiresCommands stay installable (default-compatible)', () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-cap-def-'))
  const env = wfEnv(root)
  const artifact = buildArtifact(join(root, 'artifact'), '6.4.0')
  const hash = JSON.parse(run(['workflow', 'plan', '--from', artifact, '--json'], root, env).stdout).planHash
  assert.equal(run(['workflow', 'execute', '--from', artifact, '--plan-hash', hash, '--confirm', '--json'], root, env).status, 0)
  assert.equal(readFileSync(join(root, 'wf-prefix', 'CURRENT'), 'utf8').trim(), '6.4.0')
})

test('workflow capability contract: status projects artifactVersion, cliVersion and missingCommands', () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-cap-status-'))
  const env = wfEnv(root)
  const cliVersion = JSON.parse(readFileSync(join(dirname(CLI), 'package.json'), 'utf8')).version
  const empty = JSON.parse(run(['workflow', 'status', '--json'], root, env).stdout).data
  assert.equal(empty.artifactVersion, null, 'nothing installed => no artifact version')
  assert.deepEqual(empty.missingCommands, [])
  assert.equal(empty.cliVersion, cliVersion)

  const artifact = buildArtifact(join(root, 'artifact'), '6.5.0')
  const hash = JSON.parse(run(['workflow', 'plan', '--from', artifact, '--json'], root, env).stdout).planHash
  assert.equal(run(['workflow', 'execute', '--from', artifact, '--plan-hash', hash, '--confirm', '--json'], root, env).status, 0)
  const installed = JSON.parse(run(['workflow', 'status', '--json'], root, env).stdout).data
  assert.equal(installed.artifactVersion, '6.5.0')
  assert.deepEqual(installed.missingCommands, [])

  // link 轨同样是能力断言的观测面：直通一个要求缺失命令的产物，status 必须报出来
  const dev = buildArtifact(join(root, 'dev'), '9.9.9', { requires: ['nope.missing'] })
  assert.equal(run(['workflow', 'link', '--dir', dev, '--confirm', '--json'], root, env).status, 1, 'link refuses')
  const linked = JSON.parse(run(['workflow', 'status', '--json'], root, env).stdout).data
  assert.equal(linked.artifactVersion, '6.5.0', 'CURRENT still resolves')
  assert.deepEqual(linked.missingCommands, [])
})

test('workflow capability contract: link refuses an artifact requiring commands the CLI lacks', () => {
  const root = mkdtempSync(join(tmpdir(), 'wf-cap-link-'))
  const env = wfEnv(root)
  const prefixDir = join(root, 'wf-prefix')
  const dev = buildArtifact(join(root, 'dev'), '9.9.9', { requires: ['nope.does-not-exist'] })
  const refused = run(['workflow', 'link', '--dir', dev, '--confirm', '--json'], root, env)
  assert.equal(refused.status, 1, refused.stdout)
  assert.equal(JSON.parse(refused.stdout).error.code, 'ARTIFACT_INCOMPATIBLE')
  assert.equal(existsSync(join(prefixDir, 'LINK')), false, 'LINK is not written on refusal')
})
