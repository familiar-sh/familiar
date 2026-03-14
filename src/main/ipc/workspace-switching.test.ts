/**
 * Integration test for backend workspace switching.
 *
 * Tests the actual WorkspaceManager + DataService + workspace handler flow
 * to verify the shared dataService gets updated when projects switch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WorkspaceManager } from '../services/workspace-manager'
import { DataService } from '../services/data-service'
import { registerWorkspaceHandlers } from './workspace-handlers'
import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Mock electron's ipcMain
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

// Create real temp directories with .familiar/ state
function createProjectDir(name: string, tasks: { id: string; title: string }[] = []): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `familiar-test-${name}-`))
  const familiarDir = path.join(dir, '.familiar')
  fs.mkdirSync(familiarDir, { recursive: true })
  fs.mkdirSync(path.join(familiarDir, 'tasks'), { recursive: true })

  const state = {
    version: 1,
    projectName: name,
    tasks: tasks.map((t, i) => ({
      id: t.id,
      title: t.title,
      status: 'todo',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      sortOrder: i
    })),
    columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
    labels: []
  }
  fs.writeFileSync(path.join(familiarDir, 'state.json'), JSON.stringify(state, null, 2))

  const notifications = tasks.map((t, i) => ({
    id: `notif_${name}_${i}`,
    title: `${name} notification`,
    taskId: t.id,
    read: false,
    createdAt: '2026-01-01T00:00:00Z'
  }))
  fs.writeFileSync(path.join(familiarDir, 'notifications.json'), JSON.stringify(notifications, null, 2))

  // Create individual task files
  for (const t of tasks) {
    const taskDir = path.join(familiarDir, 'tasks', t.id)
    fs.mkdirSync(taskDir, { recursive: true })
    fs.writeFileSync(path.join(taskDir, 'task.json'), JSON.stringify({
      id: t.id, title: t.title, status: 'todo', priority: 'none',
      labels: [], agentStatus: 'idle', createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z', sortOrder: 0
    }, null, 2))
    fs.writeFileSync(path.join(taskDir, 'document.md'), '')
    fs.writeFileSync(path.join(taskDir, 'activity.json'), '[]')
  }

  return dir
}

function cleanupDir(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ok */ }
}

describe('workspace switching backend integration', () => {
  let projectADir: string
  let projectBDir: string
  let handlers: Map<string, (...args: any[]) => any>
  let workspaceManager: WorkspaceManager
  let sharedDataService: DataService

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler)
      return undefined as any
    })

    // Create real projects with tasks
    projectADir = createProjectDir('Alpha', [
      { id: 'tsk_a1', title: 'Alpha Task 1' },
      { id: 'tsk_a2', title: 'Alpha Task 2' }
    ])
    projectBDir = createProjectDir('Beta', [
      { id: 'tsk_b1', title: 'Beta Task 1' },
      { id: 'tsk_b2', title: 'Beta Task 2' },
      { id: 'tsk_b3', title: 'Beta Task 3' }
    ])

    // Set up workspace manager with both projects
    workspaceManager = new WorkspaceManager()
    workspaceManager.openSingleProject(projectADir)
    workspaceManager.addProjectToWorkspace(projectBDir)

    // The shared dataService — this is what file handlers use
    sharedDataService = workspaceManager.getDataService(projectADir)

    // Mock ptyManager
    const mockPtyManager = { setDataService: vi.fn() } as any

    // Register handlers
    registerWorkspaceHandlers(workspaceManager, sharedDataService, mockPtyManager)
  })

  afterEach(() => {
    workspaceManager.closeAll()
    cleanupDir(projectADir)
    cleanupDir(projectBDir)
  })

  it('initially reads from project A', async () => {
    const state = await sharedDataService.readProjectState()
    expect(state.projectName).toBe('Alpha')
    expect(state.tasks).toHaveLength(2)
  })

  it('after set-active-project to B, shared dataService reads from B', async () => {
    const handler = handlers.get('workspace:set-active-project')!
    await handler({}, projectBDir)

    // The SHARED dataService should now read from B
    const state = await sharedDataService.readProjectState()
    expect(state.projectName).toBe('Beta')
    expect(state.tasks).toHaveLength(3)
  })

  it('after set-active-project to B, notifications read from B', async () => {
    const handler = handlers.get('workspace:set-active-project')!
    await handler({}, projectBDir)

    const notifications = await sharedDataService.readNotifications()
    expect(notifications).toHaveLength(3)
    expect(notifications[0].title).toBe('Beta notification')
  })

  it('switching A→B→A reads correct data each time', async () => {
    const setActive = handlers.get('workspace:set-active-project')!

    // Start at A
    let state = await sharedDataService.readProjectState()
    expect(state.projectName).toBe('Alpha')

    // Switch to B
    await setActive({}, projectBDir)
    state = await sharedDataService.readProjectState()
    expect(state.projectName).toBe('Beta')

    // Switch back to A
    await setActive({}, projectADir)
    state = await sharedDataService.readProjectState()
    expect(state.projectName).toBe('Alpha')
  })

  it('isInitialized reads from the correct project after switch', async () => {
    const setActive = handlers.get('workspace:set-active-project')!

    // Both projects are initialized
    expect(await sharedDataService.isInitialized()).toBe(true)

    // Switch to B
    await setActive({}, projectBDir)
    expect(await sharedDataService.isInitialized()).toBe(true)

    // Switch to a non-existent path — auto-opens but no .familiar/
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'familiar-test-empty-'))
    try {
      await setActive({}, emptyDir)
      expect(await sharedDataService.isInitialized()).toBe(false)
    } finally {
      cleanupDir(emptyDir)
    }
  })

  it('getProjectRoot returns the correct path after switch', async () => {
    const setActive = handlers.get('workspace:set-active-project')!

    expect(sharedDataService.getProjectRoot()).toBe(projectADir)

    await setActive({}, projectBDir)
    expect(sharedDataService.getProjectRoot()).toBe(projectBDir)

    await setActive({}, projectADir)
    expect(sharedDataService.getProjectRoot()).toBe(projectADir)
  })

  it('workspace:list-all-tasks returns tasks from both projects', async () => {
    const listAll = handlers.get('workspace:list-all-tasks')!
    const allTasks = await listAll({})

    expect(allTasks).toHaveLength(5) // 2 from A + 3 from B
    const alphaTaskIds = allTasks.filter((t: any) => t.projectPath === projectADir).map((t: any) => t.id)
    const betaTaskIds = allTasks.filter((t: any) => t.projectPath === projectBDir).map((t: any) => t.id)
    expect(alphaTaskIds).toContain('tsk_a1')
    expect(alphaTaskIds).toContain('tsk_a2')
    expect(betaTaskIds).toContain('tsk_b1')
    expect(betaTaskIds).toContain('tsk_b2')
    expect(betaTaskIds).toContain('tsk_b3')
  })
})
