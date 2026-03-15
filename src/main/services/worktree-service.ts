import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { generateWorktreeSlug } from '../../shared/utils/name-generator'

export interface WorktreeInfo {
  path: string
  branch: string
  slug: string
  isMain: boolean
}

/**
 * Service for managing git worktrees inside .familiar/worktrees/.
 */
export class WorktreeService {
  /**
   * Get the git root directory for a project path.
   * Returns null if the path is not inside a git repo.
   */
  static getGitRoot(projectPath: string): string | null {
    try {
      const result = execSync('git rev-parse --show-toplevel', {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
      return result.trim()
    } catch {
      return null
    }
  }

  /**
   * Check if a project path is inside a git worktree (not the main working tree).
   */
  static isWorktree(projectPath: string): boolean {
    try {
      const gitDir = execSync('git rev-parse --git-dir', {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
      // In a worktree, git-dir is usually .git/worktrees/<name> or similar
      return gitDir.includes('/worktrees/')
    } catch {
      return false
    }
  }

  /**
   * List all worktrees for the git repo at the given path.
   */
  static listWorktrees(projectPath: string): WorktreeInfo[] {
    const gitRoot = this.getGitRoot(projectPath)
    if (!gitRoot) return []

    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: gitRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })

      const worktrees: WorktreeInfo[] = []
      const blocks = output.split('\n\n').filter(Boolean)

      for (const block of blocks) {
        const lines = block.split('\n')
        let wtPath = ''
        let branch = ''
        let isBare = false

        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            wtPath = line.slice('worktree '.length)
          } else if (line.startsWith('branch ')) {
            branch = line.slice('branch '.length)
            // Remove refs/heads/ prefix
            branch = branch.replace('refs/heads/', '')
          } else if (line === 'bare') {
            isBare = true
          }
        }

        if (!wtPath || isBare) continue

        // Determine if this is a familiar-managed worktree
        const familiarWorktreesDir = path.join(gitRoot, '.familiar', 'worktrees')
        const isInFamiliarDir = wtPath.startsWith(familiarWorktreesDir)
        const slug = isInFamiliarDir ? path.basename(wtPath) : path.basename(wtPath)
        const isMain = wtPath === gitRoot

        worktrees.push({ path: wtPath, branch, slug, isMain })
      }

      return worktrees
    } catch {
      return []
    }
  }

  /**
   * Create a new worktree inside .familiar/worktrees/<slug>/.
   * Returns the worktree info.
   */
  static createWorktree(projectPath: string, customSlug?: string): WorktreeInfo {
    const gitRoot = this.getGitRoot(projectPath)
    if (!gitRoot) {
      throw new Error('Not a git repository')
    }

    const slug = customSlug || generateWorktreeSlug()
    const branchName = `familiar-worktree/${slug}`
    const worktreesDir = path.join(gitRoot, '.familiar', 'worktrees')
    const worktreePath = path.join(worktreesDir, slug)

    // Ensure the worktrees directory exists
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true })
    }

    // Ensure .familiar/.gitignore exists and ignores worktrees/
    this.ensureGitignore(gitRoot)

    // Create the worktree with a new branch
    try {
      execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
        cwd: gitRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Branch might already exist
      if (msg.includes('already exists')) {
        throw new Error(`Branch "${branchName}" already exists. Try a different slug.`)
      }
      throw new Error(`Failed to create worktree: ${msg}`)
    }

    // Initialize .familiar/ inside the worktree
    const worktreeFamiliarDir = path.join(worktreePath, '.familiar')
    if (!fs.existsSync(worktreeFamiliarDir)) {
      fs.mkdirSync(worktreeFamiliarDir, { recursive: true })
    }

    // Create a minimal state.json so Familiar treats it as an initialized project
    const stateFile = path.join(worktreeFamiliarDir, 'state.json')
    if (!fs.existsSync(stateFile)) {
      const state = {
        projectName: slug,
        tasks: [],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: [
          { name: 'bug', color: '#ef4444', description: 'Something is broken' },
          { name: 'feature', color: '#3b82f6', description: 'New functionality' },
          { name: 'chore', color: '#6b7280', description: 'Maintenance and housekeeping' }
        ]
      }
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
    }

    // Create tasks directory
    const tasksDir = path.join(worktreeFamiliarDir, 'tasks')
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true })
    }

    return {
      path: worktreePath,
      branch: branchName,
      slug,
      isMain: false
    }
  }

  /**
   * Rename a worktree by moving its directory and renaming its branch.
   * Returns the updated worktree info.
   */
  static renameWorktree(projectPath: string, worktreePath: string, newSlug: string): WorktreeInfo {
    const gitRoot = this.getGitRoot(projectPath)
    if (!gitRoot) throw new Error('Not a git repository')

    const worktrees = this.listWorktrees(projectPath)
    const wt = worktrees.find((w) => w.path === worktreePath)
    if (!wt) throw new Error('Worktree not found')

    const newBranchName = `familiar-worktree/${newSlug}`
    const worktreesDir = path.join(gitRoot, '.familiar', 'worktrees')
    const newWorktreePath = path.join(worktreesDir, newSlug)

    if (fs.existsSync(newWorktreePath)) {
      throw new Error(`A worktree named "${newSlug}" already exists`)
    }

    // Move the worktree directory
    execSync(`git worktree move "${worktreePath}" "${newWorktreePath}"`, {
      cwd: gitRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Rename the branch
    if (wt.branch && wt.branch.startsWith('familiar-worktree/')) {
      try {
        execSync(`git branch -m "${wt.branch}" "${newBranchName}"`, {
          cwd: gitRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } catch {
        // Branch rename failed — worktree still moved successfully
      }
    }

    // Update the project name in the worktree's state.json
    const stateFile = path.join(newWorktreePath, '.familiar', 'state.json')
    if (fs.existsSync(stateFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
        state.projectName = newSlug
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
      } catch {
        // Non-critical — continue
      }
    }

    return {
      path: newWorktreePath,
      branch: newBranchName,
      slug: newSlug,
      isMain: false
    }
  }

  /**
   * Remove a worktree.
   */
  static removeWorktree(projectPath: string, worktreePath: string): void {
    const gitRoot = this.getGitRoot(projectPath)
    if (!gitRoot) throw new Error('Not a git repository')

    // Get the branch name before removing so we can clean it up
    const worktrees = this.listWorktrees(projectPath)
    const wt = worktrees.find((w) => w.path === worktreePath)
    const branchToDelete = wt?.branch

    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: gitRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Delete the branch if it was a familiar-worktree branch
    if (branchToDelete && branchToDelete.startsWith('familiar-worktree/')) {
      try {
        execSync(`git branch -D "${branchToDelete}"`, {
          cwd: gitRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } catch {
        // Branch might already be gone
      }
    }
  }

  /**
   * Ensure .familiar/.gitignore exists and contains worktrees/ entry.
   */
  private static ensureGitignore(gitRoot: string): void {
    const familiarDir = path.join(gitRoot, '.familiar')
    const gitignorePath = path.join(familiarDir, '.gitignore')

    if (!fs.existsSync(familiarDir)) {
      fs.mkdirSync(familiarDir, { recursive: true })
    }

    let content = ''
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8')
    }

    // Check if worktrees/ is already ignored
    const lines = content.split('\n')
    if (!lines.some((line) => line.trim() === 'worktrees/' || line.trim() === 'worktrees')) {
      const newContent = content.trimEnd() + (content.length > 0 ? '\n' : '') + 'worktrees/\n'
      fs.writeFileSync(gitignorePath, newContent)
    }
  }
}
