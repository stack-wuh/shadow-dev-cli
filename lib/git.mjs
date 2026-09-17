import { execFileSync } from 'node:child_process'
import { err } from './errors.mjs'

export function git(r, a, o = {}) {
  return execFileSync('git', a, { cwd: r, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o }).trim()
}

export function root() {
  try { return git(process.cwd(), ['rev-parse', '--show-toplevel']) } catch { throw err('NOT_GIT_REPOSITORY') }
}

export function repo(r) {
  const s = git(r, ['status', '--porcelain'])
  return {
    root: r,
    branch: git(r, ['branch', '--show-current']),
    head: git(r, ['rev-parse', 'HEAD']),
    clean: !s,
    // porcelain 重命名行为 "R  old -> new"，取箭头右侧的新路径
    changedFiles: s ? s.split('\n').map(x => x.slice(3).split(' -> ').pop()).sort() : [],
  }
}
