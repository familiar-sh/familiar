import { Command } from 'commander'

export function logCommand(): Command {
  return new Command('log')
    .description('Show activity log for a task')
    .action(() => {
      console.log('Not implemented yet')
    })
}
