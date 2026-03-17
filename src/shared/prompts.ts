/**
 * Shared prompt templates for AI agent onboarding.
 * Used by both the CLI commands and the Electron UI.
 */

export const TMUX_SETUP_PROMPT = `# Tmux Setup for Familiar

Please configure tmux on this machine so it works correctly with Familiar. Follow these steps:

## 1. Check if tmux is installed

\`\`\`bash
which tmux && tmux -V
\`\`\`

If tmux is not installed, install it:

\`\`\`bash
brew install tmux
\`\`\`

## 2. Ensure tmux config exists

Check if ~/.tmux.conf exists. If not, create it. Add or verify the following minimal settings required for Familiar:

\`\`\`tmux
# Enable mouse support (required for scrolling, selecting, and clicking in Familiar)
set -g mouse on

# Scrollback buffer — generous size for agent output
set -g history-limit 10000

# Use vim keybindings in copy mode (for text selection and navigation)
setw -g mode-keys vi

# Enable OSC 52 clipboard (allows tmux to copy to system clipboard)
set -g set-clipboard on

# Copy to macOS clipboard — select with mouse or vim keys, copies to system clipboard
bind-key -T copy-mode-vi v send-keys -X begin-selection
bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "pbcopy"
bind-key -T copy-mode-vi Enter send-keys -X copy-pipe-and-cancel "pbcopy"
bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"

# Start window numbering at 1
set -g base-index 1
setw -g pane-base-index 1

# Don't rename windows automatically
set -g allow-rename off

# Extended keys support (for Shift+Enter, Ctrl+Enter in terminals)
# "always" sends extended keys unconditionally — "on" requires the inner app to request them
set -s extended-keys always
set -as terminal-features 'xterm*:extkeys'
\`\`\`

**How scrolling, selecting, and copying work after this config:**
- **Scroll**: mouse wheel or trackpad scroll enters copy mode and scrolls through history
- **Select text**: click and drag with mouse to select, or press \`prefix + [\` to enter copy mode and use vim keys (\`v\` to select, arrow keys or \`hjkl\` to move)
- **Copy**: mouse drag auto-copies to clipboard on release; in vim copy mode press \`y\` or \`Enter\` to copy
- **Paste**: \`Cmd+V\` in the terminal, or \`prefix + ]\` for tmux paste buffer

## 3. Verify tmux works

\`\`\`bash
# Create a test session and kill it
tmux new-session -d -s familiar-test && tmux kill-session -t familiar-test && echo "tmux is working correctly"
\`\`\`

## 4. If tmux is already running, reload the config

\`\`\`bash
tmux source-file ~/.tmux.conf 2>/dev/null || true
\`\`\`

Report what you did and whether everything is working.`

export const DOCTOR_PROMPT = `# Familiar Environment Diagnostic

Please run a full diagnostic of this machine's Familiar setup. Check each item below, report the results, then offer to fix any issues found.

## Checks to perform

### 1. tmux
\`\`\`bash
# Is tmux installed?
which tmux && tmux -V || echo "FAIL: tmux not found"

# Is the tmux config present?
test -f ~/.tmux.conf && echo "OK: ~/.tmux.conf exists" || echo "WARN: no ~/.tmux.conf found"

# Does the config have mouse support?
grep -q "set -g mouse on" ~/.tmux.conf 2>/dev/null && echo "OK: mouse support enabled" || echo "WARN: mouse support not configured"

# Does the config have vim copy-mode keys?
grep -q "mode-keys vi" ~/.tmux.conf 2>/dev/null && echo "OK: vim copy-mode keys configured" || echo "WARN: vim copy-mode keys not configured"

# Does the config have clipboard integration?
grep -q "set-clipboard on" ~/.tmux.conf 2>/dev/null && echo "OK: OSC 52 clipboard enabled" || echo "WARN: OSC 52 clipboard not configured"
grep -q "pbcopy" ~/.tmux.conf 2>/dev/null && echo "OK: pbcopy clipboard integration found" || echo "WARN: pbcopy clipboard integration not configured"

# Does the config have scrollback buffer?
grep -q "history-limit" ~/.tmux.conf 2>/dev/null && echo "OK: scrollback buffer configured" || echo "WARN: scrollback buffer not configured"

# Can we create and destroy a tmux session?
tmux new-session -d -s familiar-doctor-test 2>/dev/null && tmux kill-session -t familiar-doctor-test 2>/dev/null && echo "OK: tmux sessions work" || echo "FAIL: cannot create tmux sessions"

# Are there any existing familiar sessions?
tmux list-sessions 2>/dev/null | grep "^familiar-" || echo "INFO: no active familiar tmux sessions"
\`\`\`

### 2. familiar CLI
\`\`\`bash
# Is the CLI installed and in PATH?
which familiar && echo "OK: CLI found" || echo "FAIL: familiar not in PATH"

# Can it run?
familiar --version 2>/dev/null && echo "OK: CLI runs" || echo "FAIL: CLI cannot execute"
\`\`\`

If the CLI is **not found**, it needs to be installed. The CLI binary is bundled inside the Familiar.app package. There are two ways to set it up:

**Option A — Use the Install CLI button** in the Familiar app (board header banner or onboarding). This automatically:
1. Creates a symlink at \`~/.familiar/bin/familiar\` pointing to the binary inside the app
2. Adds \`export PATH="$HOME/.familiar/bin:$PATH"\` to your shell rc file

**Option B — Manual setup** (if the button didn't work or you prefer manual control):

\`\`\`bash
# 1. Create the bin directory
mkdir -p ~/.familiar/bin

# 2. Find the CLI binary inside the app bundle and create a symlink
# For the installed app:
ln -sf "/Applications/Familiar.app/Contents/Resources/bin/index.mjs" ~/.familiar/bin/familiar
# For development builds:
# ln -sf "<project-root>/dist/cli/index.mjs" ~/.familiar/bin/familiar

# 3. Add to PATH — add this line to your ~/.zshrc (or ~/.bashrc for bash):
echo '\\n# Added by Familiar — CLI path\\nexport PATH="$HOME/.familiar/bin:$PATH"' >> ~/.zshrc

# 4. Reload your shell
source ~/.zshrc   # or: source ~/.bashrc
\`\`\`

After installing, verify with \`which familiar && familiar --version\`.

### 3. Project setup

If the project is not initialized yet, run:
\`\`\`bash
familiar init
\`\`\`

This creates the \`.familiar/\` directory with default state and settings.

\`\`\`bash
# Is .familiar/ initialized in the current project?
test -d .familiar && echo "OK: .familiar/ exists" || echo "WARN: .familiar/ not found — run 'familiar init'"

# Is state.json present?
test -f .familiar/state.json && echo "OK: state.json exists" || echo "WARN: state.json missing"
\`\`\`

### 4. Environment variables (if running inside a Familiar terminal)
\`\`\`bash
# Check if task context is set
[ -n "$FAMILIAR_TASK_ID" ] && echo "OK: FAMILIAR_TASK_ID=$FAMILIAR_TASK_ID" || echo "INFO: FAMILIAR_TASK_ID not set (not in a task terminal)"
[ -n "$FAMILIAR_PROJECT_ROOT" ] && echo "OK: FAMILIAR_PROJECT_ROOT=$FAMILIAR_PROJECT_ROOT" || echo "INFO: FAMILIAR_PROJECT_ROOT not set"
[ -n "$FAMILIAR_SETTINGS_PATH" ] && echo "OK: FAMILIAR_SETTINGS_PATH=$FAMILIAR_SETTINGS_PATH" || echo "INFO: FAMILIAR_SETTINGS_PATH not set"
\`\`\`

### 5. Claude Code binary

Claude Code can be installed in several locations. Check all known paths and verify it can execute:

\`\`\`bash
# Check if 'claude' is in PATH
which claude 2>/dev/null && echo "OK: claude found at $(which claude)" || echo "WARN: claude not in PATH"

# Check common installation locations
for p in \\
  "$HOME/.local/bin/claude" \\
  "$HOME/.claude/local/claude" \\
  "/usr/local/bin/claude" \\
  "$HOME/.npm-global/bin/claude" \\
  "$HOME/.nvm/versions/node/*/bin/claude" \\
  "$HOME/.local/share/fnm/node-versions/*/installation/bin/claude" \\
  "$HOME/.volta/bin/claude"; do
  # Expand globs
  for expanded in $p; do
    test -f "$expanded" && echo "FOUND: $expanded" || true
  done
done

# Try to run it
claude --version 2>/dev/null && echo "OK: claude runs — $(claude --version 2>/dev/null)" || echo "FAIL: claude cannot execute"
\`\`\`

If \`claude\` is not found:

1. **Install via the official installer** (recommended):
   \`\`\`bash
   # This installs to ~/.local/bin/claude
   curl -fsSL https://claude.ai/install.sh | sh
   \`\`\`

2. **Install via npm** (alternative):
   \`\`\`bash
   npm install -g @anthropic-ai/claude-code
   \`\`\`

3. **If installed but not in PATH**, add the directory to your shell:
   \`\`\`bash
   # For the official installer (zsh):
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
   # For bash:
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
   \`\`\`

After installing, verify with \`which claude && claude --version\`.

### 6. AI agent hooks

Ask the user which AI agent they are using (e.g. Claude Code, Gemini CLI, Codex, Aider, etc.), then check if the appropriate hooks are configured. Hooks handle two lifecycle events:

- **On user message** (\`on-prompt-submit.sh\`): Sets **task status** to \`in-progress\` and **agent status** to \`running\`.
- **On agent stop** (\`on-stop.sh\`): Sets **agent status** to \`idle\` and sends a notification. Does NOT change task status.

#### Claude Code hooks

Claude Code uses \`.claude/settings.json\` for hook configuration. Check and set up:

\`\`\`bash
# Check if .claude/settings.json exists with hooks
test -f .claude/settings.json && echo "OK: .claude/settings.json exists" || echo "WARN: .claude/settings.json not found"

# Check if hook scripts exist
test -x .claude/hooks/on-prompt-submit.sh && echo "OK: on-prompt-submit.sh exists and is executable" || echo "WARN: on-prompt-submit.sh missing or not executable"
test -x .claude/hooks/on-stop.sh && echo "OK: on-stop.sh exists and is executable" || echo "WARN: on-stop.sh missing or not executable"
\`\`\`

If hooks are missing, create them:

1. Create \`.claude/settings.json\`:
\`\`\`json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\\"$CLAUDE_PROJECT_DIR\\"/.claude/hooks/on-prompt-submit.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\\"$CLAUDE_PROJECT_DIR\\"/.claude/hooks/on-stop.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
\`\`\`

2. Create \`.claude/hooks/on-prompt-submit.sh\`:
\`\`\`bash
#!/bin/bash
if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar status "$FAMILIAR_TASK_ID" in-progress 2>/dev/null
  familiar update "$FAMILIAR_TASK_ID" --agent-status running 2>/dev/null
fi
exit 0
\`\`\`

3. Create \`.claude/hooks/on-stop.sh\`:
\`\`\`bash
#!/bin/bash
if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar update "$FAMILIAR_TASK_ID" --agent-status idle 2>/dev/null
  familiar notify "Agent Stopped" "Task $FAMILIAR_TASK_ID — agent is now idle" 2>/dev/null
fi
exit 0
\`\`\`

4. Make scripts executable: \`chmod +x .claude/hooks/on-prompt-submit.sh .claude/hooks/on-stop.sh\`

#### Other agents

For other AI agents, check their documentation for lifecycle hooks or event callbacks. The key integration points are:
- **On user message**: run \`familiar status $FAMILIAR_TASK_ID in-progress\` and \`familiar update $FAMILIAR_TASK_ID --agent-status running\`
- **On agent stop**: run \`familiar update $FAMILIAR_TASK_ID --agent-status idle\` (do NOT change task status)

### 7. Familiar agent skill

Claude Code uses project-level skills in \`.claude/skills/\` to provide task-aware behavior when running inside Familiar terminals. Check if the skill is installed:

\`\`\`bash
# Check if the skill directory exists
test -d .claude/skills/familiar-agent && echo "OK: skill directory exists" || echo "WARN: .claude/skills/familiar-agent/ not found"

# Check if SKILL.md exists
test -f .claude/skills/familiar-agent/SKILL.md && echo "OK: SKILL.md exists" || echo "WARN: .claude/skills/familiar-agent/SKILL.md not found"

# Check that the skill references 'familiar agents' command
grep -q "familiar agents" .claude/skills/familiar-agent/SKILL.md 2>/dev/null && echo "OK: skill references familiar agents" || echo "WARN: skill does not reference familiar agents command"
\`\`\`

If the skill is missing, create it:

1. Create the directory: \`mkdir -p .claude/skills/familiar-agent\`

2. Create \`.claude/skills/familiar-agent/SKILL.md\` with the following content:

\`\`\`markdown
---
name: familiar-agent
description: Use when running inside a Familiar terminal (FAMILIAR_TASK_ID is set) or when the user mentions familiar, task tracking, or updating task status. Provides workflow for reading task context, updating status, logging progress, and sending notifications via the familiar CLI.
---

# Familiar — Task Context

You are running inside a **Familiar** terminal session. A task has been assigned to you.

## Step 0: Load base agent instructions

Run the following to get the canonical agent workflow and CLI reference:

\\\`\\\`\\\`bash
familiar agents
\\\`\\\`\\\`

Follow those instructions as your base workflow. The sections below provide additional context.

## Step 1: Read your context

\\\`\\\`\\\`bash
echo "Task: $FAMILIAR_TASK_ID"
echo "Root: $FAMILIAR_PROJECT_ROOT"
echo "Settings: $FAMILIAR_SETTINGS_PATH"

cat "$FAMILIAR_SETTINGS_PATH" 2>/dev/null || echo "{}"
cat "$FAMILIAR_PROJECT_ROOT/.familiar/tasks/$FAMILIAR_TASK_ID/document.md"
cat "$FAMILIAR_PROJECT_ROOT/.familiar/tasks/$FAMILIAR_TASK_ID/task.json"
\\\`\\\`\\\`

If \\\`$FAMILIAR_TASK_ID\\\` is not set, you are not inside a Familiar terminal. Skip this skill.

## Step 2: Signal you're working

\\\`\\\`\\\`bash
familiar status $FAMILIAR_TASK_ID in-progress
familiar update $FAMILIAR_TASK_ID --agent-status running
familiar log $FAMILIAR_TASK_ID "Starting work"
\\\`\\\`\\\`

## Step 3: Tidy up your task (MANDATORY — every time)

Before doing any work: add labels, save original prompt to document.md, and simplify title if enabled. See \\\`familiar agents\\\` output for full details.

## Step 4: Do the work — log progress at milestones

\\\`\\\`\\\`bash
familiar log $FAMILIAR_TASK_ID "Implemented X — moving to tests"
\\\`\\\`\\\`

## Step 5: Commit your work

\\\`\\\`\\\`bash
git add <changed-files>
git commit -m "feat: <short description>"
\\\`\\\`\\\`

## Step 6: Update task notes (MANDATORY — every time)

Before completion, update document.md with a summary and any learnings. Keep the Original Prompt section at the top.

## Step 7: On completion

\\\`\\\`\\\`bash
familiar status $FAMILIAR_TASK_ID in-review
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — all tests passing"
\\\`\\\`\\\`
\`\`\`

## Report format

After running all checks, summarize:
- **Pass**: items that are correctly configured
- **Warnings**: items that may need attention
- **Failures**: items that must be fixed

Then ask: "Would you like me to fix the issues found?" and if yes, fix them one by one, explaining each change.`

export const DOCTOR_AUTO_FIX_SUFFIX = `

## Auto-fix mode

IMPORTANT: Do NOT ask the user for confirmation. Automatically fix ALL issues found without prompting. Install missing tools, create missing configs, and set up hooks — just do it. Report what you fixed when done.`

export const BASE_AGENTS_MD = `# Familiar — Agent Instructions

This document describes how AI agents should interact with the Familiar system.

## Overview

Familiar is a macOS desktop app providing a kanban board with embedded terminal emulators for agentic AI coding workflows. Each task has a persistent tmux session. The \`familiar\` CLI lets agents manage tasks without the GUI.

## Environment

When running inside a Familiar terminal, these environment variables are set:

- \`FAMILIAR_TASK_ID\` — The ID of the current task
- \`FAMILIAR_PROJECT_ROOT\` — The root directory of the project

## Canonical Task Location

**\`document.md\` is the ONLY place for task specs, plans, and design documents.** Every task has a dedicated directory at \`.familiar/tasks/<taskId>/\` containing a \`document.md\` file. This is the file the user sees and reviews in the Familiar UI.

**Rules:**
- **ALWAYS** write specs, plans, requirements, and design notes into the task's \`document.md\`
- **NEVER** create separate spec files, plan files, or design docs elsewhere in the repo (e.g., \`docs/plan.md\`, \`PLAN.md\`, \`spec.md\`, etc.)
- If you need to plan your approach, write it in \`document.md\` under a \`## Plan\` heading
- If you need to document design decisions, write them in \`document.md\` under a \`## Design\` or \`## Notes\` heading
- The task directory (\`.familiar/tasks/<taskId>/\`) is the single source of truth for everything about that task

## Agent Workflow

### 1. Read your task

\`\`\`bash
cat "$FAMILIAR_PROJECT_ROOT/.familiar/tasks/$FAMILIAR_TASK_ID/document.md"
cat "$FAMILIAR_PROJECT_ROOT/.familiar/tasks/$FAMILIAR_TASK_ID/task.json"
\`\`\`

### 2. Signal you're working

\`\`\`bash
familiar status $FAMILIAR_TASK_ID in-progress
familiar update $FAMILIAR_TASK_ID --agent-status running
familiar log $FAMILIAR_TASK_ID "Starting work"
\`\`\`

### 3. Tidy up your task (MANDATORY — every time)

**You MUST complete ALL of the following before doing any implementation work.** This applies on every single agent run, not just the first time.

#### 3a. Classify with labels

Always add a label. Infer the type from the title and description:

| Label | When to use |
|-------|-------------|
| \`bug\` | Fixing broken behavior, errors, crashes, or regressions |
| \`feature\` | Adding new functionality that didn't exist before |
| \`chore\` | Maintenance, refactoring, dependency updates, CI/CD, docs |

\`\`\`bash
familiar update $FAMILIAR_TASK_ID --labels "feature"  # or bug, chore
\`\`\`

#### 3b. Preserve the original prompt in document.md

The task title often contains the full user prompt/request. **You MUST save the original title/prompt into \`document.md\` before any other changes.** The original prompt must ALWAYS remain at the top of the document, under an \`## Original Prompt\` heading. Never delete or move it.

If \`document.md\` is empty or does not yet have an \`## Original Prompt\` section, write it now:

\`\`\`bash
# Write the original prompt to document.md (use the familiar CLI or write directly)
# The ## Original Prompt section must ALWAYS be the first section in the document
\`\`\`

Example document.md structure:
\`\`\`markdown
## Original Prompt

<the original task title or user request, verbatim>

---

## Notes

<any notes added during work>
\`\`\`

#### 3c. Simplify the title (if \`simplifyTaskTitles\` setting is enabled)

If the Active Settings section below says \`simplifyTaskTitles\` is ON, **always** shorten the title to 3–6 words regardless of how long or short it already is. Do this AFTER saving the original prompt to \`document.md\`.

\`\`\`bash
familiar update $FAMILIAR_TASK_ID --title "Short descriptive title"
\`\`\`

### 4. Do the work — log frequent short updates

**Planning:** If you need to create a plan or spec before implementation, write it into \`document.md\` under a \`## Plan\` heading (below the original prompt). Never create plan files elsewhere.

**Send very brief (2–6 word) activity updates frequently** so the user can see what you're doing at a glance on the board card. Log an update every time you start a new phase:

\`\`\`bash
familiar log $FAMILIAR_TASK_ID "Reading codebase"
# ... explore ...
familiar log $FAMILIAR_TASK_ID "Implementing feature X"
# ... code ...
familiar log $FAMILIAR_TASK_ID "Writing tests"
# ... test ...
familiar log $FAMILIAR_TASK_ID "All tests passing"
\`\`\`

### 5. Commit your work

\`\`\`bash
git add <changed-files>
git commit -m "feat: short description"
\`\`\`

Use conventional commit prefixes: \`feat:\`, \`fix:\`, \`refactor:\`, \`docs:\`, \`test:\`, \`chore:\`. Do NOT push unless explicitly asked.

### 6. Update task notes (MANDATORY — every time)

**Before signaling completion, you MUST update \`document.md\` with:**

1. **A summary** of what was done in this iteration (append after the \`---\` separator, below the original prompt)
2. **Any meaningful learnings** that could be useful for the future (edge cases found, gotchas, decisions made, etc.)

Keep the \`## Original Prompt\` section at the top — never modify or remove it. Append your summary below it.

Example:
\`\`\`markdown
## Original Prompt

<original prompt — untouched>

---

## Summary

- Implemented X by modifying Y and Z
- Added tests for A and B

## Learnings

- The foo module requires bar to be initialized first
- Edge case: empty arrays need special handling in baz()
\`\`\`

### 7. Signal completion

**Important:** Task status and agent status are independent. Only move the task to \`in-review\` if you are explicitly requesting human review. Setting \`--agent-status done\` does **not** automatically change the task's board column.

\`\`\`bash
# On success — ready for human review
familiar status $FAMILIAR_TASK_ID in-review
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — all tests passing"

# On success — no review needed (e.g. chores, trivial fixes)
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — no review needed"

# On failure
familiar update $FAMILIAR_TASK_ID --agent-status error
familiar log $FAMILIAR_TASK_ID "ERROR: description of what went wrong"
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
| \`familiar setup [--copy]\` | Print tmux setup prompt for your AI agent |
| \`familiar doctor [--copy]\` | Print environment diagnostic prompt |
| \`familiar agents [--copy]\` | Print this agent instructions document |

## Tmux Sessions

Familiar uses tmux sessions named \`familiar-<taskId>-<paneIndex>\`. These sessions persist across app restarts. Do not manually kill or rename them.

## Data Directory

All state is stored in \`.familiar/\` at the project root:

\`\`\`
.familiar/
├── state.json              # Board state (task list, column order)
├── settings.json           # User settings
├── notifications.json      # In-app notifications
└── tasks/<taskId>/
    ├── task.json           # Task metadata
    ├── document.md         # Task description/spec
    ├── activity.json       # Activity log
    └── attachments/        # Files and images
\`\`\`
`
