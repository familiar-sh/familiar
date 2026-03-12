import { Command } from 'commander'
import chalk from 'chalk'
import type { TaskStatus, Priority, Task } from '../../shared/types'
import { COLUMN_LABELS, AGENT_STATUS_LABELS } from '../../shared/constants'
import { isValidTaskStatus, isValidPriority } from '../../shared/utils/validators'
import { getProjectRoot, readProjectState } from '../lib/file-ops'

const STATUS_COLORS: Record<TaskStatus, (s: string) => string> = {
  todo: chalk.blue,
  'in-progress': chalk.yellow,
  'in-review': chalk.magenta,
  done: chalk.green,
  archived: chalk.strikethrough.gray
}

const PRIORITY_COLORS: Record<Priority, (s: string) => string> = {
  urgent: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.green,
  none: chalk.gray
}

function padRight(str: string, len: number): string {
  // Strip ANSI for length calculation
  const stripped = str.replace(/\u001b\[\d+(;\d+)*m/g, '')
  if (stripped.length >= len) return str
  return str + ' '.repeat(len - stripped.length)
}

export function listCommand(): Command {
  return new Command('list')
    .description('List tasks on the board')
    .option('-s, --status <status>', 'Filter by status')
    .option('-p, --priority <priority>', 'Filter by priority')
    .option('--json', 'Output as JSON')
    .action(async (opts: { status?: string; priority?: string; json?: boolean }) => {
      const root = getProjectRoot()

      let state
      try {
        state = await readProjectState(root)
      } catch {
        console.error(chalk.red('Project not initialized. Run `kanban-agent init` first.'))
        process.exit(1)
      }

      let tasks = state.tasks

      // Filter by status
      if (opts.status) {
        if (!isValidTaskStatus(opts.status)) {
          console.error(chalk.red(`Invalid status: ${opts.status}`))
          process.exit(1)
        }
        tasks = tasks.filter((t) => t.status === opts.status)
      }

      // Filter by priority
      if (opts.priority) {
        if (!isValidPriority(opts.priority)) {
          console.error(chalk.red(`Invalid priority: ${opts.priority}`))
          process.exit(1)
        }
        tasks = tasks.filter((t) => t.priority === opts.priority)
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(tasks, null, 2))
        return
      }

      if (tasks.length === 0) {
        console.log(chalk.dim('No tasks found.'))
        return
      }

      // Table output
      const header = `${padRight(chalk.bold('ID'), 20)}  ${padRight(chalk.bold('Title'), 35)}  ${padRight(chalk.bold('Status'), 18)}  ${padRight(chalk.bold('Priority'), 14)}  ${chalk.bold('Agent')}`
      console.log(header)
      console.log(chalk.dim('-'.repeat(100)))

      for (const task of tasks) {
        const statusColor = STATUS_COLORS[task.status] || chalk.white
        const priorityColor = PRIORITY_COLORS[task.priority] || chalk.white

        const id = padRight(chalk.cyan(task.id), 20)
        const title = padRight(task.title.length > 30 ? task.title.slice(0, 27) + '...' : task.title, 35)
        const status = padRight(statusColor(COLUMN_LABELS[task.status] || task.status), 18)
        const priority = padRight(priorityColor(task.priority), 14)
        const agent = AGENT_STATUS_LABELS[task.agentStatus] || task.agentStatus

        console.log(`${id}  ${title}  ${status}  ${priority}  ${agent}`)
      }

      console.log(chalk.dim(`\n${tasks.length} task(s)`))
    })
}
