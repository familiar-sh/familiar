# Kanban Agent

A macOS desktop app that gives AI coding agents their own kanban board, terminals, and editor — so you can manage agentic workflows the way you'd manage a team.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Version](https://img.shields.io/badge/version-0.2.0-green)

## Why?

AI coding agents are powerful, but managing multiple agents across different tasks is chaotic. Kanban Agent treats each task like a card on a board — complete with its own persistent terminal sessions, rich text editor, and activity log. You see what every agent is working on, at a glance.

## Features

- **Kanban board** — Drag-and-drop task cards across columns (Backlog, Todo, In Progress, In Review, Done)
- **Embedded terminals** — Each task has dedicated terminal panes backed by persistent tmux sessions that survive app restarts
- **Block editor** — Rich text task descriptions powered by BlockNote
- **CLI companion** — `kanban-agent` CLI lets agents update their own task status, log progress, and send notifications
- **Agent status tracking** — See which tasks have running agents and their current state
- **Command palette** — Quick navigation with `Cmd+K`
- **Activity timeline** — Full history of status changes, agent logs, and updates per task
- **File-based storage** — Everything lives in `.kanban-agent/` — no database, easy to inspect and version control

## Quick Start

1. Download the latest `.dmg` from [Releases](https://github.com/carlosbaraza/kanban-agent/releases)
2. Open the app
3. Create tasks, open terminals, and start your agents

The app includes a built-in CLI (`kanban-agent`) that gets installed automatically. If the CLI isn't detected, the app will prompt you to install it.

## CLI (for agents)

The `kanban-agent` CLI is how AI agents manage their own tasks — updating status, logging progress, and sending notifications back to the board:

```bash
kanban-agent init                                    # Initialize .kanban-agent/ in a project
kanban-agent add "Implement auth flow" --priority high
kanban-agent status <task-id> in-progress
kanban-agent log <task-id> "Auth endpoint working, adding tests"
kanban-agent notify "Done" "Auth flow complete"
kanban-agent list --status in-progress --json
```

## Architecture

```
Electron Main Process
├── Services (data, file watching)
├── IPC handlers (file, pty, tmux, notifications)
└── Platform abstractions (for future browser portability)

React Renderer
├── Zustand stores (tasks, board, UI, terminals)
├── Kanban board (dnd-kit)
├── Block editor (BlockNote)
├── Terminal emulator (xterm.js)
└── Command palette (cmdk)

CLI (standalone)
└── Direct filesystem access to .kanban-agent/
```

## Tech Stack

| | |
|---|---|
| **App** | Electron + electron-vite |
| **UI** | React 19, Zustand, Framer Motion |
| **Terminal** | xterm.js + node-pty + tmux |
| **Editor** | BlockNote + Mantine |
| **DnD** | @dnd-kit |
| **CLI** | Commander.js + tsup |
| **Tests** | Vitest + Testing Library + Playwright |

## Development

```bash
npm install          # Install deps
npm run dev          # Dev server with HMR
npm test             # Run tests
npm run typecheck    # Type checking
npm run build:app    # Build the Electron app
```

## License

MIT
