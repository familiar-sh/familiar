import { Command } from 'commander'

export function notifyCommand(): Command {
  return new Command('notify')
    .description('Send a notification to the Kanban Agent app')
    .action(() => {
      console.log('Not implemented yet')
    })
}
