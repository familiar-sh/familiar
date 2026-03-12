# Agent Instructions

## Git Workflow

**Commit after completing each task.** When you finish a task (all changes implemented, tests passing), create a git commit before moving on or marking the task as done.

```bash
# Stage relevant files (be specific, avoid staging secrets or unrelated files)
git add <changed-files>

# Commit with a descriptive message referencing the task
git commit -m "feat: <short description of what was done>"
```

- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Keep commits focused — one task, one commit
- Do NOT push unless explicitly asked
