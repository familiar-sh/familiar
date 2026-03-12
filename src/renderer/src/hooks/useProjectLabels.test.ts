import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useProjectLabels } from './useProjectLabels'
import { DEFAULT_LABELS } from '@shared/constants'

const mockApi = {
  readSettings: vi.fn()
}

;(window as any).api = mockApi

describe('useProjectLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns DEFAULT_LABELS initially', () => {
    mockApi.readSettings.mockResolvedValue({})
    const { result } = renderHook(() => useProjectLabels())
    expect(result.current).toEqual(DEFAULT_LABELS)
  })

  it('loads labels from settings', async () => {
    const customLabels = [{ name: 'custom', color: '#ff0000' }]
    mockApi.readSettings.mockResolvedValue({ labels: customLabels })

    const { result } = renderHook(() => useProjectLabels())

    await waitFor(() => {
      expect(result.current).toEqual(customLabels)
    })
  })

  it('falls back to defaults when readSettings fails', async () => {
    mockApi.readSettings.mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useProjectLabels())

    // Should stay at defaults
    await waitFor(() => {
      expect(mockApi.readSettings).toHaveBeenCalled()
    })
    expect(result.current).toEqual(DEFAULT_LABELS)
  })

  it('updates when labels-updated event fires', async () => {
    mockApi.readSettings.mockResolvedValue({ labels: DEFAULT_LABELS })

    const { result } = renderHook(() => useProjectLabels())

    await waitFor(() => {
      expect(mockApi.readSettings).toHaveBeenCalled()
    })

    const newLabels = [{ name: 'updated', color: '#00ff00' }]
    window.dispatchEvent(new CustomEvent('labels-updated', { detail: newLabels }))

    await waitFor(() => {
      expect(result.current).toEqual(newLabels)
    })
  })

  it('handles empty labels array from settings', async () => {
    mockApi.readSettings.mockResolvedValue({ labels: [] })

    const { result } = renderHook(() => useProjectLabels())

    await waitFor(() => {
      expect(result.current).toEqual([])
    })
  })
})
