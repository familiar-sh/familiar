import { describe, it, expect } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'

const HOOKS_DIR = path.join(__dirname, '../../.claude/hooks')

describe('Claude Code hooks', () => {
  describe('on-prompt-submit.sh', () => {
    it('exists and is a valid shell script', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-prompt-submit.sh'), 'utf-8')
      expect(content).toMatch(/^#!\/bin\/bash/)
    })

    it('checks for FAMILIAR_TASK_ID before running', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-prompt-submit.sh'), 'utf-8')
      expect(content).toContain('$FAMILIAR_TASK_ID')
      expect(content).toContain('-n "$FAMILIAR_TASK_ID"')
    })

    it('sets agent status to running', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-prompt-submit.sh'), 'utf-8')
      expect(content).toContain('--agent-status running')
    })

    it('sets task status to in-progress', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-prompt-submit.sh'), 'utf-8')
      expect(content).toContain('familiar status "$FAMILIAR_TASK_ID" in-progress')
    })

    it('exits with 0 to not block Claude', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-prompt-submit.sh'), 'utf-8')
      expect(content).toContain('exit 0')
    })
  })

  describe('on-stop.sh', () => {
    it('exists and is a valid shell script', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-stop.sh'), 'utf-8')
      expect(content).toMatch(/^#!\/bin\/bash/)
    })

    it('checks for FAMILIAR_TASK_ID before running', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-stop.sh'), 'utf-8')
      expect(content).toContain('$FAMILIAR_TASK_ID')
      expect(content).toContain('-n "$FAMILIAR_TASK_ID"')
    })

    it('sets agent status to done', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-stop.sh'), 'utf-8')
      expect(content).toContain('--agent-status done')
    })

    it('moves task to in-review', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-stop.sh'), 'utf-8')
      expect(content).toContain('familiar status "$FAMILIAR_TASK_ID" in-review')
    })

    it('sends a notification that the agent stopped', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-stop.sh'), 'utf-8')
      expect(content).toContain('familiar notify')
    })

    it('exits with 0 to not block Claude', async () => {
      const content = await fs.readFile(path.join(HOOKS_DIR, 'on-stop.sh'), 'utf-8')
      expect(content).toContain('exit 0')
    })
  })
})
