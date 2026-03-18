import { useCallback, useRef, useEffect, useState } from 'react'
import type { TaskPastedFile, Snippet } from '@shared/types'
import { DEFAULT_SNIPPETS } from '@shared/types/settings'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { CreateTaskInput } from './CreateTaskInput'
import type { CreateTaskInputHandle, PendingImage, PendingPastedFile } from './CreateTaskInput'

export function CreateTaskModal(): React.JSX.Element | null {
  const open = useUIStore((s) => s.createTaskModalOpen)
  const parentId = useUIStore((s) => s.createTaskParentId)
  const closeModal = useUIStore((s) => s.closeCreateTaskModal)
  const addTask = useTaskStore((s) => s.addTask)
  const createSubtask = useTaskStore((s) => s.createSubtask)
  const inputRef = useRef<CreateTaskInputHandle>(null)
  const [snippets, setSnippets] = useState<Snippet[]>(DEFAULT_SNIPPETS)

  // Load snippets when modal opens
  useEffect(() => {
    if (!open) return
    inputRef.current?.clear()
    setTimeout(() => inputRef.current?.focus(), 0)

    window.api.readSettings().then((settings) => {
      if (settings.snippets && settings.snippets.length > 0) {
        setSnippets(settings.snippets)
      }
    }).catch(() => {})
  }, [open])

  // Resolve parent title for display
  const parentTitle = parentId
    ? useTaskStore.getState().getTaskById(parentId)?.title ?? null
    : null

  const handleSubmit = useCallback(
    async (
      title: string,
      document?: string,
      enabledSnippets?: Snippet[],
      pendingImages?: PendingImage[],
      pendingPastedFiles?: PendingPastedFile[]
    ) => {
      let task: import('@shared/types').Task
      if (parentId) {
        task = await createSubtask(parentId, title, { documentContent: document })
      } else {
        task = await addTask(title)
        if (document) {
          await window.api.writeTaskDocument(task.id, document)
        }
      }

      // Copy pending images to task attachments
      if (pendingImages && pendingImages.length > 0) {
        const attachmentNames: string[] = []
        for (const img of pendingImages) {
          try {
            const fileName = await window.api.copyTempToAttachment(task.id, img.tempPath, img.fileName)
            attachmentNames.push(fileName)
          } catch {
            console.warn('Failed to copy image to task attachments:', img.fileName)
          }
        }
        if (attachmentNames.length > 0) {
          const { updateTask } = useTaskStore.getState()
          await updateTask({ ...task, attachments: attachmentNames })
        }
      }

      // Save pasted files
      if (pendingPastedFiles && pendingPastedFiles.length > 0) {
        const pastedFiles: TaskPastedFile[] = []
        for (const pf of pendingPastedFiles) {
          await window.api.savePastedFile(task.id, pf.meta.filename, pf.content)
          pastedFiles.push(pf.meta)
        }
        const { updateTask } = useTaskStore.getState()
        await updateTask({ ...task, pastedFiles })
      }

      // Auto-run enabled snippets after warmup
      if (enabledSnippets && enabledSnippets.length > 0) {
        const taskId = task.id
        const sessionName = `familiar-${taskId}`
        window.api.warmupTmuxSession(taskId).then(async () => {
          await new Promise((r) => setTimeout(r, 3000))
          for (const snippet of enabledSnippets) {
            try {
              await window.api.tmuxSendKeys(sessionName, snippet.command, snippet.pressEnter)
            } catch {
              // Session may not be ready
            }
          }
        }).catch(() => {})
      }

      closeModal()

      // Open the subtask in detail view
      if (parentId) {
        useUIStore.getState().openTaskDetail(task.id)
      }
    },
    [addTask, createSubtask, parentId, closeModal]
  )

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeModal()
      }
    },
    [closeModal]
  )

  if (!open) return null

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={wrapperStyle}>
        <CreateTaskInput
          ref={inputRef}
          variant="rounded"
          onSubmit={handleSubmit}
          onCancel={closeModal}
          allSnippets={snippets}
          parentId={parentId}
          parentTitle={parentTitle}
          onClearParent={parentId ? () => {
            useUIStore.getState().closeCreateTaskModal()
          } : undefined}
          placeholder="Task title... (Shift+Enter for notes, paste images)"
        />
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '20vh',
  zIndex: 500,
  animation: 'cmdkFadeIn 120ms ease'
}

const wrapperStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  borderRadius: 12,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-surface)',
  boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden'
}
