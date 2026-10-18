// blog publish upsert 契约（20261018-feature-blog-publish-upsert）：
// frontmatter issue 号驱动 create-or-update；结果契约新增 created。
// INV-1 有号走 PATCH 不 create；INV-2 无号走 POST created:true；
// INV-3 非法号 plan 拒绝 BLOG_ISSUE_INVALID；INV-4 同步失败不影响发布；
// INV-5 issue 号参与 planHash（plan/execute 间号变更 → PLAN_HASH_INVALID）。
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
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

function fakeHomeWithConfig(content) {
  const home = mkdtempSync(join(tmpdir(), 'shadow-home-'))
  mkdirSync(join(home, '.shadow-dev'), { recursive: true })
  writeFileSync(join(home, '.shadow-dev', 'config.json'), JSON.stringify(content))
  return { HOME: home, USERPROFILE: home }
}

// 与 cli.test.mjs 的 apiStub 同构：本地 HTTP 桩按 method/path 前缀路由，请求落日志供断言
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

function fixture(frontmatter) {
  const root = mkdtempSync(join(tmpdir(), 'shadow-blog-'))
  mkdirSync(join(root, 'posts'), { recursive: true })
  writeFileSync(join(root, 'posts', 'hello.md'), `${frontmatter ?? `---
title: 测试文章
labels: [随笔, 技术]
---

正文内容。
`}`)
  return root
}

const envFor = (api) => ({ GITHUB_TOKEN: 'token', SHADOW_GITHUB_API_URL: api.url, SYNC_URL: api.url, LANG: 'zh_CN.UTF-8', ...fakeHomeWithConfig({}) })

test('blog publish: issue number in frontmatter routes execute to PATCH, created stays false', () => {
  const root = fixture(`---
title: 测试文章
issue: 42
---

正文内容。
`)
  const api = apiStub([
    { method: 'PATCH', path: '/repos/stack-wuh/blog/issues/42', body: { number: 42, html_url: 'http://127.0.0.1/stack-wuh/blog/issues/42' } },
    { method: 'POST', path: '/v2/webhook/sync/42', status: 200, body: { ok: true } },
  ])
  try {
    const env = envFor(api)
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    assert.equal(planned.status, 0, planned.stderr)
    const d = JSON.parse(planned.stdout).data
    assert.equal(d.issue, 42, 'plan data must carry the issue number')
    const result = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(result.status, 0, result.stderr)
    const v = JSON.parse(result.stdout)
    assert.equal(v.data.issue.number, 42)
    assert.equal(v.data.created, false, 'update path must report created:false')
    const calls = api.requests()
    assert.ok(calls.some(r => r.method === 'PATCH' && r.url.startsWith('/repos/stack-wuh/blog/issues/42')), 'must PATCH the issue')
    assert.ok(!calls.some(r => r.method === 'POST' && r.url.startsWith('/repos/stack-wuh/blog/issues')), 'must not create a duplicate issue')
    assert.ok(calls.some(r => r.method === 'POST' && r.url === '/v2/webhook/sync/42'))
  } finally { api.close() }
})

test('blog publish: absent issue number keeps the create path and reports created:true', () => {
  const root = fixture()
  const api = apiStub([
    { method: 'POST', path: '/repos/stack-wuh/blog/issues', body: { number: 99, html_url: 'http://127.0.0.1/stack-wuh/blog/issues/99' } },
    { method: 'POST', path: '/v2/webhook/sync/99', status: 200, body: { ok: true } },
  ])
  try {
    const env = envFor(api)
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    assert.equal(planned.status, 0, planned.stderr)
    assert.ok(!('issue' in JSON.parse(planned.stdout).data), 'plan data must omit issue when frontmatter has none')
    const result = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(result.status, 0, result.stderr)
    const v = JSON.parse(result.stdout)
    assert.equal(v.data.issue.number, 99)
    assert.equal(v.data.created, true)
  } finally { api.close() }
})

test('blog publish: invalid issue numbers are rejected at plan with BLOG_ISSUE_INVALID', () => {
  for (const bad of ['abc', '0', '-3', '1.5', '[1,2]']) {
    const root = fixture(`---
title: 测试文章
issue: ${bad}
---

正文。
`)
    const r = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, fakeHomeWithConfig({}))
    assert.equal(r.status, 1, `issue: ${bad} must fail plan`)
    assert.equal(JSON.parse(r.stdout).error.code, 'BLOG_ISSUE_INVALID', `issue: ${bad}`)
  }
})

test('blog publish: issue number participates in planHash (edit between plan and execute rejects)', () => {
  const root = fixture(`---
title: 测试文章
issue: 42
---

正文内容。
`)
  const api = apiStub([
    { method: 'PATCH', path: '/repos/stack-wuh/blog/issues/42', body: { number: 42, html_url: 'http://127.0.0.1/i/42' } },
    { method: 'POST', path: '/v2/webhook/sync/42', status: 200, body: { ok: true } },
  ])
  try {
    const env = envFor(api)
    const planned = run(['blog', 'publish', 'plan', '--file', 'posts/hello.md', '--json'], root, env)
    assert.equal(planned.status, 0, planned.stderr)
    writeFileSync(join(root, 'posts', 'hello.md'), readFileSync(join(root, 'posts', 'hello.md'), 'utf8').replace('issue: 42', 'issue: 43'))
    const stale = run(['blog', 'publish', 'execute', '--file', 'posts/hello.md', '--plan-hash', JSON.parse(planned.stdout).planHash, '--confirm', '--json'], root, env)
    assert.equal(stale.status, 1)
    assert.equal(JSON.parse(stale.stdout).error.code, 'PLAN_HASH_INVALID')
  } finally { api.close() }
})
