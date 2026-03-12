import { Command } from 'commander'
import * as fs from 'fs/promises'
import * as path from 'path'
import chalk from 'chalk'
import { DOCUMENT_FILE } from '../../shared/constants'
import type { TaskStatus, Priority } from '../../shared/types'
import { createTask } from '../../shared/utils/task-utils'
import { generateActivityId } from '../../shared/utils/id-generator'
import {
  getProjectRoot,
  getDataPath,
  readProjectState,
  writeProjectState,
  writeTask,
  appendActivity,
  ensureTaskDir
} from '../lib/file-ops'

interface ParsedTask {
  title: string
  priority: Priority
  status: TaskStatus
}

function parseMarkdownTasks(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Format: - [ ] Task title
    const checkboxMatch = trimmed.match(/^-\s+\[[ x]?\]\s+(.+)$/i)
    if (checkboxMatch) {
      const isChecked = /\[x\]/i.test(trimmed)
      tasks.push({
        title: checkboxMatch[1].trim(),
        priority: 'none',
        status: isChecked ? 'done' : 'todo'
      })
      continue
    }

    // Format: ## Task: Title
    const headingMatch = trimmed.match(/^##\s+Task:\s+(.+)$/i)
    if (headingMatch) {
      tasks.push({
        title: headingMatch[1].trim(),
        priority: 'none',
        status: 'todo'
      })
      continue
    }

    // Format: | **T-XXX** | Title | Dependencies | Hours |
    const tableMatch = trimmed.match(/^\|\s*\*?\*?T-\d+\*?\*?\s*\|\s*(.+?)\s*\|/)
    if (tableMatch) {
      // Skip header/separator rows
      const titleCandidate = tableMatch[1].trim()
      if (titleCandidate && titleCandidate !== 'Title' && !titleCandidate.match(/^-+$/)) {
        tasks.push({
          title: titleCandidate,
          priority: 'none',
          status: 'todo'
        })
      }
      continue
    }
  }

  return tasks
}

export function importCommand(): Command {
  return new Command('import')
    .description('Import tasks from a markdown file')
    .argument('<file>', 'Markdown file to import')
    .action(async (file: string) => {
      const root = getProjectRoot()

      let state
      try {
        state = await readProjectState(root)
      } catch {
        console.error(chalk.red('Project not initialized. Run `kanban-agent init` first.'))
        process.exit(1)
      }

      // Read the file
      const filePath = path.resolve(file)
      let content: string
      try {
        content = await fs.readFile(filePath, 'utf-8')
      } catch {
        console.error(chalk.red(`Could not read file: ${filePath}`))
        process.exit(1)
      }

      const parsed = parseMarkdownTasks(content)

      if (parsed.length === 0) {
        console.log(chalk.yellow('No tasks found in the file.'))
        console.log(chalk.dim('Supported formats:'))
        console.log(chalk.dim('  - [ ] Task title'))
        console.log(chalk.dim('  ## Task: Title'))
        console.log(chalk.dim('  | **T-001** | Title | Deps | Hours |'))
        return
      }

      const now = new Date().toISOString()
      let created = 0

      for (const parsed_task of parsed) {
        const maxSort = state.tasks.length > 0
          ? Math.max(...state.tasks.map((t) => t.sortOrder))
          : -1

        const task = createTask(parsed_task.title, {
          status: parsed_task.status,
          priority: parsed_task.priority,
          sortOrder: maxSort + 1
        })

        // Create task directory
        await ensureTaskDir(root, task.id)
        await writeTask(root, task)

        // Write empty document.md
        const docPath = path.join(getDataPath(root), 'tasks', task.id, DOCUMENT_FILE)
        await fs.writeFile(docPath, '', 'utf-8')

        // Write activity
        await appendActivity(root, task.id, {
          id: generateActivityId(),
          timestamp: now,
          type: 'created',
          message: `Imported from ${path.basename(filePath)}`
        })

        state.tasks.push(task)
        created++

        console.log(chalk.dim(`  + ${task.id}: ${task.title}`))
      }

      await writeProjectState(root, state)

      console.log(chalk.green(`\nImported ${chalk.bold(String(created))} task(s) from ${path.basename(filePath)}`))
    })
}
