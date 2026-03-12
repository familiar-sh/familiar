import { useState, useCallback, useRef, useEffect } from 'react'
import type { Task, TaskStatus, Priority } from '@shared/types'
import { DEFAULT_LABEL_COLOR } from '@shared/constants'
import { formatRelativeTime } from '@renderer/lib/format-time'
import { Tooltip } from '@renderer/components/common'
import { useTaskStore } from '@renderer/stores/task-store'
import { StatusSelect } from './StatusSelect'
import { PrioritySelect } from './PrioritySelect'
import { LabelSelect } from './LabelSelect'
import styles from './TaskDetailHeader.module.css'

interface TaskDetailHeaderProps {
  task: Task
  onUpdate: (updates: Partial<Task>) => void
  onClose: () => void
}

export function TaskDetailHeader({ task, onUpdate, onClose }: TaskDetailHeaderProps): React.JSX.Element {
  const [_editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(task.title)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const projectLabels = useTaskStore((s) => s.projectState?.labels ?? [])

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

  const handleToggleLabel = useCallback(
    (label: string) => {
      if (task.labels.includes(label)) {
        onUpdate({ labels: task.labels.filter((l) => l !== label) })
      } else {
        onUpdate({ labels: [...task.labels, label] })
      }
    },
    [onUpdate, task.labels]
  )

  const getLabelColor = useCallback(
    (name: string): string => {
      const config = projectLabels.find((l) => l.name === name)
      return config?.color ?? DEFAULT_LABEL_COLOR
    },
    [projectLabels]
  )

  return (
    <div className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.timestamps}>
          <span>Created {formatRelativeTime(task.createdAt)}</span>
          <span>Updated {formatRelativeTime(task.updatedAt)}</span>
        </div>
        <div className={styles.topBarActions}>
          <Tooltip placement="bottom" content="Open task folder in Finder">
            <button
              className={styles.closeButton}
              onClick={() => {
                window.api
                  .getProjectRoot()
                  .then((root) =>
                    window.api.openPath(`${root}/.kanban-agent/tasks/${task.id}`)
                  )
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 3.5C2 2.67 2.67 2 3.5 2H6l1.5 1.5H12.5C13.33 3.5 14 4.17 14 5v7.5c0 .83-.67 1.5-1.5 1.5h-9C2.67 14 2 13.33 2 12.5v-9z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" content="Back to dashboard (Esc)">
            <button className={styles.closeButton} onClick={onClose}>
              &#x2715;
            </button>
          </Tooltip>
        </div>
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
              <span
                key={label}
                className={styles.label}
                style={{
                  backgroundColor: `${getLabelColor(label)}20`,
                  borderColor: `${getLabelColor(label)}40`,
                  color: getLabelColor(label)
                }}
              >
                {label}
                <button
                  className={styles.labelRemove}
                  onClick={() => handleToggleLabel(label)}
                  style={{ color: getLabelColor(label) }}
                >
                  &#x2715;
                </button>
              </span>
            ))}
            <LabelSelect taskLabels={task.labels} onToggle={handleToggleLabel} />
          </div>
        </div>
      </div>
    </div>
  )
}
