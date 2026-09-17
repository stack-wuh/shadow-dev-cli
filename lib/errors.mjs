// 统一错误构造：code 为稳定机器契约（禁止本地化/随意改名），status 为退出码语义——
// 1 校验或内部失败，2 缺少确认/plan-hash 凭证，3 外部依赖失败（git/API），4 越界的文件操作请求
export function err(c, m = c, s = 1) {
  return Object.assign(Error(m), { code: c, status: s })
}

export function ext(c, m = c) {
  throw err(c, m, 3)
}
