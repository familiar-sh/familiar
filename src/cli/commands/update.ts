import { Command } from 'commander'

export function updateCommand(): Command {
  return new Command('update')
    .description('Update an existing task')
    .action(() => {
      console.log('Not implemented yet')
    })
}
