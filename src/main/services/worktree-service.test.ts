import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { WorktreeService } from './worktree-service'

describe('WorktreeService', () => {
  let tempDir: string
  let gitRoot: string

  beforeEach(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'familiar-wt-test-')))
    gitRoot = tempDir

    // Initialize a git repo
    execSync('git init', { cwd: gitRoot, stdio: 'pipe' })
    execSync('git config user.email "test@test.com"', { cwd: gitRoot, stdio: 'pipe' })
    execSync('git config user.name "Test"', { cwd: gitRoot, stdio: 'pipe' })
    // Create an initial commit (required for worktrees)
    fs.writeFileSync(path.join(gitRoot, 'README.md'), '# Test')
    execSync('git add .', { cwd: gitRoot, stdio: 'pipe' })
    execSync('git commit -m "init"', { cwd: gitRoot, stdio: 'pipe' })
  })

  afterEach(() => {
    // Clean up worktrees first, then temp dir
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: gitRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      })
      const blocks = output.split('\n\n').filter(Boolean)
      for (const block of blocks) {
        const lines = block.split('\n')
        const wtLine = lines.find((l) => l.startsWith('worktree '))
        if (wtLine) {
          const wtPath = wtLine.slice('worktree '.length)
          if (wtPath !== gitRoot) {
            try {
              execSync(`git worktree remove "${wtPath}" --force`, { cwd: gitRoot, stdio: 'pipe' })
            } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ }

    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('getGitRoot', () => {
    it('returns git root for a git repo', () => {
      const root = WorktreeService.getGitRoot(gitRoot)
      expect(root).toBe(gitRoot)
    })

    it('returns null for non-git directory', () => {
      const nonGitDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-')))
      try {
        const root = WorktreeService.getGitRoot(nonGitDir)
        expect(root).toBeNull()
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true })
      }
    })
  })

  describe('getMainWorktreeRoot', () => {
    it('returns the same path for a main worktree', () => {
      const result = WorktreeService.getMainWorktreeRoot(gitRoot)
      expect(result).toBe(gitRoot)
    })

    it('returns the main repo root when called from a worktree', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'test-main-root')
      const result = WorktreeService.getMainWorktreeRoot(wt.path)
      expect(result).toBe(gitRoot)
    })
  })

  describe('listWorktrees', () => {
    it('lists main worktree', () => {
      const worktrees = WorktreeService.listWorktrees(gitRoot)
      expect(worktrees.length).toBe(1)
      expect(worktrees[0].path).toBe(gitRoot)
      expect(worktrees[0].isMain).toBe(true)
    })

    it('returns empty array for non-git directory', () => {
      const nonGitDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-')))
      try {
        const worktrees = WorktreeService.listWorktrees(nonGitDir)
        expect(worktrees).toEqual([])
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true })
      }
    })

    it('correctly identifies main worktree when called from a worktree path', () => {
      // Create a worktree, then list from inside it
      const wt = WorktreeService.createWorktree(gitRoot, 'from-wt')
      const worktrees = WorktreeService.listWorktrees(wt.path)

      // Should still correctly identify the main worktree
      const main = worktrees.find((w) => w.isMain)
      expect(main).toBeDefined()
      expect(main!.path).toBe(gitRoot)

      // The created worktree should NOT be marked as main
      const child = worktrees.find((w) => w.path === wt.path)
      expect(child).toBeDefined()
      expect(child!.isMain).toBe(false)
    })

    it('excludes worktrees outside .familiar/worktrees/', () => {
      // Create a worktree outside .familiar/worktrees/ using git directly
      const externalPath = path.join(os.tmpdir(), 'external-wt-' + Date.now())
      try {
        execSync(`git worktree add -b external-branch "${externalPath}"`, {
          cwd: gitRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        })

        // Also create a familiar-managed worktree
        WorktreeService.createWorktree(gitRoot, 'familiar-wt')

        const worktrees = WorktreeService.listWorktrees(gitRoot)
        // Should have main + familiar-wt, but NOT external-wt
        const paths = worktrees.map((w) => w.path)
        expect(paths).toContain(gitRoot) // main
        expect(paths).toContain(path.join(gitRoot, '.familiar', 'worktrees', 'familiar-wt'))
        expect(paths).not.toContain(externalPath)
        expect(worktrees.length).toBe(2)
      } finally {
        // Cleanup
        try {
          execSync(`git worktree remove "${externalPath}" --force`, { cwd: gitRoot, stdio: ['pipe', 'pipe', 'pipe'] })
          execSync('git branch -D external-branch', { cwd: gitRoot, stdio: ['pipe', 'pipe', 'pipe'] })
        } catch { /* best effort */ }
      }
    })
  })

  describe('createWorktree', () => {
    it('creates a worktree with a custom slug', () => {
      const result = WorktreeService.createWorktree(gitRoot, 'test-slug')
      expect(result.slug).toBe('test-slug')
      expect(result.branch).toBe('familiar-worktree/test-slug')
      expect(result.isMain).toBe(false)
      expect(result.path).toBe(path.join(gitRoot, '.familiar', 'worktrees', 'test-slug'))
      expect(fs.existsSync(result.path)).toBe(true)
    })

    it('creates .familiar directory inside worktree', () => {
      const result = WorktreeService.createWorktree(gitRoot, 'wt-init')
      const familiarDir = path.join(result.path, '.familiar')
      expect(fs.existsSync(familiarDir)).toBe(true)
      expect(fs.existsSync(path.join(familiarDir, 'state.json'))).toBe(true)
      expect(fs.existsSync(path.join(familiarDir, 'tasks'))).toBe(true)
    })

    it('initializes state.json with slug as project name', () => {
      const result = WorktreeService.createWorktree(gitRoot, 'cool-panda')
      const stateFile = path.join(result.path, '.familiar', 'state.json')
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
      expect(state.projectName).toBe('cool-panda')
      expect(state.tasks).toEqual([])
      expect(state.columnOrder).toEqual(['todo', 'in-progress', 'in-review', 'done', 'archived'])
    })

    it('creates .familiar/.gitignore with worktrees/ entry', () => {
      WorktreeService.createWorktree(gitRoot, 'gitignore-test')
      const gitignorePath = path.join(gitRoot, '.familiar', '.gitignore')
      expect(fs.existsSync(gitignorePath)).toBe(true)
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('worktrees/')
    })

    it('creates worktree under main repo when called from a worktree path', () => {
      // Create first worktree
      const wt1 = WorktreeService.createWorktree(gitRoot, 'first-wt')
      // Create second worktree FROM the first worktree's path
      const wt2 = WorktreeService.createWorktree(wt1.path, 'second-wt')

      // The second worktree should be under the MAIN repo's .familiar/worktrees/,
      // NOT nested inside the first worktree
      expect(wt2.path).toBe(path.join(gitRoot, '.familiar', 'worktrees', 'second-wt'))
      expect(fs.existsSync(wt2.path)).toBe(true)
    })

    it('generates a slug when none is provided', () => {
      const result = WorktreeService.createWorktree(gitRoot)
      expect(result.slug).toMatch(/^[a-z]+-[a-z]+$/)
      expect(result.branch).toMatch(/^familiar-worktree\/[a-z]+-[a-z]+$/)
    })

    it('appears in worktree list after creation', () => {
      WorktreeService.createWorktree(gitRoot, 'listed-wt')
      const worktrees = WorktreeService.listWorktrees(gitRoot)
      expect(worktrees.length).toBe(2) // main + new
      const newWt = worktrees.find((w) => !w.isMain)
      expect(newWt).toBeDefined()
      expect(newWt!.branch).toBe('familiar-worktree/listed-wt')
    })

    it('copies settings.json from main project to worktree', () => {
      // Create a settings.json in the main project's .familiar/
      const mainFamiliarDir = path.join(gitRoot, '.familiar')
      fs.mkdirSync(mainFamiliarDir, { recursive: true })
      const settings = {
        defaultCommand: 'claude --resume $FAMILIAR_TASK_ID',
        simplifyTaskTitles: true,
        snippets: [{ title: 'Start', command: '/familiar-agent', pressEnter: true }]
      }
      fs.writeFileSync(
        path.join(mainFamiliarDir, 'settings.json'),
        JSON.stringify(settings, null, 2)
      )

      const result = WorktreeService.createWorktree(gitRoot, 'settings-copy')
      const worktreeSettingsFile = path.join(result.path, '.familiar', 'settings.json')
      expect(fs.existsSync(worktreeSettingsFile)).toBe(true)

      const copiedSettings = JSON.parse(fs.readFileSync(worktreeSettingsFile, 'utf-8'))
      expect(copiedSettings).toEqual(settings)
    })

    it('does not fail when main project has no settings.json', () => {
      const result = WorktreeService.createWorktree(gitRoot, 'no-settings')
      const worktreeSettingsFile = path.join(result.path, '.familiar', 'settings.json')
      expect(fs.existsSync(worktreeSettingsFile)).toBe(false)
    })

    it('throws for non-git directory', () => {
      const nonGitDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-')))
      try {
        expect(() => WorktreeService.createWorktree(nonGitDir, 'fail')).toThrow('Not a git repository')
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true })
      }
    })
  })

  describe('removeWorktree', () => {
    it('removes a worktree and its branch', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'to-remove')
      WorktreeService.removeWorktree(gitRoot, wt.path)
      const worktrees = WorktreeService.listWorktrees(gitRoot)
      expect(worktrees.length).toBe(1) // only main
      expect(fs.existsSync(wt.path)).toBe(false)
    })

    it('cleans up familiar-worktree branch', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'branch-cleanup')
      WorktreeService.removeWorktree(gitRoot, wt.path)

      // Verify branch is deleted
      const branches = execSync('git branch', { cwd: gitRoot, encoding: 'utf-8' })
      expect(branches).not.toContain('familiar-worktree/branch-cleanup')
    })

    it('works when projectPath points to a different git repo', () => {
      // Simulate the bug: user is on a different project when removing a worktree
      const otherRepo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'other-repo-')))
      execSync('git init', { cwd: otherRepo, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: otherRepo, stdio: 'pipe' })
      execSync('git config user.name "Test"', { cwd: otherRepo, stdio: 'pipe' })
      fs.writeFileSync(path.join(otherRepo, 'README.md'), '# Other')
      execSync('git add .', { cwd: otherRepo, stdio: 'pipe' })
      execSync('git commit -m "init"', { cwd: otherRepo, stdio: 'pipe' })

      try {
        const wt = WorktreeService.createWorktree(gitRoot, 'cross-project')
        // Remove using the OTHER repo as projectPath (simulating active project switch)
        WorktreeService.removeWorktree(otherRepo, wt.path)
        const worktrees = WorktreeService.listWorktrees(gitRoot)
        expect(worktrees.length).toBe(1) // only main
        expect(fs.existsSync(wt.path)).toBe(false)
      } finally {
        fs.rmSync(otherRepo, { recursive: true, force: true })
      }
    })

    it('handles already-removed worktree directory gracefully', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'already-gone')
      // Manually delete the worktree directory (simulating external deletion)
      fs.rmSync(wt.path, { recursive: true, force: true })
      // Should not throw — should prune stale entries instead
      expect(() => WorktreeService.removeWorktree(gitRoot, wt.path)).not.toThrow()
    })
  })

  describe('renameWorktree', () => {
    it('renames worktree directory and branch', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'old-name')
      const result = WorktreeService.renameWorktree(gitRoot, wt.path, 'new-name')

      expect(result.slug).toBe('new-name')
      expect(result.branch).toBe('familiar-worktree/new-name')
      expect(result.path).toContain('new-name')
      expect(fs.existsSync(result.path)).toBe(true)
      expect(fs.existsSync(wt.path)).toBe(false)
    })

    it('updates state.json project name', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'state-rename')
      const result = WorktreeService.renameWorktree(gitRoot, wt.path, 'renamed-state')

      const stateFile = path.join(result.path, '.familiar', 'state.json')
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
      expect(state.projectName).toBe('renamed-state')
    })

    it('throws when target name already exists', () => {
      WorktreeService.createWorktree(gitRoot, 'existing')
      const wt = WorktreeService.createWorktree(gitRoot, 'to-rename')

      expect(() => WorktreeService.renameWorktree(gitRoot, wt.path, 'existing')).toThrow(
        'already exists'
      )
    })

    it('works when projectPath points to a different git repo', () => {
      const otherRepo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'other-repo-')))
      execSync('git init', { cwd: otherRepo, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: otherRepo, stdio: 'pipe' })
      execSync('git config user.name "Test"', { cwd: otherRepo, stdio: 'pipe' })
      fs.writeFileSync(path.join(otherRepo, 'README.md'), '# Other')
      execSync('git add .', { cwd: otherRepo, stdio: 'pipe' })
      execSync('git commit -m "init"', { cwd: otherRepo, stdio: 'pipe' })

      try {
        const wt = WorktreeService.createWorktree(gitRoot, 'cross-rename')
        const result = WorktreeService.renameWorktree(otherRepo, wt.path, 'renamed-cross')
        expect(result.slug).toBe('renamed-cross')
        expect(fs.existsSync(result.path)).toBe(true)
      } finally {
        fs.rmSync(otherRepo, { recursive: true, force: true })
      }
    })

    it('appears in worktree list with new name after rename', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'before')
      WorktreeService.renameWorktree(gitRoot, wt.path, 'after')

      const worktrees = WorktreeService.listWorktrees(gitRoot)
      const names = worktrees.map((w) => w.branch)
      expect(names).toContain('familiar-worktree/after')
      expect(names).not.toContain('familiar-worktree/before')
    })
  })

  describe('getHookPath', () => {
    it('returns the hook path for a git repo', () => {
      const hookPath = WorktreeService.getHookPath(gitRoot)
      expect(hookPath).toBe(path.join(gitRoot, '.familiar', 'hooks', 'after-worktree-create.sh'))
    })

    it('returns null for non-git directory', () => {
      const nonGitDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-')))
      try {
        expect(WorktreeService.getHookPath(nonGitDir)).toBeNull()
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true })
      }
    })
  })

  describe('hookExists', () => {
    it('returns false when hook does not exist', () => {
      expect(WorktreeService.hookExists(gitRoot)).toBe(false)
    })

    it('returns true when hook file exists', () => {
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(path.join(hooksDir, 'after-worktree-create.sh'), '#!/bin/bash\necho hello')
      expect(WorktreeService.hookExists(gitRoot)).toBe(true)
    })
  })

  describe('runPostCreateHook', () => {
    it('returns ran=false when hook does not exist', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'no-hook')
      const result = await WorktreeService.runPostCreateHook(gitRoot, wt.path, {})
      expect(result.ran).toBe(false)
      expect(result.exitCode).toBeNull()
    })

    it('runs the hook and returns output', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'with-hook')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'after-worktree-create.sh'),
        '#!/bin/bash\necho "hello from hook"'
      )

      const result = await WorktreeService.runPostCreateHook(gitRoot, wt.path, {})
      expect(result.ran).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('hello from hook')
    })

    it('passes environment variables to the hook', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'env-hook')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'after-worktree-create.sh'),
        '#!/bin/bash\necho "main=$MAIN_WORKTREE_DIR new=$NEW_WORKTREE_DIR custom=$MY_CUSTOM_VAR"'
      )

      const result = await WorktreeService.runPostCreateHook(gitRoot, wt.path, {
        MY_CUSTOM_VAR: 'test-value'
      })
      expect(result.ran).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain(`main=${gitRoot}`)
      expect(result.output).toContain(`new=${wt.path}`)
      expect(result.output).toContain('custom=test-value')
    })

    it('runs hook in the new worktree directory', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'cwd-hook')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'after-worktree-create.sh'),
        '#!/bin/bash\npwd'
      )

      const result = await WorktreeService.runPostCreateHook(gitRoot, wt.path, {})
      expect(result.ran).toBe(true)
      expect(result.output.trim()).toBe(wt.path)
    })

    it('handles hook failure gracefully', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'fail-hook')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'after-worktree-create.sh'),
        '#!/bin/bash\nexit 1'
      )

      const result = await WorktreeService.runPostCreateHook(gitRoot, wt.path, {})
      expect(result.ran).toBe(true)
      expect(result.exitCode).toBe(1)
    })

    it('passes all built-in env vars including name, branch, and project info', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'builtin-env')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'after-worktree-create.sh'),
        '#!/bin/bash\necho "name=$NEW_WORKTREE_NAME branch=$NEW_WORKTREE_BRANCH orig_branch=$MAIN_WORKTREE_BRANCH proj=$MAIN_WORKTREE_PROJECT"'
      )

      const result = await WorktreeService.runPostCreateHook(gitRoot, wt.path, {})
      expect(result.ran).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('name=builtin-env')
      expect(result.output).toContain('branch=familiar-worktree/builtin-env')
      expect(result.output).toContain('proj=')
    })
  })

  describe('getPreDeleteHookPath', () => {
    it('returns the pre-delete hook path for a git repo', () => {
      const hookPath = WorktreeService.getPreDeleteHookPath(gitRoot)
      expect(hookPath).toBe(path.join(gitRoot, '.familiar', 'hooks', 'pre-worktree-delete.sh'))
    })

    it('returns null for non-git directory', () => {
      const nonGitDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-')))
      try {
        expect(WorktreeService.getPreDeleteHookPath(nonGitDir)).toBeNull()
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true })
      }
    })
  })

  describe('preDeleteHookExists', () => {
    it('returns false when hook does not exist', () => {
      expect(WorktreeService.preDeleteHookExists(gitRoot)).toBe(false)
    })

    it('returns true when hook file exists', () => {
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(path.join(hooksDir, 'pre-worktree-delete.sh'), '#!/bin/bash\n# noop')
      expect(WorktreeService.preDeleteHookExists(gitRoot)).toBe(true)
    })
  })

  describe('runPreDeleteHook', () => {
    it('returns ran=false when hook does not exist', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'no-pre-hook')
      const result = await WorktreeService.runPreDeleteHook(gitRoot, wt.path)
      expect(result.ran).toBe(false)
      expect(result.exitCode).toBeNull()
    })

    it('runs the pre-delete hook and returns output', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'pre-del')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'pre-worktree-delete.sh'),
        '#!/bin/bash\necho "cleaning up $DELETE_WORKTREE_NAME"'
      )

      const result = await WorktreeService.runPreDeleteHook(gitRoot, wt.path)
      expect(result.ran).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('cleaning up pre-del')
    })

    it('passes all built-in env vars to pre-delete hook', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'pre-del-env')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'pre-worktree-delete.sh'),
        '#!/bin/bash\necho "main=$MAIN_WORKTREE_DIR wt=$DELETE_WORKTREE_DIR name=$DELETE_WORKTREE_NAME"'
      )

      const result = await WorktreeService.runPreDeleteHook(gitRoot, wt.path)
      expect(result.ran).toBe(true)
      expect(result.output).toContain(`main=${gitRoot}`)
      expect(result.output).toContain(`wt=${wt.path}`)
      expect(result.output).toContain('name=pre-del-env')
    })

    it('runs in the worktree directory', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'pre-del-cwd')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      fs.writeFileSync(
        path.join(hooksDir, 'pre-worktree-delete.sh'),
        '#!/bin/bash\npwd'
      )

      const result = await WorktreeService.runPreDeleteHook(gitRoot, wt.path)
      expect(result.ran).toBe(true)
      expect(result.output.trim()).toBe(wt.path)
    })
  })

  describe('abortPreDeleteHook', () => {
    it('returns false when no hook is running for the path', () => {
      expect(WorktreeService.abortPreDeleteHook('/nonexistent/path')).toBe(false)
    })

    it('kills a running pre-delete hook and resolves the promise', async () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'abort-test')
      const hooksDir = path.join(gitRoot, '.familiar', 'hooks')
      fs.mkdirSync(hooksDir, { recursive: true })
      // Hook that sleeps for 60 seconds (will be killed before completing)
      fs.writeFileSync(
        path.join(hooksDir, 'pre-worktree-delete.sh'),
        '#!/bin/bash\nexec sleep 60'
      )
      fs.chmodSync(path.join(hooksDir, 'pre-worktree-delete.sh'), 0o755)

      // Start the hook (don't await yet)
      const hookPromise = WorktreeService.runPreDeleteHook(gitRoot, wt.path)

      // Give the process a moment to start
      await new Promise((r) => setTimeout(r, 200))

      // Abort should succeed
      const aborted = WorktreeService.abortPreDeleteHook(wt.path)
      expect(aborted).toBe(true)

      // The promise should resolve (not hang)
      const result = await hookPromise
      expect(result.ran).toBe(true)
      // SIGKILL results in null exit code
      expect(result.exitCode).toBeNull()

      // Second abort should return false (process already cleaned up)
      expect(WorktreeService.abortPreDeleteHook(wt.path)).toBe(false)
    }, 10000)
  })

  describe('ensureGitignore', () => {
    it('does not duplicate worktrees/ entry', () => {
      // Create two worktrees — each call to createWorktree calls ensureGitignore
      WorktreeService.createWorktree(gitRoot, 'first')
      WorktreeService.createWorktree(gitRoot, 'second')

      const gitignorePath = path.join(gitRoot, '.familiar', '.gitignore')
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      const matches = content.match(/worktrees\//g)
      expect(matches).toHaveLength(1)
    })
  })
})
