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

  // Persist theme preferences to global settings (~/.familiar/settings.json)
  // Guard: skip the initial render to avoid writing defaults before settings load
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      return // Skip first run (defaults, before settings load)
    }
    const save = async (): Promise<void> => {
      try {
        await window.api.writeGlobalSettings({
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
