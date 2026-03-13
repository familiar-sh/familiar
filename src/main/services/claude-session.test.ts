import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from 'path'
import { taskIdToUuid, resolveClaudeSessionCommand, ensureForkSessionCopied } from './claude-session'

const mockExistsSync = vi.fn()
const mockCopyFileSync = vi.fn()
const mockMkdirSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockWriteFileSync = vi.fn()
const mockHomedir = vi.fn().mockReturnValue('/Users/testuser')

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: (...args: Parameters<typeof actual.existsSync>) => mockExistsSync(...args),
    copyFileSync: (...args: Parameters<typeof actual.copyFileSync>) => mockCopyFileSync(...args),
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) => mockMkdirSync(...args),
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => mockReadFileSync(...args),
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => mockWriteFileSync(...args)
  }
})

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return { ...actual, homedir: () => mockHomedir() }
})

describe('taskIdToUuid', () => {
  it('returns a valid UUID v5 format', () => {
    const uuid = taskIdToUuid('tsk_abc123')
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('is deterministic — same input produces same output', () => {
    expect(taskIdToUuid('tsk_abc123')).toBe(taskIdToUuid('tsk_abc123'))
  })

  it('produces different UUIDs for different task IDs', () => {
    expect(taskIdToUuid('tsk_abc123')).not.toBe(taskIdToUuid('tsk_def456'))
  })
})

describe('resolveClaudeSessionCommand', () => {
  beforeEach(() => {
    mockHomedir.mockReturnValue('/Users/testuser')
    mockExistsSync.mockReset()
    mockCopyFileSync.mockReset()
    mockMkdirSync.mockReset()
  })

  it('returns command unchanged if no --resume $VAR pattern', () => {
    const cmd = 'claude --dangerously-skip-permissions'
    expect(resolveClaudeSessionCommand(cmd, 'tsk_abc', '/project')).toBe(cmd)
  })

  it('returns command unchanged for --resume with a literal value (no $)', () => {
    const cmd = 'claude --resume some-uuid'
    expect(resolveClaudeSessionCommand(cmd, 'tsk_abc', '/project')).toBe(cmd)
  })

  it('replaces --resume $VAR with --session-id when no existing session', () => {
    mockExistsSync.mockReturnValue(false)

    const result = resolveClaudeSessionCommand(
      'claude --dangerously-skip-permissions --resume $FAMILIAR_TASK_ID',
      'tsk_abc',
      '/project'
    )

    const uuid = taskIdToUuid('tsk_abc')
    expect(result).toBe(`claude --dangerously-skip-permissions --session-id "${uuid}"`)
  })

  it('replaces --resume $VAR with --resume <uuid> when session exists', () => {
    mockExistsSync.mockReturnValue(true)

    const result = resolveClaudeSessionCommand(
      'claude --dangerously-skip-permissions --resume $FAMILIAR_TASK_ID',
      'tsk_abc',
      '/project'
    )

    const uuid = taskIdToUuid('tsk_abc')
    expect(result).toBe(`claude --dangerously-skip-permissions --resume "${uuid}"`)
  })

  it('checks the correct session file path', () => {
    mockExistsSync.mockReturnValue(false)

    resolveClaudeSessionCommand(
      'claude --resume $FAMILIAR_TASK_ID',
      'tsk_abc',
      '/Users/testuser/dev/my-project'
    )

    const uuid = taskIdToUuid('tsk_abc')
    const expectedPath = path.join(
      '/Users/testuser',
      '.claude',
      'projects',
      '-Users-testuser-dev-my-project',
      `${uuid}.jsonl`
    )
    expect(mockExistsSync).toHaveBeenCalledWith(expectedPath)
  })

  it('handles --resume with quoted $VAR', () => {
    mockExistsSync.mockReturnValue(false)

    const result = resolveClaudeSessionCommand(
      'claude --resume "$FAMILIAR_TASK_ID"',
      'tsk_abc',
      '/project'
    )

    const uuid = taskIdToUuid('tsk_abc')
    expect(result).toBe(`claude --session-id "${uuid}"`)
  })

  it('handles --resume with single-quoted $VAR', () => {
    mockExistsSync.mockReturnValue(false)

    const result = resolveClaudeSessionCommand(
      "claude --resume '$FAMILIAR_TASK_ID'",
      'tsk_abc',
      '/project'
    )

    const uuid = taskIdToUuid('tsk_abc')
    expect(result).toBe(`claude --session-id "${uuid}"`)
  })
})

describe('ensureForkSessionCopied', () => {
  const childUuid = taskIdToUuid('tsk_child')
  const parentUuid = taskIdToUuid('tsk_parent')
  const projectDir = path.join('/Users/testuser', '.claude', 'projects', '-project')
  const childSessionFile = path.join(projectDir, `${childUuid}.jsonl`)
  const parentSessionFile = path.join(projectDir, `${parentUuid}.jsonl`)

  // Helper: build a JSONL string from an array of objects
  function buildJsonl(entries: Record<string, unknown>[]): string {
    return entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  }

  // A non-compacted session (no compact_boundary)
  const simpleSession = buildJsonl([
    { parentUuid: null, type: 'progress', uuid: 'a1', sessionId: 'parent-session' },
    { parentUuid: 'a1', type: 'user', uuid: 'a2', message: { role: 'user', content: 'hello' } },
    { parentUuid: 'a2', type: 'assistant', uuid: 'a3', message: { role: 'assistant', content: 'hi' } }
  ])

  // A compacted session with pre- and post-compaction entries
  const compactedSession = buildJsonl([
    { parentUuid: null, type: 'progress', uuid: 'a1', sessionId: 'parent-session' },
    { parentUuid: 'a1', type: 'user', uuid: 'a2', message: { role: 'user', content: 'hello' } },
    { parentUuid: 'a2', type: 'assistant', uuid: 'a3', message: { role: 'assistant', content: 'hi' } },
    { type: 'file-history-snapshot', parentUuid: null, uuid: 'snap1' },
    { type: 'last-prompt', parentUuid: null, uuid: 'lp1', sessionId: 'parent-session' },
    { parentUuid: null, logicalParentUuid: 'a3', type: 'system', subtype: 'compact_boundary', uuid: 'cb1', sessionId: 'parent-session', content: 'Conversation compacted' },
    { parentUuid: 'cb1', type: 'user', uuid: 'b1', message: { role: 'user', content: 'Summary of previous conversation...' } },
    { parentUuid: 'b1', type: 'assistant', uuid: 'b2', message: { role: 'assistant', content: 'Continuing from summary' } }
  ])

  beforeEach(() => {
    mockHomedir.mockReturnValue('/Users/testuser')
    mockExistsSync.mockReset()
    mockCopyFileSync.mockReset()
    mockMkdirSync.mockReset()
    mockReadFileSync.mockReset()
    mockWriteFileSync.mockReset()
  })

  it('copies entire file when parent has no compaction', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === childSessionFile) return false
      if (p === parentSessionFile) return true
      return false
    })
    mockReadFileSync.mockReturnValue(simpleSession)

    const result = ensureForkSessionCopied('tsk_child', 'tsk_parent', '/project')

    expect(result).toBe(true)
    expect(mockCopyFileSync).toHaveBeenCalledWith(parentSessionFile, childSessionFile)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('trims pre-compaction entries when parent session was compacted', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === childSessionFile) return false
      if (p === parentSessionFile) return true
      return false
    })
    mockReadFileSync.mockReturnValue(compactedSession)

    const result = ensureForkSessionCopied('tsk_child', 'tsk_parent', '/project')

    expect(result).toBe(true)
    // Should NOT use copyFileSync for compacted sessions
    expect(mockCopyFileSync).not.toHaveBeenCalled()
    // Should write only entries from compact_boundary onward
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string
    const writtenLines = writtenContent.trim().split('\n')
    // compact_boundary + 2 entries after it = 3 lines
    expect(writtenLines).toHaveLength(3)
    // First line should be the compact_boundary
    const firstEntry = JSON.parse(writtenLines[0])
    expect(firstEntry.type).toBe('system')
    expect(firstEntry.subtype).toBe('compact_boundary')
    // Last line should be the post-compaction assistant message
    const lastEntry = JSON.parse(writtenLines[2])
    expect(lastEntry.type).toBe('assistant')
    expect(lastEntry.uuid).toBe('b2')
  })

  it('uses last compact_boundary when session was compacted multiple times', () => {
    const doubleCompactedSession = buildJsonl([
      { parentUuid: null, type: 'progress', uuid: 'a1' },
      { parentUuid: 'a1', type: 'user', uuid: 'a2' },
      // First compaction
      { parentUuid: null, type: 'system', subtype: 'compact_boundary', uuid: 'cb1', content: 'Compacted 1' },
      { parentUuid: 'cb1', type: 'user', uuid: 'b1' },
      { parentUuid: 'b1', type: 'assistant', uuid: 'b2' },
      // Second compaction
      { parentUuid: null, type: 'system', subtype: 'compact_boundary', uuid: 'cb2', content: 'Compacted 2' },
      { parentUuid: 'cb2', type: 'user', uuid: 'c1' },
      { parentUuid: 'c1', type: 'assistant', uuid: 'c2' }
    ])

    mockExistsSync.mockImplementation((p: string) => {
      if (p === childSessionFile) return false
      if (p === parentSessionFile) return true
      return false
    })
    mockReadFileSync.mockReturnValue(doubleCompactedSession)

    const result = ensureForkSessionCopied('tsk_child', 'tsk_parent', '/project')

    expect(result).toBe(true)
    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string
    const writtenLines = writtenContent.trim().split('\n')
    // Should only include from LAST compact_boundary: cb2 + c1 + c2 = 3 lines
    expect(writtenLines).toHaveLength(3)
    const firstEntry = JSON.parse(writtenLines[0])
    expect(firstEntry.uuid).toBe('cb2')
  })

  it('skips copy when child session already exists', () => {
    mockExistsSync.mockImplementation((p: string) => p === childSessionFile)

    const result = ensureForkSessionCopied('tsk_child', 'tsk_parent', '/project')

    expect(result).toBe(false)
    expect(mockCopyFileSync).not.toHaveBeenCalled()
    expect(mockReadFileSync).not.toHaveBeenCalled()
  })

  it('returns false when parent session does not exist', () => {
    mockExistsSync.mockReturnValue(false)

    const result = ensureForkSessionCopied('tsk_child', 'tsk_parent', '/project')

    expect(result).toBe(false)
    expect(mockCopyFileSync).not.toHaveBeenCalled()
  })

  it('handles read/write failure gracefully', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === childSessionFile) return false
      if (p === parentSessionFile) return true
      return false
    })
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    const result = ensureForkSessionCopied('tsk_child', 'tsk_parent', '/project')

    expect(result).toBe(false)
  })

  it('after copy, resolveClaudeSessionCommand uses --resume for the child', () => {
    // First call: ensureForkSessionCopied — child doesn't exist, parent does
    mockExistsSync.mockImplementation((p: string) => {
      if (p === childSessionFile) return false
      if (p === parentSessionFile) return true
      return false
    })
    mockReadFileSync.mockReturnValue(simpleSession)

    ensureForkSessionCopied('tsk_child', 'tsk_parent', '/project')

    // After copy, child session now exists
    mockExistsSync.mockImplementation((p: string) => {
      if (p === childSessionFile) return true
      return false
    })

    const result = resolveClaudeSessionCommand(
      'claude --resume $FAMILIAR_TASK_ID',
      'tsk_child',
      '/project'
    )

    expect(result).toBe(`claude --resume "${childUuid}"`)
  })
})
