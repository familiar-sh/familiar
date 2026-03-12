import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { DATA_DIR, STATE_FILE, TASKS_DIR, DEFAULT_LABEL_COLOR } from '../../src/shared/constants'
import type { ProjectState, Task } from '../../src/shared/types'
import {
  readProjectState,
  writeProjectState,
  readTask,
  writeTask,
  readActivity,
  appendActivity,
  ensureTaskDir,
  deleteTaskDir
} from '../../src/cli/lib/file-ops'
import { createTask } from '../../src/shared/utils/task-utils'
import { generateActivityId } from '../../src/shared/utils/id-generator'

describe('CLI workflow integration test', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-workflow-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  async function initProject(): Promise<ProjectState> {
    const dataDir = path.join(tmpDir, DATA_DIR)
    const tasksDir = path.join(dataDir, TASKS_DIR)
    const statePath = path.join(dataDir, STATE_FILE)

    await fs.mkdir(dataDir, { recursive: true })
    await fs.mkdir(tasksDir, { recursive: true })

    const state: ProjectState = {
      version: 1,
      projectName: 'workflow-test',
      tasks: [],
      columnOrder: ['backlog', 'todo', 'in-progress', 'in-review', 'done', 'archived'],
      labels: []
    }

    await fs.writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8')
    return state
  }

  async function addTask(
    title: string,
    opts: { priority?: Task['priority']; status?: Task['status']; labels?: string[] } = {}
  ): Promise<Task> {
    const state = await readProjectState(tmpDir)
    const status = opts.status ?? 'backlog'
    const tasksInColumn = state.tasks.filter((t) => t.status === status)
    const maxSort = tasksInColumn.length > 0 ? Math.max(...tasksInColumn.map((t) => t.sortOrder)) : -1

    const task = createTask(title, {
      status,
      priority: opts.priority ?? 'none',
      labels: opts.labels ?? [],
      sortOrder: maxSort + 1
    })

    await ensureTaskDir(tmpDir, task.id)
    await writeTask(tmpDir, task)

    const docPath = path.join(tmpDir, DATA_DIR, TASKS_DIR, task.id, 'document.md')
    await fs.writeFile(docPath, '', 'utf-8')

    await appendActivity(tmpDir, task.id, {
      id: generateActivityId(),
      timestamp: task.createdAt,
      type: 'created',
      message: `Task created: ${title}`
    })

    state.tasks.push(task)
    if (opts.labels) {
      for (const label of opts.labels) {
        if (!state.labels.some((l) => l.name === label)) {
          state.labels.push({ name: label, color: DEFAULT_LABEL_COLOR })
        }
      }
    }
    await writeProjectState(tmpDir, state)

    return task
  }

  it('full workflow: init -> add -> list -> update status -> log -> delete -> verify', async () => {
    // 1. Init project
    await initProject()
    let state = await readProjectState(tmpDir)
    expect(state.projectName).toBe('workflow-test')
    expect(state.tasks).toHaveLength(0)

    // 2. Add multiple tasks with various options
    const task1 = await addTask('Build authentication', { priority: 'high', status: 'todo', labels: ['feature'] })
    const task2 = await addTask('Fix CSS bug', { priority: 'urgent', status: 'backlog', labels: ['bug'] })
    const task3 = await addTask('Write tests', { priority: 'medium', status: 'todo' })
    const task4 = await addTask('Deploy to staging', { status: 'backlog' })

    // 3. List and verify all appear
    state = await readProjectState(tmpDir)
    expect(state.tasks).toHaveLength(4)
    const titles = state.tasks.map((t) => t.title)
    expect(titles).toContain('Build authentication')
    expect(titles).toContain('Fix CSS bug')
    expect(titles).toContain('Write tests')
    expect(titles).toContain('Deploy to staging')
    expect(state.labels.some((l) => l.name === 'feature')).toBe(true)
    expect(state.labels.some((l) => l.name === 'bug')).toBe(true)

    // 4. Update status of tasks
    // Move task1 to in-progress
    const t1File = await readTask(tmpDir, task1.id)
    t1File.status = 'in-progress'
    t1File.updatedAt = new Date().toISOString()
    await writeTask(tmpDir, t1File)

    state = await readProjectState(tmpDir)
    const idx1 = state.tasks.findIndex((t) => t.id === task1.id)
    state.tasks[idx1].status = 'in-progress'
    state.tasks[idx1].updatedAt = t1File.updatedAt
    await writeProjectState(tmpDir, state)

    await appendActivity(tmpDir, task1.id, {
      id: generateActivityId(),
      timestamp: t1File.updatedAt,
      type: 'status_change',
      message: 'Status changed from Todo to In Progress'
    })

    // Move task2 to todo
    const t2File = await readTask(tmpDir, task2.id)
    t2File.status = 'todo'
    t2File.updatedAt = new Date().toISOString()
    await writeTask(tmpDir, t2File)

    state = await readProjectState(tmpDir)
    const idx2 = state.tasks.findIndex((t) => t.id === task2.id)
    state.tasks[idx2].status = 'todo'
    state.tasks[idx2].updatedAt = t2File.updatedAt
    await writeProjectState(tmpDir, state)

    // 5. Log messages
    await appendActivity(tmpDir, task1.id, {
      id: generateActivityId(),
      timestamp: new Date().toISOString(),
      type: 'note',
      message: 'Working on OAuth integration'
    })

    await appendActivity(tmpDir, task2.id, {
      id: generateActivityId(),
      timestamp: new Date().toISOString(),
      type: 'note',
      message: 'Identified the CSS specificity issue'
    })

    // 6. Delete task4
    state = await readProjectState(tmpDir)
    const idx4 = state.tasks.findIndex((t) => t.id === task4.id)
    state.tasks.splice(idx4, 1)
    await writeProjectState(tmpDir, state)
    await deleteTaskDir(tmpDir, task4.id)

    // 7. Verify final state
    state = await readProjectState(tmpDir)
    expect(state.tasks).toHaveLength(3)
    expect(state.tasks.find((t) => t.id === task4.id)).toBeUndefined()

    // Verify task1 is in-progress
    const t1Final = await readTask(tmpDir, task1.id)
    expect(t1Final.status).toBe('in-progress')

    // Verify task2 is in todo
    const t2Final = await readTask(tmpDir, task2.id)
    expect(t2Final.status).toBe('todo')

    // Verify activity logs
    const t1Activities = await readActivity(tmpDir, task1.id)
    expect(t1Activities.length).toBeGreaterThanOrEqual(3) // created + status_change + note
    expect(t1Activities.some((a) => a.type === 'status_change')).toBe(true)
    expect(t1Activities.some((a) => a.message === 'Working on OAuth integration')).toBe(true)

    const t2Activities = await readActivity(tmpDir, task2.id)
    expect(t2Activities.some((a) => a.message === 'Identified the CSS specificity issue')).toBe(true)

    // Verify task4 directory is gone
    const task4Dir = path.join(tmpDir, DATA_DIR, TASKS_DIR, task4.id)
    await expect(fs.access(task4Dir)).rejects.toThrow()
  })
})
