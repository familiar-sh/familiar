import { Command } from 'commander'

export function statusCommand(): Command {
  return new Command('status')
    .description('Show or update the status of a task')
    .action(() => {
      console.log('Not implemented yet')
    })
}
