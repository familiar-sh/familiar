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

### 3. Project setup
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
\`\`\`

## Report format

After running all checks, summarize:
- **Pass**: items that are correctly configured
- **Warnings**: items that may need attention
- **Failures**: items that must be fixed

Then ask: "Would you like me to fix the issues found?" and if yes, fix them one by one, explaining each change.`

export const BASE_AGENTS_MD = `# Familiar — AGENTS.md

This document describes how AI agents should interact with the Familiar system.

## Overview

Familiar is a macOS desktop app providing a kanban board with embedded terminal emulators for agentic AI coding workflows. Each task has a persistent tmux session. The \`familiar\` CLI lets agents manage tasks without the GUI.

## Environment

When running inside a Familiar terminal, these environment variables are set:

- \`FAMILIAR_TASK_ID\` — The ID of the current task
- \`FAMILIAR_PROJECT_ROOT\` — The root directory of the project

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

### 3. Classify your task

After reading the task, add the appropriate label based on the title and description:

| Label | When to use |
|-------|-------------|
| \`bug\` | Fixing broken behavior, errors, crashes, or regressions |
| \`feature\` | Adding new functionality that didn't exist before |
| \`chore\` | Maintenance, refactoring, dependency updates, CI/CD, docs |

\`\`\`bash
familiar update $FAMILIAR_TASK_ID --labels "feature"  # or bug, improvement, chore
\`\`\`

### 4. Log progress

\`\`\`bash
familiar log $FAMILIAR_TASK_ID "Implemented feature X — moving to tests"
\`\`\`

### 5. Commit your work

\`\`\`bash
git add <changed-files>
git commit -m "feat: short description"
\`\`\`

Use conventional commit prefixes: \`feat:\`, \`fix:\`, \`refactor:\`, \`docs:\`, \`test:\`, \`chore:\`. Do NOT push unless explicitly asked.

### 6. Signal completion

**Important:** Task status and agent status are independent. Only move the task to \`in-review\` if you are explicitly requesting human review. Setting \`--agent-status done\` does **not** automatically change the task's board column.

\`\`\`bash
# On success — ready for human review
familiar status $FAMILIAR_TASK_ID in-review
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — all tests passing"
familiar notify "Task Done" "$FAMILIAR_TASK_ID complete"

# On success — no review needed (e.g. chores, trivial fixes)
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — no review needed"
familiar notify "Task Done" "$FAMILIAR_TASK_ID complete"

# On failure
familiar update $FAMILIAR_TASK_ID --agent-status error
familiar log $FAMILIAR_TASK_ID "ERROR: description of what went wrong"
familiar notify "Task Failed" "$FAMILIAR_TASK_ID failed"
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
| \`familiar agents [--copy]\` | Print this AGENTS.md document |

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
