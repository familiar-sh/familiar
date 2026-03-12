import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  getDataPath,
  readProjectState,
  writeProjectState,
  readTask,
  writeTask,
  readActivity,
  appendActivity,
  ensureTaskDir,
  deleteTaskDir
} from './file-ops'
import type { ProjectState, Task, ActivityEntry } from '../../shared/types'
import { DATA_DIR, STATE_FILE, TASKS_DIR } from '../../shared/constants'

describe('CLI file-ops', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-fileops-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  async function initProject(): Promise<ProjectState> {
    const dataDir = path.join(tmpDir, DATA_DIR)
    const tasksDir = path.join(dataDir, TASKS_DIR)
    await fs.mkdir(dataDir, { recursive: true })
    await fs.mkdir(tasksDir, { recursive: true })
    const state: ProjectState = {
      version: 1,
      projectName: 'test-project',
      tasks: [],
      columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
      labels: []
    }
    await fs.writeFile(
      path.join(dataDir, STATE_FILE),
      JSON.stringify(state, null, 2) + '\n',
      'utf-8'
    )
    return state
  }

  function makeTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 'tsk_fops01',
      title: 'File ops task',
      status: 'todo',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sortOrder: 0,
      ...overrides
    }
  }

  describe('getDataPath', () => {
    it('returns root + .kanban-agent', () => {
      const result = getDataPath('/some/path')
      expect(result).toBe(path.join('/some/path', DATA_DIR))
    })
  })

  describe('readProjectState / writeProjectState', () => {
    it('round-trips project state', async () => {
      await initProject()

      const state = await readProjectState(tmpDir)
      expect(state.projectName).toBe('test-project')

      state.projectName = 'updated'
      state.labels = [{ name: 'test', color: '#6b7280' }]
      await writeProjectState(tmpDir, state)

      const readBack = await readProjectState(tmpDir)
      expect(readBack.projectName).toBe('updated')
      expect(readBack.labels).toEqual([{ name: 'test', color: '#6b7280' }])
    })
  })

  describe('readTask / writeTask', () => {
    it('round-trips a task', async () => {
      await initProject()

      const task = makeTask({ title: 'Round trip me' })
      await ensureTaskDir(tmpDir, task.id)
      await writeTask(tmpDir, task)

      const readBack = await readTask(tmpDir, task.id)
      expect(readBack.title).toBe('Round trip me')
      expect(readBack.id).toBe(task.id)
      expect(readBack.status).toBe('todo')
    })
  })

  describe('appendActivity / readActivity', () => {
    it('appends and reads back activity entries', async () => {
      await initProject()
      const task = makeTask()
      await ensureTaskDir(tmpDir, task.id)

      const entry: ActivityEntry = {
        id: 'act_test01',
        timestamp: '2026-01-01T00:00:00.000Z',
        type: 'note',
        message: 'Test note'
      }

      await appendActivity(tmpDir, task.id, entry)
      const activities = await readActivity(tmpDir, task.id)
      expect(activities).toHaveLength(1)
      expect(activities[0].message).toBe('Test note')
    })

    it('returns empty array when no activity file exists', async () => {
      await initProject()
      // Don't create any task dir — should return []
      const activities = await readActivity(tmpDir, 'tsk_nonexistent')
      expect(activities).toEqual([])
    })
  })

  describe('ensureTaskDir', () => {
    it('creates task directory and attachments subdirectory', async () => {
      await initProject()
      await ensureTaskDir(tmpDir, 'tsk_ensured')

      const taskDir = path.join(tmpDir, DATA_DIR, TASKS_DIR, 'tsk_ensured')
      const attachDir = path.join(taskDir, 'attachments')

      await expect(fs.access(taskDir)).resolves.toBeUndefined()
      await expect(fs.access(attachDir)).resolves.toBeUndefined()
    })
  })

  describe('deleteTaskDir', () => {
    it('removes the task directory', async () => {
      await initProject()
      await ensureTaskDir(tmpDir, 'tsk_delete_me')
      await deleteTaskDir(tmpDir, 'tsk_delete_me')

      const taskDir = path.join(tmpDir, DATA_DIR, TASKS_DIR, 'tsk_delete_me')
      await expect(fs.access(taskDir)).rejects.toThrow()
    })

    it('does not throw if directory does not exist', async () => {
      await initProject()
      await expect(deleteTaskDir(tmpDir, 'tsk_nope')).resolves.toBeUndefined()
    })
  })
})
