import { execSync, spawn, type ChildProcess } from 'child_process'
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
  /** Track running pre-delete hook processes by worktree path for abort support */
  private static runningPreDeleteHooks = new Map<string, ChildProcess>()
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

      // Parse all worktree entries
      const rawEntries: { path: string; branch: string }[] = []
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
        rawEntries.push({ path: wtPath, branch })
      }

      if (rawEntries.length === 0) return []

      // The first entry in `git worktree list` is always the main worktree.
      // We use its path (not gitRoot, which may be a worktree's --show-toplevel)
      // to correctly determine the .familiar/worktrees/ directory.
      const mainWorktreePath = rawEntries[0].path
      const familiarWorktreesDir = path.join(mainWorktreePath, '.familiar', 'worktrees')

      const worktrees: WorktreeInfo[] = []
      for (const entry of rawEntries) {
        const isMain = entry.path === mainWorktreePath
        const isInFamiliarDir = entry.path.startsWith(familiarWorktreesDir + path.sep) || entry.path === familiarWorktreesDir
        if (!isMain && !isInFamiliarDir) continue

        const slug = path.basename(entry.path)
        worktrees.push({ path: entry.path, branch: entry.branch, slug, isMain })
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

    // Resolve the main worktree root — if projectPath is inside a worktree,
    // gitRoot will be the worktree's own --show-toplevel, not the main repo.
    // We need the main repo root to create worktrees in the correct location.
    const mainRoot = this.getMainWorktreeRoot(gitRoot)

    const slug = customSlug || generateWorktreeSlug()
    const branchName = `familiar-worktree/${slug}`
    const worktreesDir = path.join(mainRoot, '.familiar', 'worktrees')
    const worktreePath = path.join(worktreesDir, slug)

    // Ensure the worktrees directory exists
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true })
    }

    // Ensure .familiar/.gitignore exists and ignores worktrees/
    this.ensureGitignore(mainRoot)

    // Create the worktree with a new branch
    try {
      execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
        cwd: mainRoot,
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

    // Copy settings.json from the main project if it exists
    const mainSettingsFile = path.join(mainRoot, '.familiar', 'settings.json')
    const worktreeSettingsFile = path.join(worktreeFamiliarDir, 'settings.json')
    if (fs.existsSync(mainSettingsFile)) {
      try {
        fs.copyFileSync(mainSettingsFile, worktreeSettingsFile)
      } catch {
        // Non-critical — worktree will use default settings
      }
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
    const gitRoot =
      this.getGitRootFromWorktreePath(worktreePath) ||
      this.getGitRoot(projectPath)
    if (!gitRoot) throw new Error('Not a git repository')

    const worktrees = this.listWorktrees(gitRoot)
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
   * Get the main worktree root for a git repo.
   * `git rev-parse --show-toplevel` returns the worktree's own directory
   * when called from inside a worktree, so we use `git worktree list` to
   * find the actual main worktree path (always the first entry).
   */
  static getMainWorktreeRoot(gitRoot: string): string {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: gitRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
      // The first entry is always the main worktree
      const firstLine = output.split('\n').find((l) => l.startsWith('worktree '))
      if (firstLine) {
        return firstLine.slice('worktree '.length)
      }
    } catch {
      // Fall through to return gitRoot
    }
    return gitRoot
  }

  /**
   * Derive the git root from a worktree path.
   * Worktree paths are always <gitRoot>/.familiar/worktrees/<slug>.
   */
  private static getGitRootFromWorktreePath(worktreePath: string): string | null {
    const marker = `${path.sep}.familiar${path.sep}worktrees${path.sep}`
    const idx = worktreePath.indexOf(marker)
    if (idx !== -1) {
      return worktreePath.substring(0, idx)
    }
    return null
  }

  /**
   * Remove a worktree.
   */
  static removeWorktree(projectPath: string, worktreePath: string): void {
    // Derive git root from the worktree path itself (reliable even when
    // the active project has changed), falling back to projectPath.
    const gitRoot =
      this.getGitRootFromWorktreePath(worktreePath) ||
      this.getGitRoot(projectPath)
    if (!gitRoot) throw new Error('Not a git repository')

    // Get the branch name before removing so we can clean it up
    const worktrees = this.listWorktrees(gitRoot)
    const wt = worktrees.find((w) => w.path === worktreePath)
    const branchToDelete = wt?.branch

    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: gitRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // If the worktree directory is already gone, prune stale entries instead
      if (msg.includes('is not a working tree') || msg.includes('does not exist')) {
        execSync('git worktree prune', {
          cwd: gitRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } else {
        throw new Error(`Failed to remove worktree: ${msg}`)
      }
    }

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
   * Get the built-in environment variables for worktree hooks.
   * Includes main/worktree dirs, names, and branch info.
   */
  private static getHookBuiltinEnv(
    gitRoot: string,
    worktreePath: string,
    targetPrefix: 'NEW' | 'DELETE' = 'NEW'
  ): Record<string, string> {
    const worktrees = this.listWorktrees(gitRoot)
    const mainWt = worktrees.find((w) => w.isMain)
    const targetWt = worktrees.find((w) => w.path === worktreePath)

    // Read main project name from state.json
    let mainProjectName = path.basename(gitRoot)
    try {
      const mainState = path.join(gitRoot, '.familiar', 'state.json')
      if (fs.existsSync(mainState)) {
        const state = JSON.parse(fs.readFileSync(mainState, 'utf-8'))
        if (state.projectName) mainProjectName = state.projectName
      }
    } catch { /* use fallback */ }

    return {
      MAIN_WORKTREE_DIR: gitRoot,
      MAIN_WORKTREE_BRANCH: mainWt?.branch || '',
      MAIN_WORKTREE_PROJECT: mainProjectName,
      [`${targetPrefix}_WORKTREE_DIR`]: worktreePath,
      [`${targetPrefix}_WORKTREE_NAME`]: targetWt?.slug || path.basename(worktreePath),
      [`${targetPrefix}_WORKTREE_BRANCH`]: targetWt?.branch || ''
    }
  }

  /**
   * Run a hook script if it exists.
   * The hook runs in the specified working directory with the provided env variables.
   */
  private static async runHook(
    hookPath: string,
    cwd: string,
    envVars: Record<string, string>
  ): Promise<{ ran: boolean; exitCode: number | null; output: string }> {
    if (!fs.existsSync(hookPath)) {
      return { ran: false, exitCode: null, output: '' }
    }

    // Ensure the hook is executable
    try {
      fs.chmodSync(hookPath, 0o755)
    } catch {
      // Non-critical
    }

    const env = { ...process.env, ...envVars }

    return new Promise((resolve) => {
      let output = ''
      const child = spawn('/bin/bash', [hookPath], {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      child.stdout?.on('data', (data) => {
        output += data.toString()
      })
      child.stderr?.on('data', (data) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        resolve({ ran: true, exitCode: code, output })
      })

      child.on('error', (err) => {
        resolve({ ran: true, exitCode: 1, output: err.message })
      })
    })
  }

  /**
   * Run the after-worktree-create hook if it exists.
   * The hook runs in the new worktree directory with built-in + user env variables.
   */
  static async runPostCreateHook(
    projectPath: string,
    worktreePath: string,
    envVars: Record<string, string>
  ): Promise<{ ran: boolean; exitCode: number | null; output: string }> {
    const gitRoot = this.getGitRoot(projectPath)
    if (!gitRoot) return { ran: false, exitCode: null, output: '' }

    const hookPath = path.join(gitRoot, '.familiar', 'hooks', 'after-worktree-create.sh')
    const builtinEnv = this.getHookBuiltinEnv(gitRoot, worktreePath)

    return this.runHook(hookPath, worktreePath, { ...builtinEnv, ...envVars })
  }

  /**
   * Run the pre-worktree-delete hook if it exists.
   * The hook runs in the worktree directory before deletion with built-in + user env variables.
   */
  static async runPreDeleteHook(
    projectPath: string,
    worktreePath: string,
    envVars: Record<string, string> = {}
  ): Promise<{ ran: boolean; exitCode: number | null; output: string }> {
    const gitRoot =
      this.getGitRootFromWorktreePath(worktreePath) ||
      this.getGitRoot(projectPath)
    if (!gitRoot) return { ran: false, exitCode: null, output: '' }

    const hookPath = path.join(gitRoot, '.familiar', 'hooks', 'pre-worktree-delete.sh')
    if (!fs.existsSync(hookPath)) {
      return { ran: false, exitCode: null, output: '' }
    }

    try {
      fs.chmodSync(hookPath, 0o755)
    } catch {
      // Non-critical
    }

    const builtinEnv = this.getHookBuiltinEnv(gitRoot, worktreePath, 'DELETE')
    const env = { ...process.env, ...builtinEnv, ...envVars }

    return new Promise((resolve) => {
      let output = ''
      const child = spawn('/bin/bash', [hookPath], {
        cwd: worktreePath,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.runningPreDeleteHooks.set(worktreePath, child)

      child.stdout?.on('data', (data) => {
        output += data.toString()
      })
      child.stderr?.on('data', (data) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        this.runningPreDeleteHooks.delete(worktreePath)
        resolve({ ran: true, exitCode: code, output })
      })

      child.on('error', (err) => {
        this.runningPreDeleteHooks.delete(worktreePath)
        resolve({ ran: true, exitCode: 1, output: err.message })
      })
    })
  }

  /**
   * Abort a running pre-delete hook for the given worktree path.
   * Kills the process tree. Returns true if a process was killed.
   */
  static abortPreDeleteHook(worktreePath: string): boolean {
    const child = this.runningPreDeleteHooks.get(worktreePath)
    if (!child) return false
    child.kill('SIGKILL')
    this.runningPreDeleteHooks.delete(worktreePath)
    return true
  }

  /**
   * Get the path where the after-worktree-create hook should be placed.
   */
  static getHookPath(projectPath: string): string | null {
    const gitRoot = this.getGitRoot(projectPath)
    if (!gitRoot) return null
    return path.join(gitRoot, '.familiar', 'hooks', 'after-worktree-create.sh')
  }

  /**
   * Get the path where the pre-worktree-delete hook should be placed.
   */
  static getPreDeleteHookPath(projectPath: string): string | null {
    const gitRoot = this.getGitRoot(projectPath)
    if (!gitRoot) return null
    return path.join(gitRoot, '.familiar', 'hooks', 'pre-worktree-delete.sh')
  }

  /**
   * Check if the after-worktree-create hook exists.
   */
  static hookExists(projectPath: string): boolean {
    const hookPath = this.getHookPath(projectPath)
    if (!hookPath) return false
    return fs.existsSync(hookPath)
  }

  /**
   * Check if the pre-worktree-delete hook exists.
   */
  static preDeleteHookExists(projectPath: string): boolean {
    const p = this.getPreDeleteHookPath(projectPath)
    if (!p) return false
    return fs.existsSync(p)
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
