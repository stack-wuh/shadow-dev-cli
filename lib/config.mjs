// .shadow-dev/ 双层配置的唯一定位入口:项目级(cwd 向上第一个命中)+ 用户级(~/.shadow-dev)。
// 生效顺序由各读取点决定:flag > env > 项目 config > 用户 config > 内置默认;未知键静默忽略保持前向兼容。
// 损坏 JSON/键类型不符不 throw 而是记入 CONFIG_INVALID——catch 阶段的 jsonEnabled 会重入 cfg,读取路径必须永不抛错;
// 主流程在参数解析后调 checkConfig() 显式报错。
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { err } from './errors.mjs'

const KEYS = {
  lang: v => v === 'zh' || v === 'en',
  quiet: v => typeof v === 'boolean',
  json: v => typeof v === 'boolean',
  'github.apiBaseUrl': v => typeof v === 'string' && v.startsWith('http'),
  'github.timeoutMs': v => Number.isInteger(v) && v > 0,
}

let cache = null

function loadLayer(path) {
  if (!existsSync(path)) return {}
  let data
  try { data = JSON.parse(readFileSync(path, 'utf8')) }
  catch { return { __broken: `not valid JSON: ${path}` } }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return { __broken: `expected a JSON object: ${path}` }
  return data
}

function ensure() {
  if (cache) return cache
  const paths = []
  let dir = process.cwd()
  for (;;) {
    const p = join(dir, '.shadow-dev', 'config.json')
    if (existsSync(p)) { paths.push(p); break }
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  try { paths.push(join(homedir(), '.shadow-dev', 'config.json')) } catch { /* 无用户目录环境:仅项目层 */ }
  let error = null
  const data = paths.map(path => {
    const layer = loadLayer(path)
    if (layer.__broken && !error) error = err('CONFIG_INVALID', `CONFIG_INVALID: ${layer.__broken}`, 1)
    return layer.__broken ? {} : layer
  })
  cache = { data, error }
  return cache
}

export function checkConfig() {
  const { error } = ensure()
  if (error) throw error
}

export function cfg(key) {
  const c = ensure()
  const validate = KEYS[key]
  for (const layer of c.data) {
    let v = layer
    for (const seg of key.split('.')) {
      if (v === null || typeof v !== 'object' || !(seg in v)) { v = undefined; break }
      v = v[seg]
    }
    if (v === undefined) continue
    if (validate && !validate(v)) {
      if (!c.error) c.error = err('CONFIG_INVALID', `CONFIG_INVALID: "${key}" has an invalid value`, 1)
      continue
    }
    return v
  }
  return undefined
}
