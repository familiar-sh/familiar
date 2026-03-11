import { Command } from 'commander'

export function addCommand(): Command {
  return new Command('add')
    .description('Add a new task to the board')
    .action(() => {
      console.log('Not implemented yet')
    })
}
