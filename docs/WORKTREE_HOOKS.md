# Worktree Hooks

Familiar supports lifecycle hooks that run automatically when worktrees are created or deleted. Use them to automate setup and teardown — installing dependencies, configuring environment files, stopping services, etc.

## Hook Location

Hooks live in your project's `.familiar/hooks/` directory:

```
.familiar/hooks/
├── after-worktree-create.sh   # Runs after a new worktree is created
└── pre-worktree-delete.sh     # Runs before a worktree is deleted
```

Both hooks are optional. If a hook file doesn't exist, it's silently skipped.

## `after-worktree-create.sh`

Runs immediately after a new worktree is created. The working directory is set to the new worktree.

**Common uses:**
- Install dependencies (`npm install`, `pip install`, etc.)
- Copy or generate `.env` files
- Run database migrations
- Set up local configuration

**Example:**

```bash
#!/bin/bash
set -e

cd "$NEW_WORKTREE_DIR"
npm install
cp "$MAIN_WORKTREE_DIR/.env" .env
echo "Worktree $NEW_WORKTREE_NAME ready."
```

## `pre-worktree-delete.sh`

Runs just before a worktree is removed. The working directory is set to the worktree being deleted.

**Common uses:**
- Stop running services or processes
- Clean up generated files or caches
- Archive logs or state

**Example:**

```bash
#!/bin/bash
set -e

cd "$DELETE_WORKTREE_DIR"
# Stop any running dev servers
pkill -f "node.*$DELETE_WORKTREE_NAME" 2>/dev/null || true
echo "Cleaned up $DELETE_WORKTREE_NAME."
```

## Environment Variables

Both hooks receive built-in environment variables. The main worktree variables are the same for both hooks; the target worktree variables use a context-appropriate prefix.

### Main worktree (always available)

| Variable | Description |
|----------|-------------|
| `MAIN_WORKTREE_DIR` | Absolute path to the main project worktree |
| `MAIN_WORKTREE_BRANCH` | Git branch of the main worktree |
| `MAIN_WORKTREE_PROJECT` | Project name (from `.familiar/state.json`, or directory name) |

### Target worktree — create hook

| Variable | Description |
|----------|-------------|
| `NEW_WORKTREE_DIR` | Absolute path to the newly created worktree |
| `NEW_WORKTREE_NAME` | Slug name of the new worktree |
| `NEW_WORKTREE_BRANCH` | Git branch of the new worktree |

### Target worktree — delete hook

| Variable | Description |
|----------|-------------|
| `DELETE_WORKTREE_DIR` | Absolute path to the worktree being deleted |
| `DELETE_WORKTREE_NAME` | Slug name of the worktree being deleted |
| `DELETE_WORKTREE_BRANCH` | Git branch of the worktree being deleted |

### Custom environment variables

You can define additional environment variables in the "New Worktree" dialog. These are passed alongside the built-in variables when the create hook runs.

## Notes

- Hooks must be executable (`chmod +x`). Familiar will attempt to set this automatically.
- Hooks run via `/bin/bash`.
- Hook output (stdout and stderr) is captured and shown in the UI.
- A non-zero exit code from `after-worktree-create.sh` does **not** roll back the worktree — it's already created.
- A non-zero exit code from `pre-worktree-delete.sh` does **not** prevent deletion.
- The `.familiar/` directory is typically gitignored, so hooks are local to each developer's machine.
