import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { DATA_DIR, STATE_FILE, SETTINGS_FILE, TASKS_DIR, DEFAULT_LABELS, DEFAULT_LABEL_COLOR } from '../../shared/constants'
import type { ProjectState, Task } from '../../shared/types'
import type { ProjectSettings } from '../../shared/types/settings'

// We test CLI commands by invoking their action handlers indirectly.
// For init, we replicate the logic; for add/list/status/delete/update/log/import
// we call the file-ops functions the commands use, since the commands also call
// process.exit and chalk which make direct invocation tricky.
// Instead, we test by setting up a temp directory, calling init logic, and then
// using file-ops directly (which is what the commands call internally).

import {
  readProjectState,
  writeProjectState,
  readTask,
  writeTask,
  readActivity,
  appendActivity,
  ensureTaskDir,
  deleteTaskDir,
  readSettings
} from '../lib/file-ops'
import { createTask } from '../../shared/utils/task-utils'
import { generateActivityId } from '../../shared/utils/id-generator'
import { buildSettingsSection } from './agents'

describe('CLI commands (via file-ops)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-cmds-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  // Helper: replicate init command logic
  async function runInit(): Promise<void> {
    const dataDir = path.join(tmpDir, DATA_DIR)
    const tasksDir = path.join(dataDir, TASKS_DIR)
    const statePath = path.join(dataDir, STATE_FILE)

    await fs.mkdir(dataDir, { recursive: true })
    await fs.mkdir(tasksDir, { recursive: true })

    const state: ProjectState = {
      version: 1,
      projectName: path.basename(tmpDir),
      tasks: [],
      columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
      labels: [...DEFAULT_LABELS]
    }

    await fs.writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8')
  }

  // Helper: replicate add command logic
  async function runAdd(
    title: string,
    opts: { priority?: string; status?: string; labels?: string } = {}
  ): Promise<Task> {
    const state = await readProjectState(tmpDir)
    const status = (opts.status ?? 'todo') as Task['status']
    const priority = (opts.priority ?? 'none') as Task['priority']
    const labels = opts.labels ? opts.labels.split(',').map((l) => l.trim()).filter(Boolean) : []

    // Shift existing tasks in the target column down to make room at the top
    for (const t of state.tasks) {
      if (t.status === status) {
        t.sortOrder += 1
      }
    }

    const task = createTask(title, {
      status,
      priority,
      labels,
      sortOrder: 0
    })

    await ensureTaskDir(tmpDir, task.id)
    await writeTask(tmpDir, task)

    // Write empty document.md
    const docPath = path.join(tmpDir, DATA_DIR, TASKS_DIR, task.id, 'document.md')
    await fs.writeFile(docPath, '', 'utf-8')

    // Write initial activity
    await appendActivity(tmpDir, task.id, {
      id: generateActivityId(),
      timestamp: task.createdAt,
      type: 'created',
      message: `Task created: ${title}`
    })

    state.tasks.push(task)
    for (const label of labels) {
      if (!state.labels.some((l) => l.name === label)) {
        state.labels.push({ name: label, color: DEFAULT_LABEL_COLOR })
      }
    }
    await writeProjectState(tmpDir, state)

    return task
  }

  describe('init command', () => {
    it('creates directory structure', async () => {
      await runInit()

      const dataDir = path.join(tmpDir, DATA_DIR)
      const tasksDir = path.join(dataDir, TASKS_DIR)
      const statePath = path.join(dataDir, STATE_FILE)

      await expect(fs.access(dataDir)).resolves.toBeUndefined()
      await expect(fs.access(tasksDir)).resolves.toBeUndefined()
      await expect(fs.access(statePath)).resolves.toBeUndefined()

      const state = await readProjectState(tmpDir)
      expect(state.version).toBe(1)
      expect(state.tasks).toEqual([])
      expect(state.columnOrder).toHaveLength(5)
    })
  })

  describe('add command', () => {
    it('creates a task with defaults', async () => {
      await runInit()
      const task = await runAdd('My new task')

      expect(task.title).toBe('My new task')
      expect(task.status).toBe('todo')
      expect(task.priority).toBe('none')

      const state = await readProjectState(tmpDir)
      expect(state.tasks).toHaveLength(1)
      expect(state.tasks[0].title).toBe('My new task')
    })

    it('creates a task with priority and status', async () => {
      await runInit()
      const task = await runAdd('Urgent task', { priority: 'urgent', status: 'todo' })

      expect(task.priority).toBe('urgent')
      expect(task.status).toBe('todo')
    })

    it('creates a task with labels and adds them to project labels', async () => {
      await runInit()
      await runAdd('Labeled task', { labels: 'bug,frontend' })

      const state = await readProjectState(tmpDir)
      expect(state.labels.some((l) => l.name === 'bug')).toBe(true)
      expect(state.labels.some((l) => l.name === 'frontend')).toBe(true)
      expect(state.tasks[0].labels).toEqual(['bug', 'frontend'])
    })
  })

  describe('list command', () => {
    it('lists all tasks from state', async () => {
      await runInit()
      await runAdd('Task A')
      await runAdd('Task B')
      await runAdd('Task C')

      const state = await readProjectState(tmpDir)
      expect(state.tasks).toHaveLength(3)
      const titles = state.tasks.map((t) => t.title)
      expect(titles).toContain('Task A')
      expect(titles).toContain('Task B')
      expect(titles).toContain('Task C')
    })

    it('can filter by status', async () => {
      await runInit()
      await runAdd('Done task', { status: 'done' })
      await runAdd('Todo task', { status: 'todo' })

      const state = await readProjectState(tmpDir)
      const todoTasks = state.tasks.filter((t) => t.status === 'todo')
      expect(todoTasks).toHaveLength(1)
      expect(todoTasks[0].title).toBe('Todo task')
    })
  })

  describe('status command', () => {
    it('updates the status of a task', async () => {
      await runInit()
      const task = await runAdd('Move me')

      // Simulate status command
      const state = await readProjectState(tmpDir)
      const taskIndex = state.tasks.findIndex((t) => t.id === task.id)
      const now = new Date().toISOString()
      state.tasks[taskIndex].status = 'in-progress'
      state.tasks[taskIndex].updatedAt = now

      const taskFile = await readTask(tmpDir, task.id)
      taskFile.status = 'in-progress'
      taskFile.updatedAt = now
      await writeTask(tmpDir, taskFile)
      await writeProjectState(tmpDir, state)

      await appendActivity(tmpDir, task.id, {
        id: generateActivityId(),
        timestamp: now,
        type: 'status_change',
        message: 'Status changed from Todo to In Progress',
        metadata: { from: 'todo', to: 'in-progress' }
      })

      const readBack = await readTask(tmpDir, task.id)
      expect(readBack.status).toBe('in-progress')

      const activities = await readActivity(tmpDir, task.id)
      expect(activities.some((a) => a.type === 'status_change')).toBe(true)
    })
  })

  describe('delete command', () => {
    it('removes a task from state and filesystem', async () => {
      await runInit()
      const task = await runAdd('Delete me')

      // Simulate delete command
      const state = await readProjectState(tmpDir)
      const taskIndex = state.tasks.findIndex((t) => t.id === task.id)
      state.tasks.splice(taskIndex, 1)
      await writeProjectState(tmpDir, state)
      await deleteTaskDir(tmpDir, task.id)

      const readBack = await readProjectState(tmpDir)
      expect(readBack.tasks).toHaveLength(0)

      const taskDir = path.join(tmpDir, DATA_DIR, TASKS_DIR, task.id)
      await expect(fs.access(taskDir)).rejects.toThrow()
    })
  })

  describe('update command', () => {
    it('modifies task fields', async () => {
      await runInit()
      const task = await runAdd('Update me')

      // Simulate update command
      const now = new Date().toISOString()
      const taskFile = await readTask(tmpDir, task.id)
      taskFile.title = 'Updated title'
      taskFile.priority = 'high'
      taskFile.updatedAt = now
      await writeTask(tmpDir, taskFile)

      const state = await readProjectState(tmpDir)
      const idx = state.tasks.findIndex((t) => t.id === task.id)
      state.tasks[idx].title = 'Updated title'
      state.tasks[idx].priority = 'high'
      state.tasks[idx].updatedAt = now
      await writeProjectState(tmpDir, state)

      const readBack = await readTask(tmpDir, task.id)
      expect(readBack.title).toBe('Updated title')
      expect(readBack.priority).toBe('high')
    })
  })

  describe('log command', () => {
    it('appends a note activity entry', async () => {
      await runInit()
      const task = await runAdd('Log to me')

      await appendActivity(tmpDir, task.id, {
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        type: 'note',
        message: 'My log message'
      })

      const activities = await readActivity(tmpDir, task.id)
      // 1 from creation + 1 from log
      expect(activities).toHaveLength(2)
      expect(activities[1].type).toBe('note')
      expect(activities[1].message).toBe('My log message')
    })
  })

  describe('import command', () => {
    it('parses checkbox-style markdown and creates tasks', async () => {
      await runInit()

      const mdContent = [
        '- [ ] First task',
        '- [x] Completed task',
        '- [ ] Third task'
      ].join('\n')

      // Write md file
      const mdPath = path.join(tmpDir, 'import.md')
      await fs.writeFile(mdPath, mdContent, 'utf-8')

      // Simulate the import parse logic
      const lines = mdContent.split('\n')
      const parsed: Array<{ title: string; status: string }> = []
      for (const line of lines) {
        const trimmed = line.trim()
        const match = trimmed.match(/^-\s+\[[ x]?\]\s+(.+)$/i)
        if (match) {
          const isChecked = /\[x\]/i.test(trimmed)
          parsed.push({
            title: match[1].trim(),
            status: isChecked ? 'done' : 'todo'
          })
        }
      }

      expect(parsed).toHaveLength(3)
      expect(parsed[0]).toEqual({ title: 'First task', status: 'todo' })
      expect(parsed[1]).toEqual({ title: 'Completed task', status: 'done' })
      expect(parsed[2]).toEqual({ title: 'Third task', status: 'todo' })

      // Actually create the tasks
      for (const p of parsed) {
        await runAdd(p.title, { status: p.status })
      }

      const state = await readProjectState(tmpDir)
      expect(state.tasks).toHaveLength(3)

      const doneTasks = state.tasks.filter((t) => t.status === 'done')
      expect(doneTasks).toHaveLength(1)
      expect(doneTasks[0].title).toBe('Completed task')
    })

    it('parses heading-style markdown', async () => {
      const mdContent = '## Task: Build login page\n## Task: Create API\n'
      const lines = mdContent.split('\n')
      const parsed: string[] = []
      for (const line of lines) {
        const match = line.trim().match(/^##\s+Task:\s+(.+)$/i)
        if (match) parsed.push(match[1].trim())
      }

      expect(parsed).toEqual(['Build login page', 'Create API'])
    })

    it('parses table-style markdown', async () => {
      const mdContent = [
        '| **T-001** | Setup project | None | 2 |',
        '| **T-002** | Add auth | T-001 | 4 |'
      ].join('\n')

      const lines = mdContent.split('\n')
      const parsed: string[] = []
      for (const line of lines) {
        const match = line.trim().match(/^\|\s*\*?\*?T-\d+\*?\*?\s*\|\s*(.+?)\s*\|/)
        if (match) {
          const title = match[1].trim()
          if (title && title !== 'Title' && !title.match(/^-+$/)) {
            parsed.push(title)
          }
        }
      }

      expect(parsed).toEqual(['Setup project', 'Add auth'])
    })
  })

  describe('readSettings', () => {
    it('returns empty object when settings file does not exist', async () => {
      await runInit()
      const settings = await readSettings(tmpDir)
      expect(settings).toEqual({})
    })

    it('reads settings from file', async () => {
      await runInit()
      const settingsPath = path.join(tmpDir, DATA_DIR, SETTINGS_FILE)
      const settings: ProjectSettings = { simplifyTaskTitles: true }
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')

      const result = await readSettings(tmpDir)
      expect(result.simplifyTaskTitles).toBe(true)
    })
  })

  describe('buildSettingsSection', () => {
    it('returns no-settings message when no settings are enabled', () => {
      const section = buildSettingsSection({})
      expect(section).toContain('No special settings are enabled')
    })

    it('returns no-settings message when simplifyTaskTitles is false', () => {
      const section = buildSettingsSection({ simplifyTaskTitles: false })
      expect(section).toContain('No special settings are enabled')
    })

    it('includes simplifyTaskTitles description when enabled', () => {
      const section = buildSettingsSection({ simplifyTaskTitles: true })
      expect(section).toContain('`simplifyTaskTitles` is ON')
      expect(section).toContain('Simplify the task title')
      expect(section).toContain('Active Settings')
    })
  })
})
