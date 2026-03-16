import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AboutDialog } from './AboutDialog'
import { useUIStore } from '@renderer/stores/ui-store'

const mockGetVersion = vi.fn().mockResolvedValue('1.2.3')
;(window as any).api = {
  ...((window as any).api || {}),
  getVersion: mockGetVersion
}

describe('AboutDialog', () => {
  beforeEach(() => {
    mockGetVersion.mockResolvedValue('1.2.3')
    useUIStore.setState({ aboutDialogOpen: false })
  })

  it('renders nothing when closed', () => {
    render(<AboutDialog />)
    expect(screen.queryByTestId('about-dialog')).toBeNull()
  })

  it('renders dialog when open', () => {
    useUIStore.setState({ aboutDialogOpen: true })
    render(<AboutDialog />)
    expect(screen.getByTestId('about-dialog')).toBeTruthy()
    expect(screen.getByText('Familiar')).toBeTruthy()
  })

  it('closes on overlay click', () => {
    useUIStore.setState({ aboutDialogOpen: true })
    render(<AboutDialog />)
    expect(screen.getByTestId('about-dialog')).toBeTruthy()

    fireEvent.click(screen.getByTestId('about-overlay'))
    expect(useUIStore.getState().aboutDialogOpen).toBe(false)
  })

  it('closes on close button click', () => {
    useUIStore.setState({ aboutDialogOpen: true })
    render(<AboutDialog />)

    fireEvent.click(screen.getByLabelText('Close'))
    expect(useUIStore.getState().aboutDialogOpen).toBe(false)
  })

  it('displays app version from API', async () => {
    useUIStore.setState({ aboutDialogOpen: true })
    render(<AboutDialog />)

    const versionText = await screen.findByText('Version 1.2.3')
    expect(versionText).toBeTruthy()
  })

  it('shows description text', () => {
    useUIStore.setState({ aboutDialogOpen: true })
    render(<AboutDialog />)
    expect(
      screen.getByText('A kanban board with embedded terminals for agentic AI coding workflows.')
    ).toBeTruthy()
  })
})
