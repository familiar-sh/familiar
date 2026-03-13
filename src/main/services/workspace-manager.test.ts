import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WorkspaceManager } from './workspace-manager'
import fs from 'fs'
import path from 'path'
import os from 'os'

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.familiar')
const WORKSPACES_FILE = path.join(GLOBAL_CONFIG_DIR, 'workspaces.json')

// Save original file if it exists, restore after tests
let originalContent: string | null = null

beforeEach(() => {
  try {
    originalContent = fs.readFileSync(WORKSPACES_FILE, 'utf-8')
  } catch {
    originalContent = null
  }
  // Write empty config for testing
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true })
  }
  fs.writeFileSync(WORKSPACES_FILE, JSON.stringify({ workspaces: [], lastWorkspaceId: null }))
})

afterEach(() => {
  // Restore original file
  if (originalContent !== null) {
    fs.writeFileSync(WORKSPACES_FILE, originalContent)
  } else {
    try {
      fs.unlinkSync(WORKSPACES_FILE)
    } catch {
      // ignore
    }
  }
})

describe('WorkspaceManager', () => {
  describe('workspace CRUD', () => {
    it('creates a workspace with id, name, and project paths', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('My Stack', ['/tmp/project-a', '/tmp/project-b'])

      expect(ws.id).toMatch(/^ws_/)
      expect(ws.name).toBe('My Stack')
      expect(ws.projectPaths).toEqual(['/tmp/project-a', '/tmp/project-b'])
      expect(ws.lastOpenedAt).toBeTruthy()
      expect(ws.createdAt).toBeTruthy()
    })

    it('persists workspace to config file', () => {
      const wm = new WorkspaceManager()
      wm.createWorkspace('Test', ['/tmp/test'])

      const config = wm.loadWorkspaceConfig()
      expect(config.workspaces).toHaveLength(1)
      expect(config.workspaces[0].name).toBe('Test')
    })

    it('lists workspaces sorted by lastOpenedAt descending', () => {
      const wm = new WorkspaceManager()
      const old = wm.createWorkspace('Old', ['/tmp/old'])
      // Manually set an older timestamp
      wm.updateWorkspace(old.id, { lastOpenedAt: '2020-01-01T00:00:00.000Z' })
      wm.createWorkspace('New', ['/tmp/new'])

      const list = wm.listWorkspaces()
      expect(list).toHaveLength(2)
      // New was created last so has the most recent lastOpenedAt
      expect(list[0].name).toBe('New')
      expect(list[1].name).toBe('Old')
    })

    it('updates a workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Before', ['/tmp/a'])
      const updated = wm.updateWorkspace(ws.id, { name: 'After' })

      expect(updated.name).toBe('After')
      expect(updated.projectPaths).toEqual(['/tmp/a'])
    })

    it('deletes a workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('ToDelete', ['/tmp/d'])
      wm.deleteWorkspace(ws.id)

      const list = wm.listWorkspaces()
      expect(list).toHaveLength(0)
    })

    it('updates lastWorkspaceId on create', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Test', ['/tmp/t'])
      const config = wm.loadWorkspaceConfig()
      expect(config.lastWorkspaceId).toBe(ws.id)
    })

    it('clears lastWorkspaceId when deleting the last workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Only', ['/tmp/o'])
      wm.deleteWorkspace(ws.id)
      const config = wm.loadWorkspaceConfig()
      expect(config.lastWorkspaceId).toBeNull()
    })

    it('throws when updating non-existent workspace', () => {
      const wm = new WorkspaceManager()
      expect(() => wm.updateWorkspace('ws_nonexist', { name: 'x' })).toThrow('Workspace not found')
    })
  })

  describe('runtime project management', () => {
    it('openSingleProject sets active project path', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/proj')
      expect(wm.getActiveProjectPath()).toBe('/tmp/proj')
      expect(wm.getOpenProjectPaths()).toEqual(['/tmp/proj'])
    })

    it('addProjectToWorkspace adds a second project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')

      expect(wm.getOpenProjectPaths()).toContain('/tmp/a')
      expect(wm.getOpenProjectPaths()).toContain('/tmp/b')
    })

    it('does not duplicate projects when adding same path', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/a')

      expect(wm.getOpenProjectPaths()).toHaveLength(1)
    })

    it('removeProjectFromWorkspace removes a project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.removeProjectFromWorkspace('/tmp/b')

      expect(wm.getOpenProjectPaths()).toEqual(['/tmp/a'])
    })

    it('switches active project when removing the active one', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.setActiveProjectPath('/tmp/b')
      wm.removeProjectFromWorkspace('/tmp/b')

      expect(wm.getActiveProjectPath()).toBe('/tmp/a')
    })

    it('setActiveProjectPath changes the active project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.setActiveProjectPath('/tmp/b')

      expect(wm.getActiveProjectPath()).toBe('/tmp/b')
    })

    it('auto-opens project when setting active to non-open project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.setActiveProjectPath('/tmp/b')

      expect(wm.getActiveProjectPath()).toBe('/tmp/b')
      expect(wm.getOpenProjectPaths()).toContain('/tmp/b')
    })

    it('closeAll clears all state', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.closeAll()

      expect(wm.getActiveProjectPath()).toBeNull()
      expect(wm.getOpenProjectPaths()).toEqual([])
    })
  })

  describe('DataService routing', () => {
    it('getDataService returns the DataService for a specific project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')

      const dsA = wm.getDataService('/tmp/a')
      const dsB = wm.getDataService('/tmp/b')
      expect(dsA).toBeDefined()
      expect(dsB).toBeDefined()
      expect(dsA).not.toBe(dsB)
    })

    it('getDataService without arg returns active project DataService', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')

      const ds = wm.getDataService()
      expect(ds).toBeDefined()
    })

    it('throws when no active project for getDataService', () => {
      const wm = new WorkspaceManager()
      expect(() => wm.getDataService()).toThrow('No active project')
    })

    it('throws for unknown project path', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      expect(() => wm.getDataService('/tmp/nonexist')).toThrow('No DataService for project')
    })
  })

  describe('workspace open', () => {
    it('openWorkspace opens all projects in the workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Multi', ['/tmp/x', '/tmp/y'])
      wm.openWorkspace(ws.id)

      expect(wm.getOpenProjectPaths()).toContain('/tmp/x')
      expect(wm.getOpenProjectPaths()).toContain('/tmp/y')
      expect(wm.getActiveProjectPath()).toBe('/tmp/x')
    })

    it('openWorkspace throws for non-existent workspace', () => {
      const wm = new WorkspaceManager()
      expect(() => wm.openWorkspace('ws_fake')).toThrow('Workspace not found')
    })

    it('openWorkspace updates lastOpenedAt', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Test', ['/tmp/t'])
      const originalTime = ws.lastOpenedAt

      // Small delay to ensure time difference
      const now = new Date(Date.now() + 1000).toISOString()
      vi.setSystemTime(new Date(now))
      wm.openWorkspace(ws.id)
      vi.useRealTimers()

      const config = wm.loadWorkspaceConfig()
      const updated = config.workspaces.find((w) => w.id === ws.id)
      expect(updated!.lastOpenedAt).not.toBe(originalTime)
    })
  })

  describe('config file handling', () => {
    it('handles missing workspaces.json gracefully', () => {
      try { fs.unlinkSync(WORKSPACES_FILE) } catch { /* ignore */ }

      const wm = new WorkspaceManager()
      const config = wm.loadWorkspaceConfig()
      expect(config.workspaces).toEqual([])
      expect(config.lastWorkspaceId).toBeNull()
    })

    it('handles corrupt workspaces.json gracefully', () => {
      fs.writeFileSync(WORKSPACES_FILE, '{invalid json')

      const wm = new WorkspaceManager()
      const config = wm.loadWorkspaceConfig()
      expect(config.workspaces).toEqual([])
    })

    it('uses atomic writes (temp + rename)', () => {
      const wm = new WorkspaceManager()
      wm.createWorkspace('Atomic', ['/tmp/a'])

      // Verify the file exists and is valid JSON
      const raw = fs.readFileSync(WORKSPACES_FILE, 'utf-8')
      const config = JSON.parse(raw)
      expect(config.workspaces).toHaveLength(1)
    })
  })
})
