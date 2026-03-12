# Familiar — Developer Guide

## What is this project?

Familiar is a macOS Electron desktop app that provides a Linear-style kanban board with embedded terminal emulators, purpose-built for agentic AI coding workflows. Each task card has a block editor and terminal panes running persistent tmux sessions. A companion CLI (`familiar`) allows scripts/agents to manage tasks without the GUI.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with HMR
npm run build        # Production build (Electron app)
npm run build:cli    # Build CLI tool
npm test             # Run all 196 tests
npm run typecheck    # TypeScript type checking
```

## Architecture

- **Electron main process** (`src/main/`) — Services, IPC handlers, platform implementations
- **Preload** (`src/preload/`) — contextBridge exposing `window.api` to renderer
- **Renderer** (`src/renderer/`) — React 19 + Zustand UI
- **Shared** (`src/shared/`) — Types, constants, utilities shared across all processes
- **CLI** (`src/cli/`) — Standalone Commander.js CLI reading `.familiar/` directly

### Key Patterns

- **Platform abstraction**: All Electron APIs are behind interfaces in `src/shared/platform/`. Implementations in `src/main/platform/`. This enables future browser portability.
- **State**: Zustand stores in renderer only. Main process is stateless (provides services via IPC).
- **Persistence**: File-based in `.familiar/` folder. No database. Atomic writes (temp+rename) for safety.
- **Terminals**: Real tmux sessions (`familiar-<taskId>-<paneIndex>`). node-pty spawns `tmux attach`. Sessions survive app restarts.

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, window creation, service wiring
│   ├── ipc/                 # IPC handler registrations
│   │   ├── file-handlers.ts
│   │   ├── pty-handlers.ts
│   │   ├── tmux-handlers.ts
│   │   ├── notification-handlers.ts
│   │   └── window-handlers.ts
│   ├── services/
│   │   ├── data-service.ts  # CRUD for project state, tasks, documents, activity
│   │   └── file-watcher.ts  # Chokidar watcher for external changes
│   └── platform/            # Electron implementations of shared interfaces
│       ├── electron-file-system.ts
│       ├── electron-pty.ts
│       ├── electron-tmux.ts
│       └── electron-notifications.ts
├── preload/
│   └── index.ts             # contextBridge exposing typed window.api
├── renderer/
│   ├── index.html
│   └── src/
│       ├── App.tsx           # Root component
│       ├── main.tsx          # React entry
│       ├── components/
│       │   ├── board/        # KanbanBoard, KanbanColumn, TaskCard
│       │   ├── task-detail/  # TaskDetail, SplitPanel, ActivityTimeline, StatusSelect, PrioritySelect
│       │   ├── editor/       # BlockNote block editor
│       │   ├── terminal/     # xterm.js Terminal, TerminalTabs, TerminalPanel
│       │   ├── command-palette/ # Cmd+K palette (cmdk)
│       │   ├── layout/       # AppShell, Header
│       │   └── common/       # ContextMenu, EmptyState, LoadingSpinner, AgentStatusBadge
│       ├── stores/           # Zustand stores
│       │   ├── task-store.ts # Project state + task CRUD
│       │   ├── board-store.ts # Drag-and-drop state
│       │   ├── ui-store.ts   # UI state (sidebar, filters, focus, command palette)
│       │   └── terminal-store.ts # Terminal sessions and panes
│       ├── hooks/            # useKeyboardNavigation, useGlobalShortcuts, useContextMenu
│       ├── styles/           # global.css (Linear dark theme), animations.css
│       └── lib/              # Utilities (format-time)
├── shared/                   # Shared between main, renderer, CLI
│   ├── types/                # TypeScript types (Task, ProjectState, ActivityEntry, TerminalSession)
│   ├── platform/             # Platform abstraction interfaces
│   ├── constants.ts          # App constants, file paths, column/priority/status configs
│   └── utils/                # id-generator, task-utils, validators
└── cli/                      # CLI tool
    ├── index.ts              # Commander.js entry
    ├── commands/             # init, add, list, status, update, delete, log, notify, open, sync, import
    └── lib/                  # file-ops (direct filesystem), ipc-client (stub)
```

## Data Model

Tasks stored in `.familiar/`:
```
.familiar/
├── state.json           # ProjectState (tasks array, column order, labels)
└── tasks/<taskId>/
    ├── task.json        # Task metadata
    ├── document.md      # Block editor content
    ├── activity.json    # Activity log
    └── attachments/     # Images and files
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App framework | Electron (electron-vite) |
| Frontend | React 19 + TypeScript (strict) |
| State | Zustand (NOT Redux) |
| Terminal | xterm.js + node-pty + tmux |
| Editor | BlockNote (with Mantine) |
| Drag & Drop | @dnd-kit |
| Command Palette | cmdk |
| Animations | framer-motion |
| Build | Vite + electron-vite + tsup (CLI) |
| Testing | Vitest + @testing-library/react + Playwright |

## Testing

Tests are **colocated** next to source files (e.g., `task-store.test.ts` next to `task-store.ts`). Integration tests are in `tests/integration/`.

**All changes must include unit tests and integration tests.** Aim for good test coverage — every new feature, bug fix, or refactor should have corresponding tests. Run `npm run test:coverage` to verify coverage before submitting changes.

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run test:e2e      # Playwright E2E (when available)
```

## CLI Usage

```bash
familiar init                          # Create .familiar/
familiar add "Task title" --priority high --labels "a,b"
familiar list --status in-progress --json
familiar status <id> done
familiar update <id> --title "New title" --priority medium
familiar delete <id>
familiar log <id> "Completed step 1"
familiar notify "Title" "Body"
familiar open [id]
familiar import <markdown-file>
```

## Key Decisions (see docs/EXECUTIVE_DECISIONS.md for full details)

- **macOS only** for initial release
- **Agent-agnostic** — any CLI command can run in terminals
- **Manual launch** — user starts agents manually, no auto-start
- **Flat hierarchy** — no sub-tasks, use labels instead
- **File-based** — no database, `.familiar/` is source of truth
- **Browser-portable** — all Electron APIs abstracted for future web version

## Import Path Aliases

- `@shared/*` → `src/shared/*` (available in main, preload, and renderer)
- `@renderer/*` → `src/renderer/src/*` (renderer only)

## Status Change Logic

Task status and agent status are independent. Here is every trigger that changes them:

| Trigger | Task Status | Agent Status | Notification |
|---------|-------------|-------------|-------------|
| **User sends message** (hook: `on-prompt-submit.sh`) | → `in-progress` | → `running` | — |
| **Claude stops responding** (hook: `on-stop.sh`) | *(unchanged)* | → `idle` | "Agent Stopped" |
| **Agent completes — needs review** (CLI) | → `in-review` | → `done` | "Task Done" |
| **Agent completes — no review** (CLI) | *(unchanged)* | → `done` | "Task Done" |
| **Agent fails** (CLI) | *(unchanged)* | → `error` | "Task Failed" |
| **CLI `familiar status` → `in-review`/`done`** | as specified | `running` → `done` (auto) | — |
| **CLI `familiar status` → `archived`** | as specified | → `idle` (auto, kills tmux) | — |
| **Stop Agent button** (UI) | *(unchanged)* | → `idle` (if `running`) | — |

Key files: `.claude/hooks/on-prompt-submit.sh`, `.claude/hooks/on-stop.sh`, `src/cli/commands/status.ts` (auto-transitions), `src/renderer/src/stores/task-store.ts` (`updateTask`/`moveTask` auto-transitions), `src/renderer/src/components/terminal/TerminalPanel.tsx` (stop button).

## Common Tasks for Contributing Agents

### Adding a new IPC method
1. Add handler in `src/main/ipc/`
2. Register in `src/main/index.ts`
3. Expose in `src/preload/index.ts`
4. Add type to `src/renderer/src/env.d.ts`

### Adding a new CLI command
1. Create `src/cli/commands/<name>.ts` returning a `Command`
2. Register in `src/cli/index.ts`

### Adding a new store
1. Create in `src/renderer/src/stores/`
2. Create colocated test file

### Releasing a new version
1. Bump `"version"` in `package.json`
2. Build the app: `npm run build:app` (builds Electron + CLI + DMG)
3. The DMG is output to `release/Familiar-<version>-arm64.dmg`
4. Create a GitHub release:
   ```bash
   gh release create v<version> "release/Familiar-<version>-arm64.dmg" \
     --title "Familiar v<version>" --notes "<release notes>"
   ```
5. To delete old releases: `gh release delete v<old> --yes --cleanup-tag`
