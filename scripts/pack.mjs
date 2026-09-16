#!/usr/bin/env node
// 打包发布产物：dist/shadow-dev-cli-v<version>.tar.gz，解包得到 shadow-dev-cli/ 目录
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const { version } = JSON.parse(await import('node:fs').then(fs => fs.readFileSync(join(root, 'package.json'), 'utf8')))
const dist = join(root, 'dist')
const staging = join(dist, 'staging')

rmSync(dist, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
for (const f of ['cli.mjs', 'lib', 'package.json', 'README.md', 'LICENSE']) {
  cpSync(join(root, f), join(staging, 'shadow-dev-cli', f), { recursive: true })
}
const artifact = join(dist, `shadow-dev-cli-v${version}.tar.gz`)
execFileSync('tar', ['-czf', artifact, '-C', staging, 'shadow-dev-cli'])
rmSync(staging, { recursive: true, force: true })
console.log(artifact)
