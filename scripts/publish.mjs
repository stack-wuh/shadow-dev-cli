#!/usr/bin/env node
// publish.mjs —— CLI 发布链的唯一实现。CI 只委派本脚本（.github/workflows/publish.yml 一行 run），
// 断言绝不在 yml 里重抄一遍：两份实现意味着改一处漏一处，门就会给出假绿。
// 五步顺序固定：版本权威 → pack → 资产名契约 → 上传 → 回读校验；任一步失败即非零退出且不上传。
// 退出：0 通过 · 1 断言失败（版本/资产名/回读） · 2 参数错误 · 3 外部命令失败（tar/gh/api）
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export const ASSET_RE = /^shadow-dev-cli-v[0-9][0-9.]*\.tar\.gz$/
export const readVersion = (root = ROOT) => JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

// 版本权威：tag 去掉 v 必须等于 package.json 的 version。缺这一步会把「bump 没进 tag」的发版静默放过去。
export function assertVersion(version, tag) {
  const want = String(tag || '').replace(/^v/, '')
  if (!want) throw new Error('EMPTY_TAG: --tag must carry a version')
  if (version !== want) throw new Error(`VERSION_AUTHORITY: package.json ${version} != tag ${want}`)
  return want
}

// 资产名契约：安装器按这个名字正则找资产，名字写错等于没发布（消费侧 RELEASE_NOT_FOUND / asset not found）。
export function assertAssetName(name) {
  if (!ASSET_RE.test(name)) throw new Error(`ASSET_NAME_CONTRACT: [${name}] violates ^shadow-dev-cli-v[0-9][0-9.]*\.tar\.gz$`)
  return name
}

export function packArtifact() {
  const out = execFileSync('node', [join(ROOT, 'scripts', 'pack.mjs')], { cwd: ROOT, encoding: 'utf8' }).trim()
  const line = out.split(String.fromCharCode(10)).pop().trim()
  if (!line || !existsSync(line)) throw new Error('PACK_OUTPUT_UNRESOLVED: pack.mjs did not print an existing artifact path')
  return line
}

function gh(args) { return execFileSync('gh', args, { encoding: 'utf8' }).trim() }

export function upload(tag, artifact, repo) { gh(['release', 'upload', tag, artifact, '--clobber', '--repo', repo]) }

// 回读校验：上传成功不等于资产真的可被解析。v1.6.0 的实测教训就是 release 建好了、assets 是空数组。
export function readBackAssetNames(tag, repo) {
  const out = gh(['api', `repos/${repo}/releases/tags/${tag}`, '--jq', '.assets | map(.name) | join(",")'])
  return out ? out.split(',').filter(Boolean) : []
}

function parse(a) {
  const o = { tag: '', repo: 'stack-wuh/shadow-dev-cli', dry: false, json: false }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--tag') o.tag = a[++i] || ''
    else if (a[i] === '--repo') o.repo = a[++i] || ''
    else if (a[i] === '--dry-run') o.dry = true
    else if (a[i] === '--json') o.json = true
    else { const e = new Error('USAGE: publish.mjs --tag vA.B.C [--repo owner/name] [--dry-run] [--json]'); e.code = 'USAGE'; throw e }
  }
  if (!o.tag) { const e = new Error('--tag is required'); e.code = 'USAGE'; throw e }
  return o
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const o = parse(process.argv.slice(2))
    const version = readVersion()
    const want = assertVersion(version, o.tag)
    const artifact = o.dry ? join(ROOT, 'dist', `shadow-dev-cli-v${want}.tar.gz`) : packArtifact()
    const name = assertAssetName(basename(artifact))
    const steps = ['version-authority ok ' + want, 'pack ' + name, 'asset-contract ok']
    if (o.dry) {
      steps.push('upload skipped (dry-run)', 'read-back skipped (dry-run)')
    } else {
      upload(o.tag, artifact, o.repo)
      const names = readBackAssetNames(o.tag, o.repo)
      if (!names.includes(name)) throw new Error(`READ_BACK_FAILED: release ${o.tag} assets=[${names.join(', ')}] lacks ${name}`)
      steps.push('upload ok', `read-back ok [${names.join(', ')}]`)
    }
    console.log(o.json ? JSON.stringify({ ok: true, tag: o.tag, name, steps }) : 'ok ' + o.tag + ' — ' + steps.join(' → '))
  } catch (e) {
    const code = e.code === 'USAGE' ? 2 : /AUTHORITY|CONTRACT|EMPTY_TAG|UNRESOLVED|READ_BACK/.test(String(e.message)) ? 1 : 3
    if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: e.message }))
    else console.error('publish: ' + e.message)
    process.exit(code)
  }
}
