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
  const r = spawnSync('tar', ['-czf', toUnix(tgz), '-C', toUnix(dir), 'shadow-dev-cli'], { encoding: 'utf8' })
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
  assert.ok(existsSync(join(bin, 'shadow-dev.cmd')))
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
  spawnSync('tar', ['-czf', toUnix(tgz), '-C', toUnix(dir), 'shadow-dev-cli'])
  const r = run(['install', '--from', toUnix(tgz), '--prefix', toUnix(prefix), '--bin', toUnix(bin)])
  assert.equal(r.status, 3)
  assert.ok(!existsSync(join(prefix, 'CURRENT')))
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
