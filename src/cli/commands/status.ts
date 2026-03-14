import { Command } from 'commander'
import chalk from 'chalk'
import { execSync } from 'child_process'
import type { TaskStatus } from '../../shared/types'
import { COLUMN_LABELS } from '../../shared/constants'
import { isValidTaskStatus } from '../../shared/utils/validators'
import { generateActivityId } from '../../shared/utils/id-generator'
import {
  getProjectRoot,
  readProjectState,
  writeProjectState,
  writeTask,
  readTask,
  appendActivity
} from '../lib/file-ops'

export function statusCommand(): Command {
  return new Command('status')
    .description('Update the status of a task')
    .argument('<id>', 'Task ID')
    .argument('<status>', 'New status (todo, in-progress, in-review, done, archived)')
    .action(async (id: string, status: string) => {
      if (!isValidTaskStatus(status)) {
        console.error(chalk.red(`Invalid status: ${status}`))
        console.error(chalk.dim('Valid values: todo, in-progress, in-review, done, archived'))
        process.exit(1)
      }

      const root = getProjectRoot()

      let state
      try {
        state = await readProjectState(root)
      } catch {
        console.error(chalk.red('Project not initialized. Run `familiar init` first.'))
        process.exit(1)
      }

      const taskIndex = state.tasks.findIndex((t) => t.id === id)
      if (taskIndex === -1) {
        console.error(chalk.red(`Task not found: ${id}`))
        process.exit(1)
      }

      const oldStatus = state.tasks[taskIndex].status
      const newStatus = status as TaskStatus
      const now = new Date().toISOString()

      // Move task to top of new column: shift existing tasks down, set sortOrder 0
      if (oldStatus !== newStatus) {
        for (const t of state.tasks) {
          if (t.status === newStatus) {
            t.sortOrder = (t.sortOrder ?? 0) + 1
            t.updatedAt = now
          }
        }
        state.tasks[taskIndex].sortOrder = 0

        // Re-index old column to close the gap
        const oldColumnTasks = state.tasks
          .filter((t) => t.id !== id && t.status === oldStatus)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        for (let i = 0; i < oldColumnTasks.length; i++) {
          oldColumnTasks[i].sortOrder = i
          oldColumnTasks[i].updatedAt = now
        }
      }

      // Update task in state
      state.tasks[taskIndex].status = newStatus
      state.tasks[taskIndex].updatedAt = now
      if (oldStatus !== newStatus) {
        state.tasks[taskIndex].statusChangedAt = now
      }
      if (newStatus === 'archived') {
        state.tasks[taskIndex].agentStatus = 'idle'
      } else if (newStatus === 'in-review' || newStatus === 'done') {
        if (state.tasks[taskIndex].agentStatus === 'running') {
          state.tasks[taskIndex].agentStatus = 'done'
        }
      }

      // Update task file
      const task = await readTask(root, id)
      task.status = newStatus
      task.sortOrder = state.tasks[taskIndex].sortOrder
      task.updatedAt = now
      if (oldStatus !== newStatus) {
        task.statusChangedAt = now
      }
      if (newStatus === 'archived') {
        task.agentStatus = 'idle'
      } else if (newStatus === 'in-review' || newStatus === 'done') {
        if (task.agentStatus === 'running') {
          task.agentStatus = 'done'
        }
      }
      await writeTask(root, task)

      // Log activity
      await appendActivity(root, id, {
        id: generateActivityId(),
        timestamp: now,
        type: 'status_change',
        message: `Status changed from ${COLUMN_LABELS[oldStatus]} to ${COLUMN_LABELS[newStatus]}`,
        metadata: { from: oldStatus, to: newStatus }
      })

      // Kill tmux sessions when archiving
      if (newStatus === 'archived') {
        try {
          const output = execSync('tmux list-sessions -F "#{session_name}"', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
          })
          const sessions = output.trim().split('\n').filter(Boolean)
          const taskSessions = sessions.filter((s) => s.startsWith(`familiar-${id}`))
          for (const session of taskSessions) {
            try {
              execSync(`tmux kill-session -t "${session}"`, { stdio: 'pipe' })
            } catch {
              // Session may already be dead
            }
          }
          if (taskSessions.length > 0) {
            console.log(chalk.dim(`Killed ${taskSessions.length} tmux session(s) for task ${id}`))
          }
        } catch {
          // tmux not available or no sessions — ignore
        }
      }

      // Write state
      await writeProjectState(root, state)

      console.log(chalk.green(`Task ${chalk.bold(id)} status updated: ${COLUMN_LABELS[oldStatus]} -> ${COLUMN_LABELS[newStatus]}`))

      if (newStatus === 'done') {
        console.log(chalk.dim('Hint: Use `familiar notify` to send a completion notification.'))
      }
    })
}
