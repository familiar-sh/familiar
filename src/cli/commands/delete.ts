import { Command } from 'commander'

export function deleteCommand(): Command {
  return new Command('delete')
    .description('Delete a task from the board')
    .action(() => {
      console.log('Not implemented yet')
    })
}
