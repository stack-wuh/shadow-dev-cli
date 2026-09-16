export const HELP = 'repo inspect\nchange create|approve\nissue plan|execute\nbranch plan|execute\nsync plan|execute\nconflict inspect\ntask list|set\nreview plan|execute\ncommit plan|execute\npublish plan|execute\nrelease plan|execute\npr inspect\nreconcile plan|execute\narchive plan|execute\nindex rebuild plan|execute'

export function args(a) {
  const p = [], o = {}
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) p.push(a[i])
    else { const k = a[i].slice(2); if (['confirm', 'json'].includes(k)) o[k] = true; else o[k] = a[++i] }
  }
  return { p, o }
}
