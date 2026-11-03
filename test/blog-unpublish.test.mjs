// blog unpublish 契约（20261103-feature-blog-unpublish）：
// close 即下架——PATCH {state:'closed'} + sync ping；publish update 补 state:'open'（重新上架）。
// INV-1 无 issue 号 plan 拒绝 BLOG_ISSUE_REQUIRED；INV-2 载荷只含 state；
// INV-3 publish update PATCH 含 state:'open'、create POST 不含；INV-4 结果契约 {state:'closed', sync}。
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const CLI = fileURLToPath(new URL('../cli.mjs', import.meta.url))

function run(args, cwd = process.cwd(), env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
}

function fakeHomeWithConfig(content) {
  const home = mkdtempSync(join(tmpdir(), 'shadow-home-'))
  mkdirSync(join(home, '.shadow-dev'), { recursive: true })
  writeFileSync(join(home, '.shadow-dev', 'config.json'), JSON.stringify(content))
  return { HOME: home, USERPROFILE: home }
}

// 与 cli.test.mjs 的 apiStub 同构（本地 HTTP 桩 + 请求日志）
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
    stdio: 'ignore'
  })
  for (let i = 0; i < 100 && !existsSync(portFile); i += 1) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
  if (!existsSync(portFile)) throw new Error('API stub did not start')
  return {
    url: `http://127.0.0.1:${readFileSync(portFile, 'utf8')}`,
    requests: () => existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [],
    close: () => child.kill()
  }
}

function fixtureWithIssue() {
  const root = mkdtempSync(join(tmpdir(), 'shadow-blog-'))
  mkdirSync(join(root, 'posts'), { recursive: true })
  writeFileSync(join(root, 'posts', 'hello.md'), `---
title: 已发布文章
issue: 42
---

正文内容。
`)
  return root
}

const envFor = (api) => ({ GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url, SYNC_URL: api.url, LANG: 'zh_CN.UTF-8', ...fakeHomeWithConfig({}) })

test('blog unpublish: plan carries issue without requiring title, execute PATCHes state closed only', () => {
  const root = mkdtempSync(join(tmpdir(), 'shadow-blog-'))
  mkdirSync(join(root, 'posts'), { recursive: true })
  // 无 title 的 frontmatter 也可下架（title 非下架必需）
  writeFileSync(join(root, 'posts', 'hello.md'), '---\nissue: 42\n---\n\n正文。\n')
  const api = apiStub([
    { method: 'PATCH', path: '/repos/stack-wuh/blog/issues/42', body: { number: 42, html_url: 'http://127.0.0.1/i/42', state: 'closed' } },
    { method: 'POST', path: '/v2/webhook/sync/42', status: 200, body: { ok: true } }
  ])
  try {
    const env = envFor(api)
    const planned = run(['blog', 'unpublish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    assert.equal(planned.status, 0, planned.stderr)
    const d = JSON.parse(planned.stdout).data
    assert.equal(d.issue, 42)
    assert.ok(!('body' in d), 'unpublish plan must stay lean')
    const result = run(['blog', 'unpublish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(result.status, 0, result.stderr)
    const v = JSON.parse(result.stdout)
    assert.equal(v.data.issue.number, 42)
    assert.equal(v.data.state, 'closed')
    assert.equal(v.data.sync.ok, true)
    const patchCall = api.requests().find(r => r.method === 'PATCH' && r.url.startsWith('/repos/stack-wuh/blog/issues/42'))
    const sent = JSON.parse(patchCall.body)
    assert.deepEqual(sent, { state: 'closed' }, 'unpublish payload must carry state only (INV-2)')
  } finally { api.close() }
})

test('blog unpublish: missing issue number rejects at plan with BLOG_ISSUE_REQUIRED', () => {
  const root = mkdtempSync(join(tmpdir(), 'shadow-blog-'))
  mkdirSync(join(root, 'posts'), { recursive: true })
  writeFileSync(join(root, 'posts', 'hello.md'), '---\ntitle: 未发布\n---\n\n正文。\n')
  const r = run(['blog', 'unpublish', 'plan', '--file', 'posts/hello.md', '--json'], root, fakeHomeWithConfig({}))
  assert.equal(r.status, 1)
  assert.equal(JSON.parse(r.stdout).error.code, 'BLOG_ISSUE_REQUIRED')
})

test('blog publish update path sends state open; create path does not', () => {
  const root = fixtureWithIssue()
  const api = apiStub([
    { method: 'PATCH', path: '/repos/stack-wuh/blog/issues/42', body: { number: 42, html_url: 'http://127.0.0.1/i/42' } },
    { method: 'POST', path: '/v2/webhook/sync/42', status: 200, body: { ok: true } }
  ])
  try {
    const env = envFor(api)
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    const result = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(result.status, 0, result.stderr)
    const patchCall = api.requests().find(r => r.method === 'PATCH' && r.url.startsWith('/repos/stack-wuh/blog/issues/42'))
    const sent = JSON.parse(patchCall.body)
    assert.equal(sent.state, 'open', 'republish must reopen the issue (INV-3)')
    assert.ok(sent.title && 'body' in sent && Array.isArray(sent.labels))
  } finally { api.close() }

  // create 路径不含 state
  const root2 = mkdtempSync(join(tmpdir(), 'shadow-blog-'))
  mkdirSync(join(root2, 'posts'), { recursive: true })
  writeFileSync(join(root2, 'posts', 'new.md'), '---\ntitle: 新文章\n---\n\n正文。\n')
  const api2 = apiStub([
    { method: 'POST', path: '/repos/stack-wuh/blog/issues', body: { number: 7, html_url: 'http://127.0.0.1/i/7' } },
    { method: 'POST', path: '/v2/webhook/sync/7', status: 200, body: { ok: true } }
  ])
  try {
    const env = envFor(api2)
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/new.md', '--json'], root2, env)
    const result = run(['blog', 'publish', 'execute', '--file', 'posts/new.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root2, env)
    assert.equal(result.status, 0, result.stderr)
    const postCall = api2.requests().find(r => r.method === 'POST' && r.url.startsWith('/repos/stack-wuh/blog/issues'))
    assert.ok(!('state' in JSON.parse(postCall.body)), 'create payload must not carry state')
  } finally { api2.close() }
})

test('blog unpublish: planHash chain rejects file edits between plan and execute', () => {
  const root = fixtureWithIssue()
  const api = apiStub([
    { method: 'PATCH', path: '/repos/stack-wuh/blog/issues/42', body: { number: 42, html_url: 'http://127.0.0.1/i/42' } },
    { method: 'POST', path: '/v2/webhook/sync/42', status: 200, body: { ok: true } }
  ])
  try {
    const env = envFor(api)
    const planned = run(['blog', 'unpublish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    writeFileSync(join(root, 'posts', 'hello.md'), readFileSync(join(root, 'posts', 'hello.md'), 'utf8').replace('issue: 42', 'issue: 43'))
    const stale = run(['blog', 'unpublish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(stale.status, 1)
    assert.equal(JSON.parse(stale.stdout).error.code, 'PLAN_HASH_INVALID')
  } finally { api.close() }
})
