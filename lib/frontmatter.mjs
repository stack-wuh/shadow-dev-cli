// 文章 frontmatter 最小解析器：语料实测全部为单行 `key: value` + 内联数组，
// 不引入 YAML 依赖。支持：裸标量（尾随未引号注释剥离）、单/双引号标量、内联数组、
// 整行 # 注释；未知键静默保留原样（labels/keywords 的逗号串形态由调用方归一）。
export function parseFrontmatter(text) {
  const t = text.replace(/^\uFEFF/, '')
  const lines = t.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { data: {}, content: t }
  let end = -1
  for (let i = 1; i < lines.length; i += 1) if (lines[i].trim() === '---') { end = i; break }
  if (end < 0) return { data: {}, content: t }
  const data = {}
  for (const line of lines.slice(1, end)) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(s)
    if (!kv) continue
    const key = kv[1]
    let v = kv[2].trim()
    if (v.startsWith('[') && v.endsWith(']')) {
      data[key] = v.slice(1, -1).split(',').map(x => unquote(x.trim())).filter(x => x !== '')
      continue
    }
    const quoted = /^(".*"|'.*')$/.test(v)
    if (quoted) v = v.slice(1, -1)
    else v = v.replace(/\s+#.*$/, '').trim()
    data[key] = v
  }
  return { data, content: lines.slice(end + 1).join('\n') }
}

function unquote(v) {
  return /^(".*"|'.*')$/.test(v) ? v.slice(1, -1) : v
}

// labels/keywords 双形态归一（脚本语义一致）：数组逐项或逗号串拆分，去空
export function parseList(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean)
  return []
}
