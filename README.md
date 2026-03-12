<p align="center">
  <img src="resources/logo-banner.png" alt="Familiar" width="800" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/version-0.3.0-green" alt="Version" />
</p>

A macOS desktop app that gives AI coding agents their own kanban board, terminals, and editor — so you can manage agentic workflows the way you'd manage a team.

## Why "Familiar"?

The name carries a double meaning:

**Familiar** *(adjective)* — something well-known, intuitive, easy to use. The interface should feel natural from the first moment — a kanban board, terminals, an editor. No learning curve. Just the tools you already know, organized around your agents.

**Familiar** *(noun)* — in folklore, a supernatural creature (often a cat, raven, or small spirit) that serves a practitioner of magic, carrying out their will with loyalty and autonomy. Your AI agents are your familiars — digital spirits that execute your intent, report back, and work tirelessly under your command.

The logo reflects this: a kanban board with a geometric cat silhouette beneath it — your familiar, watching over your tasks, ready to obey.

## Why?

AI coding agents are powerful, but managing multiple agents across different tasks is chaotic. Familiar treats each task like a card on a board — complete with its own persistent terminal sessions, rich text editor, and activity log. You see what every agent is working on, at a glance.

## Features

- **Kanban board** — Drag-and-drop task cards across columns (Backlog, Todo, In Progress, In Review, Done)
- **Embedded terminals** — Each task has dedicated terminal panes backed by persistent tmux sessions that survive app restarts
- **Block editor** — Rich text task descriptions powered by BlockNote
- **CLI companion** — `familiar` CLI lets agents update their own task status, log progress, and send notifications
- **Agent status tracking** — See which tasks have running agents and their current state
- **Command palette** — Quick navigation with `Cmd+K`
- **Activity timeline** — Full history of status changes, agent logs, and updates per task
- **File-based storage** — Everything lives in `.familiar/` — no database, easy to inspect and version control

## Quick Start

1. Download the latest `.dmg` from [Releases](https://github.com/familiar-sh/familiar/releases)
2. Open the app
3. Create tasks, open terminals, and start your agents

The app includes a built-in CLI (`familiar`) that gets installed automatically. If the CLI isn't detected, the app will prompt you to install it.

## CLI (for agents)

The `familiar` CLI is how AI agents manage their own tasks — updating status, logging progress, and sending notifications back to the board:

```bash
familiar init                                    # Initialize .familiar/ in a project
familiar add "Implement auth flow" --priority high
familiar status <task-id> in-progress
familiar log <task-id> "Auth endpoint working, adding tests"
familiar notify "Done" "Auth flow complete"
familiar list --status in-progress --json
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
└── Direct filesystem access to .familiar/
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
