import { useState, useCallback, useRef, useEffect } from 'react'
import type { Task, TaskStatus, Priority } from '@shared/types'
import { formatRelativeTime } from '@renderer/lib/format-time'
import { Tooltip } from '@renderer/components/common'
import { StatusSelect } from './StatusSelect'
import { PrioritySelect } from './PrioritySelect'
import styles from './TaskDetailHeader.module.css'

interface TaskDetailHeaderProps {
  task: Task
  onUpdate: (updates: Partial<Task>) => void
  onClose: () => void
}

export function TaskDetailHeader({ task, onUpdate, onClose }: TaskDetailHeaderProps): React.JSX.Element {
  const [_editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(task.title)
  const [addingLabel, setAddingLabel] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)

  const resizeTitleTextarea = useCallback(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  useEffect(() => {
    resizeTitleTextarea()
  }, [titleValue, resizeTitleTextarea])

  const handleTitleSubmit = useCallback(() => {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed })
    } else {
      setTitleValue(task.title)
    }
    setEditingTitle(false)
  }, [titleValue, task.title, onUpdate])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleTitleSubmit()
      } else if (e.key === 'Escape') {
        setTitleValue(task.title)
        setEditingTitle(false)
      }
    },
    [handleTitleSubmit, task.title]
  )

  const handleStatusChange = useCallback(
    (status: TaskStatus) => {
      onUpdate({ status })
    },
    [onUpdate]
  )

  const handlePriorityChange = useCallback(
    (priority: Priority) => {
      onUpdate({ priority })
    },
    [onUpdate]
  )

  const handleRemoveLabel = useCallback(
    (label: string) => {
      onUpdate({ labels: task.labels.filter((l) => l !== label) })
    },
    [onUpdate, task.labels]
  )

  const handleAddLabel = useCallback(() => {
    const trimmed = newLabel.trim()
    if (trimmed && !task.labels.includes(trimmed)) {
      onUpdate({ labels: [...task.labels, trimmed] })
    }
    setNewLabel('')
    setAddingLabel(false)
  }, [newLabel, task.labels, onUpdate])

  const handleAddLabelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddLabel()
      } else if (e.key === 'Escape') {
        setNewLabel('')
        setAddingLabel(false)
      }
    },
    [handleAddLabel]
  )

  return (
    <div className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.timestamps}>
          <span>Created {formatRelativeTime(task.createdAt)}</span>
          <span>Updated {formatRelativeTime(task.updatedAt)}</span>
        </div>
        <Tooltip placement="bottom" content="Back to dashboard (Esc)">
          <button className={styles.closeButton} onClick={onClose}>
            &#x2715;
          </button>
        </Tooltip>
      </div>

      <div className={styles.titleRow}>
        <textarea
          ref={titleRef}
          className={styles.titleInput}
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onFocus={() => setEditingTitle(true)}
          onBlur={handleTitleSubmit}
          onKeyDown={handleTitleKeyDown}
          spellCheck={false}
          rows={1}
        />
      </div>

      <div className={styles.metaRow}>
        <div className={styles.metaGroup}>
          <span className={styles.metaLabel}>Status</span>
          <StatusSelect value={task.status} onChange={handleStatusChange} />
        </div>

        <div className={styles.separator} />

        <div className={styles.metaGroup}>
          <span className={styles.metaLabel}>Priority</span>
          <PrioritySelect value={task.priority} onChange={handlePriorityChange} />
        </div>

        <div className={styles.separator} />

        <div className={styles.metaGroup}>
          <span className={styles.metaLabel}>Labels</span>
          <div className={styles.labelsSection}>
            {task.labels.map((label) => (
              <span key={label} className={styles.label}>
                {label}
                <button className={styles.labelRemove} onClick={() => handleRemoveLabel(label)}>
                  &#x2715;
                </button>
              </span>
            ))}
            {addingLabel ? (
              <input
                ref={labelInputRef}
                className={styles.addLabelInput}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onBlur={handleAddLabel}
                onKeyDown={handleAddLabelKeyDown}
                autoFocus
                placeholder="Label name"
              />
            ) : (
              <button
                className={styles.addLabelButton}
                onClick={() => setAddingLabel(true)}
                title="Add label"
              >
                +
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
