import { useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { LabelConfig } from '@shared/types'
import { DEFAULT_LABEL_COLOR } from '@shared/constants'

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280' // gray
]

interface LabelSettingsProps {
  labels: LabelConfig[]
  onChange: (labels: LabelConfig[]) => void
}

export function LabelSettings({ labels, onChange }: LabelSettingsProps): React.JSX.Element {
  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null)
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  const handleChange = useCallback(
    (index: number, field: keyof LabelConfig, value: string) => {
      const next = [...labels]
      next[index] = { ...next[index], [field]: value }
      onChange(next)
    },
    [labels, onChange]
  )

  const handleAdd = useCallback(() => {
    onChange([...labels, { name: '', color: DEFAULT_LABEL_COLOR, description: '' }])
  }, [labels, onChange])

  const handleRemove = useCallback(
    (index: number) => {
      onChange(labels.filter((_, i) => i !== index))
      setColorPickerIndex(null)
    },
    [labels, onChange]
  )

  const handleColorSelect = useCallback(
    (index: number, color: string) => {
      const next = [...labels]
      next[index] = { ...next[index], color }
      onChange(next)
      setColorPickerIndex(null)
    },
    [labels, onChange]
  )

  return (
    <div style={styles.wrapper}>
      {labels.map((label, i) => (
        <div key={i} style={styles.labelRow}>
          <button
            style={{ ...styles.colorDot, backgroundColor: label.color }}
            onClick={(e) => {
              if (colorPickerIndex === i) {
                setColorPickerIndex(null)
              } else {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setColorPickerPos({ top: rect.bottom + 4, left: rect.left })
                setColorPickerIndex(i)
              }
            }}
            title="Change color"
          />
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="Label name"
            value={label.name}
            onChange={(e) => handleChange(i, 'name', e.target.value.toLowerCase())}
          />
          <input
            style={{ ...styles.input, flex: 2 }}
            placeholder="Description (optional)"
            value={label.description ?? ''}
            onChange={(e) => handleChange(i, 'description', e.target.value)}
          />
          <button style={styles.removeButton} onClick={() => handleRemove(i)} title="Remove">
            &times;
          </button>
        </div>
      ))}

      <button style={styles.addButton} onClick={handleAdd}>
        + Add Label
      </button>

      {colorPickerIndex !== null && colorPickerPos && createPortal(
        <div
          ref={colorPickerRef}
          style={{ ...styles.colorPicker, top: colorPickerPos.top, left: colorPickerPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              style={{
                ...styles.colorSwatch,
                backgroundColor: c,
                ...(c === labels[colorPickerIndex]?.color ? styles.colorSwatchActive : {})
              }}
              onClick={() => handleColorSelect(colorPickerIndex, c)}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  labelRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.15)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    transition: 'transform 0.1s ease'
  },
  input: {
    padding: '6px 10px',
    fontSize: '12px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none'
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
  colorPicker: {
    position: 'fixed',
    zIndex: 1000,
    display: 'flex',
    gap: '4px',
    padding: '6px',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    flexWrap: 'wrap',
    width: '130px'
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid transparent',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.1s ease'
  },
  colorSwatchActive: {
    borderColor: 'var(--text-primary)'
  }
}
