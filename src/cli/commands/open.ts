import { Command } from 'commander'

export function openCommand(): Command {
  return new Command('open')
    .description('Open a task in the Kanban Agent app')
    .action(() => {
      console.log('Not implemented yet')
    })
}
