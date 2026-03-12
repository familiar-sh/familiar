import { useState, useCallback, useRef } from 'react'
import { Tooltip } from '@renderer/components/common'
import { IconPicker, LucideIconByName } from '@renderer/components/terminal/IconPicker'
import type { Snippet } from '@shared/types'

interface SnippetSettingsProps {
  snippets: Snippet[]
  onChange: (snippets: Snippet[]) => void
}

export function SnippetSettings({ snippets, onChange }: SnippetSettingsProps): React.JSX.Element {
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null)
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<number>>(new Set())
  const iconButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const handleChange = useCallback(
    (index: number, field: keyof Snippet, value: string | boolean) => {
      const next = [...snippets]
      next[index] = { ...next[index], [field]: value }
      onChange(next)
    },
    [snippets, onChange]
  )

  const handleAdd = useCallback(() => {
    onChange([...snippets, { title: '', command: '', pressEnter: true }])
  }, [snippets, onChange])

  const handleRemove = useCallback(
    (index: number) => {
      onChange(snippets.filter((_, i) => i !== index))
      setExpandedAdvanced((prev) => {
        const next = new Set<number>()
        for (const idx of prev) {
          if (idx < index) next.add(idx)
          else if (idx > index) next.add(idx - 1)
        }
        return next
      })
    },
    [snippets, onChange]
  )

  const handleIconSelect = useCallback(
    (index: number, iconName: string) => {
      const next = [...snippets]
      next[index] = { ...next[index], icon: iconName }
      onChange(next)
      setOpenPickerIndex(null)
    },
    [snippets, onChange]
  )

  const handleIconClear = useCallback(
    (index: number) => {
      const next = [...snippets]
      const { icon: _, showIconInDashboard: __, showIconInTerminal: ___, ...rest } = next[index]
      next[index] = rest as Snippet
      onChange(next)
    },
    [snippets, onChange]
  )

  const toggleAdvanced = useCallback((index: number) => {
    setExpandedAdvanced((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  return (
    <div style={styles.wrapper}>
      {snippets.map((snippet, i) => (
        <div key={i} style={styles.snippetBlock}>
          <div style={styles.row}>
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
            <div style={styles.advancedToggle} onClick={() => toggleAdvanced(i)}>
              {expandedAdvanced.has(i) ? '▾' : '▸'} Advanced
            </div>
            <button style={styles.removeButton} onClick={() => handleRemove(i)} title="Remove">
              &times;
            </button>
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
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
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
  iconName: { fontSize: '11px' },
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
    marginLeft: '4px',
    lineHeight: 1,
    flexShrink: 0
  },
  advancedToggle: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    marginLeft: '8px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    userSelect: 'none',
    flexShrink: 0,
    whiteSpace: 'nowrap'
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
  }
}
