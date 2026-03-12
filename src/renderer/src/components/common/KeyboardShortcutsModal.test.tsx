import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { useUIStore } from '@renderer/stores/ui-store'

describe('KeyboardShortcutsModal', () => {
  beforeEach(() => {
    useUIStore.setState({ shortcutsModalOpen: false })
  })

  it('renders nothing when closed', () => {
    const { container } = render(<KeyboardShortcutsModal />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal content when open', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Board Navigation')).toBeInTheDocument()
    expect(screen.getByText('Task Actions')).toBeInTheDocument()
  })

  it('displays shortcut descriptions', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    expect(screen.getByText('Open command palette')).toBeInTheDocument()
    expect(screen.getByText('Move down in column')).toBeInTheDocument()
    expect(screen.getByText('Set priority: Urgent')).toBeInTheDocument()
    expect(screen.getByText('Move to Todo')).toBeInTheDocument()
  })

  it('closes when clicking overlay', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    // Click the overlay background directly (target === currentTarget)
    const overlay = screen.getByTestId('shortcuts-overlay')
    fireEvent.click(overlay)

    expect(useUIStore.getState().shortcutsModalOpen).toBe(false)
  })

  it('closes when pressing Escape', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useUIStore.getState().shortcutsModalOpen).toBe(false)
  })

  it('closes when clicking close button', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    const closeButton = screen.getByText('Keyboard Shortcuts')
      .closest('div')!
      .querySelector('button')!
    fireEvent.click(closeButton)

    expect(useUIStore.getState().shortcutsModalOpen).toBe(false)
  })
})
