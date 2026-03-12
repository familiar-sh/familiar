import { useState, useRef, useEffect, useCallback } from 'react'
import { DEFAULT_LABEL_COLOR } from '@shared/constants'
import { useTaskStore } from '@renderer/stores/task-store'
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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const projectState = useTaskStore((s) => s.projectState)
  const updateProjectLabels = useTaskStore((s) => s.updateProjectLabels)
  const projectLabels = projectState?.labels ?? []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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

  const handleAddLabel = useCallback(() => {
    const trimmed = newLabelName.trim().toLowerCase()
    if (!trimmed) return

    // Add to project labels if new
    if (!projectLabels.some((l) => l.name === trimmed)) {
      updateProjectLabels([...projectLabels, { name: trimmed, color: DEFAULT_LABEL_COLOR }])
    }

    // Toggle it on for the task
    if (!taskLabels.includes(trimmed)) {
      onToggle(trimmed)
    }

    setNewLabelName('')
  }, [newLabelName, projectLabels, taskLabels, onToggle, updateProjectLabels])

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
      updateProjectLabels(updated)
      setEditingColor(null)
    },
    [projectLabels, updateProjectLabels]
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

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} title="Add label">
        +
      </button>
      {open && (
        <div className={styles.dropdown}>
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
                      setEditingColor(editingColor === label.name ? null : label.name)
                    }}
                    title="Change color"
                  />
                  {editingColor === label.name && (
                    <div className={styles.colorPicker}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`${styles.colorSwatch} ${c === label.color ? styles.colorSwatchActive : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleColorChange(label.name, c)
                          }}
                        />
                      ))}
                    </div>
                  )}
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
  )
}
