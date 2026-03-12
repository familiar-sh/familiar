# Global Settings Page — Design Spec

## Overview

A VS Code-style visual settings page that renders `settings.json` as a friendly UI with proper controls for each setting type. Embeds the existing snippet editor inline. Accessible via navbar gear icon and command palette.

## Navigation

- **Gear icon** in Navbar right group (before notification bell)
- **Command palette** entry: "Open Settings"
- **Escape** key closes settings, returns to board
- New UI store state: `settingsOpen: boolean` + `openSettings()` / `closeSettings()`
- When settings is open, board and task detail are hidden (not unmounted)

## Layout

Full-page view replacing board content area. Navbar stays visible.

```
┌──────────────────────────────────────────────┐
│  Navbar  [Dashboard] [Finder] [⚙️] [🔔]     │
├──────────────────────────────────────────────┤
│                                              │
│   Settings                                   │
│                                              │
│   ── Terminal ──────────────────────────────  │
│   Default Command                            │
│   Command to run when a new terminal starts  │
│   [ /kanban-agent                         ]  │
│                                              │
│   ── Snippets ─────────────────────────────  │
│   Terminal command shortcuts shown as buttons │
│   ┌─ snippet 1 ─────────────────────────┐   │
│   │ [icon] [Label___] [Command_____] ☑  │   │
│   │ ▸ Advanced                          │   │
│   └─────────────────────────────────────┘   │
│   ┌─ snippet 2 ─────────────────────────┐   │
│   │ ...                                  │   │
│   └─────────────────────────────────────┘   │
│   [+ Add Snippet]                            │
│                                              │
│                        [Cancel]  [Save]      │
└──────────────────────────────────────────────┘
```

## Sections

### 1. Terminal
- **Default Command** — text input, optional
  - Description: "Command to run automatically when a new task terminal is created"
  - Maps to `settings.defaultCommand`

### 2. Snippets
- Existing `SnippetSettingsModal` content extracted and embedded inline
- Each snippet: icon picker, label, command, auto-run checkbox, advanced toggle
- Advanced: showInDashboard, iconOnlyDashboard, iconOnlyTerminal
- Add/remove snippets
- Maps to `settings.snippets[]`

## Implementation

### New files
- `src/renderer/src/components/settings/SettingsPage.tsx` — main settings page
- `src/renderer/src/components/settings/SettingsSection.tsx` — reusable section wrapper
- `src/renderer/src/components/settings/SnippetSettings.tsx` — extracted snippet editor (from SnippetSettingsModal)

### Modified files
- `src/renderer/src/stores/ui-store.ts` — add `settingsOpen`, `openSettings()`, `closeSettings()`
- `src/renderer/src/App.tsx` — conditionally render SettingsPage when settingsOpen
- `src/renderer/src/components/layout/Navbar.tsx` — add gear icon button
- `src/renderer/src/components/command-palette/CommandPalette.tsx` — add "Open Settings" action
- `src/renderer/src/components/terminal/TerminalPanel.tsx` — gear icon opens global settings page instead of modal

### Data flow
1. SettingsPage loads settings via `window.api.readSettings()` on mount
2. User edits controls → local state updates
3. Save button → `window.api.writeSettings(settings)` → dispatches `snippets-updated` event
4. Cancel → discard local state, close settings

### Styling
- Inline styles following existing pattern (SnippetSettingsModal)
- Uses CSS custom properties: `--bg-primary`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--border`, `--accent`
- Max-width container (~720px) centered for readability
- Scrollable body
