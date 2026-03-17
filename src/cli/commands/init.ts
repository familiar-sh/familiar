import { Command } from 'commander'
import * as fs from 'fs/promises'
import * as path from 'path'
import chalk from 'chalk'
import { DATA_DIR, STATE_FILE, TASKS_DIR, SETTINGS_FILE } from '../../shared/constants'
import { DEFAULT_COLUMNS, DEFAULT_LABELS } from '../../shared/constants'
import type { ProjectState } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize a new Familiar project in the current directory')
    .action(async () => {
      const cwd = process.cwd()
      const dataDir = path.join(cwd, DATA_DIR)
      const statePath = path.join(dataDir, STATE_FILE)
      const tasksDir = path.join(dataDir, TASKS_DIR)

      // Check if already initialized
      try {
        await fs.access(statePath)
        console.log(chalk.yellow('Project already initialized in this directory.'))
        return
      } catch {
        // Not initialized yet — proceed
      }

      // Create directory structure
      await fs.mkdir(dataDir, { recursive: true })
      await fs.mkdir(tasksDir, { recursive: true })

      // Create default state
      const defaultState: ProjectState = {
        version: 1,
        projectName: path.basename(cwd),
        tasks: [],
        columnOrder: [...DEFAULT_COLUMNS],
        labels: [...DEFAULT_LABELS]
      }

      await fs.writeFile(statePath, JSON.stringify(defaultState, null, 2) + '\n', 'utf-8')

      // Write default settings (includes Start snippet)
      const settingsPath = path.join(dataDir, SETTINGS_FILE)
      await fs.writeFile(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2) + '\n', 'utf-8')

      // Create .gitignore to keep task data out of version control
      const gitignorePath = path.join(dataDir, '.gitignore')
      const gitignoreContent = `# Ignore everything in .familiar/ except project config
*
!.gitignore
!settings.json
`
      await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8')

      console.log(chalk.green('Familiar project initialized successfully!'))
      console.log(chalk.dim(`  Created ${DATA_DIR}/`))
      console.log(chalk.dim(`  Created ${DATA_DIR}/${STATE_FILE}`))
      console.log(chalk.dim(`  Created ${DATA_DIR}/${TASKS_DIR}/`))
      console.log(chalk.dim(`  Created ${DATA_DIR}/${SETTINGS_FILE}`))
    })
}
