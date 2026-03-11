import { Command } from 'commander'
import { initCommand } from './commands/init'
import { addCommand } from './commands/add'
import { listCommand } from './commands/list'
import { statusCommand } from './commands/status'
import { updateCommand } from './commands/update'
import { deleteCommand } from './commands/delete'
import { logCommand } from './commands/log'
import { notifyCommand } from './commands/notify'
import { openCommand } from './commands/open'
import { syncCommand } from './commands/sync'
import { importCommand } from './commands/import'

const program = new Command()

program
  .name('kanban-agent')
  .description('CLI for Kanban Agent \u2014 manage tasks from the terminal')
  .version('0.1.0')

program.addCommand(initCommand())
program.addCommand(addCommand())
program.addCommand(listCommand())
program.addCommand(statusCommand())
program.addCommand(updateCommand())
program.addCommand(deleteCommand())
program.addCommand(logCommand())
program.addCommand(notifyCommand())
program.addCommand(openCommand())
program.addCommand(syncCommand())
program.addCommand(importCommand())

program.parse()
