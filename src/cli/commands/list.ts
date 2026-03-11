import { Command } from 'commander'

export function listCommand(): Command {
  return new Command('list')
    .description('List tasks on the board')
    .action(() => {
      console.log('Not implemented yet')
    })
}
