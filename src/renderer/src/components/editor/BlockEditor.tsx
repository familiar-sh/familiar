import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import styles from './BlockEditor.module.css'

interface BlockEditorProps {
  taskId: string
  initialContent?: string // markdown content
  onChange?: (markdown: string) => void
}

export function BlockEditor({ taskId, initialContent, onChange }: BlockEditorProps): JSX.Element {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taskIdRef = useRef(taskId)
  taskIdRef.current = taskId

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const timestamp = Date.now()
      const fileName = `${timestamp}-${file.name}`
      const arrayBuffer = await file.arrayBuffer()
      const filePath = await window.api.saveAttachment(taskIdRef.current, fileName, arrayBuffer)
      // Return a file:// URL so the editor can display the image inline
      return `file://${filePath}`
    },
    []
  )

  const editor = useCreateBlockNote(
    {
      uploadFile,
    },
    [uploadFile]
  )

  // Load initial content from markdown
  useEffect(() => {
    if (!editor || !initialContent) return
    let cancelled = false

    async function loadContent(): Promise<void> {
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(initialContent!)
        if (!cancelled && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks)
        }
      } catch (err) {
        console.error('Failed to parse markdown into blocks:', err)
      }
    }

    loadContent()
    return () => {
      cancelled = true
    }
  }, [editor, initialContent])

  const handleChange = useCallback(async () => {
    if (!editor) return

    // Clear any pending save timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Debounce: wait 1 second before saving
    saveTimerRef.current = setTimeout(async () => {
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document)
        onChange?.(markdown)
        await window.api.writeTaskDocument(taskIdRef.current, markdown)
      } catch (err) {
        console.error('Failed to save document:', err)
      }
    }, 1000)
  }, [editor, onChange])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  return (
    <div className={styles.editorWrapper} data-testid="block-editor">
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={handleChange}
      />
    </div>
  )
}
