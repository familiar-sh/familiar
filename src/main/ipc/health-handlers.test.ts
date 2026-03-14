import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerHealthHandlers } from './health-handlers'
import type { WorkspaceManager } from '../services/workspace-manager'
import type { DataService } from '../services/data-service'

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

// Use vi.hoisted to ensure mock functions are available during vi.mock hoisting
const {
  mockExistsSync,
  mockReadFileSync,
  mockStatSync,
  mockMkdirSync,
  mockWriteFileSync,
  mockChmodSync
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockChmodSync: vi.fn()
}))

// Mock child_process.exec — default: commands fail (not found)
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    default: actual,
    exec: vi.fn(
      (
        _cmd: string,
        _opts: unknown,
        cb: (err: Error | null, stdout: string) => void
      ) => {
        cb(new Error('not found'), '')
      }
    )
  }
})

// Mock fs — need to provide default export that also has the mock functions
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  const mocked = {
    ...actual,
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    statSync: (...args: unknown[]) => mockStatSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    chmodSync: (...args: unknown[]) => mockChmodSync(...args)
  }
  return {
    ...mocked,
    default: mocked
  }
})

describe('health-handlers', () => {
  let handlers: Map<string, (...args: unknown[]) => unknown>
  let mockWorkspaceManager: Partial<WorkspaceManager>
  let mockDataService: Partial<DataService>
  let mockDs: { readSettings: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()

    vi.mocked(ipcMain.handle).mockImplementation(
      (channel: string, handler: unknown) => {
        handlers.set(channel, handler as (...args: unknown[]) => unknown)
        return undefined as ReturnType<typeof ipcMain.handle>
      }
    )

    mockDs = {
      readSettings: vi.fn().mockResolvedValue({ codingAgent: 'claude-code' })
    }

    mockWorkspaceManager = {
      getActiveProjectPath: vi.fn().mockReturnValue('/test/project'),
      getDataService: vi.fn().mockReturnValue(mockDs)
    }

    mockDataService = {} as Partial<DataService>

    registerHealthHandlers(
      mockWorkspaceManager as WorkspaceManager,
      mockDataService as DataService
    )
  })

  it('registers health:check, health:fix, and health:fix-all handlers', () => {
    expect(handlers.has('health:check')).toBe(true)
    expect(handlers.has('health:fix')).toBe(true)
    expect(handlers.has('health:fix-all')).toBe(true)
  })

  describe('health:check', () => {
    it('returns empty issues when no active project', async () => {
      vi.mocked(mockWorkspaceManager.getActiveProjectPath!).mockReturnValue(null)
      const handler = handlers.get('health:check')!
      const result = (await handler()) as {
        issues: unknown[]
        cliAvailable: boolean
      }
      expect(result.issues).toEqual([])
      expect(result.cliAvailable).toBe(false)
    })

    it('reports no-agent-harness when codingAgent is not set', async () => {
      mockDs.readSettings.mockResolvedValue({})
      const handler = handlers.get('health:check')!
      const result = (await handler()) as { issues: { id: string }[] }
      const agentIssue = result.issues.find((i) => i.id === 'no-agent-harness')
      expect(agentIssue).toBeDefined()
    })

    it('checks hooks and skill for claude-code agent', async () => {
      mockDs.readSettings.mockResolvedValue({ codingAgent: 'claude-code' })
      mockExistsSync.mockReturnValue(false)

      const handler = handlers.get('health:check')!
      const result = (await handler()) as {
        issues: { id: string }[]
        hooksConfigured: boolean
        skillInstalled: boolean
      }

      expect(result.hooksConfigured).toBe(false)
      expect(result.skillInstalled).toBe(false)
      expect(
        result.issues.find((i) => i.id === 'hooks-not-configured')
      ).toBeDefined()
      expect(
        result.issues.find((i) => i.id === 'skill-not-installed')
      ).toBeDefined()
    })

    it('does not check hooks/skill for non-claude-code agent', async () => {
      mockDs.readSettings.mockResolvedValue({ codingAgent: 'other' })

      const handler = handlers.get('health:check')!
      const result = (await handler()) as {
        hooksConfigured: boolean | null
        skillInstalled: boolean | null
      }
      expect(result.hooksConfigured).toBeNull()
      expect(result.skillInstalled).toBeNull()
    })

    it('reports hooks configured when all files exist correctly', async () => {
      mockDs.readSettings.mockResolvedValue({ codingAgent: 'claude-code' })

      mockExistsSync.mockImplementation((p: string) => {
        if (p.endsWith('settings.json')) return true
        if (p.endsWith('on-prompt-submit.sh')) return true
        if (p.endsWith('on-stop.sh')) return true
        if (p.endsWith('SKILL.md')) return true
        return false
      })

      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [{ hooks: [{ type: 'command' }] }],
            Stop: [{ hooks: [{ type: 'command' }] }]
          }
        })
      )

      mockStatSync.mockReturnValue({ mode: 0o755 })

      const handler = handlers.get('health:check')!
      const result = (await handler()) as {
        hooksConfigured: boolean
        skillInstalled: boolean
      }
      expect(result.hooksConfigured).toBe(true)
      expect(result.skillInstalled).toBe(true)
    })
  })

  describe('health:fix', () => {
    it('fixes hooks-not-configured', async () => {
      mockExistsSync.mockReturnValue(false)

      const handler = handlers.get('health:fix')!
      const result = (await handler({}, 'hooks-not-configured')) as {
        success: boolean
      }
      expect(result.success).toBe(true)
      expect(mockMkdirSync).toHaveBeenCalled()
      expect(mockWriteFileSync).toHaveBeenCalled()
      expect(mockChmodSync).toHaveBeenCalledTimes(2)
    })

    it('fixes skill-not-installed', async () => {
      mockExistsSync.mockReturnValue(false)

      const handler = handlers.get('health:fix')!
      const result = (await handler({}, 'skill-not-installed')) as {
        success: boolean
      }
      expect(result.success).toBe(true)
      expect(mockMkdirSync).toHaveBeenCalled()
      expect(mockWriteFileSync).toHaveBeenCalled()
    })

    it('returns error for unknown issue', async () => {
      const handler = handlers.get('health:fix')!
      const result = (await handler({}, 'unknown-issue')) as {
        success: boolean
        error: string
      }
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown issue')
    })

    it('returns error when no active project', async () => {
      vi.mocked(mockWorkspaceManager.getActiveProjectPath!).mockReturnValue(
        null
      )
      const handler = handlers.get('health:fix')!
      const result = (await handler({}, 'hooks-not-configured')) as {
        success: boolean
        error: string
      }
      expect(result.success).toBe(false)
      expect(result.error).toBe('No active project')
    })
  })

  describe('health:fix-all', () => {
    it('fixes all auto-fixable issues for claude-code', async () => {
      mockDs.readSettings.mockResolvedValue({ codingAgent: 'claude-code' })
      mockExistsSync.mockReturnValue(false)

      const handler = handlers.get('health:fix-all')!
      const result = (await handler()) as { fixed: string[]; failed: string[] }
      expect(result.fixed).toContain('hooks-not-configured')
      expect(result.fixed).toContain('skill-not-installed')
      expect(result.failed).toEqual([])
    })

    it('returns empty arrays when no active project', async () => {
      vi.mocked(mockWorkspaceManager.getActiveProjectPath!).mockReturnValue(
        null
      )
      const handler = handlers.get('health:fix-all')!
      const result = (await handler()) as { fixed: string[]; failed: string[] }
      expect(result.fixed).toEqual([])
      expect(result.failed).toEqual([])
    })
  })

  describe('health:check-hooks', () => {
    it('registers the handler', () => {
      expect(handlers.has('health:check-hooks')).toBe(true)
    })

    it('checks hooks for given project root directly', async () => {
      mockExistsSync.mockReturnValue(false)
      const handler = handlers.get('health:check-hooks')!
      const result = handler({}, '/some/project') as boolean
      expect(result).toBe(false)
    })
  })

  describe('health:check-skill', () => {
    it('registers the handler', () => {
      expect(handlers.has('health:check-skill')).toBe(true)
    })

    it('checks skill for given project root directly', async () => {
      mockExistsSync.mockReturnValue(false)
      const handler = handlers.get('health:check-skill')!
      const result = handler({}, '/some/project') as boolean
      expect(result).toBe(false)
    })
  })

  describe('health:fix-for-project', () => {
    it('registers the handler', () => {
      expect(handlers.has('health:fix-for-project')).toBe(true)
    })

    it('fixes hooks for given project root', async () => {
      mockExistsSync.mockReturnValue(false)
      const handler = handlers.get('health:fix-for-project')!
      const result = handler({}, '/some/project', 'hooks-not-configured') as { success: boolean }
      expect(result.success).toBe(true)
      expect(mockMkdirSync).toHaveBeenCalled()
    })

    it('fixes skill for given project root', async () => {
      mockExistsSync.mockReturnValue(false)
      const handler = handlers.get('health:fix-for-project')!
      const result = handler({}, '/some/project', 'skill-not-installed') as { success: boolean }
      expect(result.success).toBe(true)
    })

    it('returns error for unknown issue', async () => {
      const handler = handlers.get('health:fix-for-project')!
      const result = handler({}, '/some/project', 'unknown') as { success: boolean; error: string }
      expect(result.success).toBe(false)
    })
  })
})
