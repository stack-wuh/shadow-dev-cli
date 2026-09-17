export function out(v, s = 0) { console.log(JSON.stringify(v)); process.exitCode = s }
export function fail(c, m = c, s = 1) { out({ ok: false, error: { code: c, message: m } }, s) }

// JSON 契约面路由：管道/重定向（agent、脚本）恒输出；交互 TTY 默认静默，仅 --json 或 SHADOW_DEV_JSON=1 显式开启。
// 抑制时退出码照常设置，人用信息（含 planHash）由 stderr 层承载。
export function jsonEnabled(o) { return !process.stdout.isTTY || !!o.json || process.env.SHADOW_DEV_JSON === '1' }
