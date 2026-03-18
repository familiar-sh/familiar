import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_GLOBAL_SETTINGS } from './settings'
import type { GlobalSettings } from './settings'

describe('ProjectSettings', () => {
  it('DEFAULT_SETTINGS has simplifyTaskTitles enabled by default', () => {
    expect(DEFAULT_SETTINGS.simplifyTaskTitles).toBe(true)
  })
})

describe('GlobalSettings', () => {
  it('DEFAULT_GLOBAL_SETTINGS includes theme defaults', () => {
    expect(DEFAULT_GLOBAL_SETTINGS.themeMode).toBe('system')
    expect(DEFAULT_GLOBAL_SETTINGS.darkTheme).toBe('familiar-dark')
    expect(DEFAULT_GLOBAL_SETTINGS.lightTheme).toBe('familiar-light')
  })

  it('allows all three theme modes', () => {
    const settings: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      themeMode: 'light'
    }
    expect(settings.themeMode).toBe('light')
    settings.themeMode = 'dark'
    expect(settings.themeMode).toBe('dark')
    settings.themeMode = 'system'
    expect(settings.themeMode).toBe('system')
  })
})
