import { ipcMain } from 'electron'
import { exec } from 'child_process'
import {
  existsSync,
  readFileSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  statSync
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { DataService } from '../services/data-service'
import type { WorkspaceManager } from '../services/workspace-manager'

function execAsync(command: string, timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  })
}

export interface HealthIssue {
  id: string
  severity: 'error' | 'warning'
  title: string
  description: string
  fixable: boolean
}

export interface HealthCheckResult {
  issues: HealthIssue[]
  cliAvailable: boolean
  agentHarnessConfigured: boolean
  claudeAvailable: boolean | null
  hooksConfigured: boolean | null
  skillInstalled: boolean | null
}

async function checkCliAvailable(): Promise<boolean> {
  // First check the known symlink directly — most reliable
  const symlink = join(homedir(), '.familiar', 'bin', 'familiar')
  try {
    // realpathSync follows the symlink and throws if the target doesn't exist
    realpathSync(symlink)
    return true
  } catch {
    // Symlink missing or broken — fall through to shell check
  }

  // Fallback: check via interactive shell (zsh -ic sources .zshrc)
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    await execAsync(`${shell} -ic 'which familiar'`)
    return true
  } catch {
    return false
  }
}

async function checkClaudeAvailable(): Promise<boolean> {
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    await execAsync(`${shell} -ic 'which claude'`)
    return true
  } catch {
    return false
  }
}

export function checkHooksConfigured(projectRoot: string): boolean {
  const settingsLocalPath = join(projectRoot, '.claude', 'settings.local.json')
  // Also check legacy settings.json for backwards compatibility
  const settingsLegacyPath = join(projectRoot, '.claude', 'settings.json')
  const onPromptSubmit = join(projectRoot, '.claude', 'hooks', 'on-prompt-submit.sh')
  const onStop = join(projectRoot, '.claude', 'hooks', 'on-stop.sh')

  // Check settings.local.json (preferred) or settings.json (legacy) for hooks
  const settingsPath = existsSync(settingsLocalPath) ? settingsLocalPath : settingsLegacyPath
  if (!existsSync(settingsPath)) return false
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    if (!settings.hooks?.UserPromptSubmit || !settings.hooks?.Stop) return false
  } catch {
    return false
  }

  // Check hook scripts exist and are executable
  for (const script of [onPromptSubmit, onStop]) {
    if (!existsSync(script)) return false
    try {
      const stat = statSync(script)
      // Check if executable (owner execute bit)
      if (!(stat.mode & 0o100)) return false
    } catch {
      return false
    }
  }

  return true
}

export function checkSkillInstalled(projectRoot: string): boolean {
  const skillPath = join(projectRoot, '.claude', 'skills', 'familiar-agent', 'SKILL.md')
  return existsSync(skillPath)
}

export function fixHooks(projectRoot: string): void {
  const claudeDir = join(projectRoot, '.claude')
  const hooksDir = join(claudeDir, 'hooks')
  const settingsPath = join(claudeDir, 'settings.json')

  // Ensure directories exist
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true })
  }

  // Create/update .claude/settings.json with hooks
  let settings: Record<string, unknown> = {}
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    } catch {
      // Start fresh if corrupted
    }
  }

  settings.hooks = {
    UserPromptSubmit: [
      {
        hooks: [
          {
            type: 'command',
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/on-prompt-submit.sh',
            timeout: 5
          }
        ]
      }
    ],
    Stop: [
      {
        hooks: [
          {
            type: 'command',
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/on-stop.sh',
            timeout: 5
          }
        ]
      }
    ]
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')

  // Create on-prompt-submit.sh
  const onPromptSubmit = join(hooksDir, 'on-prompt-submit.sh')
  writeFileSync(
    onPromptSubmit,
    `#!/bin/bash
if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar status "$FAMILIAR_TASK_ID" in-progress 2>/dev/null
  familiar update "$FAMILIAR_TASK_ID" --agent-status running 2>/dev/null
fi
exit 0
`
  )
  chmodSync(onPromptSubmit, 0o755)

  // Create on-stop.sh
  const onStop = join(hooksDir, 'on-stop.sh')
  writeFileSync(
    onStop,
    `#!/bin/bash
if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar update "$FAMILIAR_TASK_ID" --agent-status idle 2>/dev/null
  familiar notify "Agent Stopped" "Task $FAMILIAR_TASK_ID — agent is now idle" 2>/dev/null
fi
exit 0
`
  )
  chmodSync(onStop, 0o755)
}

export function fixSkill(projectRoot: string): void {
  const skillDir = join(projectRoot, '.claude', 'skills', 'familiar-agent')

  if (!existsSync(skillDir)) {
    mkdirSync(skillDir, { recursive: true })
  }

  const skillContent = `---
name: familiar-agent
description: Use when running inside a Familiar terminal (FAMILIAR_TASK_ID is set) or when the user mentions familiar, task tracking, or updating task status. Provides workflow for reading task context, updating status, logging progress, and sending notifications via the familiar CLI.
---

# Familiar — Task Context

You are running inside a **Familiar** terminal session. A task has been assigned to you.

## Step 0: Load base agent instructions

Run the following to get the canonical agent workflow and CLI reference:

\`\`\`bash
familiar agents
\`\`\`

Follow those instructions as your base workflow. The sections below provide additional context.

## Important: document.md is the canonical spec location

**ALWAYS** store your task spec, plan, design notes, and requirements in the task's \`document.md\` file at \`.familiar/tasks/$FAMILIAR_TASK_ID/document.md\`. This is the file the user sees in the Familiar UI. **NEVER** create separate spec/plan files elsewhere in the repo.

## Step 1: Read your context

\`\`\`bash
# Your task ID, project root, and settings path are in the environment
echo "Task: $FAMILIAR_TASK_ID"
echo "Root: $FAMILIAR_PROJECT_ROOT"
echo "Settings: $FAMILIAR_SETTINGS_PATH"

# Read project settings first — obey any enabled behaviors
cat "$FAMILIAR_SETTINGS_PATH" 2>/dev/null || echo "{}"
# If simplifyTaskTitles is true: shorten the title and move original to document.md

# Read your task spec/document
cat "$FAMILIAR_PROJECT_ROOT/.familiar/tasks/$FAMILIAR_TASK_ID/document.md"

# Read task metadata (status, priority, labels)
cat "$FAMILIAR_PROJECT_ROOT/.familiar/tasks/$FAMILIAR_TASK_ID/task.json"
\`\`\`

If \`$FAMILIAR_TASK_ID\` is not set, you are not inside a Familiar terminal. Skip this skill.

## Step 2: Signal you're working

\`\`\`bash
familiar status $FAMILIAR_TASK_ID in-progress
familiar update $FAMILIAR_TASK_ID --agent-status running
familiar log $FAMILIAR_TASK_ID "Starting work"
\`\`\`

## Step 2.5: Classify your task

After reading the task, infer the type from the title and description and add the appropriate label:

| Label | When to use |
|-------|-------------|
| \`bug\` | Fixing broken behavior, errors, crashes, or regressions |
| \`feature\` | Adding new functionality that didn't exist before |
| \`chore\` | Maintenance, refactoring, dependency updates, CI/CD, docs |

\`\`\`bash
familiar update $FAMILIAR_TASK_ID --labels "feature"  # or bug, improvement, chore
\`\`\`

## Step 3: Log progress at milestones

\`\`\`bash
familiar log $FAMILIAR_TASK_ID "Implemented X — moving to tests"
\`\`\`

## Step 4: Commit your work

After completing the task, create a git commit with all relevant changes before signaling completion.

\`\`\`bash
git add <changed-files>
git commit -m "feat: <short description>"
\`\`\`

Use conventional commit prefixes (\`feat:\`, \`fix:\`, \`refactor:\`, \`docs:\`, \`test:\`, \`chore:\`). Do NOT push unless explicitly asked.

## Step 5: On completion

\`\`\`bash
# Success
familiar status $FAMILIAR_TASK_ID in-review
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — all tests passing"

# Failure
familiar update $FAMILIAR_TASK_ID --agent-status error
familiar log $FAMILIAR_TASK_ID "ERROR: <description>"
\`\`\`

## CLI Reference

| Command | Purpose |
|---------|---------|
| \`familiar status <id> <status>\` | Set status: \`backlog\`, \`todo\`, \`in-progress\`, \`in-review\`, \`done\`, \`archived\` |
| \`familiar update <id> --agent-status <s>\` | Set agent status: \`idle\`, \`running\`, \`done\`, \`error\` |
| \`familiar update <id> --priority <p>\` | Set priority: \`urgent\`, \`high\`, \`medium\`, \`low\`, \`none\` |
| \`familiar log <id> "<message>"\` | Append to activity log |
| \`familiar notify "<title>" "<body>"\` | Send in-app notification |
| \`familiar add "<title>" [--priority p] [--status s]\` | Create a new task |
| \`familiar list [--status s] [--json]\` | List tasks |
| \`familiar setup [--copy]\` | Print tmux setup prompt |
| \`familiar doctor [--copy]\` | Print environment diagnostic prompt |
| \`familiar agents [--copy]\` | Print base agent instructions |
`

  writeFileSync(join(skillDir, 'SKILL.md'), skillContent)
}

export function registerHealthHandlers(
  workspaceManager: WorkspaceManager,
  _dataService: DataService
): void {
  ipcMain.handle('health:check', async (_event, overrideAgent?: string): Promise<HealthCheckResult> => {
    const projectRoot = workspaceManager.getActiveProjectPath()
    if (!projectRoot) {
      return {
        issues: [],
        cliAvailable: false,
        agentHarnessConfigured: false,
        claudeAvailable: null,
        hooksConfigured: null,
        skillInstalled: null
      }
    }

    const ds = workspaceManager.getDataService(projectRoot)
    const settings = await ds.readSettings()
    const issues: HealthIssue[] = []

    // Use overrideAgent if provided (e.g. during onboarding when settings may not be synced yet)
    const effectiveAgent = overrideAgent || settings.codingAgent

    // 1. Check CLI
    const cliAvailable = await checkCliAvailable()
    if (!cliAvailable) {
      issues.push({
        id: 'cli-not-installed',
        severity: 'error',
        title: 'CLI not installed',
        description: 'The familiar CLI is not in your PATH.',
        fixable: true
      })
    }

    // 2. Check agent harness
    const agentHarnessConfigured = !!effectiveAgent
    if (!agentHarnessConfigured) {
      issues.push({
        id: 'no-agent-harness',
        severity: 'warning',
        title: 'No agent harness selected',
        description: 'Select a coding agent in Settings to enable agent integration.',
        fixable: false
      })
    }

    // Agent-specific checks (only for claude-code)
    let claudeAvailable: boolean | null = null
    let hooksConfigured: boolean | null = null
    let skillInstalled: boolean | null = null

    if (effectiveAgent === 'claude-code') {
      // 3. Check Claude Code binary
      claudeAvailable = await checkClaudeAvailable()
      if (!claudeAvailable) {
        issues.push({
          id: 'claude-not-available',
          severity: 'error',
          title: 'Claude Code not found',
          description: 'Install Claude Code: npm install -g @anthropic-ai/claude-code',
          fixable: false
        })
      }

      // 4. Check hooks
      hooksConfigured = checkHooksConfigured(projectRoot)
      if (!hooksConfigured) {
        issues.push({
          id: 'hooks-not-configured',
          severity: 'warning',
          title: 'Agent hooks not configured',
          description: 'Lifecycle hooks for task status tracking are missing.',
          fixable: true
        })
      }

      // 5. Check skill
      skillInstalled = checkSkillInstalled(projectRoot)
      if (!skillInstalled) {
        issues.push({
          id: 'skill-not-installed',
          severity: 'warning',
          title: 'Agent skill not installed',
          description: 'The familiar-agent skill for Claude Code is missing.',
          fixable: true
        })
      }
    }

    return {
      issues,
      cliAvailable,
      agentHarnessConfigured,
      claudeAvailable,
      hooksConfigured,
      skillInstalled
    }
  })

  ipcMain.handle(
    'health:fix',
    async (_event, issueId: string): Promise<{ success: boolean; error?: string }> => {
      const projectRoot = workspaceManager.getActiveProjectPath()
      if (!projectRoot) {
        return { success: false, error: 'No active project' }
      }

      try {
        switch (issueId) {
          case 'hooks-not-configured':
            fixHooks(projectRoot)
            return { success: true }

          case 'skill-not-installed':
            fixSkill(projectRoot)
            return { success: true }

          case 'cli-not-installed':
            // Delegate to existing CLI install handler
            // The renderer should call cliInstallToPath() directly for this
            return { success: false, error: 'Use the Install CLI button' }

          default:
            return { success: false, error: `Unknown issue: ${issueId}` }
        }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  ipcMain.handle(
    'health:fix-all',
    async (): Promise<{ fixed: string[]; failed: string[] }> => {
      const projectRoot = workspaceManager.getActiveProjectPath()
      if (!projectRoot) {
        return { fixed: [], failed: [] }
      }

      const ds = workspaceManager.getDataService(projectRoot)
      const settings = await ds.readSettings()
      const fixed: string[] = []
      const failed: string[] = []

      if (settings.codingAgent === 'claude-code') {
        // Fix hooks
        if (!checkHooksConfigured(projectRoot)) {
          try {
            fixHooks(projectRoot)
            fixed.push('hooks-not-configured')
          } catch {
            failed.push('hooks-not-configured')
          }
        }

        // Fix skill
        if (!checkSkillInstalled(projectRoot)) {
          try {
            fixSkill(projectRoot)
            fixed.push('skill-not-installed')
          } catch {
            failed.push('skill-not-installed')
          }
        }
      }

      return { fixed, failed }
    }
  )

  // Direct check/fix methods that take an explicit project root
  // Used by onboarding which may not have a synced active project
  ipcMain.handle(
    'health:check-hooks',
    (_event, projectRoot: string): boolean => {
      return checkHooksConfigured(projectRoot)
    }
  )

  ipcMain.handle(
    'health:check-skill',
    (_event, projectRoot: string): boolean => {
      return checkSkillInstalled(projectRoot)
    }
  )

  ipcMain.handle(
    'health:fix-for-project',
    (_event, projectRoot: string, issueId: string): { success: boolean; error?: string } => {
      try {
        switch (issueId) {
          case 'hooks-not-configured':
            fixHooks(projectRoot)
            return { success: true }
          case 'skill-not-installed':
            fixSkill(projectRoot)
            return { success: true }
          default:
            return { success: false, error: `Unknown issue: ${issueId}` }
        }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )
}
