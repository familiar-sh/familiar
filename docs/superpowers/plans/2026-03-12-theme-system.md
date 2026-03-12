# Theme System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete light/dark theme system with 8 preset themes, three-state mode toggle, and theme picker UI.

**Architecture:** Theme presets defined as CSS variable maps in `src/shared/themes.ts`. Applied via `data-theme` attribute on `<html>`. Zustand store manages mode/theme selection, persisted to settings.json. FOUC prevented by main process injecting theme before window shows. Terminal updates in-place via MutationObserver.

**Note on line numbers:** Line numbers are approximate anchors. Use surrounding code context (function names, variable names) to locate the exact insertion points.

**Tech Stack:** React 19, Zustand, CSS custom properties, xterm.js theme API, BlockNote theme prop, Electron preload.

**Spec:** `docs/superpowers/specs/2026-03-12-theme-system-design.md`

---

## Chunk 1: Theme Data Layer

### Task 1: Extend ProjectSettings type with theme fields

**Files:**
- Modify: `src/shared/types/settings.ts:18-33`

- [ ] **Step 1: Write the test**

Create `src/shared/types/settings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import type { ProjectSettings } from './settings'

describe('ProjectSettings', () => {
  it('DEFAULT_SETTINGS includes theme defaults', () => {
    expect(DEFAULT_SETTINGS.themeMode).toBe('system')
    expect(DEFAULT_SETTINGS.darkTheme).toBe('familiar-dark')
    expect(DEFAULT_SETTINGS.lightTheme).toBe('familiar-light')
  })

  it('allows all three theme modes', () => {
    const settings: ProjectSettings = {
      ...DEFAULT_SETTINGS,
      themeMode: 'light'
    }
    expect(settings.themeMode).toBe('light')
    settings.themeMode = 'dark'
    expect(settings.themeMode).toBe('dark')
    settings.themeMode = 'system'
    expect(settings.themeMode).toBe('system')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/types/settings.test.ts`
Expected: FAIL — `themeMode` does not exist on type

- [ ] **Step 3: Add theme fields to ProjectSettings and DEFAULT_SETTINGS**

In `src/shared/types/settings.ts`, add to `ProjectSettings` interface (after line 22):

```typescript
  /** Theme mode: system follows OS, or force light/dark */
  themeMode?: 'system' | 'light' | 'dark'
  /** Selected dark theme preset ID */
  darkTheme?: string
  /** Selected light theme preset ID */
  lightTheme?: string
```

Update `DEFAULT_SETTINGS` (after line 32):

```typescript
export const DEFAULT_SETTINGS: ProjectSettings = {
  defaultCommand:
    'claude --dangerously-skip-permissions --resume $FAMILIAR_TASK_ID',
  snippets: DEFAULT_SNIPPETS,
  themeMode: 'system',
  darkTheme: 'familiar-dark',
  lightTheme: 'familiar-light'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/types/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/settings.ts src/shared/types/settings.test.ts
git commit -m "feat: add theme fields to ProjectSettings"
```

---

### Task 2: Create theme presets data

**Files:**
- Create: `src/shared/themes.ts`
- Create: `src/shared/themes.test.ts`

- [ ] **Step 1: Write the test**

Create `src/shared/themes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  THEME_PRESETS,
  getThemePreset,
  getDarkThemes,
  getLightThemes,
  type ThemePreset
} from './themes'

describe('themes', () => {
  it('has 8 presets total', () => {
    expect(THEME_PRESETS).toHaveLength(8)
  })

  it('has 4 dark and 4 light themes', () => {
    expect(getDarkThemes()).toHaveLength(4)
    expect(getLightThemes()).toHaveLength(4)
  })

  it('dark themes are in correct order', () => {
    const ids = getDarkThemes().map((t) => t.id)
    expect(ids).toEqual(['familiar-dark', 'dracula', 'github-dark', 'nord'])
  })

  it('light themes are in correct order', () => {
    const ids = getLightThemes().map((t) => t.id)
    expect(ids).toEqual(['familiar-light', 'solarized-light', 'github-light', 'catppuccin-latte'])
  })

  it('getThemePreset returns correct preset', () => {
    const preset = getThemePreset('dracula')
    expect(preset).toBeDefined()
    expect(preset!.name).toBe('Dracula')
    expect(preset!.type).toBe('dark')
  })

  it('getThemePreset returns undefined for unknown id', () => {
    expect(getThemePreset('nonexistent')).toBeUndefined()
  })

  it('every preset has all required CSS variable keys', () => {
    const requiredKeys = [
      '--bg-deepest', '--bg-primary', '--bg-surface', '--bg-elevated',
      '--text-primary', '--text-secondary', '--text-tertiary',
      '--accent', '--accent-hover', '--accent-active', '--accent-subtle',
      '--border', '--border-hover',
      '--overlay-faint', '--overlay-subtle', '--overlay-hover', '--overlay-emphasis',
      '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-focus',
      '--term-black', '--term-red', '--term-green', '--term-yellow',
      '--term-blue', '--term-magenta', '--term-cyan', '--term-white',
      '--term-bright-black', '--term-bright-red', '--term-bright-green',
      '--term-bright-yellow', '--term-bright-blue', '--term-bright-magenta',
      '--term-bright-cyan', '--term-bright-white'
    ]
    for (const preset of THEME_PRESETS) {
      for (const key of requiredKeys) {
        expect(preset.colors, `${preset.id} missing ${key}`).toHaveProperty(key)
      }
    }
  })

  it('every preset has a type field of dark or light', () => {
    for (const preset of THEME_PRESETS) {
      expect(['dark', 'light']).toContain(preset.type)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/themes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create theme presets**

Create `src/shared/themes.ts` with full theme preset data. Each preset must include ALL CSS custom property overrides. The file structure:

```typescript
export interface ThemePreset {
  id: string
  name: string
  type: 'dark' | 'light'
  colors: Record<string, string>
}

export const THEME_PRESETS: ThemePreset[] = [
  // --- DARK THEMES ---
  {
    id: 'familiar-dark',
    name: 'Familiar Dark',
    type: 'dark',
    colors: {
      '--bg-deepest': '#0d0d12',
      '--bg-primary': '#12121a',
      '--bg-surface': '#1a1a27',
      '--bg-elevated': '#232334',
      '--text-primary': '#f0f0f4',
      '--text-secondary': '#8e8ea0',
      '--text-tertiary': '#5c5c6e',
      '--accent': '#5e6ad2',
      '--accent-hover': '#6e7ae2',
      '--accent-active': '#4e5ac2',
      '--accent-subtle': 'rgba(94, 106, 210, 0.15)',
      '--border': '#2a2a3c',
      '--border-hover': '#3a3a50',
      '--overlay-faint': 'rgba(255, 255, 255, 0.02)',
      '--overlay-subtle': 'rgba(255, 255, 255, 0.05)',
      '--overlay-hover': 'rgba(255, 255, 255, 0.08)',
      '--overlay-emphasis': 'rgba(255, 255, 255, 0.15)',
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
      '--shadow-md': '0 2px 8px rgba(0, 0, 0, 0.4)',
      '--shadow-lg': '0 4px 16px rgba(0, 0, 0, 0.5)',
      '--shadow-focus': '0 0 0 2px rgba(94, 106, 210, 0.4)',
      // Terminal ANSI
      '--term-black': '#1a1a27',
      '--term-red': '#e74c3c',
      '--term-green': '#2ecc71',
      '--term-yellow': '#f2994a',
      '--term-blue': '#5e6ad2',
      '--term-magenta': '#b07cd8',
      '--term-cyan': '#56b6c2',
      '--term-white': '#f0f0f4',
      '--term-bright-black': '#5c5c6e',
      '--term-bright-red': '#ff6b6b',
      '--term-bright-green': '#2ecc71',
      '--term-bright-yellow': '#f7dc6f',
      '--term-bright-blue': '#6e7ae2',
      '--term-bright-magenta': '#c49de8',
      '--term-bright-cyan': '#6ec8d4',
      '--term-bright-white': '#ffffff'
    }
  },
  // Dracula, GitHub Dark, Nord — same structure, colors from spec mockups
  // --- LIGHT THEMES ---
  // Familiar Light (One Light), Solarized Light, GitHub Light, Catppuccin Latte
  // ... (all 8 presets with complete color maps)
]

export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((t) => t.id === id)
}

export function getDarkThemes(): ThemePreset[] {
  return THEME_PRESETS.filter((t) => t.type === 'dark')
}

export function getLightThemes(): ThemePreset[] {
  return THEME_PRESETS.filter((t) => t.type === 'light')
}
```

**IMPORTANT:** Fill in ALL 8 theme presets with complete color values. Reference the color values from the design spec and the browser mockups. Every preset must include every key listed in the test. The Familiar Dark values come from the current `global.css` `:root` block. Light theme overlay/shadow values use inverted alpha (black instead of white overlays, lighter shadows).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/themes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/themes.ts src/shared/themes.test.ts
git commit -m "feat: add 8 theme presets with complete color maps"
```

---

### Task 3: Create theme application utility

**Files:**
- Create: `src/renderer/src/lib/theme.ts`
- Create: `src/renderer/src/lib/theme.test.ts`

- [ ] **Step 1: Write the test**

Create `src/renderer/src/lib/theme.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyTheme, resolveThemeId, isDarkTheme } from './theme'

describe('theme utilities', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  describe('applyTheme', () => {
    it('sets data-theme attribute on document element', () => {
      applyTheme('dracula')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dracula')
    })
  })

  describe('resolveThemeId', () => {
    it('returns darkTheme when mode is dark', () => {
      expect(resolveThemeId('dark', 'familiar-dark', 'familiar-light', true)).toBe('familiar-dark')
    })

    it('returns lightTheme when mode is light', () => {
      expect(resolveThemeId('light', 'familiar-dark', 'familiar-light', true)).toBe('familiar-light')
    })

    it('returns darkTheme when mode is system and OS prefers dark', () => {
      expect(resolveThemeId('system', 'familiar-dark', 'familiar-light', true)).toBe('familiar-dark')
    })

    it('returns lightTheme when mode is system and OS prefers light', () => {
      expect(resolveThemeId('system', 'familiar-dark', 'familiar-light', false)).toBe('familiar-light')
    })
  })

  describe('isDarkTheme', () => {
    it('returns true for dark theme IDs', () => {
      expect(isDarkTheme('familiar-dark')).toBe(true)
      expect(isDarkTheme('dracula')).toBe(true)
    })

    it('returns false for light theme IDs', () => {
      expect(isDarkTheme('familiar-light')).toBe(false)
      expect(isDarkTheme('solarized-light')).toBe(false)
    })

    it('returns true for unknown IDs (safe fallback)', () => {
      expect(isDarkTheme('unknown')).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/lib/theme.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement theme utilities**

Create `src/renderer/src/lib/theme.ts`:

```typescript
import { getThemePreset } from '@shared/themes'

/**
 * Apply a theme by setting the data-theme attribute.
 * CSS selectors in themes.css will activate the matching variable set.
 */
export function applyTheme(themeId: string): void {
  document.documentElement.setAttribute('data-theme', themeId)
}

/**
 * Resolve which theme ID to use given mode, selections, and OS preference.
 */
export function resolveThemeId(
  mode: 'system' | 'light' | 'dark',
  darkTheme: string,
  lightTheme: string,
  systemPrefersDark: boolean
): string {
  if (mode === 'dark') return darkTheme
  if (mode === 'light') return lightTheme
  return systemPrefersDark ? darkTheme : lightTheme
}

/**
 * Check if a theme ID refers to a dark theme.
 * Falls back to true (dark) for unknown IDs.
 */
export function isDarkTheme(themeId: string): boolean {
  const preset = getThemePreset(themeId)
  return preset ? preset.type === 'dark' : true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/lib/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/theme.ts src/renderer/src/lib/theme.test.ts
git commit -m "feat: add theme application utilities"
```

---

### Task 4: Create themes.css with all theme selector blocks

**Files:**
- Create: `src/renderer/src/styles/themes.css`
- Modify: `src/renderer/src/main.tsx:5-6` (add import)

- [ ] **Step 1: Create themes.css**

Create `src/renderer/src/styles/themes.css`. This file defines `[data-theme="<id>"]` selector blocks for ALL 8 themes. Each block overrides every CSS custom property from `:root`.

Structure:

```css
/* ==========================================================================
   Theme Presets
   Each [data-theme] block overrides all CSS custom properties from :root.
   ========================================================================== */

/* ---- Familiar Dark (matches :root defaults) ---- */
[data-theme="familiar-dark"] {
  --bg-deepest: #0d0d12;
  --bg-primary: #12121a;
  --bg-surface: #1a1a27;
  --bg-elevated: #232334;
  --text-primary: #f0f0f4;
  --text-secondary: #8e8ea0;
  --text-tertiary: #5c5c6e;
  --accent: #5e6ad2;
  --accent-hover: #6e7ae2;
  --accent-active: #4e5ac2;
  --accent-subtle: rgba(94, 106, 210, 0.15);
  --border: #2a2a3c;
  --border-hover: #3a3a50;
  --overlay-faint: rgba(255, 255, 255, 0.02);
  --overlay-subtle: rgba(255, 255, 255, 0.05);
  --overlay-hover: rgba(255, 255, 255, 0.08);
  --overlay-emphasis: rgba(255, 255, 255, 0.15);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-focus: 0 0 0 2px rgba(94, 106, 210, 0.4);
  /* Status — todo and archived must adapt per theme for visibility */
  --status-todo: #f0f0f4;
  --status-in-progress: #5e6ad2;
  --status-in-review: #e89b3e;
  --status-done: #27ae60;
  --status-archived: #6b7280;
  /* Priority — none must adapt per theme for visibility */
  --priority-urgent: #e74c3c;
  --priority-high: #f2994a;
  --priority-medium: #f2c94c;
  --priority-low: #27ae60;
  --priority-none: #5c5c6e;
  /* Agent */
  --agent-idle: #5c5c6e;
  --agent-running: #5e6ad2;
  --agent-done: #27ae60;
  --agent-error: #e74c3c;
  /* Terminal ANSI */
  --term-black: #1a1a27;
  --term-red: #e74c3c;
  --term-green: #2ecc71;
  --term-yellow: #f2994a;
  --term-blue: #5e6ad2;
  --term-magenta: #b07cd8;
  --term-cyan: #56b6c2;
  --term-white: #f0f0f4;
  --term-bright-black: #5c5c6e;
  --term-bright-red: #ff6b6b;
  --term-bright-green: #2ecc71;
  --term-bright-yellow: #f7dc6f;
  --term-bright-blue: #6e7ae2;
  --term-bright-magenta: #c49de8;
  --term-bright-cyan: #6ec8d4;
  --term-bright-white: #ffffff;
}

/* Repeat for: dracula, github-dark, nord, familiar-light, solarized-light, github-light, catppuccin-latte */
/* Use exact color values from src/shared/themes.ts presets */
```

**IMPORTANT:** The CSS values MUST match the JS values in `src/shared/themes.ts` exactly. Copy from the same source. Include ALL variables for every theme. Most status and priority colors stay the same across themes, but `--status-todo` (near-white on dark, near-black on light), `--status-archived`, and `--priority-none` must adapt per theme for visibility. Background, text, accent, border, overlay, shadow, and terminal ANSI colors change per theme.

**Also include** `--status-todo`, `--status-archived`, `--priority-none`, `--agent-idle` in the `ThemePreset.colors` record and the required keys test.

Also add the overlay variables to `global.css` `:root` block (after `--border-hover` line 33):

```css
  /* ---- Overlays ---- */
  --overlay-faint: rgba(255, 255, 255, 0.02);
  --overlay-subtle: rgba(255, 255, 255, 0.05);
  --overlay-hover: rgba(255, 255, 255, 0.08);
  --overlay-emphasis: rgba(255, 255, 255, 0.15);
```

And add terminal ANSI variables to `:root` (after agent status colors, line 53):

```css
  /* ---- Terminal ANSI colors ---- */
  --term-black: #1a1a27;
  --term-red: #e74c3c;
  --term-green: #2ecc71;
  --term-yellow: #f2994a;
  --term-blue: #5e6ad2;
  --term-magenta: #b07cd8;
  --term-cyan: #56b6c2;
  --term-white: #f0f0f4;
  --term-bright-black: #5c5c6e;
  --term-bright-red: #ff6b6b;
  --term-bright-green: #2ecc71;
  --term-bright-yellow: #f7dc6f;
  --term-bright-blue: #6e7ae2;
  --term-bright-magenta: #c49de8;
  --term-bright-cyan: #6ec8d4;
  --term-bright-white: #ffffff;
```

- [ ] **Step 2: Import themes.css in main.tsx**

In `src/renderer/src/main.tsx`, add after the animations.css import:

```typescript
import './styles/themes.css'
```

- [ ] **Step 3: Also update global.css cmdk hardcoded colors to use CSS variables**

Replace hardcoded colors in `global.css` lines 346-374:
- `color: #5c5c6e` → `color: var(--text-tertiary)`
- `rgba(94, 106, 210, 0.15)` → `var(--accent-subtle)`
- `rgba(94, 106, 210, 0.1)` → `var(--overlay-hover)`
- `#2a2a3c` → `var(--border)`

- [ ] **Step 4: Verify app still builds**

Run: `npx vitest run && npm run typecheck`
Expected: All tests pass, no type errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/styles/themes.css src/renderer/src/styles/global.css src/renderer/src/main.tsx
git commit -m "feat: add themes.css with all 8 theme selector blocks"
```

---

## Chunk 2: State Management & Theme Application

### Task 5: Add theme state to ui-store

**Files:**
- Modify: `src/renderer/src/stores/ui-store.ts`
- Modify: `src/renderer/src/stores/ui-store.test.ts` (if exists, else create)

- [ ] **Step 1: Write the test**

Create or update `src/renderer/src/stores/ui-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from './ui-store'

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
})

describe('ui-store theme state', () => {
  beforeEach(() => {
    // Reset store to defaults
    useUIStore.setState({
      themeMode: 'system',
      darkTheme: 'familiar-dark',
      lightTheme: 'familiar-light'
    })
  })

  it('has correct theme defaults', () => {
    const state = useUIStore.getState()
    expect(state.themeMode).toBe('system')
    expect(state.darkTheme).toBe('familiar-dark')
    expect(state.lightTheme).toBe('familiar-light')
  })

  it('setThemeMode updates mode', () => {
    useUIStore.getState().setThemeMode('dark')
    expect(useUIStore.getState().themeMode).toBe('dark')
  })

  it('setDarkTheme updates dark theme', () => {
    useUIStore.getState().setDarkTheme('dracula')
    expect(useUIStore.getState().darkTheme).toBe('dracula')
  })

  it('setLightTheme updates light theme', () => {
    useUIStore.getState().setLightTheme('solarized-light')
    expect(useUIStore.getState().lightTheme).toBe('solarized-light')
  })

  it('cycleThemeMode cycles system → light → dark → system', () => {
    const { cycleThemeMode } = useUIStore.getState()
    expect(useUIStore.getState().themeMode).toBe('system')
    cycleThemeMode()
    expect(useUIStore.getState().themeMode).toBe('light')
    cycleThemeMode()
    expect(useUIStore.getState().themeMode).toBe('dark')
    cycleThemeMode()
    expect(useUIStore.getState().themeMode).toBe('system')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/stores/ui-store.test.ts`
Expected: FAIL — `themeMode` doesn't exist

- [ ] **Step 3: Add theme state and actions to ui-store.ts**

Add to `UIState` interface (after line 25 `settingsOpen`):

```typescript
  // Theme
  themeMode: 'system' | 'light' | 'dark'
  darkTheme: string
  lightTheme: string
```

Add to actions section of interface (after line 45 `closeSettings`):

```typescript
  setThemeMode: (mode: 'system' | 'light' | 'dark') => void
  setDarkTheme: (themeId: string) => void
  setLightTheme: (themeId: string) => void
  cycleThemeMode: () => void
```

Add defaults in store creation (after line 81 `settingsOpen: false`):

```typescript
  // Theme
  themeMode: 'system',
  darkTheme: 'familiar-dark',
  lightTheme: 'familiar-light',
```

Add actions (after `closeSettings` action, line 123):

```typescript
  setThemeMode: (mode) => set({ themeMode: mode }),
  setDarkTheme: (themeId) => set({ darkTheme: themeId }),
  setLightTheme: (themeId) => set({ lightTheme: themeId }),
  cycleThemeMode: () =>
    set((state) => {
      const next = state.themeMode === 'system' ? 'light' : state.themeMode === 'light' ? 'dark' : 'system'
      return { themeMode: next }
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/stores/ui-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/ui-store.ts src/renderer/src/stores/ui-store.test.ts
git commit -m "feat: add theme state and actions to ui-store"
```

---

### Task 6: Add ThemeProvider component (applies theme + syncs settings)

**Files:**
- Create: `src/renderer/src/components/ThemeProvider.tsx`
- Modify: `src/renderer/src/App.tsx` (wrap with ThemeProvider)

- [ ] **Step 1: Create ThemeProvider**

Create `src/renderer/src/components/ThemeProvider.tsx`:

```typescript
import { useEffect, useRef } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import { applyTheme, resolveThemeId } from '@renderer/lib/theme'

/**
 * Listens to theme state changes and applies the resolved theme to the DOM.
 * Also listens for OS color scheme changes when mode is 'system'.
 * Persists theme preferences to settings.json.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const themeMode = useUIStore((s) => s.themeMode)
  const darkTheme = useUIStore((s) => s.darkTheme)
  const lightTheme = useUIStore((s) => s.lightTheme)
  const systemPrefersDarkRef = useRef(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  // Apply theme whenever mode or selections change
  useEffect(() => {
    const resolved = resolveThemeId(themeMode, darkTheme, lightTheme, systemPrefersDarkRef.current)
    applyTheme(resolved)
  }, [themeMode, darkTheme, lightTheme])

  // Listen for OS color scheme changes (only matters in system mode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent): void => {
      systemPrefersDarkRef.current = e.matches
      const state = useUIStore.getState()
      if (state.themeMode === 'system') {
        const resolved = resolveThemeId('system', state.darkTheme, state.lightTheme, e.matches)
        applyTheme(resolved)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Persist theme preferences to settings.json when they change
  // Guard: skip the initial render to avoid writing defaults before settings load
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      return // Skip first run (defaults, before settings load)
    }
    const save = async (): Promise<void> => {
      try {
        const current = await window.api.readSettings()
        await window.api.writeSettings({
          ...current,
          themeMode,
          darkTheme,
          lightTheme
        })
      } catch {
        // Settings save is best-effort
      }
    }
    save()
  }, [themeMode, darkTheme, lightTheme])

  return <>{children}</>
}
```

- [ ] **Step 2: Load theme from settings on App mount**

In `src/renderer/src/App.tsx`, import ThemeProvider and wrap the root:

```typescript
import { ThemeProvider } from './components/ThemeProvider'
```

Wrap the return JSX with `<ThemeProvider>...</ThemeProvider>`.

Also add a `useEffect` that loads theme settings on mount and applies them to the store:

```typescript
useEffect(() => {
  window.api.readSettings().then((settings) => {
    const store = useUIStore.getState()
    if (settings.themeMode) store.setThemeMode(settings.themeMode)
    if (settings.darkTheme) store.setDarkTheme(settings.darkTheme)
    if (settings.lightTheme) store.setLightTheme(settings.lightTheme)
  }).catch(() => { /* use defaults */ })
}, [])
```

- [ ] **Step 3: Verify it compiles and runs**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ThemeProvider.tsx src/renderer/src/App.tsx
git commit -m "feat: add ThemeProvider for theme application and persistence"
```

---

### Task 7: FOUC prevention via main process

**Files:**
- Modify: `src/main/index.ts` (where BrowserWindow is created/shown)

The project root is determined in the main process (via CLI args), not available in the preload. The safest FOUC prevention approach: have the main process read settings.json, resolve the theme ID, and inject it via `webContents.executeJavaScript` before showing the window.

- [ ] **Step 1: Add theme injection before window.show()**

In `src/main/index.ts`, find where the BrowserWindow is created and shown. Before `mainWindow.show()` (or after `ready-to-show` event), add:

```typescript
// FOUC Prevention: apply theme before showing the window
mainWindow.webContents.once('dom-ready', async () => {
  try {
    const settings = await dataService.readSettings()
    const mode = settings.themeMode || 'system'
    const darkTheme = settings.darkTheme || 'familiar-dark'
    const lightTheme = settings.lightTheme || 'familiar-light'

    let themeId: string
    if (mode === 'dark') {
      themeId = darkTheme
    } else if (mode === 'light') {
      themeId = lightTheme
    } else {
      // System mode — check OS preference via nativeTheme
      const { nativeTheme } = require('electron')
      themeId = nativeTheme.shouldUseDarkColors ? darkTheme : lightTheme
    }
    await mainWindow.webContents.executeJavaScript(
      `document.documentElement.setAttribute('data-theme', '${themeId}')`
    )
  } catch {
    // Fallback to familiar-dark
    await mainWindow.webContents.executeJavaScript(
      `document.documentElement.setAttribute('data-theme', 'familiar-dark')`
    )
  }
})
```

If the window uses `show: false` + `ready-to-show`, ensure the theme is injected before `mainWindow.show()`. If using `dom-ready`, the injection happens before first paint.

**Alternative if timing is tricky:** Set `show: false` on the BrowserWindow, listen to `dom-ready`, inject the theme, then call `mainWindow.show()`.

- [ ] **Step 2: Verify no flash on reload**

Run: `npm run dev`, set a light theme in settings, restart — no dark flash should be visible.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: FOUC prevention via main process theme injection"
```

---

## Chunk 3: Terminal & Editor Theme Updates

### Task 8: Update Terminal.tsx to use CSS variables and live-update on theme change

**Files:**
- Modify: `src/renderer/src/components/terminal/Terminal.tsx:26-48,64-70`

- [ ] **Step 1: Update xterm theme to read `--term-*` CSS variables**

Replace the `theme` block in Terminal.tsx (lines 26-48) with:

```typescript
      theme: {
        background: cssVar('--bg-primary'),
        foreground: cssVar('--text-primary'),
        cursor: cssVar('--accent'),
        cursorAccent: cssVar('--bg-primary'),
        selectionBackground: cssVar('--accent-subtle'),
        selectionForeground: cssVar('--text-primary'),
        black: cssVar('--term-black'),
        red: cssVar('--term-red'),
        green: cssVar('--term-green'),
        yellow: cssVar('--term-yellow'),
        blue: cssVar('--term-blue'),
        magenta: cssVar('--term-magenta'),
        cyan: cssVar('--term-cyan'),
        white: cssVar('--term-white'),
        brightBlack: cssVar('--term-bright-black'),
        brightRed: cssVar('--term-bright-red'),
        brightGreen: cssVar('--term-bright-green'),
        brightYellow: cssVar('--term-bright-yellow'),
        brightBlue: cssVar('--term-bright-blue'),
        brightMagenta: cssVar('--term-bright-magenta'),
        brightCyan: cssVar('--term-bright-cyan'),
        brightWhite: cssVar('--term-bright-white')
      },
```

- [ ] **Step 2: Add MutationObserver for live theme updates**

After the `onReady?.()` call (line 172), add:

```typescript
    // Watch for theme changes and update xterm colors in-place
    const webglAddonRef = { current: null as WebglAddon | null }
    // Store webgl addon ref (move the try/catch block to capture it)

    const themeObserver = new MutationObserver(() => {
      const newStyles = getComputedStyle(document.documentElement)
      const v = (name: string): string => newStyles.getPropertyValue(name).trim()
      term.options.theme = {
        background: v('--bg-primary'),
        foreground: v('--text-primary'),
        cursor: v('--accent'),
        cursorAccent: v('--bg-primary'),
        selectionBackground: v('--accent-subtle'),
        selectionForeground: v('--text-primary'),
        black: v('--term-black'),
        red: v('--term-red'),
        green: v('--term-green'),
        yellow: v('--term-yellow'),
        blue: v('--term-blue'),
        magenta: v('--term-magenta'),
        cyan: v('--term-cyan'),
        white: v('--term-white'),
        brightBlack: v('--term-bright-black'),
        brightRed: v('--term-bright-red'),
        brightGreen: v('--term-bright-green'),
        brightYellow: v('--term-bright-yellow'),
        brightBlue: v('--term-bright-blue'),
        brightMagenta: v('--term-bright-magenta'),
        brightCyan: v('--term-bright-cyan'),
        brightWhite: v('--term-bright-white')
      }
      // Clear WebGL texture cache if using WebGL renderer
      try {
        if (webglAddonRef.current) {
          webglAddonRef.current.clearTextureAtlas()
        }
      } catch { /* ignore if not available */ }
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
```

Update the WebGL addon block to capture the reference:

```typescript
    try {
      const webglAddon = new WebglAddon()
      term.loadAddon(webglAddon)
      webglAddonRef.current = webglAddon
    } catch {
      console.warn('WebGL renderer not available, falling back to canvas')
    }
```

Add to the cleanup return: `themeObserver.disconnect()`

- [ ] **Step 3: Verify terminal updates on theme change**

Manual test: Run dev, switch theme, confirm terminal colors update without restart.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/terminal/Terminal.tsx
git commit -m "feat: terminal uses CSS vars and live-updates on theme change"
```

---

### Task 9: Update BlockNote editor to use dynamic theme

**Files:**
- Modify: `src/renderer/src/components/editor/BlockEditor.tsx:103`

- [ ] **Step 1: Make BlockNote theme dynamic**

In `BlockEditor.tsx`, add import:

```typescript
import { useUIStore } from '@renderer/stores/ui-store'
import { resolveThemeId, isDarkTheme } from '@renderer/lib/theme'
```

Inside the component, add:

```typescript
const themeMode = useUIStore((s) => s.themeMode)
const darkTheme = useUIStore((s) => s.darkTheme)
const lightTheme = useUIStore((s) => s.lightTheme)
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const resolvedId = resolveThemeId(themeMode, darkTheme, lightTheme, systemPrefersDark)
const editorTheme = isDarkTheme(resolvedId) ? 'dark' : 'light'
```

Change line 103 from:
```typescript
theme="dark"
```
to:
```typescript
theme={editorTheme}
```

- [ ] **Step 2: Verify editor adapts to theme**

Manual test: Switch to a light theme, confirm BlockNote editor shows light background.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/editor/BlockEditor.tsx
git commit -m "feat: BlockNote editor uses dynamic theme from store"
```

---

## Chunk 4: UI — Navbar Toggle & Settings Appearance Section

### Task 10: Add theme toggle button to Navbar

**Files:**
- Modify: `src/renderer/src/components/layout/Navbar.tsx:134-145`
- Modify: `src/renderer/src/components/layout/Navbar.module.css` (if needed for styles)

- [ ] **Step 1: Add theme cycle button to navbar**

In `Navbar.tsx`, add imports:

```typescript
import { useUIStore } from '@renderer/stores/ui-store'
// (already imported above, just add the theme selectors)
```

Inside the component, add selectors:

```typescript
const themeMode = useUIStore((s) => s.themeMode)
const cycleThemeMode = useUIStore((s) => s.cycleThemeMode)
```

Add the theme toggle button immediately before the settings gear button (before line 135):

```tsx
{/* Theme toggle */}
<button
  className={styles.navButton}
  onClick={cycleThemeMode}
  title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`}
>
  {themeMode === 'system' ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ) : themeMode === 'light' ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )}
</button>
```

- [ ] **Step 2: Verify button appears and cycles through modes**

Manual test: Run dev, click the theme button, see icon change (monitor → sun → moon).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/layout/Navbar.tsx
git commit -m "feat: add theme toggle button to navbar"
```

---

### Task 11: Add Appearance section to Settings page

**Files:**
- Create: `src/renderer/src/components/settings/AppearanceSettings.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx:68-101`

- [ ] **Step 1: Create AppearanceSettings component**

Create `src/renderer/src/components/settings/AppearanceSettings.tsx`. This component renders:
1. Mode segmented control (System | Light | Dark)
2. Dark theme 2x2 grid with preview cards
3. Light theme 2x2 grid with preview cards

Each preview card shows a mini task card + terminal output using the theme's actual colors, plus a row of color dots and the theme name. Selected theme has an accent border.

```typescript
import { useUIStore } from '@renderer/stores/ui-store'
import { getDarkThemes, getLightThemes, type ThemePreset } from '@shared/themes'

export function AppearanceSettings(): React.JSX.Element {
  const themeMode = useUIStore((s) => s.themeMode)
  const darkTheme = useUIStore((s) => s.darkTheme)
  const lightTheme = useUIStore((s) => s.lightTheme)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  const setDarkTheme = useUIStore((s) => s.setDarkTheme)
  const setLightTheme = useUIStore((s) => s.setLightTheme)

  const darkThemes = getDarkThemes()
  const lightThemes = getLightThemes()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Mode selector */}
      <div>
        <div style={labelStyle}>Mode</div>
        <div style={segmentedControlContainer}>
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              style={themeMode === mode ? segmentedActive : segmentedButton}
              onClick={() => setThemeMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Dark theme grid */}
      <div style={themeMode === 'light' ? { opacity: 0.5 } : undefined}>
        <div style={labelStyle}>Dark Theme</div>
        {themeMode === 'light' && (
          <div style={subtitleStyle}>Used when mode is Dark or System</div>
        )}
        <div style={gridStyle}>
          {darkThemes.map((preset) => (
            <ThemePreviewCard
              key={preset.id}
              preset={preset}
              selected={darkTheme === preset.id}
              onClick={() => setDarkTheme(preset.id)}
            />
          ))}
        </div>
      </div>

      {/* Light theme grid */}
      <div style={themeMode === 'dark' ? { opacity: 0.5 } : undefined}>
        <div style={labelStyle}>Light Theme</div>
        {themeMode === 'dark' && (
          <div style={subtitleStyle}>Used when mode is Light or System</div>
        )}
        <div style={gridStyle}>
          {lightThemes.map((preset) => (
            <ThemePreviewCard
              key={preset.id}
              preset={preset}
              selected={lightTheme === preset.id}
              onClick={() => setLightTheme(preset.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

The `ThemePreviewCard` subcomponent renders the mini task card + terminal preview using the preset's color values from `preset.colors`. Build the preview using inline styles with the preset colors (NOT CSS variables, since the preview shows a *different* theme than the currently active one).

Reference the v5 mockup HTML for the exact layout: mini task card with status circle, title, labels, status badge, agent status dot, then a mini terminal block, then a footer with theme name and color dots.

**IMPORTANT:** This is a large component. Keep the preview card as a separate function within the file. Use the exact color values from the preset's `colors` record. The color dots should show: accent, red (term-red), green (term-green), yellow (term-yellow), magenta (term-magenta), cyan (term-cyan).

- [ ] **Step 2: Add AppearanceSettings to SettingsPage**

In `SettingsPage.tsx`, import and add above the Terminal section:

```typescript
import { AppearanceSettings } from './AppearanceSettings'
```

In the body (after line 68, before the Terminal section):

```tsx
{/* Appearance section */}
<div style={styles.section}>
  <h2 style={styles.sectionTitle}>Appearance</h2>
  <AppearanceSettings />
</div>
```

- [ ] **Step 3: Verify appearance section renders correctly**

Manual test: Open Settings, see Appearance section at top with mode control and theme grids.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/AppearanceSettings.tsx src/renderer/src/components/settings/SettingsPage.tsx
git commit -m "feat: add Appearance section with theme picker to Settings"
```

---

## Chunk 5: Hardcoded Color Migration

### Task 12: Convert hardcoded colors to CSS variables

**Files (modify all):**
- `src/renderer/src/components/common/ContextMenu.tsx`
- `src/renderer/src/components/common/AgentStatusBadge.tsx`
- `src/renderer/src/components/common/EmptyState.tsx`
- `src/renderer/src/components/common/LoadingSpinner.tsx`
- `src/renderer/src/components/board/TaskCard.tsx`
- `src/renderer/src/components/board/TaskCard.module.css`
- `src/renderer/src/components/command-palette/CommandPalette.tsx`
- `src/renderer/src/components/terminal/TerminalPanel.tsx`
- `src/renderer/src/components/terminal/TerminalTabs.tsx`
- `src/renderer/src/components/settings/SnippetSettings.tsx`
- `src/renderer/src/components/settings/SettingsPage.tsx` (save button)
- `src/renderer/src/components/terminal/SnippetSettingsModal.tsx`
- `src/renderer/src/components/terminal/IconPicker.tsx`
- `src/renderer/src/components/layout/Navbar.module.css`
- `src/renderer/src/components/layout/AgentSwapWidget.module.css`
- `src/renderer/src/components/common/ErrorBoundary.tsx`
- `src/renderer/src/components/common/PriorityIcon.tsx`
- `src/renderer/src/components/common/Tooltip.tsx`
- `src/shared/constants.ts` (PRIORITY_COLORS)

This is a systematic find-and-replace task. For each file:

1. Find every hardcoded hex color (`#xxx`, `#xxxxxx`) and `rgba(...)` value
2. Replace with the appropriate CSS variable:
   - Background colors → `var(--bg-*)`, `var(--bg-surface)`, etc.
   - Text colors → `var(--text-primary)`, `var(--text-secondary)`, etc.
   - Accent/purple → `var(--accent)`, `var(--accent-subtle)`, etc.
   - Border → `var(--border)`
   - Status colors → `var(--status-*)`, `var(--priority-*)`, `var(--agent-*)`
   - White overlays `rgba(255,255,255,0.0x)` → `var(--overlay-faint/subtle/hover/emphasis)`
   - `#fff` / `#ffffff` → `var(--text-primary)` (or context-dependent)
3. For SVG `fill` attributes in JSX: change from `fill="#hex"` to `style={{ fill: 'var(--priority-urgent)' }}`

**Strategy:** Do this in batches by directory. Test after each batch.

- [ ] **Step 1: Migrate common/ components**

Update `ContextMenu.tsx`, `AgentStatusBadge.tsx`, `EmptyState.tsx`, `LoadingSpinner.tsx`, `ErrorBoundary.tsx`.

- [ ] **Step 2: Migrate board/ components**

Update `TaskCard.tsx` and `TaskCard.module.css`. Replace all `rgba(255,255,255,...)` with overlay vars. Replace agent status hex colors with `var(--agent-*)`.

- [ ] **Step 3: Migrate command-palette/**

Update `CommandPalette.tsx` — replace all inline style hex colors with CSS variables.

- [ ] **Step 4: Migrate terminal/ components**

Update `TerminalPanel.tsx` and `TerminalTabs.tsx`.

- [ ] **Step 5: Migrate settings/ components**

Update `SnippetSettings.tsx`, `SnippetSettingsModal.tsx` (if exists), `SettingsPage.tsx` save button styles.

- [ ] **Step 6: Migrate layout/ CSS modules**

Update `Navbar.module.css` and `AgentSwapWidget.module.css`.

- [ ] **Step 7: Update PRIORITY_COLORS in constants.ts**

Replace hardcoded hex values with CSS variable strings:

```typescript
export const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'var(--priority-urgent)',
  high: 'var(--priority-high)',
  medium: 'var(--priority-medium)',
  low: 'var(--priority-low)',
  none: 'var(--priority-none)'
}
```

Check all consumers of `PRIORITY_COLORS` to ensure they use it in `style` props (not SVG attributes). For SVG `fill` props (e.g., `PriorityIcon.tsx`), change to `style={{ fill: 'var(--priority-urgent)' }}` instead.

**Note:** The current `PRIORITY_COLORS` values (`#f44336`, `#ff9800`, etc.) differ from the CSS variables (`#e74c3c`, `#f2994a`). This change unifies them. Update any tests in `constants.test.ts` that assert hex values — they should accept `var(...)` strings or be removed.

- [ ] **Step 8: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: All pass

- [ ] **Step 9: Manual visual test — switch between all 8 themes**

Verify no broken colors, invisible text, or missing elements in each theme.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: migrate all hardcoded colors to CSS custom properties"
```

---

## Chunk 6: Testing & Polish

### Task 13: Integration tests

**Files:**
- Create: `tests/integration/theme-system.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from '../../src/renderer/src/stores/ui-store'

// Mock matchMedia
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)',
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}))
Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })

describe('Theme system integration', () => {
  beforeEach(() => {
    useUIStore.setState({
      themeMode: 'system',
      darkTheme: 'familiar-dark',
      lightTheme: 'familiar-light'
    })
    document.documentElement.removeAttribute('data-theme')
  })

  it('full cycle: mode changes resolve correct theme', async () => {
    const { resolveThemeId } = await import('../../src/renderer/src/lib/theme')

    // System mode + dark OS = dark theme
    expect(resolveThemeId('system', 'familiar-dark', 'familiar-light', true)).toBe('familiar-dark')

    // System mode + light OS = light theme
    expect(resolveThemeId('system', 'familiar-dark', 'familiar-light', false)).toBe('familiar-light')

    // Force dark
    expect(resolveThemeId('dark', 'dracula', 'familiar-light', false)).toBe('dracula')

    // Force light
    expect(resolveThemeId('light', 'dracula', 'solarized-light', true)).toBe('solarized-light')
  })

  it('theme presets all have unique IDs', async () => {
    const { THEME_PRESETS } = await import('../../src/shared/themes')
    const ids = THEME_PRESETS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: ALL tests pass (existing + new)

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add tests/integration/theme-system.test.ts
git commit -m "test: add theme system integration tests"
```

---

### Task 14: Final verification and cleanup

- [ ] **Step 1: Run full test suite with coverage**

Run: `npm run test:coverage`
Expected: Good coverage on new theme files

- [ ] **Step 2: Visual QA — test all 8 themes**

Switch through all 8 themes and verify:
- Board view: columns, task cards, labels, priority indicators
- Task detail: editor, terminal, split panel
- Settings page: all controls visible and readable
- Command palette: proper colors
- Notifications dropdown: proper colors
- Context menu: proper colors

- [ ] **Step 3: Test system mode**

Set mode to System, change macOS appearance in System Preferences — verify app follows.

- [ ] **Step 4: Test persistence**

Set a non-default theme, quit and relaunch — verify theme persists with no flash.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete theme system with 8 presets and settings UI"
```
