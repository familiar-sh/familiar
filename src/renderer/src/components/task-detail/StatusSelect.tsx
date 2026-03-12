import { useState, useRef, useEffect } from 'react'
import type { TaskStatus } from '@shared/types'
import { DEFAULT_COLUMNS, COLUMN_LABELS } from '@shared/constants'
import styles from './StatusSelect.module.css'

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--status-todo)',
  'in-progress': 'var(--status-in-progress)',
  'in-review': 'var(--status-in-review)',
  done: 'var(--status-done)',
  archived: 'var(--status-archived)'
}

interface StatusSelectProps {
  value: TaskStatus
  onChange: (status: TaskStatus) => void
}

export function StatusSelect({ value, onChange }: StatusSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button className={styles.trigger} onClick={() => setOpen(!open)}>
        <span className={styles.dot} style={{ backgroundColor: STATUS_COLORS[value] }} />
        {COLUMN_LABELS[value]}
      </button>
      {open && (
        <div className={styles.dropdown}>
          {DEFAULT_COLUMNS.map((status) => (
            <button
              key={status}
              className={`${styles.option} ${status === value ? styles.optionActive : ''}`}
              onClick={() => {
                onChange(status)
                setOpen(false)
              }}
            >
              <span className={styles.dot} style={{ backgroundColor: STATUS_COLORS[status] }} />
              {COLUMN_LABELS[status]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
