import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import type { ProjectSettings } from './settings'

describe('ProjectSettings', () => {
  it('DEFAULT_SETTINGS includes theme defaults', () => {
    expect(DEFAULT_SETTINGS.themeMode).toBe('system')
    expect(DEFAULT_SETTINGS.darkTheme).toBe('familiar-dark')
    expect(DEFAULT_SETTINGS.lightTheme).toBe('familiar-light')
  })

  it('DEFAULT_SETTINGS has simplifyTaskTitles enabled by default', () => {
    expect(DEFAULT_SETTINGS.simplifyTaskTitles).toBe(true)
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
