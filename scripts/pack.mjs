#!/usr/bin/env node
// 打包发布产物：dist/shadow-dev-cli-v<version>.tar.gz，解包得到 shadow-dev-cli/ 目录
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dist = join(root, 'dist')
const staging = join(dist, 'staging')

rmSync(dist, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
for (const f of ['cli.mjs', 'lib', 'package.json', 'README.md', 'LICENSE']) {
  cpSync(join(root, f), join(staging, 'shadow-dev-cli', f), { recursive: true })
}
const artifact = join(dist, `shadow-dev-cli-v${version}.tar.gz`)
try {
  // tar 必须用相对路径：Git Bash 的 tar 会把 "D:\..." 解析成"远程主机:路径"
  execFileSync('tar', ['-czf', `dist/shadow-dev-cli-v${version}.tar.gz`, '-C', 'dist/staging', 'shadow-dev-cli'], { cwd: root })
  rmSync(staging, { recursive: true, force: true })
  console.log(artifact)
} catch {
  rmSync(dist, { recursive: true, force: true })
  console.error('pack failed: system `tar` is required on PATH (Windows 10+ ships tar.exe natively; otherwise run from Git Bash)')
  process.exitCode = 1
}
