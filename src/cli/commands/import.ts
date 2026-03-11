import { Command } from 'commander'

export function importCommand(): Command {
  return new Command('import')
    .description('Import tasks from an external source')
    .action(() => {
      console.log('Not implemented yet')
    })
}
