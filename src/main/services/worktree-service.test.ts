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

    it('appears in worktree list with new name after rename', () => {
      const wt = WorktreeService.createWorktree(gitRoot, 'before')
      WorktreeService.renameWorktree(gitRoot, wt.path, 'after')

      const worktrees = WorktreeService.listWorktrees(gitRoot)
      const names = worktrees.map((w) => w.branch)
      expect(names).toContain('familiar-worktree/after')
      expect(names).not.toContain('familiar-worktree/before')
    })
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
