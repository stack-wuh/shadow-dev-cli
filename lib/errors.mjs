export function ext(c, m = c) { throw Object.assign(Error(m), { code: c, status: 3 }) }
