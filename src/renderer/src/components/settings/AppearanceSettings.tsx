import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '@renderer/stores/ui-store'
import { getDarkThemes, getLightThemes, getThemePreset, type ThemePreset } from '@shared/themes'

export function AppearanceSettings(): React.JSX.Element {
  const themeMode = useUIStore((s) => s.themeMode)
  const darkTheme = useUIStore((s) => s.darkTheme)
  const lightTheme = useUIStore((s) => s.lightTheme)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  const setDarkTheme = useUIStore((s) => s.setDarkTheme)
  const setLightTheme = useUIStore((s) => s.setLightTheme)

  const darkPreset = getThemePreset(darkTheme)
  const lightPreset = getThemePreset(lightTheme)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={labelStyle}>Mode</div>
          <div style={descStyle}>Follow system appearance or force light/dark</div>
        </div>
        <div style={segmentedControlContainer}>
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              style={themeMode === mode ? segmentedActive : segmentedButton}
              onClick={() => setThemeMode(mode)}
            >
              {mode === 'system' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              ) : mode === 'light' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Dark theme picker */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        ...(themeMode === 'light' ? { opacity: 0.5 } : {})
      }}>
        <div>
          <div style={labelStyle}>Dark Theme</div>
          {themeMode === 'light' && <div style={descStyle}>Used when mode is Dark or System</div>}
        </div>
        <ThemePickerTrigger
          preset={darkPreset}
          themes={getDarkThemes()}
          selectedId={darkTheme}
          onSelect={setDarkTheme}
        />
      </div>

      {/* Light theme picker */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        ...(themeMode === 'dark' ? { opacity: 0.5 } : {})
      }}>
        <div>
          <div style={labelStyle}>Light Theme</div>
          {themeMode === 'dark' && <div style={descStyle}>Used when mode is Light or System</div>}
        </div>
        <ThemePickerTrigger
          preset={lightPreset}
          themes={getLightThemes()}
          selectedId={lightTheme}
          onSelect={setLightTheme}
        />
      </div>
    </div>
  )
}

function ThemePickerTrigger({
  preset,
  themes,
  selectedId,
  onSelect
}: {
  preset: ThemePreset | undefined
  themes: ThemePreset[]
  selectedId: string
  onSelect: (id: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right
      })
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const c = preset?.colors

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: 500
        }}
      >
        {/* Color dots preview */}
        {c && (
          <div style={{ display: 'flex', gap: 2 }}>
            {[c['--bg-primary'], c['--accent'], c['--term-green'], c['--term-red']].map((color, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, border: '1px solid var(--border)' }} />
            ))}
          </div>
        )}
        <span>{preset?.name ?? selectedId}</span>
        {/* Chevron */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 500,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
            padding: 8,
            borderRadius: 8,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {themes.map((t) => (
            <MiniThemeCard
              key={t.id}
              preset={t}
              selected={selectedId === t.id}
              onClick={() => {
                onSelect(t.id)
                setOpen(false)
              }}
            />
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function MiniThemeCard({
  preset,
  selected,
  onClick
}: {
  preset: ThemePreset
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  const c = preset.colors

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: selected ? `2px solid ${c['--accent']}` : '2px solid transparent',
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        background: c['--bg-primary'],
        padding: 0,
        textAlign: 'left',
        transition: 'border-color 0.15s ease',
        outline: 'none',
        width: 180
      }}
    >
      {/* Compact terminal preview */}
      <div style={{
        padding: '6px 8px',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 8,
        lineHeight: 1.4,
        backgroundColor: c['--bg-primary'],
        display: 'flex',
        flexDirection: 'column',
        gap: 0
      }}>
        <div>
          <span style={{ color: c['--term-green'] }}>$</span>
          <span style={{ color: c['--text-primary'] }}> npm test</span>
        </div>
        <div style={{ color: c['--term-green'] }}>PASS auth.test</div>
        <div style={{ color: c['--term-red'] }}>FAIL db.test</div>
      </div>

      {/* Footer: name + color dots */}
      <div style={{
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: c['--bg-surface'],
        borderTop: `1px solid ${c['--border']}`
      }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: c['--text-primary'] }}>
          {preset.name}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[c['--accent'], c['--term-red'], c['--term-green'], c['--term-yellow'], c['--term-cyan']].map((color, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
          ))}
        </div>
      </div>
    </button>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-primary)'
}

const descStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-tertiary)',
  marginTop: 2
}

const segmentedControlContainer: React.CSSProperties = {
  display: 'inline-flex',
  borderRadius: 6,
  border: '1px solid var(--border)',
  overflow: 'hidden',
  backgroundColor: 'var(--bg-surface)',
  flexShrink: 0
}

const segmentedBase: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  transition: 'background-color 0.15s ease, color 0.15s ease'
}

const segmentedButton: React.CSSProperties = {
  ...segmentedBase
}

const segmentedActive: React.CSSProperties = {
  ...segmentedBase,
  backgroundColor: 'var(--accent)',
  color: '#ffffff'
}
