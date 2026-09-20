import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { platform, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const SH = join(REPO, 'scripts', 'install-cli.sh')
const hasBash = spawnSync('bash', ['--version'], { encoding: 'utf8' }).status === 0
const skip = !hasBash && { skip: 'bash unavailable' }

// Git Bash 的 tar/bash 会把 "C:\..." 误读为“远程主机:路径”；传给子进程前统一转正斜杠 POSIX 形态
const toUnix = platform() === 'win32' ? (p) => {
  const r = spawnSync('cygpath', ['-u', p], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : p
} : (p) => p

function run(args, env = {}) {
  return spawnSync('bash', [SH, ...args], { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env } })
}

function makeTarball(version) {
  const dir = mkdtempSync(join(tmpdir(), 'sd-art-'))
  const app = join(dir, 'shadow-dev-cli')
  mkdirSync(app, { recursive: true })
  writeFileSync(join(app, 'cli.mjs'), `console.log(JSON.stringify({ ok: true, command: 'help', data: { help: 'repo inspect' } }))\n`)
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'shadow-dev-cli', version }))
  writeFileSync(join(app, 'README.md'), '# fake artifact\n')
  const tgz = join(dir, `shadow-dev-cli-v${version}.tar.gz`)
  // tar 必须在 bash 内执行：Windows runner 上 node 直 spawn 绑到 System32 bsdtar，读不了 MSYS 路径；
  // bash -c 让测试与 install-cli.sh 本体走同一解析路径（Windows 命中 git 的 GNU tar）
  const r = spawnSync('bash', ['-c', 'tar -czf "$0" -C "$1" shadow-dev-cli', toUnix(tgz), toUnix(dir)], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return tgz
}

function env2() {
  const base = mkdtempSync(join(tmpdir(), 'sd-home-'))
  const prefix = join(base, 'share'), bin = join(base, 'bin')
  mkdirSync(bin, { recursive: true })
  return { base, prefix, bin }
}

test('offline install: pointer, managed shims, installed shim runs', skip, () => {
  const { prefix, bin } = env2()
  const tgz = makeTarball('9.9.9')
  const r = run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json'])
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.ok, true)
  assert.equal(out.version, '9.9.9')
  assert.equal(out.action, 'install')
  assert.equal(readFileSync(join(prefix, 'CURRENT'), 'utf8').trim(), '9.9.9')
  const shim = readFileSync(join(bin, 'shadow-dev'), 'utf8')
  assert.match(shim, /managed-by: shadow-dev-cli-installer/)
  assert.equal(existsSync(join(bin, 'shadow-dev.cmd')), platform() === 'win32', '.cmd shim is generated on Windows only')
  if (platform() === 'win32') {
    const cmd = readFileSync(join(bin, 'shadow-dev.cmd'), 'utf8')
    assert.ok(cmd.includes('\r\n'), '.cmd shim must be CRLF: LF-only batch files make cmd.exe mis-tokenize (stray command errors)')
    assert.ok(!/[^\x00-\x7f]/.test(cmd), '.cmd shim must be ASCII-only (codepage-safe comments)')
  }
  const viaShim = spawnSync('bash', [toUnix(join(bin, 'shadow-dev')), 'help'], { encoding: 'utf8' })
  assert.equal(viaShim.status, 0, viaShim.stderr)
  assert.match(viaShim.stdout, /"ok":true/)
})

test('second install is a no-op; --force reinstalls', skip, () => {
  const { prefix, bin } = env2()
  const tgz = makeTarball('9.9.9')
  run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  const again = JSON.parse(run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json']).stdout)
  assert.equal(again.action, 'none')
  const forced = JSON.parse(run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--force', '--json']).stdout)
  assert.equal(forced.action, 'install')
})

test('unmanaged shim is protected and aborts before any pointer write', skip, () => {
  const { prefix, bin } = env2()
  const tgz = makeTarball('9.9.9')
  writeFileSync(join(bin, 'shadow-dev'), '#!/bin/sh\necho sentinel\n')
  const r = run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  assert.equal(r.status, 1)
  assert.match(r.stderr + r.stdout, /unmanaged/i)
  assert.equal(readFileSync(join(bin, 'shadow-dev'), 'utf8'), '#!/bin/sh\necho sentinel\n')
  assert.ok(!existsSync(join(prefix, 'CURRENT')), 'conflict must fail before publishing')
})

test('rollback roundtrip; rollback without previous exits 1', skip, () => {
  const { prefix, bin } = env2()
  run(['install', '--from', toUnix(makeTarball('9.9.9')), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  run(['install', '--from', toUnix(makeTarball('9.9.10')), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  assert.equal(readFileSync(join(prefix, 'CURRENT'), 'utf8').trim(), '9.9.10')
  const rb = JSON.parse(run(['rollback', '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json']).stdout)
  assert.equal(rb.ok, true)
  assert.equal(readFileSync(join(prefix, 'CURRENT'), 'utf8').trim(), '9.9.9')
  writeFileSync(join(prefix, 'PREVIOUS'), '')
  const none = run(['rollback', '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  assert.equal(none.status, 1)
})

test('artifact without cli.mjs fails selfcheck and leaves pointer untouched', skip, () => {
  const { prefix, bin } = env2()
  const dir = mkdtempSync(join(tmpdir(), 'sd-bad-'))
  mkdirSync(join(dir, 'shadow-dev-cli'))
  writeFileSync(join(dir, 'shadow-dev-cli', 'package.json'), '{"name":"shadow-dev-cli","version":"0.0.1"}')
  writeFileSync(join(dir, 'shadow-dev-cli', 'README.md'), '# nope\n')
  const tgz = join(dir, 'bad.tar.gz')
  spawnSync('bash', ['-c', 'tar -czf "$0" -C "$1" shadow-dev-cli', toUnix(tgz), toUnix(dir)])
  const r = run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  assert.equal(r.status, 3)
  assert.ok(!existsSync(join(prefix, 'CURRENT')))
})

test('link maps shim to a live repo dir, wins over release, unlink restores materialized track', skip, () => {
  const { prefix, bin } = env2()
  const fake = mkdtempSync(join(tmpdir(), 'sd-repo-'))
  writeFileSync(join(fake, 'cli.mjs'), 'console.log(JSON.stringify({ok:true,command:"help",data:{help:"LINKED"}}))\n')
  writeFileSync(join(fake, 'package.json'), '{"name":"shadow-dev-cli","version":"8.8.8"}')
  const linked = run(['link', toUnix(fake), '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json'])
  assert.equal(linked.status, 0, linked.stderr)
  assert.equal(JSON.parse(linked.stdout).action, 'link')
  const viaShim = spawnSync('bash', [toUnix(join(bin, 'shadow-dev')), 'help'], { encoding: 'utf8' })
  assert.equal(viaShim.status, 0, viaShim.stderr)
  assert.match(viaShim.stdout, /LINKED/, 'shim must resolve LINK target')
  // release 安装不改变 LINK：双轨并存，LINK 优先
  const inst = run(['install', '--from', toUnix(makeTarball('9.9.9')), '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json'])
  assert.equal(inst.status, 0, inst.stderr)
  const still = spawnSync('bash', [toUnix(join(bin, 'shadow-dev')), 'help'], { encoding: 'utf8' })
  assert.match(still.stdout, /LINKED/, 'LINK keeps priority over a later release install')
  const st = JSON.parse(run(['status', '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json']).stdout)
  assert.equal(st.current, '9.9.9')
  assert.ok(st.linked, 'status must expose the linked target')
  const un = run(['unlink', '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json'])
  assert.equal(un.status, 0, un.stderr)
  const back = spawnSync('bash', [toUnix(join(bin, 'shadow-dev')), 'help'], { encoding: 'utf8' })
  assert.match(back.stdout, /repo inspect/, 'after unlink the shim falls back to the materialized CURRENT')
  assert.equal(run(['unlink', '--prefix', toUnix(prefix), '--bin', toUnix(bin)]).status, 1, 'unlink without LINK fails')
})

test('link rejects invalid targets and unmanaged shims without writing any pointer', skip, () => {
  const { prefix, bin } = env2()
  assert.equal(run(['link', '--prefix', toUnix(prefix), '--bin', toUnix(bin)]).status, 1, 'link needs a target')
  const empty = mkdtempSync(join(tmpdir(), 'sd-notrepo-'))
  assert.equal(run(['link', toUnix(empty), '--prefix', toUnix(prefix), '--bin', toUnix(bin)]).status, 3, 'missing cli.mjs is an artifact failure')
  assert.ok(!existsSync(join(prefix, 'LINK')), 'failed link must not write the pointer')
  const broken = mkdtempSync(join(tmpdir(), 'sd-smoke-'))
  writeFileSync(join(broken, 'cli.mjs'), 'process.exit(7)\n')
  writeFileSync(join(broken, 'package.json'), '{"name":"shadow-dev-cli","version":"0.0.0"}')
  assert.equal(run(['link', toUnix(broken), '--prefix', toUnix(prefix), '--bin', toUnix(bin)]).status, 3, 'smoke failure is a selfcheck failure')
  assert.ok(!existsSync(join(prefix, 'LINK')))
  const good = mkdtempSync(join(tmpdir(), 'sd-repo2-'))
  writeFileSync(join(good, 'cli.mjs'), 'console.log(JSON.stringify({ok:true,command:"help",data:{help:"LINKED"}}))\n')
  writeFileSync(join(good, 'package.json'), '{"name":"shadow-dev-cli","version":"8.8.8"}')
  writeFileSync(join(bin, 'shadow-dev'), '#!/bin/sh\necho sentinel\n')
  const guard = run(['link', toUnix(good), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  assert.equal(guard.status, 1)
  assert.match(guard.stderr + guard.stdout, /unmanaged/i)
  assert.ok(!existsSync(join(prefix, 'LINK')), 'shim conflict must fail before writing LINK')
  assert.equal(readFileSync(join(bin, 'shadow-dev'), 'utf8'), '#!/bin/sh\necho sentinel\n')
})

test('dry-run writes nothing; status reflects installed version; bad args rejected', skip, () => {
  const { prefix, bin } = env2()
  const tgz = makeTarball('9.9.9')
  const dry = run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--dry-run', '--json'])
  assert.equal(dry.status, 0, dry.stderr)
  assert.equal(JSON.parse(dry.stdout).action, 'dry-run')
  assert.ok(!existsSync(join(prefix, 'CURRENT')))
  run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  const st = JSON.parse(run(['status', '--prefix', toUnix(prefix), '--bin', toUnix(bin), '--json']).stdout)
  assert.equal(st.current, '9.9.9')
  assert.equal(run(['install', '--from', toUnix(tgz), '--version', 'v1.0.0', '--prefix', toUnix(prefix)]).status, 1)
})
