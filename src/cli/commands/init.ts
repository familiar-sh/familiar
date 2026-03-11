import { Command } from 'commander'

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a new Kanban Agent project in the current directory')
    .action(() => {
      console.log('Not implemented yet')
    })
}
