import type { TaskPastedFile, PastedFileType } from '@shared/types'
import { PASTE_LINE_THRESHOLD, PASTE_CHAR_THRESHOLD } from '@shared/constants'

/**
 * Check if pasted text exceeds the threshold for auto-extraction.
 */
export function isLargePaste(text: string): boolean {
  if (text.length >= PASTE_CHAR_THRESHOLD) return true
  const lineCount = text.split('\n').length
  return lineCount >= PASTE_LINE_THRESHOLD
}

/**
 * Generate a pasted file metadata object from content.
 */
export function createPastedFileMeta(
  content: string,
  type: PastedFileType = 'text'
): TaskPastedFile {
  const timestamp = Date.now()
  const ext = type === 'text' ? 'md' : type === 'image' ? 'png' : 'bin'
  const filename = `pasted-${timestamp}.${ext}`
  const lines = content.split('\n')
  const firstLine = lines[0]?.trim() || 'Pasted content'
  const label = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine

  return {
    filename,
    type,
    size: new Blob([content]).size,
    lineCount: type === 'text' ? lines.length : undefined,
    label,
    createdAt: new Date().toISOString()
  }
}
