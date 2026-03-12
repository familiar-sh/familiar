import { Command } from 'commander'
import chalk from 'chalk'
import { getProjectRoot, appendNotification } from '../lib/file-ops'
import { generateNotificationId } from '../../shared/utils/id-generator'

export function notifyCommand(): Command {
  return new Command('notify')
    .description('Send an in-app notification to the Kanban Agent UI')
    .argument('<title>', 'Notification title')
    .argument('[body]', 'Notification body')
    .option('--task <taskId>', 'Associate notification with a task')
    .action(async (title: string, body: string | undefined, opts: { task?: string }) => {
      try {
        const root = getProjectRoot()
        await appendNotification(root, {
          id: generateNotificationId(),
          title,
          body,
          taskId: opts.task,
          read: false,
          createdAt: new Date().toISOString()
        })
        console.log(chalk.green('Notification sent.'))
      } catch {
        console.error(chalk.red('Failed to send notification. Is .kanban-agent/ initialized?'))
        process.exit(1)
      }
    })
}
