import path from 'path'
import os from 'os'
import fs from 'fs'
import { DataService } from './data-service'
import { FileWatcher } from './file-watcher'
import { generateWorkspaceId } from '../../shared/utils/id-generator'
import type { Workspace, WorkspaceConfig } from '../../shared/types'
import type { BrowserWindow } from 'electron'

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.familiar')
const WORKSPACES_FILE = path.join(GLOBAL_CONFIG_DIR, 'workspaces.json')

export class WorkspaceManager {
  private dataServices = new Map<string, DataService>()
  private fileWatchers = new Map<string, FileWatcher>()
  private activeProjectPath: string | null = null
  private activeWorkspaceId: string | null = null
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  // ─── Workspace CRUD ──────────────────────────────────────────────

  loadWorkspaceConfig(): WorkspaceConfig {
    try {
      if (fs.existsSync(WORKSPACES_FILE)) {
        const raw = fs.readFileSync(WORKSPACES_FILE, 'utf-8')
        return JSON.parse(raw) as WorkspaceConfig
      }
    } catch {
      // Corrupt file — return default
    }
    return { workspaces: [], lastWorkspaceId: null }
  }

  saveWorkspaceConfig(config: WorkspaceConfig): void {
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
      fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true })
    }
    const tmpFile = WORKSPACES_FILE + `.tmp-${Date.now()}`
    fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2))
    fs.renameSync(tmpFile, WORKSPACES_FILE)
  }

  createWorkspace(name: string, projectPaths: string[]): Workspace {
    const config = this.loadWorkspaceConfig()
    const now = new Date().toISOString()
    const workspace: Workspace = {
      id: generateWorkspaceId(),
      name,
      projectPaths,
      lastOpenedAt: now,
      createdAt: now
    }
    config.workspaces.push(workspace)
    config.lastWorkspaceId = workspace.id
    this.saveWorkspaceConfig(config)
    return workspace
  }

  updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Workspace {
    const config = this.loadWorkspaceConfig()
    const workspace = config.workspaces.find((w) => w.id === id)
    if (!workspace) throw new Error(`Workspace not found: ${id}`)
    Object.assign(workspace, updates)
    this.saveWorkspaceConfig(config)
    return workspace
  }

  deleteWorkspace(id: string): void {
    const config = this.loadWorkspaceConfig()
    config.workspaces = config.workspaces.filter((w) => w.id !== id)
    if (config.lastWorkspaceId === id) {
      config.lastWorkspaceId = config.workspaces[0]?.id ?? null
    }
    this.saveWorkspaceConfig(config)
  }

  listWorkspaces(): Workspace[] {
    const config = this.loadWorkspaceConfig()
    return config.workspaces.sort(
      (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
    )
  }

  // ─── Runtime project management ──────────────────────────────────

  openWorkspace(workspaceId: string): void {
    const config = this.loadWorkspaceConfig()
    const workspace = config.workspaces.find((w) => w.id === workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)

    // Close existing services
    this.closeAll()

    // Open all projects in this workspace
    for (const projectPath of workspace.projectPaths) {
      this.openProjectInternal(projectPath)
    }

    // Set active to the first project
    this.activeProjectPath = workspace.projectPaths[0] ?? null
    this.activeWorkspaceId = workspaceId

    // Update lastOpenedAt
    workspace.lastOpenedAt = new Date().toISOString()
    config.lastWorkspaceId = workspaceId
    this.saveWorkspaceConfig(config)
  }

  openSingleProject(projectPath: string): void {
    // Close existing services
    this.closeAll()

    this.openProjectInternal(projectPath)
    this.activeProjectPath = projectPath
    this.activeWorkspaceId = null
  }

  addProjectToWorkspace(projectPath: string): void {
    // Already open?
    if (this.dataServices.has(projectPath)) return

    this.openProjectInternal(projectPath)

    // Update workspace config if we have an active workspace
    if (this.activeWorkspaceId) {
      const config = this.loadWorkspaceConfig()
      const workspace = config.workspaces.find((w) => w.id === this.activeWorkspaceId)
      if (workspace && !workspace.projectPaths.includes(projectPath)) {
        workspace.projectPaths.push(projectPath)
        this.saveWorkspaceConfig(config)
      }
    }
  }

  removeProjectFromWorkspace(projectPath: string): void {
    // Close the project's services
    const ds = this.dataServices.get(projectPath)
    if (ds) {
      this.dataServices.delete(projectPath)
    }
    const fw = this.fileWatchers.get(projectPath)
    if (fw) {
      fw.stop()
      this.fileWatchers.delete(projectPath)
    }

    // Switch active project if needed
    if (this.activeProjectPath === projectPath) {
      const remaining = Array.from(this.dataServices.keys())
      this.activeProjectPath = remaining[0] ?? null
    }

    // Update workspace config
    if (this.activeWorkspaceId) {
      const config = this.loadWorkspaceConfig()
      const workspace = config.workspaces.find((w) => w.id === this.activeWorkspaceId)
      if (workspace) {
        workspace.projectPaths = workspace.projectPaths.filter((p) => p !== projectPath)
        this.saveWorkspaceConfig(config)
      }
    }
  }

  // ─── DataService routing ─────────────────────────────────────────

  getDataService(projectPath?: string): DataService {
    const target = projectPath ?? this.activeProjectPath
    if (!target) throw new Error('No active project')
    const ds = this.dataServices.get(target)
    if (!ds) throw new Error(`No DataService for project: ${target}`)
    return ds
  }

  getActiveProjectPath(): string | null {
    return this.activeProjectPath
  }

  setActiveProjectPath(projectPath: string): void {
    if (!this.dataServices.has(projectPath)) {
      // Auto-open the project if it's not already open
      this.openProjectInternal(projectPath)
    }
    this.activeProjectPath = projectPath
  }

  getActiveWorkspaceId(): string | null {
    return this.activeWorkspaceId
  }

  getOpenProjectPaths(): string[] {
    return Array.from(this.dataServices.keys())
  }

  getActiveDataServices(): Map<string, DataService> {
    return new Map(this.dataServices)
  }

  // ─── File watcher management ─────────────────────────────────────

  getFileWatcher(projectPath?: string): FileWatcher | null {
    const target = projectPath ?? this.activeProjectPath
    if (!target) return null
    return this.fileWatchers.get(target) ?? null
  }

  /**
   * Ensure all open projects have file watchers running.
   * Called after BrowserWindow is available, since projects opened before
   * the window existed won't have watchers.
   */
  ensureFileWatchers(window: BrowserWindow): void {
    for (const [projectPath] of this.dataServices) {
      if (!this.fileWatchers.has(projectPath)) {
        const fw = new FileWatcher(projectPath, window)
        fw.start()
        this.fileWatchers.set(projectPath, fw)
      }
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  closeAll(): void {
    for (const fw of this.fileWatchers.values()) {
      fw.stop()
    }
    this.fileWatchers.clear()
    this.dataServices.clear()
    this.activeProjectPath = null
    this.activeWorkspaceId = null
  }

  // ─── Internal ────────────────────────────────────────────────────

  private openProjectInternal(projectPath: string): void {
    if (this.dataServices.has(projectPath)) return

    const ds = new DataService(projectPath)
    this.dataServices.set(projectPath, ds)

    // Start file watcher if we have a main window
    if (this.mainWindow) {
      const fw = new FileWatcher(projectPath, this.mainWindow)
      fw.start()
      this.fileWatchers.set(projectPath, fw)
    }
  }
}
