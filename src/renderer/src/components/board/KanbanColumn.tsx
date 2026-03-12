import { useState, useCallback, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus, Snippet, TaskPastedFile } from '@shared/types'
import { COLUMN_LABELS } from '@shared/constants'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { ContextMenu } from '@renderer/components/common'
import type { ContextMenuItem } from '@renderer/components/common'
import { isLargePaste, createPastedFileMeta } from '@renderer/lib/paste-utils'
import type { DropIndicator } from './KanbanBoard'
import { TaskCard } from './TaskCard'
import styles from './KanbanColumn.module.css'

/** A pasted image stored in temp, pending task creation */
export interface PendingImage {
  tempPath: string
  fileName: string
  mimeType: string
  dataUrl: string // for preview
}

/** A large pasted text pending task creation */
export interface PendingPastedFile {
  meta: TaskPastedFile
  content: string
}

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  onMultiSelect: (taskId: string, append: boolean) => void
  onCreateTask: (title: string, document?: string, enabledSnippets?: Snippet[], pendingImages?: PendingImage[], pendingPastedFiles?: PendingPastedFile[]) => void
  selectedTaskId?: string | null
  multiSelectedIds?: Set<string>
  draggedTaskId?: string | null
  dropIndicator?: DropIndicator | null
  focusedTaskIndex?: number
  isFocusedColumn?: boolean
  showCreateInput?: boolean
  onCreateInputShown?: () => void
  headerAction?: React.ReactNode
  dashboardSnippets?: Snippet[]
  allSnippets?: Snippet[]
  alwaysShowInput?: boolean
  onInputExit?: () => void
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--status-todo)',
  'in-progress': 'var(--status-in-progress)',
  'in-review': 'var(--status-in-review)',
  done: 'var(--status-done)',
  archived: 'var(--status-archived)'
}

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onMultiSelect,
  onCreateTask,
  selectedTaskId,
  multiSelectedIds,
  draggedTaskId,
  dropIndicator,
  focusedTaskIndex = -1,
  isFocusedColumn = false,
  showCreateInput = false,
  onCreateInputShown,
  headerAction,
  dashboardSnippets = [],
  allSnippets = [],
  alwaysShowInput = false,
  onInputExit
}: KanbanColumnProps): React.JSX.Element {
  const draftKey = `familiar-draft-${status}`
  const [newTaskTitle, setNewTaskTitle] = useState(() => localStorage.getItem(draftKey) ?? '')
  const [isCreating, setIsCreating] = useState(false)
  const [enabledSnippetIndices, setEnabledSnippetIndices] = useState<Set<number>>(() => {
    // All snippets enabled by default
    return new Set(allSnippets.map((_, i) => i))
  })
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [pendingPastedFiles, setPendingPastedFiles] = useState<PendingPastedFile[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const contextMenu = useContextMenu()

  const updateDraft = useCallback(
    (value: string) => {
      setNewTaskTitle(value)
      if (value) {
        localStorage.setItem(draftKey, value)
      } else {
        localStorage.removeItem(draftKey)
      }
    },
    [draftKey]
  )

  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { type: 'column', status }
  })

  const taskIds = tasks.map((t) => t.id)

  // Sync enabled snippet indices when allSnippets length changes
  useEffect(() => {
    setEnabledSnippetIndices(new Set(allSnippets.map((_, i) => i)))
  }, [allSnippets.length])

  const toggleSnippet = useCallback((index: number) => {
    setEnabledSnippetIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Show create input when triggered externally (keyboard shortcut)
  useEffect(() => {
    if (showCreateInput && !isCreating) {
      setIsCreating(true)
      onCreateInputShown?.()
    }
  }, [showCreateInput, isCreating, onCreateInputShown])

  // Auto-focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  // Listen for focus-new-task-input event (triggered by Cmd+N)
  useEffect(() => {
    if (!alwaysShowInput) return
    const handleFocus = (): void => {
      inputRef.current?.focus()
    }
    window.addEventListener('focus-new-task-input', handleFocus)
    return () => window.removeEventListener('focus-new-task-input', handleFocus)
  }, [alwaysShowInput])

  // Listen for focus-column-input event (triggered by ArrowUp from first task)
  useEffect(() => {
    if (!alwaysShowInput && !isCreating) return
    const handleFocusColumn = (e: Event): void => {
      const detail = (e as CustomEvent<{ status: string }>).detail
      if (detail.status === status) {
        inputRef.current?.focus()
      }
    }
    window.addEventListener('focus-column-input', handleFocusColumn)
    return () => window.removeEventListener('focus-column-input', handleFocusColumn)
  }, [alwaysShowInput, isCreating, status])

  const handlePlusClick = useCallback(() => {
    setIsCreating(true)
  }, [])

  const resizeCreateTextarea = useCallback(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  useEffect(() => {
    resizeCreateTextarea()
  }, [newTaskTitle, resizeCreateTextarea])

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // Check for image paste first
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (!blob) continue
          const arrayBuffer = await blob.arrayBuffer()
          const mimeType = item.type
          const tempPath = await window.api.clipboardSaveImage(arrayBuffer, mimeType)
          const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'png'
          const fileName = `paste-${Date.now()}.${ext}`

          // Create data URL for preview
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          )
          const dataUrl = `data:${mimeType};base64,${base64}`

          setPendingImages((prev) => [...prev, { tempPath, fileName, mimeType, dataUrl }])
          return
        }
      }

      // Check for large text paste
      const text = e.clipboardData.getData('text/plain')
      if (text && isLargePaste(text)) {
        e.preventDefault()
        const meta = createPastedFileMeta(text)
        setPendingPastedFiles((prev) => [...prev, { meta, content: text }])
      }
    },
    []
  )

  const removePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && (newTaskTitle.trim() || pendingImages.length > 0 || pendingPastedFiles.length > 0)) {
        e.preventDefault()
        const lines = newTaskTitle.trim().split('\n')
        const title = lines[0].trim() || 'Untitled'
        const document = lines.slice(1).join('\n').trim() || undefined
        const enabled = allSnippets.filter((_, i) => enabledSnippetIndices.has(i))
        onCreateTask(
          title,
          document,
          enabled.length > 0 ? enabled : undefined,
          pendingImages.length > 0 ? pendingImages : undefined,
          pendingPastedFiles.length > 0 ? pendingPastedFiles : undefined
        )
        updateDraft('')
        setPendingImages([])
        setPendingPastedFiles([])
      }
      if (e.key === 'Escape') {
        updateDraft('')
        setPendingImages([])
        setPendingPastedFiles([])
        if (!alwaysShowInput) {
          setIsCreating(false)
        }
        ;(e.target as HTMLTextAreaElement).blur()
      }
      // ArrowDown at last line: exit input and start navigating tasks
      if (e.key === 'ArrowDown') {
        const textarea = e.target as HTMLTextAreaElement
        const { selectionStart, selectionEnd, value } = textarea
        const isCollapsed = selectionStart === selectionEnd
        const textAfterCursor = value.substring(selectionEnd)
        const hasMoreLinesBelow = textAfterCursor.includes('\n')
        if (isCollapsed && !hasMoreLinesBelow) {
          e.preventDefault()
          textarea.blur()
          onInputExit?.()
        }
      }
    },
    [newTaskTitle, pendingImages, pendingPastedFiles, onCreateTask, alwaysShowInput, onInputExit, updateDraft, allSnippets, enabledSnippetIndices]
  )

  const handleBlur = useCallback(() => {
    if (!alwaysShowInput && !newTaskTitle.trim()) {
      setIsCreating(false)
    }
  }, [newTaskTitle, alwaysShowInput])

  const columnContextItems: ContextMenuItem[] = [
    ...(status !== 'archived'
      ? [
          {
            label: 'Create task',
            onClick: () => setIsCreating(true),
            shortcut: 'C'
          },
          { label: '', onClick: () => {}, divider: true } as ContextMenuItem
        ]
      : []),
    {
      label: `Clear column (${tasks.length})`,
      onClick: () => {},
      danger: tasks.length > 0
    }
  ]

  // Build the task list with drop indicator inserted at the right position
  const renderTasks = (): React.ReactNode => {
    if (tasks.length === 0 && !isCreating && !dropIndicator) {
      return (
        <div className={styles.empty}>
          <span style={{ opacity: 0.6 }}>No tasks</span>
        </div>
      )
    }

    const indicator = (
      <div
        key="drop-indicator"
        className={styles.dropIndicator}
      />
    )

    const elements: React.ReactNode[] = []

    // If there are no tasks but we have a drop indicator, just show the indicator
    if (tasks.length === 0 && dropIndicator) {
      return indicator
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      // Insert drop indicator before this task if needed
      if (dropIndicator && dropIndicator.index === i && task.id !== draggedTaskId) {
        elements.push(indicator)
      }

      elements.push(
        <TaskCard
          key={task.id}
          task={task}
          onClick={() => onTaskClick(task.id)}
          onMultiSelect={onMultiSelect}
          isSelected={selectedTaskId === task.id}
          isMultiSelected={multiSelectedIds?.has(task.id) ?? false}
          isFocused={isFocusedColumn && focusedTaskIndex === i}
          dashboardSnippets={dashboardSnippets}
        />
      )
    }

    // Drop indicator at the end (after all cards)
    if (dropIndicator && dropIndicator.index >= tasks.length) {
      elements.push(indicator)
    }

    return elements
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${isOver ? styles.columnDragOver : ''}`}
      onContextMenu={contextMenu.open}
    >
      <div className={styles.header}>
        <span
          className={styles.statusDot}
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
        <span className={styles.statusName}>{COLUMN_LABELS[status]}</span>
        <span className={styles.taskCount}>{tasks.length}</span>
        {headerAction}
        {status !== 'archived' && (
          <button
            className={styles.addButton}
            onClick={handlePlusClick}
            title="Create task (c)"
            aria-label={`Create task in ${COLUMN_LABELS[status]}`}
          >
            +
          </button>
        )}
      </div>

      {(alwaysShowInput || isCreating) && (
        <div className={styles.createWidget}>
          <textarea
            ref={inputRef}
            className={styles.createInput}
            placeholder="Task title... (Shift+Enter for notes, Enter to create, paste images)"
            value={newTaskTitle}
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={handleBlur}
            rows={1}
          />
          {pendingImages.length > 0 && (
            <div className={styles.pendingImages}>
              {pendingImages.map((img, i) => (
                <div key={i} className={styles.pendingImageThumb}>
                  <img src={img.dataUrl} alt={img.fileName} />
                  <button
                    className={styles.pendingImageRemove}
                    onClick={() => removePendingImage(i)}
                    type="button"
                    aria-label="Remove image"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {pendingPastedFiles.length > 0 && (
            <div className={styles.pendingPastedFiles}>
              {pendingPastedFiles.map((pf, i) => (
                <div key={pf.meta.filename} className={styles.pendingPastedCard}>
                  <div className={styles.pendingPastedInfo}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className={styles.pendingPastedLabel}>{pf.meta.label}</span>
                    <span className={styles.pendingPastedMeta}>
                      {pf.meta.lineCount} lines
                    </span>
                  </div>
                  <button
                    className={styles.pendingImageRemove}
                    onClick={() => setPendingPastedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    type="button"
                    aria-label="Remove pasted file"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {allSnippets.length > 0 && (
            <div className={styles.snippetToggles}>
              <span className={styles.snippetTogglesLabel}>Auto-run on create:</span>
              {allSnippets.map((snippet, i) => (
                <button
                  key={i}
                  className={`${styles.snippetToggle} ${enabledSnippetIndices.has(i) ? styles.snippetToggleOn : ''}`}
                  onClick={() => toggleSnippet(i)}
                  title={`${snippet.command}${enabledSnippetIndices.has(i) ? ' (enabled)' : ' (disabled)'}`}
                  type="button"
                >
                  <span className={styles.snippetToggleCheck}>
                    {enabledSnippetIndices.has(i) ? '✓' : ''}
                  </span>
                  {snippet.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={`${styles.taskList} ${isOver ? styles.dropTarget : ''}`}>
          {renderTasks()}
        </div>
      </SortableContext>

      {contextMenu.isOpen && (
        <ContextMenu
          items={columnContextItems}
          position={contextMenu.position}
          onClose={contextMenu.close}
        />
      )}
    </div>
  )
}
