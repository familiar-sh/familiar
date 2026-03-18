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

  it('applyTheme sets data-theme attribute', async () => {
    const { applyTheme } = await import('../../src/renderer/src/lib/theme')
    applyTheme('dracula')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dracula')
  })

  it('store cycle: system → light → dark → system', () => {
    const store = useUIStore.getState()
    expect(store.themeMode).toBe('system')

    store.cycleThemeMode()
    expect(useUIStore.getState().themeMode).toBe('light')

    useUIStore.getState().cycleThemeMode()
    expect(useUIStore.getState().themeMode).toBe('dark')

    useUIStore.getState().cycleThemeMode()
    expect(useUIStore.getState().themeMode).toBe('system')
  })

  it('global settings fields have defaults', async () => {
    const { DEFAULT_GLOBAL_SETTINGS } = await import('../../src/shared/types/settings')
    expect(DEFAULT_GLOBAL_SETTINGS.themeMode).toBe('system')
    expect(DEFAULT_GLOBAL_SETTINGS.darkTheme).toBe('familiar-dark')
    expect(DEFAULT_GLOBAL_SETTINGS.lightTheme).toBe('familiar-light')
  })

  it('store updates atomically when loading global settings', () => {
    // Simulate the settings loading flow that happens on mount
    const store = useUIStore.getState()

    // Start with defaults (as the store would on mount)
    expect(store.themeMode).toBe('system')
    expect(store.darkTheme).toBe('familiar-dark')
    expect(store.lightTheme).toBe('familiar-light')

    // Simulate loading global settings with custom theme
    const settings = {
      themeMode: 'dark' as const,
      darkTheme: 'dracula',
      lightTheme: 'solarized-light'
    }

    if (settings.themeMode) store.setThemeMode(settings.themeMode)
    if (settings.darkTheme) store.setDarkTheme(settings.darkTheme)
    if (settings.lightTheme) store.setLightTheme(settings.lightTheme)

    // All values should be updated
    const updated = useUIStore.getState()
    expect(updated.themeMode).toBe('dark')
    expect(updated.darkTheme).toBe('dracula')
    expect(updated.lightTheme).toBe('solarized-light')
  })

  it('store reflects new theme when switching back to defaults', () => {
    // Set custom theme first
    const store = useUIStore.getState()
    store.setThemeMode('dark')
    store.setDarkTheme('dracula')
    store.setLightTheme('solarized-light')

    // Then load default global settings
    const defaults = {
      themeMode: 'system' as const,
      darkTheme: 'familiar-dark',
      lightTheme: 'familiar-light'
    }

    store.setThemeMode(defaults.themeMode)
    store.setDarkTheme(defaults.darkTheme)
    store.setLightTheme(defaults.lightTheme)

    const updated = useUIStore.getState()
    expect(updated.themeMode).toBe('system')
    expect(updated.darkTheme).toBe('familiar-dark')
    expect(updated.lightTheme).toBe('familiar-light')
  })
})
