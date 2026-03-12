import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_LABEL_COLOR } from '@shared/constants'
import { useProjectLabels } from '@renderer/hooks/useProjectLabels'
import { useDropdownPosition } from '@renderer/hooks/useDropdownPosition'
import styles from './LabelSelect.module.css'

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280'  // gray
]

interface LabelSelectProps {
  taskLabels: string[]
  onToggle: (label: string) => void
}

export function LabelSelect({ taskLabels, onToggle }: LabelSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null)
  const projectLabels = useProjectLabels()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  useDropdownPosition(dropdownRef, open)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as Node
      if (colorPickerRef.current?.contains(target)) return
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false)
        setEditingColor(null)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const saveLabelsToSettings = useCallback(async (labels: LabelConfig[]) => {
    try {
      const settings = await window.api.readSettings()
      settings.labels = labels
      await window.api.writeSettings(settings)
      setProjectLabels(labels)
    } catch {
      // Silently fail
    }
  }, [])

  const handleAddLabel = useCallback(() => {
    const trimmed = newLabelName.trim().toLowerCase()
    if (!trimmed) return

    // Add to project labels if new
    if (!projectLabels.some((l) => l.name === trimmed)) {
      saveLabelsToSettings([...projectLabels, { name: trimmed, color: DEFAULT_LABEL_COLOR }])
    }

    // Toggle it on for the task
    if (!taskLabels.includes(trimmed)) {
      onToggle(trimmed)
    }

    setNewLabelName('')
  }, [newLabelName, projectLabels, taskLabels, onToggle, saveLabelsToSettings])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddLabel()
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    },
    [handleAddLabel]
  )

  const handleColorChange = useCallback(
    (labelName: string, color: string) => {
      const updated = projectLabels.map((l) =>
        l.name === labelName ? { ...l, color } : l
      )
      saveLabelsToSettings(updated)
      setEditingColor(null)
    },
    [projectLabels, saveLabelsToSettings]
  )

  // Filter project labels based on input
  const filtered = newLabelName.trim()
    ? projectLabels.filter((l) =>
        l.name.toLowerCase().includes(newLabelName.trim().toLowerCase())
      )
    : projectLabels

  const showCreateOption =
    newLabelName.trim() &&
    !projectLabels.some((l) => l.name === newLabelName.trim().toLowerCase())

  return (<>
    <div className={styles.wrapper} ref={wrapperRef}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} title="Add label">
        +
      </button>
      {open && (
        <div ref={dropdownRef} className={styles.dropdown}>
          <input
            ref={inputRef}
            className={styles.searchInput}
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or create label..."
          />

          <div className={styles.labelList}>
            {filtered.map((label) => {
              const isActive = taskLabels.includes(label.name)
              return (
                <div key={label.name} className={styles.labelRow}>
                  <button
                    className={`${styles.option} ${isActive ? styles.optionActive : ''}`}
                    onClick={() => onToggle(label.name)}
                  >
                    <span
                      className={styles.dot}
                      style={{ backgroundColor: label.color }}
                    />
                    <span className={styles.labelName}>{label.name}</span>
                    {isActive && <span className={styles.check}>&#x2713;</span>}
                  </button>
                  <button
                    className={styles.colorBtn}
                    style={{ backgroundColor: label.color }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (editingColor === label.name) {
                        setEditingColor(null)
                      } else {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setColorPickerPos({ top: rect.bottom + 4, left: rect.right })
                        setEditingColor(label.name)
                      }
                    }}
                    title="Change color"
                  />
                </div>
              )
            })}

            {showCreateOption && (
              <button className={styles.createOption} onClick={handleAddLabel}>
                <span className={styles.dot} style={{ backgroundColor: DEFAULT_LABEL_COLOR }} />
                Create &ldquo;{newLabelName.trim()}&rdquo;
              </button>
            )}

            {filtered.length === 0 && !showCreateOption && (
              <div className={styles.empty}>No labels</div>
            )}
          </div>
        </div>
      )}
    </div>
    {editingColor && colorPickerPos && (() => {
      const editingLabel = projectLabels.find((l) => l.name === editingColor)
      if (!editingLabel) return null
      return createPortal(
        <div
          ref={colorPickerRef}
          className={styles.colorPicker}
          style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
        >
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`${styles.colorSwatch} ${c === editingLabel.color ? styles.colorSwatchActive : ''}`}
              style={{ backgroundColor: c }}
              onClick={(e) => {
                e.stopPropagation()
                handleColorChange(editingLabel.name, c)
              }}
            />
          ))}
        </div>,
        document.body
      )
    })()}
  </>
  )
}
