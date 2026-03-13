import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import { WorkspaceManager } from '../../src/main/services/workspace-manager'
import { DataService } from '../../src/main/services/data-service'

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.familiar')
const WORKSPACES_FILE = path.join(GLOBAL_CONFIG_DIR, 'workspaces.json')

describe('Workspace lifecycle integration test', () => {
  let tmpDirA: string
  let tmpDirB: string
  let tmpDirC: string
  let originalWorkspaces: string | null = null

  beforeEach(async () => {
    // Save original workspaces.json
    try {
      originalWorkspaces = fsSync.readFileSync(WORKSPACES_FILE, 'utf-8')
    } catch {
      originalWorkspaces = null
    }
    // Write clean config
    if (!fsSync.existsSync(GLOBAL_CONFIG_DIR)) {
      fsSync.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true })
    }
    fsSync.writeFileSync(WORKSPACES_FILE, JSON.stringify({ workspaces: [], lastWorkspaceId: null }))

    // Create temporary project directories
    tmpDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-proj-a-'))
    tmpDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-proj-b-'))
    tmpDirC = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-proj-c-'))

    // Initialize .familiar/ in each
    for (const dir of [tmpDirA, tmpDirB, tmpDirC]) {
      const ds = new DataService(dir)
      await ds.initProject(path.basename(dir))
    }
  })

  afterEach(async () => {
    // Restore original workspaces.json
    if (originalWorkspaces !== null) {
      fsSync.writeFileSync(WORKSPACES_FILE, originalWorkspaces)
    } else {
      try { fsSync.unlinkSync(WORKSPACES_FILE) } catch { /* ignore */ }
    }

    // Clean up temp dirs
    await fs.rm(tmpDirA, { recursive: true, force: true })
    await fs.rm(tmpDirB, { recursive: true, force: true })
    await fs.rm(tmpDirC, { recursive: true, force: true })
  })

  it('full workspace lifecycle: create → add projects → switch → remove → delete', async () => {
    const wm = new WorkspaceManager()

    // 1. Create workspace with two projects
    const ws = wm.createWorkspace('Test Workspace', [tmpDirA, tmpDirB])
    expect(ws.name).toBe('Test Workspace')
    expect(ws.projectPaths).toEqual([tmpDirA, tmpDirB])

    // 2. Open the workspace
    wm.openWorkspace(ws.id)
    expect(wm.getOpenProjectPaths()).toContain(tmpDirA)
    expect(wm.getOpenProjectPaths()).toContain(tmpDirB)
    expect(wm.getActiveProjectPath()).toBe(tmpDirA)

    // 3. Verify DataService instances are correct
    const dsA = wm.getDataService(tmpDirA)
    const dsB = wm.getDataService(tmpDirB)
    expect(dsA.getProjectRoot()).toBe(tmpDirA)
    expect(dsB.getProjectRoot()).toBe(tmpDirB)

    // 4. Switch active project
    wm.setActiveProjectPath(tmpDirB)
    expect(wm.getActiveProjectPath()).toBe(tmpDirB)
    expect(wm.getDataService().getProjectRoot()).toBe(tmpDirB)

    // 5. Add a third project
    wm.addProjectToWorkspace(tmpDirC)
    expect(wm.getOpenProjectPaths()).toHaveLength(3)

    // Verify workspace config was updated
    const config = wm.loadWorkspaceConfig()
    const updatedWs = config.workspaces.find((w) => w.id === ws.id)
    expect(updatedWs!.projectPaths).toContain(tmpDirC)

    // 6. Remove a project
    wm.removeProjectFromWorkspace(tmpDirA)
    expect(wm.getOpenProjectPaths()).not.toContain(tmpDirA)
    expect(wm.getOpenProjectPaths()).toHaveLength(2)

    // 7. Delete the workspace
    wm.deleteWorkspace(ws.id)
    expect(wm.listWorkspaces()).toHaveLength(0)

    // 8. Clean up
    wm.closeAll()
    expect(wm.getOpenProjectPaths()).toEqual([])
  })

  it('single-project mode works without workspace', async () => {
    const wm = new WorkspaceManager()

    // Open single project — no workspace created
    wm.openSingleProject(tmpDirA)
    expect(wm.getActiveProjectPath()).toBe(tmpDirA)
    expect(wm.getActiveWorkspaceId()).toBeNull()

    // DataService works
    const ds = wm.getDataService()
    const state = await ds.readProjectState()
    expect(state.projectName).toBe(path.basename(tmpDirA))

    // Can read/write tasks
    const task = {
      id: 'tsk_test01',
      title: 'Test Task',
      status: 'todo' as const,
      priority: 'none' as const,
      labels: [],
      agentStatus: 'idle' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0
    }
    await ds.createTask(task)
    const readBack = await ds.readTask('tsk_test01')
    expect(readBack.title).toBe('Test Task')

    wm.closeAll()
  })

  it('switching workspaces closes previous and opens new', () => {
    const wm = new WorkspaceManager()

    // Create two workspaces
    const ws1 = wm.createWorkspace('WS 1', [tmpDirA])
    const ws2 = wm.createWorkspace('WS 2', [tmpDirB, tmpDirC])

    // Open first
    wm.openWorkspace(ws1.id)
    expect(wm.getOpenProjectPaths()).toEqual([tmpDirA])

    // Open second — should close first
    wm.openWorkspace(ws2.id)
    expect(wm.getOpenProjectPaths()).toContain(tmpDirB)
    expect(wm.getOpenProjectPaths()).toContain(tmpDirC)
    expect(wm.getOpenProjectPaths()).not.toContain(tmpDirA)
    expect(wm.getActiveProjectPath()).toBe(tmpDirB)

    wm.closeAll()
  })

  it('workspace config persists across WorkspaceManager instances', () => {
    // Create with one instance
    const wm1 = new WorkspaceManager()
    const ws = wm1.createWorkspace('Persistent', [tmpDirA])

    // Read with a new instance
    const wm2 = new WorkspaceManager()
    const list = wm2.listWorkspaces()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Persistent')
    expect(list[0].id).toBe(ws.id)
  })

  it('IPC-style routing: getDataService routes to correct project', async () => {
    const wm = new WorkspaceManager()
    wm.openSingleProject(tmpDirA)
    wm.addProjectToWorkspace(tmpDirB)

    // Write task to project A
    const dsA = wm.getDataService(tmpDirA)
    const taskA = {
      id: 'tsk_a1',
      title: 'Task in A',
      status: 'todo' as const,
      priority: 'none' as const,
      labels: [],
      agentStatus: 'idle' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0
    }
    await dsA.createTask(taskA)

    // Write task to project B
    const dsB = wm.getDataService(tmpDirB)
    const taskB = {
      id: 'tsk_b1',
      title: 'Task in B',
      status: 'todo' as const,
      priority: 'none' as const,
      labels: [],
      agentStatus: 'idle' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0
    }
    await dsB.createTask(taskB)

    // Read from each — tasks are isolated
    const readA = await dsA.readTask('tsk_a1')
    const readB = await dsB.readTask('tsk_b1')
    expect(readA.title).toBe('Task in A')
    expect(readB.title).toBe('Task in B')

    // Task from A doesn't exist in B
    await expect(dsB.readTask('tsk_a1')).rejects.toThrow()

    wm.closeAll()
  })
})
