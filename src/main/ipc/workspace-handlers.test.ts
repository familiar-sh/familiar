import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerWorkspaceHandlers } from './workspace-handlers'
import type { WorkspaceManager } from '../services/workspace-manager'
import type { DataService } from '../services/data-service'
import type { ElectronPtyManager } from '../platform/electron-pty'

// Mock ipcMain
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

describe('workspace-handlers', () => {
  let mockManager: Partial<WorkspaceManager>
  let mockDataService: Partial<DataService>
  let mockPtyManager: Partial<ElectronPtyManager>
  let handlers: Map<string, (...args: any[]) => any>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()

    // Capture registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler)
      return undefined as any
    })

    const mockDs = { getProjectRoot: vi.fn().mockReturnValue('/tmp/target'), setProjectRoot: vi.fn() }

    mockManager = {
      listWorkspaces: vi.fn().mockReturnValue([]),
      createWorkspace: vi.fn().mockReturnValue({ id: 'ws_1', name: 'Test', projectPaths: ['/tmp/a'], lastOpenedAt: '', createdAt: '' }),
      updateWorkspace: vi.fn().mockReturnValue({ id: 'ws_1', name: 'Updated', projectPaths: ['/tmp/a'], lastOpenedAt: '', createdAt: '' }),
      deleteWorkspace: vi.fn(),
      openWorkspace: vi.fn(),
      openSingleProject: vi.fn(),
      addProjectToWorkspace: vi.fn(),
      removeProjectFromWorkspace: vi.fn(),
      loadWorkspaceConfig: vi.fn().mockReturnValue({ workspaces: [], lastWorkspaceId: null }),
      getOpenProjectPaths: vi.fn().mockReturnValue([]),
      getActiveProjectPath: vi.fn().mockReturnValue(null),
      setActiveProjectPath: vi.fn(),
      setActiveWorkspaceId: vi.fn(),
      getDataService: vi.fn().mockReturnValue(mockDs)
    }

    mockDataService = {
      setProjectRoot: vi.fn()
    }

    mockPtyManager = {
      setDataService: vi.fn()
    }

    registerWorkspaceHandlers(
      mockManager as WorkspaceManager,
      mockDataService as DataService,
      mockPtyManager as ElectronPtyManager
    )
  })

  it('registers all workspace IPC channels', () => {
    const expectedChannels = [
      'workspace:list',
      'workspace:create',
      'workspace:update',
      'workspace:delete',
      'workspace:open',
      'workspace:open-single',
      'workspace:add-project',
      'workspace:remove-project',
      'workspace:get-config',
      'workspace:get-open-projects',
      'workspace:get-active-project',
      'workspace:set-active-project',
      'workspace:set-active-workspace-id'
    ]

    for (const channel of expectedChannels) {
      expect(handlers.has(channel), `Missing handler for ${channel}`).toBe(true)
    }
  })

  it('workspace:list calls listWorkspaces', async () => {
    const handler = handlers.get('workspace:list')!
    await handler({})
    expect(mockManager.listWorkspaces).toHaveBeenCalled()
  })

  it('workspace:create passes name and paths', async () => {
    const handler = handlers.get('workspace:create')!
    await handler({}, 'MyWorkspace', ['/tmp/a', '/tmp/b'])
    expect(mockManager.createWorkspace).toHaveBeenCalledWith('MyWorkspace', ['/tmp/a', '/tmp/b'])
  })

  it('workspace:update passes id and updates', async () => {
    const handler = handlers.get('workspace:update')!
    await handler({}, 'ws_1', { name: 'Updated' })
    expect(mockManager.updateWorkspace).toHaveBeenCalledWith('ws_1', { name: 'Updated' })
  })

  it('workspace:delete passes id', async () => {
    const handler = handlers.get('workspace:delete')!
    await handler({}, 'ws_1')
    expect(mockManager.deleteWorkspace).toHaveBeenCalledWith('ws_1')
  })

  it('workspace:open passes workspaceId and syncs legacy refs', async () => {
    (mockManager.getActiveProjectPath as ReturnType<typeof vi.fn>).mockReturnValue('/tmp/a')
    const handler = handlers.get('workspace:open')!
    await handler({}, 'ws_1')
    expect(mockManager.openWorkspace).toHaveBeenCalledWith('ws_1')
    // Should sync shared dataService to match the active project path directly
    expect(mockDataService.setProjectRoot).toHaveBeenCalledWith('/tmp/a')
    expect(mockPtyManager.setDataService).toHaveBeenCalled()
  })

  it('workspace:open-single passes path and syncs legacy refs', async () => {
    (mockManager.getActiveProjectPath as ReturnType<typeof vi.fn>).mockReturnValue('/tmp/project')
    const handler = handlers.get('workspace:open-single')!
    await handler({}, '/tmp/project')
    expect(mockManager.openSingleProject).toHaveBeenCalledWith('/tmp/project')
    // Should sync shared dataService to match the active project path directly
    expect(mockDataService.setProjectRoot).toHaveBeenCalledWith('/tmp/project')
    expect(mockPtyManager.setDataService).toHaveBeenCalled()
  })

  it('workspace:add-project passes path', async () => {
    const handler = handlers.get('workspace:add-project')!
    await handler({}, '/tmp/new-project')
    expect(mockManager.addProjectToWorkspace).toHaveBeenCalledWith('/tmp/new-project')
  })

  it('workspace:remove-project passes path and syncs legacy refs', async () => {
    (mockManager.getActiveProjectPath as ReturnType<typeof vi.fn>).mockReturnValue('/tmp/a')
    const handler = handlers.get('workspace:remove-project')!
    await handler({}, '/tmp/old-project')
    expect(mockManager.removeProjectFromWorkspace).toHaveBeenCalledWith('/tmp/old-project')
    // Active project may have changed — sync refs using the active path directly
    expect(mockDataService.setProjectRoot).toHaveBeenCalledWith('/tmp/a')
    expect(mockPtyManager.setDataService).toHaveBeenCalled()
  })

  it('workspace:set-active-project passes path and updates legacy refs', async () => {
    (mockManager.getActiveProjectPath as ReturnType<typeof vi.fn>).mockReturnValue('/tmp/target')
    const handler = handlers.get('workspace:set-active-project')!
    await handler({}, '/tmp/target')
    expect(mockManager.setActiveProjectPath).toHaveBeenCalledWith('/tmp/target')
    // Uses the active path directly (not ds.getProjectRoot()) to avoid
    // corrupting the workspace manager's internal DataService map entry
    expect(mockDataService.setProjectRoot).toHaveBeenCalledWith('/tmp/target')
    expect(mockPtyManager.setDataService).toHaveBeenCalled()
  })

  it('workspace:set-active-workspace-id passes id', async () => {
    const handler = handlers.get('workspace:set-active-workspace-id')!
    await handler({}, 'ws_123')
    expect(mockManager.setActiveWorkspaceId).toHaveBeenCalledWith('ws_123')
  })
})
