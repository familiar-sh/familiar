import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PastedFileCard } from './PastedFileCard'
import type { TaskPastedFile } from '@shared/types'

const mockFile: TaskPastedFile = {
  filename: 'pasted-1710264000000.md',
  type: 'text',
  size: 4520,
  lineCount: 87,
  label: 'Error log from API endpoint',
  createdAt: '2026-03-12T16:30:00.000Z'
}

describe('PastedFileCard', () => {
  it('renders file label and metadata', () => {
    render(<PastedFileCard file={mockFile} onClick={vi.fn()} />)

    expect(screen.getByText('Error log from API endpoint')).toBeInTheDocument()
    expect(screen.getByText(/87 lines/)).toBeInTheDocument()
    expect(screen.getByText(/4.4 KB/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<PastedFileCard file={mockFile} onClick={onClick} />)

    fireEvent.click(screen.getByText('Error log from API endpoint'))
    expect(onClick).toHaveBeenCalled()
  })

  it('shows remove button when onRemove provided', () => {
    const onRemove = vi.fn()
    render(<PastedFileCard file={mockFile} onClick={vi.fn()} onRemove={onRemove} />)

    const removeBtn = screen.getByLabelText('Remove pasted file')
    expect(removeBtn).toBeInTheDocument()

    fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalled()
  })

  it('does not show remove button when onRemove not provided', () => {
    render(<PastedFileCard file={mockFile} onClick={vi.fn()} />)

    expect(screen.queryByLabelText('Remove pasted file')).not.toBeInTheDocument()
  })

  it('renders compact variant', () => {
    render(<PastedFileCard file={mockFile} onClick={vi.fn()} compact />)

    expect(screen.getByText('87L')).toBeInTheDocument()
  })

  it('displays size in bytes for small files', () => {
    const smallFile: TaskPastedFile = {
      ...mockFile,
      size: 500,
      lineCount: 12
    }
    render(<PastedFileCard file={smallFile} onClick={vi.fn()} />)
    expect(screen.getByText(/500 B/)).toBeInTheDocument()
  })

  it('displays size in MB for large files', () => {
    const largeFile: TaskPastedFile = {
      ...mockFile,
      size: 2 * 1024 * 1024
    }
    render(<PastedFileCard file={largeFile} onClick={vi.fn()} />)
    expect(screen.getByText(/2.0 MB/)).toBeInTheDocument()
  })
})
