import { brief, write, tasks } from '../brief.mjs'
import { name, confirm } from '../input.mjs'
import { err } from '../errors.mjs'

export function list(r, o) {
  return { tasks: tasks(brief(r, name(o)).body) }
}

export function set(r, o) {
  confirm(o)
  const b = brief(r, name(o)), n = Number(String(o.task || '').replace('task-', ''))
  if (!Number.isInteger(n) || !['todo', 'done'].includes(o.state)) throw err('INVALID_TASK')
  let i = 0
  b.body = b.body.replace(/^(\s*- \[)([ xX])(\]\s+.+)$/gm, (m, x, y, z) => {
    i++
    return i === n ? `${x}${o.state === 'done' ? 'x' : ' '}${z}` : m
  })
  if (i < n) throw err('TASK_NOT_FOUND')
  if (b.data.status === 'draft') b.data.status = 'implementing'
  write(b)
  return { task: `task-${n}`, state: o.state }
}
