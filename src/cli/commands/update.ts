import { Command } from 'commander'
import chalk from 'chalk'
import { DEFAULT_LABEL_COLOR } from '../../shared/constants'
import type { Priority, AgentStatus } from '../../shared/types'
import { isValidPriority } from '../../shared/utils/validators'
import { generateActivityId } from '../../shared/utils/id-generator'
import {
  getProjectRoot,
  readProjectState,
  writeProjectState,
  readTask,
  writeTask,
  appendActivity,
  readSettings,
  writeSettings
} from '../lib/file-ops'

const VALID_AGENT_STATUSES: AgentStatus[] = ['idle', 'running', 'done', 'error']

export function updateCommand(): Command {
  return new Command('update')
    .description('Update an existing task')
    .argument('<id>', 'Task ID')
    .option('-t, --title <title>', 'New title')
    .option('-p, --priority <priority>', 'New priority')
    .option('-l, --labels <labels>', 'New labels (comma-separated)')
    .option('-a, --agent-status <status>', 'New agent status (idle, running, done, error)')
    .action(async (id: string, opts: { title?: string; priority?: string; labels?: string; agentStatus?: string }) => {
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

      if (opts.priority && !isValidPriority(opts.priority)) {
        console.error(chalk.red(`Invalid priority: ${opts.priority}`))
        process.exit(1)
      }

      if (opts.agentStatus && !VALID_AGENT_STATUSES.includes(opts.agentStatus as AgentStatus)) {
        console.error(chalk.red(`Invalid agent status: ${opts.agentStatus}`))
        console.error(chalk.dim('Valid values: idle, running, done, error'))
        process.exit(1)
      }

      const now = new Date().toISOString()
      const changes: string[] = []

      // Read task file
      const task = await readTask(root, id)

      if (opts.title) {
        task.title = opts.title
        state.tasks[taskIndex].title = opts.title
        changes.push(`title -> "${opts.title}"`)
      }

      if (opts.priority) {
        task.priority = opts.priority as Priority
        state.tasks[taskIndex].priority = opts.priority as Priority
        changes.push(`priority -> ${opts.priority}`)
      }

      if (opts.labels) {
        const labels = opts.labels.split(',').map((l) => l.trim()).filter(Boolean)
        task.labels = labels
        state.tasks[taskIndex].labels = labels
        changes.push(`labels -> [${labels.join(', ')}]`)

        // Add new labels to settings
        const settings = await readSettings(root)
        const settingsLabels = settings.labels ?? []
        let settingsChanged = false
        for (const label of labels) {
          if (!settingsLabels.some((l) => l.name === label)) {
            settingsLabels.push({ name: label, color: DEFAULT_LABEL_COLOR })
            settingsChanged = true
          }
        }
        if (settingsChanged) {
          settings.labels = settingsLabels
          await writeSettings(root, settings)
        }

        // Keep project state labels in sync
        for (const label of labels) {
          if (!state.labels.some((l) => l.name === label)) {
            state.labels.push({ name: label, color: DEFAULT_LABEL_COLOR })
          }
        }
      }

      if (opts.agentStatus) {
        task.agentStatus = opts.agentStatus as AgentStatus
        state.tasks[taskIndex].agentStatus = opts.agentStatus as AgentStatus
        changes.push(`agent status -> ${opts.agentStatus}`)
      }

      if (changes.length === 0) {
        console.log(chalk.yellow('No changes specified.'))
        return
      }

      task.updatedAt = now
      state.tasks[taskIndex].updatedAt = now

      await writeTask(root, task)
      await writeProjectState(root, state)

      // Log activity
      await appendActivity(root, id, {
        id: generateActivityId(),
        timestamp: now,
        type: 'updated',
        message: `Updated: ${changes.join(', ')}`,
        metadata: { changes }
      })

      console.log(chalk.green(`Task ${chalk.bold(id)} updated:`))
      for (const change of changes) {
        console.log(chalk.dim(`  ${change}`))
      }
    })
}
