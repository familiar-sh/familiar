import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { UpdateBanner } from './UpdateBanner'

// Mock window.api
const mockOnUpdateAvailable = vi.fn()
const mockDismissUpdate = vi.fn()
const mockDownloadUpdate = vi.fn()

;(window as any).api = {
  onUpdateAvailable: mockOnUpdateAvailable.mockReturnValue(vi.fn()),
  dismissUpdate: mockDismissUpdate.mockResolvedValue(undefined),
  downloadUpdate: mockDownloadUpdate.mockResolvedValue(undefined)
}

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdateAvailable.mockReturnValue(vi.fn())
  })

  it('renders nothing when no update is available', () => {
    const { container } = render(<UpdateBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders update banner when update is received', () => {
    // Capture the callback passed to onUpdateAvailable
    let updateCallback: (info: any) => void = () => {}
    mockOnUpdateAvailable.mockImplementation((cb: any) => {
      updateCallback = cb
      return vi.fn()
    })

    render(<UpdateBanner />)

    // Simulate receiving an update
    act(() => {
      updateCallback({
        currentVersion: '0.7.0',
        latestVersion: '0.8.0',
        releaseUrl: 'https://github.com/familiar-sh/familiar/releases/tag/v0.8.0',
        releaseNotes: 'New features',
        publishedAt: '2026-03-13T00:00:00Z'
      })
    })

    expect(screen.getByTestId('update-banner')).toBeTruthy()
    expect(screen.getByText(/v0\.8\.0/)).toBeTruthy()
    expect(screen.getByText(/v0\.7\.0/)).toBeTruthy()
  })

  it('calls downloadUpdate when download button clicked', () => {
    let updateCallback: (info: any) => void = () => {}
    mockOnUpdateAvailable.mockImplementation((cb: any) => {
      updateCallback = cb
      return vi.fn()
    })

    render(<UpdateBanner />)

    act(() => {
      updateCallback({
        currentVersion: '0.7.0',
        latestVersion: '0.8.0',
        releaseUrl: 'https://github.com/familiar-sh/familiar/releases/tag/v0.8.0',
        releaseNotes: '',
        publishedAt: '2026-03-13T00:00:00Z'
      })
    })

    fireEvent.click(screen.getByTestId('update-download-button'))
    expect(mockDownloadUpdate).toHaveBeenCalledWith(
      'https://github.com/familiar-sh/familiar/releases/tag/v0.8.0'
    )
  })

  it('dismisses banner when dismiss button clicked', () => {
    let updateCallback: (info: any) => void = () => {}
    mockOnUpdateAvailable.mockImplementation((cb: any) => {
      updateCallback = cb
      return vi.fn()
    })

    render(<UpdateBanner />)

    act(() => {
      updateCallback({
        currentVersion: '0.7.0',
        latestVersion: '0.8.0',
        releaseUrl: 'https://github.com/familiar-sh/familiar/releases/tag/v0.8.0',
        releaseNotes: '',
        publishedAt: '2026-03-13T00:00:00Z'
      })
    })

    fireEvent.click(screen.getByTestId('update-dismiss-button'))
    expect(mockDismissUpdate).toHaveBeenCalledWith('0.8.0')
  })

  it('cleans up listener on unmount', () => {
    const unsubscribe = vi.fn()
    mockOnUpdateAvailable.mockReturnValue(unsubscribe)

    const { unmount } = render(<UpdateBanner />)
    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
