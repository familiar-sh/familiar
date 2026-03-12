import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreviewDialog } from './PreviewDialog'
import type { TaskPastedFile } from '@shared/types'

// Mock window.api
;(window as any).api = {
  readPastedFile: vi.fn().mockResolvedValue('Line 1\nLine 2\nLine 3')
}

const mockTextFile: TaskPastedFile = {
  filename: 'pasted-1710264000000.md',
  type: 'text',
  size: 4520,
  lineCount: 87,
  label: 'Error log from API endpoint',
  createdAt: '2026-03-12T16:30:00.000Z'
}

const mockBinaryFile: TaskPastedFile = {
  filename: 'pasted-1710264000000.bin',
  type: 'binary',
  size: 10240,
  label: 'Binary data',
  createdAt: '2026-03-12T16:30:00.000Z'
}

describe('PreviewDialog', () => {
  it('renders filename and metadata in header', () => {
    render(<PreviewDialog taskId="tsk_abc" file={mockTextFile} onClose={vi.fn()} />)

    expect(screen.getByText('pasted-1710264000000.md')).toBeInTheDocument()
    expect(screen.getByText(/4.4 KB/)).toBeInTheDocument()
  })

  it('loads and displays text content', async () => {
    render(<PreviewDialog taskId="tsk_abc" file={mockTextFile} onClose={vi.fn()} />)

    await vi.waitFor(() => {
      expect(screen.getByText(/Line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Line 3/)).toBeInTheDocument()
    })

    expect((window as any).api.readPastedFile).toHaveBeenCalledWith('tsk_abc', 'pasted-1710264000000.md')
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<PreviewDialog taskId="tsk_abc" file={mockTextFile} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking overlay', () => {
    const onClose = vi.fn()
    const { container } = render(
      <PreviewDialog taskId="tsk_abc" file={mockTextFile} onClose={onClose} />
    )

    // Click the overlay (the outermost div)
    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking close button', () => {
    const onClose = vi.fn()
    render(<PreviewDialog taskId="tsk_abc" file={mockTextFile} onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Close preview'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows binary info for binary files', () => {
    render(<PreviewDialog taskId="tsk_abc" file={mockBinaryFile} onClose={vi.fn()} />)

    expect(screen.getByText(/preview not available/)).toBeInTheDocument()
  })
})
