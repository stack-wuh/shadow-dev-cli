export function out(v, s = 0) { console.log(JSON.stringify(v)); process.exitCode = s }
export function fail(c, m = c, s = 1) { out({ ok: false, error: { code: c, message: m } }, s) }
