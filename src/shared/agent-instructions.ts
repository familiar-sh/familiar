/**
 * Template for AGENTS.md that gets created in .familiar/
 * when a project is initialized. This file tells AI coding agents
 * how to interact with the familiar system.
 */
export const AGENTS_MD = `# Familiar — Instructions for AI Agents

You are running inside a **Familiar** terminal. This system tracks tasks,
documents, and activity for an agentic coding workflow.

## Your Context

The environment variable \`FAMILIAR_TASK_ID\` contains the ID of the task you are
working on. The variable \`FAMILIAR_PROJECT_ROOT\` points to the workspace root.
\`\`\`bash
echo $FAMILIAR_TASK_ID        # e.g. tsk_a1b2c3d4
echo $FAMILIAR_PROJECT_ROOT   # e.g. /Users/me/myproject
\`\`\`

## CLI — \`familiar\`

Use the \`familiar\` CLI to interact with the system. All commands operate
on the \`.familiar/\` directory in the project root.

Run \`familiar agents\` to see the full agent workflow and any **active project settings** you must obey.

### Read your task

\`\`\`bash
familiar list --json                         # List all tasks
familiar list --status in-progress --json    # Filter by status
\`\`\`

Your task document (markdown notes, specs, etc.) is at:
\`\`\`
.familiar/tasks/$FAMILIAR_TASK_ID/document.md
\`\`\`

Your task metadata:
\`\`\`
.familiar/tasks/$FAMILIAR_TASK_ID/task.json
\`\`\`

Activity log:
\`\`\`
.familiar/tasks/$FAMILIAR_TASK_ID/activity.json
\`\`\`

### Update status

\`\`\`bash
familiar status $FAMILIAR_TASK_ID in-progress  # Mark as in progress
familiar status $FAMILIAR_TASK_ID in-review    # Ready for review
familiar status $FAMILIAR_TASK_ID done         # Complete
\`\`\`

### Log progress

\`\`\`bash
familiar log $FAMILIAR_TASK_ID "Implemented the auth module"
familiar log $FAMILIAR_TASK_ID "Fixed failing tests, 12/12 passing"
\`\`\`

### Send notifications

\`\`\`bash
familiar notify "Build Complete" "All tests passing on feature-xyz"
\`\`\`

### Update task fields

\`\`\`bash
familiar update $FAMILIAR_TASK_ID --priority high
familiar update $FAMILIAR_TASK_ID --agent-status running
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar update $FAMILIAR_TASK_ID --agent-status error
familiar update $FAMILIAR_TASK_ID --labels "backend,auth"
\`\`\`

### Create new tasks

\`\`\`bash
familiar add "Fix login redirect bug" --priority high --status todo
familiar add "Write unit tests for auth" --labels "testing"
\`\`\`

## Status Management

**IMPORTANT: Always update your task status to \`in-progress\` as the very first thing you do when you start working on a task.** Do not skip this step.

### Task Status (column on the board)

Use \`familiar status <id> <status>\` to move your task between columns:

| Status | Meaning | When to set |
|--------|---------|-------------|
| \`backlog\` | Not yet planned | Rarely used by agents |
| \`todo\` | Planned but not started | Default for new tasks |
| \`in-progress\` | **Actively being worked on** | **Set this FIRST when you begin work** |
| \`in-review\` | Work done, waiting for human review | Only set this if you want the user to review your work — do NOT set automatically on every completion |
| \`done\` | Completed and accepted | Usually set by the user after reviewing |
| \`archived\` | No longer relevant | Rarely used by agents |

### Agent Status (shows agent state on the card)

Use \`familiar update <id> --agent-status <status>\` to show your runtime state:

| Agent Status | Meaning | When to set |
|-------------|---------|-------------|
| \`idle\` | Agent is not running | Default state |
| \`running\` | Agent is actively working | Set alongside \`in-progress\` |
| \`done\` | Agent finished successfully | Set when work is complete |
| \`error\` | Agent encountered a failure | Set when something went wrong |

### Rules

- **Do NOT** use \`familiar log\` to record status changes — use \`familiar status\` and \`familiar update --agent-status\` instead.
- **Do** use \`familiar log\` only for progress notes describing what you did or what happened.
- Task status and agent status are **independent**. Setting \`--agent-status done\` does **not** automatically move the task on the board.
- Only move the task to \`in-review\` if you are explicitly requesting human review. If the task doesn't need review (e.g. chores, trivial fixes), just set \`--agent-status done\` without changing the task status to \`in-review\`.

## Task Classification

When you start working on a task, **classify it** by adding the appropriate label based on the task title and description. Use one of these standard labels:

| Label | When to use |
|-------|-------------|
| \`bug\` | Fixing broken behavior, errors, crashes, or regressions |
| \`feature\` | Adding new functionality that didn't exist before |
| \`chore\` | Maintenance, refactoring, dependency updates, CI/CD, docs |

\`\`\`bash
# Example: classify your task as a bug fix
familiar update $FAMILIAR_TASK_ID --labels "bug"

# You can combine with other labels
familiar update $FAMILIAR_TASK_ID --labels "bug,backend"
\`\`\`

Do this **right after** setting your status to \`in-progress\`, before you start the actual work.

## Best Practices

1. **Set your status to \`in-progress\`** and agent-status to \`running\` as the **first thing** when you start working
2. **Log progress** at meaningful milestones so the human can follow along
3. **Read your task document** — it may contain specs, acceptance criteria, or context
4. **Send notifications** for important events (build failures, completion, blockers)
5. **Set agent-status to \`done\`** when finished — only move task status to \`in-review\` if you want the user to review your work

## Recommended Workflow

\`\`\`bash
# 1. FIRST THING: Mark yourself as working (do this BEFORE anything else)
familiar status $FAMILIAR_TASK_ID in-progress
familiar update $FAMILIAR_TASK_ID --agent-status running
familiar log $FAMILIAR_TASK_ID "Starting work"

# 2. Read the task document and classify it
cat .familiar/tasks/$FAMILIAR_TASK_ID/document.md
familiar update $FAMILIAR_TASK_ID --labels "feature"  # or bug, improvement, chore

# 4. Do your work, logging progress (NOT status changes)
familiar log $FAMILIAR_TASK_ID "Implemented the auth module"
# ... more work ...
familiar log $FAMILIAR_TASK_ID "Running tests — 12/12 passing"

# 5. On success — ready for human review
familiar status $FAMILIAR_TASK_ID in-review
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — ready for review"
familiar notify "Task Complete" "$FAMILIAR_TASK_ID done"

# 5b. On success — no review needed (e.g. chores, trivial fixes)
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — no review needed"
familiar notify "Task Complete" "$FAMILIAR_TASK_ID done"

# 6. On failure: update status, then notify
familiar update $FAMILIAR_TASK_ID --agent-status error
familiar log $FAMILIAR_TASK_ID "ERROR: Tests failed — see terminal output"
familiar notify "Task Failed" "Error on $FAMILIAR_TASK_ID"
\`\`\`

## File Structure

\`\`\`
.familiar/
├── AGENTS.md            # This file
├── state.json           # All tasks and project config
└── tasks/
    └── <taskId>/
        ├── task.json    # Task metadata (status, priority, labels)
        ├── document.md  # Task document (specs, notes)
        ├── activity.json # Activity/progress log
        └── attachments/ # Images and files
\`\`\`
`
