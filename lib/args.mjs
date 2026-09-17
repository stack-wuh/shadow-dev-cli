import { HELP } from './commands.mjs'

export { HELP }

export function args(a) {
  const p = [], o = {}
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) p.push(a[i])
    else { const k = a[i].slice(2); if (['confirm', 'json', 'full', 'help'].includes(k)) o[k] = true; else o[k] = a[++i] }
  }
  return { p, o }
}
