import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// issue 正文的唯一来源是 brief：纯字符串拼接，零 LLM 推导、零本地化分支。
// 契约 = 人读分节骨架（白名单搬运）+ 尾部 brief 指针 + 底部一行机器 metadata 注释块。
const CLI_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

const SECTIONS = ['动机', '引用规范', '决策', '任务']
const MISSING = '（brief 缺少该节）'

function splitSections(body) {
  const map = new Map()
  let cur = null
  for (const line of body.replaceAll('\r\n', '\n').split('\n')) {
    const h = /^## (.+?)\s*$/.exec(line)
    if (h) { cur = h[1].trim(); map.set(cur, []) } else if (cur) map.get(cur).push(line)
  }
  for (const [k, v] of map) map.set(k, v.join('\n').trim())
  return map
}

export function renderIssueBody(b, { titleRaw = null, supplement = '' } = {}) {
  const d = b.data
  const found = splitSections(b.body)
  const raw = titleRaw || (b.body.replaceAll('\r\n', '\n').match(/^# (.+)$/m) || [])[1]?.trim() || d.name
  const prefix = `[${d.type}] `
  const title = raw.startsWith(prefix) ? raw : prefix + raw
  const briefPath = `shadow-docs/changes/${d.name}/brief.md`
  const parts = SECTIONS.map(s => `## ${s}\n${found.get(s) || MISSING}`)
  if (supplement && supplement.trim()) parts.push(`## 补充\n${supplement.trim()}`)
  parts.push(`完整 brief：${briefPath}`)
  const meta = {
    name: d.name, type: d.type, scope: d.scope ?? null, status: d.status,
    branch: d.branch ?? null, baseBranch: d.baseBranch ?? null, briefPath, cliVersion: CLI_VERSION,
    prUrl: d.github?.pullRequestUrl ?? null, issueNumber: d.github?.issue ?? null,
  }
  const body = [...parts, `<!-- shadow-dev:issue-metadata ${JSON.stringify(meta)} -->`].join('\n\n') + '\n'
  return {
    title, body,
    sections: SECTIONS.map(s => (found.get(s) ? s : `-${s}`)),
    bodyBytes: Buffer.byteLength(body),
    bodySha256: createHash('sha256').update(body, 'utf8').digest('hex'),
  }
}
