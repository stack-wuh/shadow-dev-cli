import { readFileSync } from 'node:fs'

// 版本号唯一事实源 = 同源 package.json（与 issue-render 的 cliVersion 同一读法）：
// 运行时读取，零编译期注入，release 布局（cli.mjs/lib/package.json 同目录物化）天然成立
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
