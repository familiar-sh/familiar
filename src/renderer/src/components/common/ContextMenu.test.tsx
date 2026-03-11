import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'

const mockItems: ContextMenuItem[] = [
  { label: 'Edit', onClick: vi.fn() },
  { label: 'Copy', onClick: vi.fn(), shortcut: 'Cmd+C' },
  { label: '', onClick: vi.fn(), divider: true },
  { label: 'Delete', onClick: vi.fn(), danger: true }
]

function renderMenu(items = mockItems): ReturnType<typeof render> {
  return render(
    <ContextMenu items={items} position={{ x: 100, y: 200 }} onClose={vi.fn()} />
  )
}

describe('ContextMenu', () => {
  it('renders all non-divider items', () => {
    renderMenu()
    expect(screen.getByText('Edit')).toBeTruthy()
    expect(screen.getByText('Copy')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })

  it('renders shortcut text when provided', () => {
    renderMenu()
    expect(screen.getByText('Cmd+C')).toBeTruthy()
  })

  it('renders dividers', () => {
    renderMenu()
    const separators = screen.getAllByRole('separator')
    expect(separators).toHaveLength(1)
  })

  it('calls onClick and onClose when an item is clicked', () => {
    const onClose = vi.fn()
    const onClick = vi.fn()
    const items: ContextMenuItem[] = [{ label: 'Action', onClick }]

    render(<ContextMenu items={items} position={{ x: 0, y: 0 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Action'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('supports keyboard navigation with ArrowDown and Enter', () => {
    const onClick = vi.fn()
    const items: ContextMenuItem[] = [
      { label: 'First', onClick: vi.fn() },
      { label: 'Second', onClick }
    ]

    render(<ContextMenu items={items} position={{ x: 0, y: 0 }} onClose={vi.fn()} />)

    // Arrow down to second item, then Enter
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(
      <ContextMenu
        items={[{ label: 'Item', onClick: vi.fn() }]}
        position={{ x: 0, y: 0 }}
        onClose={onClose}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
