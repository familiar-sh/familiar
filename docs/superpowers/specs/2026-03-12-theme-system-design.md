# Theme System Design

## Overview

Add a light/dark theme system to Familiar with 8 preset themes (4 dark, 4 light), a three-state mode toggle (System / Light / Dark), and theme selection UI in both the navbar and settings page.

## Mode Toggle

Three-state: **System** (default), **Light**, **Dark**.

- **System** follows macOS appearance via `matchMedia('(prefers-color-scheme: dark)')` and listens for real-time changes.
- User's choice persists in `.familiar/settings.json`.

## Theme Presets

### Dark Themes

| Name | Base | Background | Surface | Accent | Text |
|------|------|-----------|---------|--------|------|
| Familiar Dark (default) | Current app theme | `#12121a` | `#1a1a27` | `#5e6ad2` | `#f0f0f4` |
| Dracula | dracula-theme.com | `#282a36` | `#343746` | `#bd93f9` | `#f8f8f2` |
| GitHub Dark | GitHub | `#0d1117` | `#161b22` | `#58a6ff` | `#c9d1d9` |
| Nord | nordtheme.com | `#2e3440` | `#3b4252` | `#88c0d0` | `#d8dee9` |

### Light Themes

| Name | Base | Background | Surface | Accent | Text |
|------|------|-----------|---------|--------|------|
| Familiar Light (default) | One Light / Atom | `#fafafa` | `#f0f0f1` | `#4078f2` | `#383a42` |
| Solarized Light | Solarized | `#fdf6e3` | `#eee8d5` | `#268bd2` | `#657b83` |
| GitHub Light | GitHub | `#ffffff` | `#f6f8fa` | `#0366d6` | `#24292e` |
| Catppuccin Latte | Catppuccin | `#eff1f5` | `#e6e9ef` | `#8839ef` | `#4c4f69` |

Each preset defines a complete set of ALL CSS custom properties (~40+): backgrounds (deepest, primary, surface, elevated), text (primary, secondary, tertiary), accent (base, hover, active, subtle), status colors, priority colors, agent status colors, border/separator colors, shadows, overlay colors, and ANSI terminal colors (black, red, green, yellow, blue, magenta, cyan, white + bright variants). The summary tables above show representative values only.

## UI

### Navbar Toggle

A sun/moon icon button placed immediately left of the settings gear icon. Click cycles: System → Light → Dark → System. Tooltip shows current mode name (e.g., "Theme: System").

Icon states:
- **System**: monitor/display icon
- **Light**: sun icon
- **Dark**: moon icon

### Settings Page — Appearance Section

New "Appearance" section at the top of the settings page, above the existing "Terminal" section. Contains:

1. **Mode** — segmented control: System | Light | Dark
2. **Dark Theme** — 2x2 grid of theme preview cards. Each card shows:
   - Mini task card (status circle, title, labels, status badge, agent status)
   - Mini terminal output (prompt, command, success, error, warning)
   - Footer with theme name + row of color dots (accent, red, green, yellow, magenta, cyan)
   - Selected theme has accent-colored border
3. **Light Theme** — same 2x2 grid layout

When in forced "Dark" mode, the Light Theme grid is visually dimmed with reduced opacity and a "Used when mode is Light or System" subtitle. Vice versa for forced "Light" mode. Both grids are always interactive so the user can pre-select their preference.

## State Management

### ui-store.ts additions

```typescript
// New state
themeMode: 'system' | 'light' | 'dark'  // default: 'system'
darkTheme: string   // default: 'familiar-dark'
lightTheme: string  // default: 'familiar-light'

// Derived (not stored, computed)
resolvedTheme: string  // e.g., 'familiar-dark', 'dracula', 'github-light', etc.

// New actions
setThemeMode: (mode: 'system' | 'light' | 'dark') => void
setDarkTheme: (themeId: string) => void
setLightTheme: (themeId: string) => void
cycleThemeMode: () => void  // for navbar button: system → light → dark → system
```

### ProjectSettings type extension

Extend `ProjectSettings` in `src/shared/types/settings.ts` with:

```typescript
themeMode?: 'system' | 'light' | 'dark'
darkTheme?: string
lightTheme?: string
```

All fields optional for backwards compatibility — existing `settings.json` files without these fields default to `system` / `familiar-dark` / `familiar-light`.

### Persistence

Theme preferences saved to `.familiar/settings.json` via existing settings IPC. On load, read from settings and apply before first render (see FOUC Prevention below).

## FOUC Prevention (Flash of Unstyled Content)

To avoid a visible flash when the user's preference differs from the `:root` defaults:

1. In the **preload script** (`src/preload/index.ts`), read `.familiar/settings.json` synchronously via `fs.readFileSync` before the renderer loads.
2. Set `document.documentElement.dataset.theme` to the resolved theme ID immediately.
3. For "system" mode, check `window.matchMedia('(prefers-color-scheme: dark)')` to resolve which theme to apply.

This synchronous read must happen at the **top-level scope** of the preload module (before `contextBridge.exposeInMainWorld` calls), not inside an exposed API function, since the DOM is accessible at preload execution time. The preload has Node.js access because electron-vite configures `sandbox: false` for preload scripts by default.

## CSS Architecture

### Theme Application

Themes applied by setting `data-theme` attribute on `document.documentElement`. The `applyTheme(themeId)` JS utility function sets this attribute, which activates the corresponding CSS selector block.

```html
<html data-theme="familiar-dark">
```

### CSS Structure

Current `:root` variables remain as dark defaults for safety/fallback. Each theme is defined as a `[data-theme="<id>"]` selector block in a new `themes.css` file that overrides all CSS custom properties.

### Terminal Theme — Live Updates

The current `Terminal.tsx` reads CSS custom properties **once at mount** via `getComputedStyle` and passes them as a static `theme` object to `new XTerm()`. Terminals will NOT auto-update on theme change.

**Solution:** Add a `MutationObserver` on `document.documentElement` watching for `data-theme` attribute changes. When detected, re-read all CSS variables and call `term.options.theme = { ... }` to update the xterm instance in-place without recreating it. If the WebGL addon is loaded, call `webglAddon.clearTextureAtlas()` after setting the new theme to force the WebGL renderer to re-render with updated colors. Each theme preset includes ANSI color mappings as CSS variables (`--term-black`, `--term-red`, etc.).

**Terminal hardcoded ANSI colors:** The current `Terminal.tsx` also has 8 hardcoded hex values for ANSI colors not backed by CSS variables (`magenta: '#b07cd8'`, `cyan: '#56b6c2'`, `brightRed: '#ff6b6b'`, etc.). These must be converted to `--term-*` CSS variables so they respond to theme changes.

### BlockNote Editor

Change `theme="dark"` to `theme={isDark ? "dark" : "light"}` where `isDark` is derived from the resolved theme's `type` field via a Zustand selector (e.g., `useUIStore(s => s.resolvedThemeType === 'dark')`).

### Hardcoded Colors — Full Audit

The following files contain hardcoded color values that must be converted to CSS custom properties or theme-aware values:

**CSS Module files:**
- `AgentSwapWidget.module.css`: `#5e6ad2`, `#e74c3c`, `#e89b3e` (agent status dots)
- `Navbar.module.css`: `#e74c3c`, `#fff`, `#4caf50` (notification badge, text)
- `TaskCard.module.css`: ~15 colors including `#f2994a`, `#fff`, `#818cf8`, `#27ae60`, plus `rgba(255,255,255,...)` hover overlays
- `global.css`: `[cmdk-*]` selectors with `#5c5c6e`, `rgba(94,106,210,...)`, `#2a2a3c`

**TSX inline styles:**
- `TaskCard.tsx`: 4 agent status colors
- `CommandPalette.tsx`: ~15 colors (status, borders, backgrounds, text)
- `TerminalPanel.tsx`: `#5c5c6e`, `#e74c3c`, `#8e8ea0`
- `TerminalTabs.tsx`: `#0d0d12`, `#2a2a3c`, `#8e8ea0`
- `SnippetSettings.tsx`: `rgba(99,102,241,...)`, `#818cf8`
- `SettingsPage.tsx`: `rgba(99,102,241,...)`, `#818cf8`
- `ErrorBoundary.tsx`: `#fff`
- `ContextMenu.tsx`: ~7 colors (`#1a1a27`, `#2a2a3c`, `#f0f0f4`, `#e74c3c`, `#8e8ea0`, `#5c5c6e`) plus overlays
- `AgentStatusBadge.tsx`: 5 colors (`#5c5c6e`, `#5e6ad2`, `#27ae60`, `#e74c3c`, `#8e8ea0`)
- `PriorityIcon.tsx`: 6+ colors for priority bars/icons
- `EmptyState.tsx`: 4 colors (`#5c5c6e`, `#f0f0f4`, `#8e8ea0`, `#5e6ad2`)
- `LoadingSpinner.tsx`: 2 colors
- `SnippetSettingsModal.tsx`: 8+ values including `rgba(99,102,241,...)`, `#818cf8`, `#e74c3c`
- `IconPicker.tsx`: `rgba(255,255,255,0.03)`
- `Tooltip.tsx`: `rgba(255,255,255,0.05)` in box-shadow
- `LabelSelect.module.css`: `rgba(255,255,255,0.15)` overlay

**Out of scope:** `LabelSelect.tsx` has a hardcoded palette of 9 user-facing label colors. These are intentional design choices, not theme-dependent values.

**Strategy:** Convert all hardcoded values to existing or new CSS custom properties. For inline styles in TSX, use `var(--property-name)` string values (e.g., `style={{ color: 'var(--text-primary)' }}`). For SVG `fill` attributes in JSX (e.g., `PriorityIcon.tsx`), use `style={{ fill: 'var(--priority-urgent)' }}` instead of the `fill` prop, since SVG attribute props don't support CSS `var()` but inline styles do.

### White-based RGBA Overlays

Multiple files use `rgba(255, 255, 255, 0.06)` for hover states and subtle backgrounds. These are invisible on light backgrounds. Add theme-aware overlay variables:

```css
/* Dark themes */
--overlay-faint: rgba(255, 255, 255, 0.02);
--overlay-subtle: rgba(255, 255, 255, 0.05);
--overlay-hover: rgba(255, 255, 255, 0.08);
--overlay-emphasis: rgba(255, 255, 255, 0.15);

/* Light themes override to: */
--overlay-faint: rgba(0, 0, 0, 0.02);
--overlay-subtle: rgba(0, 0, 0, 0.04);
--overlay-hover: rgba(0, 0, 0, 0.07);
--overlay-emphasis: rgba(0, 0, 0, 0.12);
```

### Shadow Values

`--shadow-sm/md/lg` use `rgba(0, 0, 0, 0.3-0.5)`. These are too heavy on light backgrounds. Each theme preset should include shadow overrides — lighter shadows for light themes (e.g., `rgba(0, 0, 0, 0.08-0.15)`).

### Priority Colors in constants.ts

`PRIORITY_COLORS` in `src/shared/constants.ts` has hardcoded hex values used for inline styles. These should be replaced with CSS variable references or removed in favor of the CSS custom properties already defined in `global.css`.

## Theme Data Structure

Each theme preset is a plain object in a new `src/shared/themes.ts` constants file:

```typescript
interface ThemePreset {
  id: string
  name: string
  type: 'dark' | 'light'
  colors: Record<string, string>  // CSS variable name → value (all ~40+ vars)
}
```

The `colors` record maps every CSS custom property name to its value for that theme. This is the source of truth — the `themes.css` file is generated from or mirrors these values.

## Not In Scope

- Custom user-defined themes
- Per-task themes
- Theme transition animations (instant switch)
- Import/export themes
- Theme API for plugins
- Command palette theme commands (future enhancement)
- CLI awareness of theme settings (CLI ignores theme fields in settings.json)
