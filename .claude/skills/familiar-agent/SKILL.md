---
name: familiar-agent
description: Use when running inside a Familiar terminal (FAMILIAR_TASK_ID is set) or when the user mentions familiar, task tracking, or updating task status. Provides workflow for reading task context, updating status, logging progress, and sending notifications via the familiar CLI.
---

# Familiar — Task Context

You are running inside a **Familiar** terminal session. A task has been assigned to you.

## Step 0: Load base agent instructions

Run the following to get the canonical agent workflow and CLI reference:

```bash
familiar agents
```

Follow those instructions as your base workflow. The sections below provide additional context.

## Important: document.md is the canonical spec location

**ALWAYS** store your task spec, plan, design notes, and requirements in the task's `document.md` file at `.familiar/tasks/$FAMILIAR_TASK_ID/document.md`. This is the file the user sees in the Familiar UI. **NEVER** create separate spec/plan files elsewhere in the repo.

## Step 1: Read your context

```bash
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
```

If `$FAMILIAR_TASK_ID` is not set, you are not inside a Familiar terminal. Skip this skill.

## Step 2: Signal you're working

```bash
familiar status $FAMILIAR_TASK_ID in-progress
familiar update $FAMILIAR_TASK_ID --agent-status running
familiar log $FAMILIAR_TASK_ID "Starting work"
```

## Step 2.5: Classify your task

After reading the task, infer the type from the title and description and add the appropriate label:

| Label | When to use |
|-------|-------------|
| `bug` | Fixing broken behavior, errors, crashes, or regressions |
| `feature` | Adding new functionality that didn't exist before |
| `chore` | Maintenance, refactoring, dependency updates, CI/CD, docs |

```bash
familiar update $FAMILIAR_TASK_ID --labels "feature"  # or bug, improvement, chore
```

## Step 3: Log frequent short progress updates

Send very brief (2–6 word) activity updates frequently so the user can see what you're doing on the board card. Log an update every time you start a new phase of work:

```bash
familiar log $FAMILIAR_TASK_ID "Reading codebase"
familiar log $FAMILIAR_TASK_ID "Implementing feature X"
familiar log $FAMILIAR_TASK_ID "Writing tests"
familiar log $FAMILIAR_TASK_ID "Fixing lint errors"
familiar log $FAMILIAR_TASK_ID "All tests passing"
```

## Step 4: Commit your work

After completing the task, create a git commit with all relevant changes before signaling completion.

```bash
git add <changed-files>
git commit -m "feat: <short description>"
```

Use conventional commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). Do NOT push unless explicitly asked.

## Step 5: On completion

```bash
# Success
familiar status $FAMILIAR_TASK_ID in-review
familiar update $FAMILIAR_TASK_ID --agent-status done
familiar log $FAMILIAR_TASK_ID "Complete — all tests passing"

# Failure
familiar update $FAMILIAR_TASK_ID --agent-status error
familiar log $FAMILIAR_TASK_ID "ERROR: <description>"
```

## CLI Reference

| Command | Purpose |
|---------|---------|
| `familiar status <id> <status>` | Set status: `backlog`, `todo`, `in-progress`, `in-review`, `done`, `archived` |
| `familiar update <id> --agent-status <s>` | Set agent status: `idle`, `running`, `done`, `error` |
| `familiar update <id> --priority <p>` | Set priority: `urgent`, `high`, `medium`, `low`, `none` |
| `familiar log <id> "<message>"` | Append to activity log |
| `familiar notify "<title>" "<body>"` | Send in-app notification |
| `familiar add "<title>" [--priority p] [--status s]` | Create a new task |
| `familiar list [--status s] [--json]` | List tasks |
| `familiar setup [--copy]` | Print tmux setup prompt |
| `familiar doctor [--copy]` | Print environment diagnostic prompt |
| `familiar agents [--copy]` | Print base agent instructions |
