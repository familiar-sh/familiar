/**
 * Real filesystem tests for health check functions.
 * These tests create actual files on disk to verify the check logic works correctly.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, chmodSync, rmSync, existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { checkHooksConfigured, checkSkillInstalled, fixHooks, fixSkill } from './health-handlers'

let testRoot: string

beforeEach(() => {
  testRoot = join(tmpdir(), `familiar-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(testRoot, { recursive: true })
})

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true })
})

// ── Helper to create a fully valid hooks setup ──

function createValidHooksSetup(root: string): void {
  const claudeDir = join(root, '.claude')
  const hooksDir = join(claudeDir, 'hooks')
  mkdirSync(hooksDir, { recursive: true })

  writeFileSync(
    join(claudeDir, 'settings.json'),
    JSON.stringify({
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/on-prompt-submit.sh', timeout: 5 }] }
        ],
        Stop: [
          { hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/on-stop.sh', timeout: 5 }] }
        ]
      }
    }, null, 2)
  )

  const onPromptSubmit = join(hooksDir, 'on-prompt-submit.sh')
  writeFileSync(onPromptSubmit, '#!/bin/bash\nexit 0\n')
  chmodSync(onPromptSubmit, 0o755)

  const onStop = join(hooksDir, 'on-stop.sh')
  writeFileSync(onStop, '#!/bin/bash\nexit 0\n')
  chmodSync(onStop, 0o755)
}

function createValidSkillSetup(root: string): void {
  const skillDir = join(root, '.claude', 'skills', 'familiar-agent')
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: familiar-agent\n---\n# Content\n')
}

// ── checkHooksConfigured ──

describe('checkHooksConfigured (real filesystem)', () => {
  it('returns true when hooks are fully configured', () => {
    createValidHooksSetup(testRoot)
    expect(checkHooksConfigured(testRoot)).toBe(true)
  })

  it('returns false when .claude directory does not exist', () => {
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when settings.json does not exist', () => {
    const hooksDir = join(testRoot, '.claude', 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(join(hooksDir, 'on-prompt-submit.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-prompt-submit.sh'), 0o755)
    writeFileSync(join(hooksDir, 'on-stop.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-stop.sh'), 0o755)
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when settings.json has no hooks key', () => {
    const claudeDir = join(testRoot, '.claude')
    const hooksDir = join(claudeDir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({ other: 'stuff' }))
    writeFileSync(join(hooksDir, 'on-prompt-submit.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-prompt-submit.sh'), 0o755)
    writeFileSync(join(hooksDir, 'on-stop.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-stop.sh'), 0o755)
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when hooks.UserPromptSubmit is missing', () => {
    const claudeDir = join(testRoot, '.claude')
    const hooksDir = join(claudeDir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ hooks: { Stop: [{ hooks: [] }] } })
    )
    writeFileSync(join(hooksDir, 'on-prompt-submit.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-prompt-submit.sh'), 0o755)
    writeFileSync(join(hooksDir, 'on-stop.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-stop.sh'), 0o755)
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when hooks.Stop is missing', () => {
    const claudeDir = join(testRoot, '.claude')
    const hooksDir = join(claudeDir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [] }] } })
    )
    writeFileSync(join(hooksDir, 'on-prompt-submit.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-prompt-submit.sh'), 0o755)
    writeFileSync(join(hooksDir, 'on-stop.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-stop.sh'), 0o755)
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when settings.json is malformed JSON', () => {
    const claudeDir = join(testRoot, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    writeFileSync(join(claudeDir, 'settings.json'), 'not valid json{{{')
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when on-prompt-submit.sh does not exist', () => {
    const claudeDir = join(testRoot, '.claude')
    const hooksDir = join(claudeDir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [] }], Stop: [{ hooks: [] }] } })
    )
    writeFileSync(join(hooksDir, 'on-stop.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-stop.sh'), 0o755)
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when on-stop.sh does not exist', () => {
    const claudeDir = join(testRoot, '.claude')
    const hooksDir = join(claudeDir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [] }], Stop: [{ hooks: [] }] } })
    )
    writeFileSync(join(hooksDir, 'on-prompt-submit.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-prompt-submit.sh'), 0o755)
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns false when hook scripts exist but are NOT executable', () => {
    const claudeDir = join(testRoot, '.claude')
    const hooksDir = join(claudeDir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [] }], Stop: [{ hooks: [] }] } })
    )
    writeFileSync(join(hooksDir, 'on-prompt-submit.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-prompt-submit.sh'), 0o644)
    writeFileSync(join(hooksDir, 'on-stop.sh'), '#!/bin/bash\n')
    chmodSync(join(hooksDir, 'on-stop.sh'), 0o644)
    expect(checkHooksConfigured(testRoot)).toBe(false)
  })

  it('returns true with extra fields in settings.json', () => {
    createValidHooksSetup(testRoot)
    const settingsPath = join(testRoot, '.claude', 'settings.json')
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    settings.permissions = { allow: ['Read'] }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    expect(checkHooksConfigured(testRoot)).toBe(true)
  })
})

// ── checkSkillInstalled ──

describe('checkSkillInstalled (real filesystem)', () => {
  it('returns true when SKILL.md exists', () => {
    createValidSkillSetup(testRoot)
    expect(checkSkillInstalled(testRoot)).toBe(true)
  })

  it('returns false when .claude directory does not exist', () => {
    expect(checkSkillInstalled(testRoot)).toBe(false)
  })

  it('returns false when skills directory exists but SKILL.md is missing', () => {
    mkdirSync(join(testRoot, '.claude', 'skills', 'familiar-agent'), { recursive: true })
    expect(checkSkillInstalled(testRoot)).toBe(false)
  })

  it('returns false when skill is in wrong directory name', () => {
    const wrongDir = join(testRoot, '.claude', 'skills', 'other-agent')
    mkdirSync(wrongDir, { recursive: true })
    writeFileSync(join(wrongDir, 'SKILL.md'), '# test')
    expect(checkSkillInstalled(testRoot)).toBe(false)
  })
})

// ── fixHooks ──

describe('fixHooks (real filesystem)', () => {
  it('creates all required files from scratch', () => {
    fixHooks(testRoot)
    expect(existsSync(join(testRoot, '.claude', 'hooks'))).toBe(true)
    expect(existsSync(join(testRoot, '.claude', 'settings.json'))).toBe(true)
    expect(existsSync(join(testRoot, '.claude', 'hooks', 'on-prompt-submit.sh'))).toBe(true)
    expect(existsSync(join(testRoot, '.claude', 'hooks', 'on-stop.sh'))).toBe(true)
  })

  it('creates settings.json with correct hooks structure', () => {
    fixHooks(testRoot)
    const settings = JSON.parse(readFileSync(join(testRoot, '.claude', 'settings.json'), 'utf-8'))
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1)
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].type).toBe('command')
    expect(settings.hooks.Stop).toHaveLength(1)
    expect(settings.hooks.Stop[0].hooks[0].type).toBe('command')
  })

  it('makes hook scripts executable', () => {
    fixHooks(testRoot)
    expect(statSync(join(testRoot, '.claude', 'hooks', 'on-prompt-submit.sh')).mode & 0o100).toBeTruthy()
    expect(statSync(join(testRoot, '.claude', 'hooks', 'on-stop.sh')).mode & 0o100).toBeTruthy()
  })

  it('preserves existing settings.json fields', () => {
    const claudeDir = join(testRoot, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({ permissions: { allow: ['Read'] } }))
    fixHooks(testRoot)
    const settings = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf-8'))
    expect(settings.permissions).toEqual({ allow: ['Read'] })
    expect(settings.hooks).toBeDefined()
  })

  it('check passes after fix (integration)', () => {
    expect(checkHooksConfigured(testRoot)).toBe(false)
    fixHooks(testRoot)
    expect(checkHooksConfigured(testRoot)).toBe(true)
  })

  it('is idempotent — fix twice, check still passes', () => {
    fixHooks(testRoot)
    fixHooks(testRoot)
    expect(checkHooksConfigured(testRoot)).toBe(true)
  })
})

// ── fixSkill ──

describe('fixSkill (real filesystem)', () => {
  it('creates SKILL.md', () => {
    fixSkill(testRoot)
    expect(existsSync(join(testRoot, '.claude', 'skills', 'familiar-agent', 'SKILL.md'))).toBe(true)
  })

  it('creates SKILL.md with correct content', () => {
    fixSkill(testRoot)
    const content = readFileSync(join(testRoot, '.claude', 'skills', 'familiar-agent', 'SKILL.md'), 'utf-8')
    expect(content).toContain('name: familiar-agent')
    expect(content).toContain('FAMILIAR_TASK_ID')
  })

  it('check passes after fix (integration)', () => {
    expect(checkSkillInstalled(testRoot)).toBe(false)
    fixSkill(testRoot)
    expect(checkSkillInstalled(testRoot)).toBe(true)
  })

  it('is idempotent', () => {
    fixSkill(testRoot)
    fixSkill(testRoot)
    expect(checkSkillInstalled(testRoot)).toBe(true)
  })
})
