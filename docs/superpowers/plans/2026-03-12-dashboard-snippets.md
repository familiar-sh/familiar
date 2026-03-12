# Dashboard Snippets Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow snippets to appear as action buttons on TaskCards in the kanban board, with icon support via Lucide, tmux session warmup on task creation, and configurable visibility per snippet.

**Architecture:** Extend the `Snippet` type with icon/visibility fields. Add two new IPC methods (`warmup-tmux-session`, `tmux-send-keys`). Refactor `sendKeys` in `ElectronTmuxManager` to support optional Enter. Add `lucide-react` for icons. Build an `IconPicker` component. Update `SnippetSettingsModal` with icon picker and advanced toggles. Update `TaskCard` with a unified footer row. Warmup tmux sessions on task creation in the store.

**Tech Stack:** React 19, Zustand, lucide-react, Electron IPC, tmux, node-pty, Vitest

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/shared/types/settings.ts` | Extend `Snippet` interface with icon/visibility fields |
| Modify | `src/shared/platform/tmux.ts` | Add `sendKeys` to `ITmuxManager` interface |
| Modify | `src/main/platform/electron-tmux.ts` | Refactor `sendKeys` to accept `pressEnter` param |
| Modify | `src/main/ipc/tmux-handlers.ts` | Add `tmux:send-keys` and `tmux:warmup` IPC handlers |
| Modify | `src/main/index.ts` | Pass `dataService` to tmux handlers registration |
| Modify | `src/preload/index.ts` | Expose `tmuxSendKeys` and `warmupTmuxSession` |
| Modify | `src/renderer/src/env.d.ts` | Add type declarations for new IPC methods |
| Modify | `src/renderer/src/stores/task-store.ts` | Fire warmup on `addTask` |
| Create | `src/renderer/src/components/terminal/IconPicker.tsx` | Searchable Lucide icon picker popover |
| Modify | `src/renderer/src/components/terminal/SnippetSettingsModal.tsx` | Icon picker + advanced toggles |
| Modify | `src/renderer/src/components/terminal/TerminalPanel.tsx` | Icon support in snippet bar |
| Modify | `src/renderer/src/components/board/TaskCard.tsx` | Footer with dashboard snippet buttons |
| Modify | `src/renderer/src/components/board/TaskCard.module.css` | Footer styles |
| Modify | `src/renderer/src/components/board/KanbanColumn.tsx` | Hide add button for archived column |
| Modify | `src/renderer/src/components/board/KanbanBoard.tsx` | Load snippets, pass to TaskCard |

---

## Chunk 1: Backend — Types, IPC, and Tmux Warmup

### Task 1: Extend Snippet type and install lucide-react

**Files:**
- Modify: `src/shared/types/settings.ts`
- Modify: `package.json`

- [ ] **Step 1: Update Snippet interface**

In `src/shared/types/settings.ts`, add the new optional fields to the `Snippet` interface:

```typescript
export interface Snippet {
  /** Button label */
  title: string
  /** Command to send to the terminal */
  command: string
  /** Whether to press Enter after sending the command */
  pressEnter: boolean
  /** Lucide icon name (e.g., "play", "rocket"). undefined = no icon */
  icon?: string
  /** Show this snippet as a button on TaskCards in the board. Default: false */
  showInDashboard?: boolean
  /** When shown in dashboard, display only the icon (no text label). Default: false */
  showIconInDashboard?: boolean
  /** When shown in terminal bar, display only the icon (no text label). Default: false */
  showIconInTerminal?: boolean
}
```

- [ ] **Step 2: Install lucide-react**

Run: `npm install lucide-react`

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (new optional fields are backward-compatible)

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/settings.ts package.json package-lock.json
git commit -m "feat: extend Snippet type with icon and visibility fields, add lucide-react"
```

---

### Task 2: Refactor ElectronTmuxManager.sendKeys and ITmuxManager interface

**Files:**
- Modify: `src/shared/platform/tmux.ts`
- Modify: `src/main/platform/electron-tmux.ts`

- [ ] **Step 1: Add sendKeys to ITmuxManager interface**

In `src/shared/platform/tmux.ts`, add to the interface:

```typescript
sendKeys(sessionName: string, keys: string, pressEnter?: boolean): Promise<void>
```

- [ ] **Step 2: Refactor sendKeys in ElectronTmuxManager**

In `src/main/platform/electron-tmux.ts`, change `sendKeys` to:

```typescript
async sendKeys(sessionName: string, keys: string, pressEnter = true): Promise<void> {
  const args = ['send-keys', '-t', sessionName, keys]
  if (pressEnter) {
    args.push('Enter')
  }
  await this._exec(args)
}
```

This is backward-compatible — existing callers pass no `pressEnter` arg and get `true` (same behavior as before).

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/platform/tmux.ts src/main/platform/electron-tmux.ts
git commit -m "refactor: make sendKeys pressEnter parameter optional"
```

---

### Task 3: Add tmux IPC handlers (send-keys and warmup)

**Files:**
- Modify: `src/main/ipc/tmux-handlers.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Update tmux-handlers to accept dataService and add new handlers**

Update `src/main/ipc/tmux-handlers.ts` with the following changes:
1. Add `DataService` import and update function signature to accept `dataService` parameter
2. Add two new IPC handlers at the end: `tmux:send-keys` and `tmux:warmup`
3. Keep all existing handlers unchanged

The full file should look like (verify existing handlers match current code before applying):

```typescript
import { ipcMain } from 'electron'
import { ElectronTmuxManager } from '../platform/electron-tmux'
import type { DataService } from '../services/data-service'

export function registerTmuxHandlers(
  tmuxManager: ElectronTmuxManager,
  dataService: DataService
): void {
  ipcMain.handle('tmux:list', async () => {
    return tmuxManager.listSessions()
  })

  ipcMain.handle('tmux:attach', async (_event, name: string) => {
    await tmuxManager.attachSession(name)
  })

  ipcMain.handle('tmux:detach', async (_event, name: string) => {
    await tmuxManager.detachSession(name)
  })

  ipcMain.handle('tmux:kill', async (_event, name: string) => {
    try {
      await tmuxManager.killSession(name)
    } catch {
      // Session may already be dead — that's fine
    }
  })

  ipcMain.handle('tmux:has', async (_event, name: string) => {
    return tmuxManager.hasSession(name)
  })

  ipcMain.handle(
    'tmux:send-keys',
    async (_event, sessionName: string, keys: string, pressEnter: boolean) => {
      await tmuxManager.sendKeys(sessionName, keys, pressEnter)
    }
  )

  ipcMain.handle('tmux:warmup', async (_event, taskId: string) => {
    const sessionName = `kanban-${taskId}`

    // Skip if session already exists
    const exists = await tmuxManager.hasSession(sessionName)
    if (exists) return

    const projectRoot = dataService.getProjectRoot()
    const env = {
      KANBAN_TASK_ID: taskId,
      KANBAN_PROJECT_ROOT: projectRoot
    }

    await tmuxManager.createSession(sessionName, projectRoot, env)

    // Run default command if configured
    try {
      const settings = await dataService.readSettings()
      if (settings.defaultCommand) {
        await tmuxManager.sendKeys(sessionName, settings.defaultCommand)
      }
    } catch {
      // Settings not available — skip default command
    }
  })
}
```

- [ ] **Step 2: Update main/index.ts to pass dataService to registerTmuxHandlers**

In `src/main/index.ts`, change the call from:

```typescript
registerTmuxHandlers(tmuxManager)
```

to:

```typescript
registerTmuxHandlers(tmuxManager, dataService)
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/tmux-handlers.ts src/main/index.ts
git commit -m "feat: add tmux send-keys and warmup IPC handlers"
```

---

### Task 4: Expose new IPC methods in preload and type declarations

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: Add to preload api object**

In `src/preload/index.ts`, add after the existing tmux methods (after line 66):

```typescript
tmuxSendKeys: (sessionName: string, keys: string, pressEnter: boolean): Promise<void> =>
  ipcRenderer.invoke('tmux:send-keys', sessionName, keys, pressEnter),
warmupTmuxSession: (taskId: string): Promise<void> =>
  ipcRenderer.invoke('tmux:warmup', taskId),
```

- [ ] **Step 2: Add type declarations**

In `src/renderer/src/env.d.ts`, add after `tmuxHas` (after line 54):

```typescript
tmuxSendKeys(sessionName: string, keys: string, pressEnter: boolean): Promise<void>
warmupTmuxSession(taskId: string): Promise<void>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "feat: expose tmuxSendKeys and warmupTmuxSession in preload"
```

---

### Task 5: Fire tmux warmup on task creation

**Files:**
- Modify: `src/renderer/src/stores/task-store.ts`
- Modify: `src/renderer/src/stores/task-store.test.ts`

- [ ] **Step 1: Add warmupTmuxSession mock to test file**

In `src/renderer/src/stores/task-store.test.ts`, add to the `mockApi` object:

```typescript
warmupTmuxSession: vi.fn(),
tmuxList: vi.fn().mockResolvedValue([]),
tmuxKill: vi.fn(),
```

- [ ] **Step 2: Write the failing test**

Add to the `addTask` describe block in `task-store.test.ts`:

```typescript
it('calls warmupTmuxSession after creating a non-archived task', async () => {
  const state = makeProjectState()
  useTaskStore.setState({ projectState: state })
  mockApi.createTask.mockResolvedValue(undefined)
  mockApi.writeProjectState.mockResolvedValue(undefined)
  mockApi.warmupTmuxSession.mockResolvedValue(undefined)

  const task = await useTaskStore.getState().addTask('Test warmup')
  expect(mockApi.warmupTmuxSession).toHaveBeenCalledWith(task.id)
})

it('does not call warmupTmuxSession when creating an archived task', async () => {
  const state = makeProjectState()
  useTaskStore.setState({ projectState: state })
  mockApi.createTask.mockResolvedValue(undefined)
  mockApi.writeProjectState.mockResolvedValue(undefined)
  mockApi.warmupTmuxSession.mockResolvedValue(undefined)

  await useTaskStore.getState().addTask('Archived task', { status: 'archived' })
  expect(mockApi.warmupTmuxSession).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/stores/task-store.test.ts`
Expected: FAIL (warmupTmuxSession not called yet)

- [ ] **Step 4: Add warmup call in addTask**

In `src/renderer/src/stores/task-store.ts`, in the `addTask` method, after `set({ projectState: newState })` (line 152) and before `return task`, add:

```typescript
// Warm up tmux session for non-archived tasks (fire-and-forget)
if (task.status !== 'archived') {
  window.api.warmupTmuxSession(task.id).catch(() => {
    // Warmup failure is non-critical — terminal will create session on open
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/stores/task-store.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/stores/task-store.ts src/renderer/src/stores/task-store.test.ts
git commit -m "feat: warmup tmux session on task creation"
```

---

### Task 6: Block task creation in Archived column

**Files:**
- Modify: `src/renderer/src/components/board/KanbanColumn.tsx`

- [ ] **Step 1: Hide add button for archived status**

In `src/renderer/src/components/board/KanbanColumn.tsx`, wrap the "+" button (lines 200-207) in a condition:

```tsx
{status !== 'archived' && (
  <button
    className={styles.addButton}
    onClick={handlePlusClick}
    title="Create task (c)"
    aria-label={`Create task in ${COLUMN_LABELS[status]}`}
  >
    +
  </button>
)}
```

Also guard the "Create task" item in `columnContextItems` when `status === 'archived'`. Wrap the first two items (the "Create task" entry and the divider after it) in a condition:

```typescript
// At the top of columnContextItems, wrap the Create task + divider:
...(status !== 'archived'
  ? [
      {
        label: 'Create task',
        onClick: () => setIsCreating(true),
        shortcut: 'C'
      },
      { label: '', onClick: () => {}, divider: true } as ContextMenuItem
    ]
  : []),
// Keep all remaining menu items unchanged
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/board/KanbanColumn.tsx
git commit -m "feat: block task creation in archived column"
```

---

## Chunk 2: Icon Picker Component

### Task 7: Create IconPicker component

**Files:**
- Create: `src/renderer/src/components/terminal/IconPicker.tsx`

- [ ] **Step 1: Create the IconPicker component**

Create `src/renderer/src/components/terminal/IconPicker.tsx`:

```tsx
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { icons } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface IconPickerProps {
  selectedIcon?: string
  onSelect: (iconName: string) => void
  onClose: () => void
  anchorRect: DOMRect | null
}

// Convert PascalCase icon names to kebab-case for display/search
function toKebab(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

const iconEntries: Array<{ name: string; kebab: string; Component: LucideIcon }> = Object.entries(
  icons
).map(([name, Component]) => ({
  name,
  kebab: toKebab(name),
  Component
}))

export function IconPicker({
  selectedIcon,
  onSelect,
  onClose,
  anchorRect
}: IconPickerProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const filtered = useMemo(() => {
    if (!search.trim()) return iconEntries.slice(0, 60)
    const q = search.toLowerCase()
    return iconEntries.filter((e) => e.kebab.includes(q)).slice(0, 60)
  }, [search])

  const handleSelect = useCallback(
    (name: string) => {
      onSelect(toKebab(name))
      onClose()
    },
    [onSelect, onClose]
  )

  const top = anchorRect ? anchorRect.bottom + 4 : 0
  const left = anchorRect ? anchorRect.left : 0

  return (
    <div ref={popoverRef} style={{ ...pickerStyles.popover, top, left }}>
      <input
        ref={inputRef}
        style={pickerStyles.search}
        placeholder="Search icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div style={pickerStyles.grid}>
        {filtered.map((entry) => {
          const Icon = entry.Component
          const isSelected = selectedIcon === entry.kebab
          return (
            <button
              key={entry.name}
              style={{
                ...pickerStyles.iconButton,
                ...(isSelected ? pickerStyles.iconButtonSelected : {})
              }}
              title={entry.kebab}
              onClick={() => handleSelect(entry.name)}
            >
              <Icon size={16} />
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={pickerStyles.noResults}>No icons found</div>
        )}
      </div>
      <div style={pickerStyles.count}>
        {filtered.length} icon{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ''}
      </div>
    </div>
  )
}

/** Render a Lucide icon by its kebab-case name. Returns null if not found. */
export function LucideIconByName({
  name,
  size = 14,
  ...props
}: {
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
}): React.JSX.Element | null {
  // Convert kebab-case to PascalCase for lookup
  const pascalName = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  const Icon = icons[pascalName as keyof typeof icons]
  if (!Icon) return null
  return <Icon size={size} {...props} />
}

const pickerStyles: Record<string, React.CSSProperties> = {
  popover: {
    position: 'fixed',
    zIndex: 10000,
    width: '280px',
    maxHeight: '320px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    padding: '10px'
  },
  search: {
    width: '100%',
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
    marginBottom: '8px',
    boxSizing: 'border-box' as const,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '4px',
    overflowY: 'auto',
    flex: 1,
    maxHeight: '200px'
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    borderRadius: '5px',
    border: '1px solid transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background-color 0.1s, border-color 0.1s'
  },
  iconButtonSelected: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: 'rgba(99,102,241,0.3)',
    color: '#818cf8'
  },
  noResults: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    color: 'var(--text-tertiary)',
    fontSize: '12px',
    padding: '16px'
  },
  count: {
    marginTop: '6px',
    color: 'var(--text-tertiary)',
    fontSize: '10px',
    textAlign: 'center' as const
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/terminal/IconPicker.tsx
git commit -m "feat: add searchable Lucide icon picker component"
```

---

## Chunk 3: Snippet Settings Modal Updates

### Task 8: Update SnippetSettingsModal with icon picker and advanced toggles

**Files:**
- Modify: `src/renderer/src/components/terminal/SnippetSettingsModal.tsx`

- [ ] **Step 1: Rewrite SnippetSettingsModal**

Replace the content of `src/renderer/src/components/terminal/SnippetSettingsModal.tsx`. Before applying, verify the current file matches what's expected (the existing file has icon-less snippets with just title/command/pressEnter fields). The rewrite adds: icon picker integration, advanced collapsible toggles, and new styling.

```tsx
import { useState, useCallback, useRef } from 'react'
import { Tooltip } from '@renderer/components/common'
import { IconPicker, LucideIconByName } from './IconPicker'
import type { Snippet, ProjectSettings } from '@shared/types'

interface SnippetSettingsModalProps {
  snippets: Snippet[]
  onSave: (snippets: Snippet[]) => void
  onClose: () => void
}

export function SnippetSettingsModal({
  snippets: initialSnippets,
  onSave,
  onClose
}: SnippetSettingsModalProps): React.JSX.Element {
  const [snippets, setSnippets] = useState<Snippet[]>(
    initialSnippets.map((s) => ({ ...s }))
  )
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null)
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<number>>(new Set())
  const iconButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const handleChange = useCallback(
    (index: number, field: keyof Snippet, value: string | boolean) => {
      setSnippets((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    []
  )

  const handleAdd = useCallback(() => {
    setSnippets((prev) => [...prev, { title: '', command: '', pressEnter: true }])
  }, [])

  const handleRemove = useCallback((index: number) => {
    setSnippets((prev) => prev.filter((_, i) => i !== index))
    setExpandedAdvanced((prev) => {
      const next = new Set<number>()
      for (const idx of prev) {
        if (idx < index) next.add(idx)
        else if (idx > index) next.add(idx - 1)
      }
      return next
    })
  }, [])

  const handleIconSelect = useCallback((index: number, iconName: string) => {
    setSnippets((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], icon: iconName }
      return next
    })
    setOpenPickerIndex(null)
  }, [])

  const handleIconClear = useCallback((index: number) => {
    setSnippets((prev) => {
      const next = [...prev]
      const { icon: _, showIconInDashboard: __, showIconInTerminal: ___, ...rest } = next[index]
      next[index] = rest as Snippet
      return next
    })
  }, [])

  const toggleAdvanced = useCallback((index: number) => {
    setExpandedAdvanced((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    const valid = snippets.filter((s) => s.title.trim() && s.command.trim())
    try {
      const settings: ProjectSettings = await window.api.readSettings()
      settings.snippets = valid
      await window.api.writeSettings(settings)
      onSave(valid)
    } catch (err) {
      console.error('Failed to save snippet settings:', err)
    }
  }, [snippets, onSave])

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Snippet Settings</span>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.body}>
          {snippets.map((snippet, i) => (
            <div key={i} style={styles.snippetBlock}>
              <div style={styles.row}>
                {/* Icon picker button */}
                <button
                  ref={(el) => {
                    if (el) iconButtonRefs.current.set(i, el)
                    else iconButtonRefs.current.delete(i)
                  }}
                  style={snippet.icon ? styles.iconChip : styles.iconPlaceholder}
                  onClick={() => setOpenPickerIndex(openPickerIndex === i ? null : i)}
                  title={snippet.icon ? `Icon: ${snippet.icon}` : 'Choose icon'}
                >
                  {snippet.icon ? (
                    <>
                      <LucideIconByName name={snippet.icon} size={14} />
                      <span style={styles.iconName}>{snippet.icon}</span>
                      <span
                        style={styles.iconClear}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleIconClear(i)
                        }}
                      >
                        &times;
                      </span>
                    </>
                  ) : (
                    '+ Icon'
                  )}
                </button>
                <input
                  style={styles.input}
                  placeholder="Label"
                  value={snippet.title}
                  onChange={(e) => handleChange(i, 'title', e.target.value)}
                />
                <input
                  style={{ ...styles.input, flex: 2 }}
                  placeholder="Command"
                  value={snippet.command}
                  onChange={(e) => handleChange(i, 'command', e.target.value)}
                />
                <Tooltip
                  placement="top"
                  content="When checked, the command runs immediately. Otherwise it's pasted for you to review first."
                >
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={snippet.pressEnter}
                      onChange={(e) => handleChange(i, 'pressEnter', e.target.checked)}
                    />
                    <span style={styles.checkboxText}>Auto-run</span>
                  </label>
                </Tooltip>
                <button style={styles.removeButton} onClick={() => handleRemove(i)} title="Remove">
                  &times;
                </button>
              </div>

              {/* Advanced toggle */}
              <div
                style={styles.advancedToggle}
                onClick={() => toggleAdvanced(i)}
              >
                {expandedAdvanced.has(i) ? '▾' : '▸'} Advanced
              </div>

              {expandedAdvanced.has(i) && (
                <div style={styles.advancedPanel}>
                  <label style={styles.advancedCheckbox}>
                    <input
                      type="checkbox"
                      checked={snippet.showInDashboard ?? false}
                      onChange={(e) => handleChange(i, 'showInDashboard', e.target.checked)}
                    />
                    <span style={styles.advancedText}>Show in dashboard</span>
                  </label>
                  <label style={styles.advancedCheckbox}>
                    <input
                      type="checkbox"
                      checked={snippet.showIconInDashboard ?? false}
                      onChange={(e) => handleChange(i, 'showIconInDashboard', e.target.checked)}
                      disabled={!snippet.icon}
                    />
                    <span
                      style={{
                        ...styles.advancedText,
                        ...(!snippet.icon ? { opacity: 0.4 } : {})
                      }}
                    >
                      Icon only in dashboard
                    </span>
                  </label>
                  <label style={styles.advancedCheckbox}>
                    <input
                      type="checkbox"
                      checked={snippet.showIconInTerminal ?? false}
                      onChange={(e) => handleChange(i, 'showIconInTerminal', e.target.checked)}
                      disabled={!snippet.icon}
                    />
                    <span
                      style={{
                        ...styles.advancedText,
                        ...(!snippet.icon ? { opacity: 0.4 } : {})
                      }}
                    >
                      Icon only in terminal
                    </span>
                  </label>
                </div>
              )}

              {openPickerIndex === i && (
                <IconPicker
                  selectedIcon={snippet.icon}
                  onSelect={(name) => handleIconSelect(i, name)}
                  onClose={() => setOpenPickerIndex(null)}
                  anchorRect={iconButtonRefs.current.get(i)?.getBoundingClientRect() ?? null}
                />
              )}
            </div>
          ))}

          <button style={styles.addButton} onClick={handleAdd}>
            + Add Snippet
          </button>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button style={styles.saveButton} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    width: '580px',
    maxHeight: '80vh',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1
  },
  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    flex: 1
  },
  snippetBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  iconPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 8px',
    borderRadius: '5px',
    border: '1px dashed var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-tertiary)',
    fontSize: '11px',
    cursor: 'pointer',
    minWidth: '70px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    flexShrink: 0
  },
  iconChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 8px',
    borderRadius: '5px',
    border: '1px solid rgba(99,102,241,0.3)',
    backgroundColor: 'rgba(99,102,241,0.08)',
    color: '#818cf8',
    fontSize: '11px',
    cursor: 'pointer',
    minWidth: '70px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    flexShrink: 0
  },
  iconName: {
    fontSize: '11px'
  },
  iconClear: {
    marginLeft: '2px',
    fontSize: '13px',
    lineHeight: 1,
    cursor: 'pointer',
    opacity: 0.6
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '12px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    flexShrink: 0
  },
  checkboxText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#e74c3c',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    flexShrink: 0
  },
  advancedToggle: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    paddingLeft: '2px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    userSelect: 'none'
  },
  advancedPanel: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: '5px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  advancedCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  advancedText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  addButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px dashed var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    alignSelf: 'flex-start'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid var(--border)'
  },
  cancelButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  saveButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    cursor: 'pointer'
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/terminal/SnippetSettingsModal.tsx
git commit -m "feat: add icon picker and advanced toggles to snippet settings"
```

---

## Chunk 4: Terminal Panel Icon Support

### Task 9: Update TerminalPanel snippet bar with icon support

**Files:**
- Modify: `src/renderer/src/components/terminal/TerminalPanel.tsx`

- [ ] **Step 1: Add LucideIconByName import and update snippet button rendering**

In `src/renderer/src/components/terminal/TerminalPanel.tsx`, add the import:

```typescript
import { LucideIconByName } from './IconPicker'
```

Then replace the snippet button rendering section (the `{snippets.map(...)}` block inside the snippetBar div, lines 198-231) with:

```tsx
{snippets.map((snippet, i) => (
  <Tooltip
    key={i}
    placement="bottom"
    content={
      <div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>
          {snippet.title}
        </div>
        <code
          style={{
            fontSize: '11px',
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            color: 'var(--accent-hover)',
            wordBreak: 'break-all'
          }}
        >
          {snippet.command}
        </code>
        <div style={{ marginTop: 4, fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {snippet.pressEnter
            ? 'Runs immediately (Enter is sent automatically)'
            : 'Pastes command only (you press Enter to run)'}
        </div>
      </div>
    }
  >
    <button
      style={panelStyles.snippetButton}
      onClick={() => handleSnippet(snippet)}
    >
      {snippet.icon && <LucideIconByName name={snippet.icon} size={14} />}
      {!(snippet.icon && snippet.showIconInTerminal) && snippet.title}
    </button>
  </Tooltip>
))}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/terminal/TerminalPanel.tsx
git commit -m "feat: render snippet icons in terminal bar"
```

---

## Chunk 5: Dashboard Snippet Buttons on TaskCard

### Task 10: Update KanbanBoard to load and pass snippets

**Files:**
- Modify: `src/renderer/src/components/board/KanbanBoard.tsx`
- Modify: `src/renderer/src/components/board/KanbanColumn.tsx`

- [ ] **Step 1: Load snippets in KanbanBoard and pass down**

In `src/renderer/src/components/board/KanbanBoard.tsx`:

Add imports:
```typescript
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Task, TaskStatus, Snippet } from '@shared/types'
import { DEFAULT_SNIPPETS } from '@shared/types/settings'
```

Inside the `KanbanBoard` component, after the existing state declarations (around line 58), add:

```typescript
const [snippets, setSnippets] = useState<Snippet[]>(DEFAULT_SNIPPETS)

useEffect(() => {
  async function loadSnippets(): Promise<void> {
    try {
      const settings = await window.api.readSettings()
      if (settings.snippets && settings.snippets.length > 0) {
        setSnippets(settings.snippets)
      }
    } catch {
      // Use defaults
    }
  }
  loadSnippets()
}, [])

const dashboardSnippets = useMemo(
  () => snippets.filter((s) => s.showInDashboard),
  [snippets]
)
```

Then pass `dashboardSnippets` as a prop to `KanbanColumn`:

```tsx
<KanbanColumn
  key={status}
  status={status}
  tasks={tasksByStatus[status] ?? []}
  dashboardSnippets={dashboardSnippets}
  // ... rest of existing props
/>
```

- [ ] **Step 2: Update KanbanColumn to accept and pass dashboardSnippets**

In `src/renderer/src/components/board/KanbanColumn.tsx`:

Add to imports:
```typescript
import type { Task, TaskStatus, Snippet } from '@shared/types'
```

Add to `KanbanColumnProps`:
```typescript
dashboardSnippets?: Snippet[]
```

Add to destructuring:
```typescript
dashboardSnippets = []
```

Pass to `TaskCard` in the `renderTasks` function:

```tsx
<TaskCard
  key={task.id}
  task={task}
  dashboardSnippets={dashboardSnippets}
  // ... rest of existing props
/>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/board/KanbanBoard.tsx src/renderer/src/components/board/KanbanColumn.tsx
git commit -m "feat: load and pass dashboard snippets to task cards"
```

---

### Task 11: Add dashboard snippet buttons to TaskCard

**Files:**
- Modify: `src/renderer/src/components/board/TaskCard.tsx`
- Modify: `src/renderer/src/components/board/TaskCard.module.css`

- [ ] **Step 1: Add footer styles to TaskCard.module.css**

Append to `src/renderer/src/components/board/TaskCard.module.css`:

```css
/* ---- Footer row: snippet buttons + labels ---- */

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border-top: 1px solid var(--border);
  padding-top: var(--space-2);
  margin-top: var(--space-1);
  flex-wrap: wrap;
  overflow: hidden;
  max-height: 30px;
}

.footerSpacer {
  flex: 1;
  min-width: 4px;
}

.snippetBtn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 500;
  font-family: 'SF Mono', 'Fira Code', monospace;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
  transition: background-color 0.1s;
}

.snippetBtn:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.snippetBtnPrimary {
  border-color: rgba(99, 102, 241, 0.3);
  background-color: rgba(99, 102, 241, 0.1);
  color: #818cf8;
}

.snippetBtnPrimary:hover {
  background-color: rgba(99, 102, 241, 0.2);
}

.snippetBtnIcon {
  padding: 2px 5px;
}
```

- [ ] **Step 2: Update TaskCard component**

In `src/renderer/src/components/board/TaskCard.tsx`:

Add imports:
```typescript
import type { Task, TaskStatus, Priority, AgentStatus, Snippet } from '@shared/types'
import { LucideIconByName } from '@renderer/components/terminal/IconPicker'
```

Add to `TaskCardProps`:
```typescript
dashboardSnippets?: Snippet[]
```

Add to destructuring:
```typescript
dashboardSnippets = []
```

Add snippet click handler inside the component:

```typescript
const handleSnippetClick = useCallback(
  (e: React.MouseEvent, snippet: Snippet) => {
    e.stopPropagation()
    const sessionName = `kanban-${task.id}`
    window.api.tmuxSendKeys(sessionName, snippet.command, snippet.pressEnter).catch((err) => {
      console.warn('Failed to send snippet command:', err)
    })
  },
  [task.id]
)
```

Replace the existing `bottomRow` div in the JSX (the labels section) with a conditional footer:

```tsx
{(dashboardSnippets.length > 0 || task.labels.length > 0) && (
  <div className={styles.footer}>
    {dashboardSnippets.slice(0, 4).map((snippet, i) => {
      const iconOnly = snippet.icon && snippet.showIconInDashboard
      return (
        <button
          key={i}
          className={`${styles.snippetBtn} ${i === 0 ? styles.snippetBtnPrimary : ''} ${iconOnly ? styles.snippetBtnIcon : ''}`}
          onClick={(e) => handleSnippetClick(e, snippet)}
          title={`${snippet.title}: ${snippet.command}`}
        >
          {snippet.icon && <LucideIconByName name={snippet.icon} size={12} />}
          {!iconOnly && snippet.title}
        </button>
      )
    })}
    {dashboardSnippets.length > 0 && task.labels.length > 0 && (
      <div className={styles.footerSpacer} />
    )}
    {task.labels.map((label) => (
      <span key={label} className={styles.label}>
        {label}
      </span>
    ))}
  </div>
)}
```

Keep the `TaskCardOverlay` unchanged — it shows labels in the existing `bottomRow` without snippet buttons.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/board/TaskCard.tsx src/renderer/src/components/board/TaskCard.module.css
git commit -m "feat: add dashboard snippet buttons and unified footer to TaskCard"
```

---

### Task 12: Final integration verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Manual smoke test checklist**

If dev server is available (`npm run dev`):
1. Create a task → verify tmux session warms up (check `tmux ls`)
2. Open snippet settings → verify icon picker opens, selects, clears
3. Enable "Show in dashboard" for a snippet → verify it appears on the TaskCard
4. Click a dashboard snippet → verify command is sent to tmux session
5. Verify archived column has no "+" button
6. Verify drag overlay shows labels but no snippets

- [ ] **Step 4: Commit any fixups if needed, then final commit**

```bash
git add <any-fixup-files>
git commit -m "fix: dashboard snippets fixups"
```
