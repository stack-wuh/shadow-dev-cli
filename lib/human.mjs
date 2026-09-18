import { COMMANDS } from './commands.mjs'
import { ui, hint } from './i18n.mjs'

// 人用输出层：只写 stderr；SHADOW_DEV_QUIET 关闭。stdout JSON 契约与本模块完全隔离。
const quiet = () => { const q = process.env.SHADOW_DEV_QUIET; return !!q && q !== '0' }
const w = s => { if (!quiet()) process.stderr.write(s + '\n') }

export function enter(L, p) { w(ui(L, 'enter', { cmd: `shadow-dev ${p.join(' ')}` })) }

export function done(L, v, ms) {
  w(ui(L, 'done', { cmd: v.command, ms }))
  // TTY 抑制 JSON 时，plan 凭证与下一步建议必须仍可从 stderr 恢复
  if (v.planHash) w(ui(L, 'planHash', { hash: v.planHash }))
  if (v.data?.nextStep) w(ui(L, 'next', { step: v.data.nextStep }))
}

// 参数行单一格式源：help 详情与缺参错误共用，内容恒从命令目录派生
const argLine = (L, a) => `    ${a.flag}${a.required ? ' *' : '  '} ${a.desc[L] ?? a.desc.zh}`

export function error(L, e, p, o = {}) {
  const code = e.code || e.message
  w(ui(L, 'error', { code, hint: hint(L, code) }))
  const spec = lookup(p)
  if (!spec) return
  // 必填参数缺失时逐行列出目录中该参数的完整描述（flag → option key 即去掉 -- 前缀）
  for (const a of spec.args) if (a.required && o[a.flag.slice(2)] === undefined) w(argLine(L, a))
  w(ui(L, 'example', { example: spec.example }))
}

export function printVersion(L, v) { w(ui(L, 'version', { v })) }

export function printHelp(L, v) {
  if (v.command === 'help') {
    w(ui(L, 'helpHead'))
    w(ui(L, 'globals'))
    // 人用表与 stdout 是否带 commands 无关，恒从命令目录直读
    for (const key of Object.keys(COMMANDS)) {
      const e = COMMANDS[key]
      w(`  ${e.usage.padEnd(26)} ${e.summary[L] ?? e.summary.zh}`)
    }
    return
  }
  for (const e of Object.values(v.data.commands)) {
    w(`  ${e.usage} — ${e.summary[L] ?? e.summary.zh}`)
    for (const a of e.args) w(argLine(L, a))
    w(ui(L, 'example', { example: e.example }))
  }
}

// nextStep：按命令目录把英文稳定模板实例化为建议命令；数组参数以逗号连接
export function decorate(v, o = {}) {
  if (!v.ok || !v.data || typeof v.data !== 'object') return v
  const next = COMMANDS[v.command]?.next
  if (!next) return v
  const src = { name: o.name, ...v.data, planHash: v.planHash }
  v.data.nextStep = next.replace(/\{(\w+)\}/g, (m, k) => {
    const x = src[k]
    if (x === undefined || x === null) return ''
    return Array.isArray(x) ? x.join(',') : String(x)
  })
  return v
}

function lookup(p) {
  for (let n = p.length; n > 0; n--) {
    const e = COMMANDS[p.slice(0, n).join('.')]
    if (e) return e
  }
  return null
}
