import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LabelSelect } from './LabelSelect'

const mockApi = {
  readSettings: vi.fn(),
  writeSettings: vi.fn().mockResolvedValue(undefined)
}

;(window as any).api = mockApi

describe('LabelSelect', () => {
  const onToggle = vi.fn()

  const defaultLabels = [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#3b82f6' },
    { name: 'chore', color: '#6b7280' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.readSettings.mockResolvedValue({ labels: defaultLabels })
  })

  it('renders trigger button with + text', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    expect(screen.getByTitle('Add label')).toBeInTheDocument()
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('does not show dropdown initially', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    expect(screen.queryByPlaceholderText('Search or create label...')).not.toBeInTheDocument()
  })

  it('opens dropdown and shows project labels', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
      expect(screen.getByText('feature')).toBeInTheDocument()
      expect(screen.getByText('chore')).toBeInTheDocument()
    })
  })

  it('shows checkmark for active labels', async () => {
    render(<LabelSelect taskLabels={['bug']} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('\u2713')).toBeInTheDocument()
    })
  })

  it('calls onToggle when clicking a label', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('bug'))

    expect(onToggle).toHaveBeenCalledWith('bug')
  })

  it('filters labels based on search input', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('feature')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'feat' } })

    expect(screen.getByText('feature')).toBeInTheDocument()
    expect(screen.queryByText('bug')).not.toBeInTheDocument()
    expect(screen.queryByText('chore')).not.toBeInTheDocument()
  })

  it('shows create option for new label', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'newlabel' } })

    expect(screen.getByText(/Create/)).toBeInTheDocument()
    expect(screen.getByText(/newlabel/)).toBeInTheDocument()
  })

  it('does not show create option if label already exists', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'bug' } })

    expect(screen.queryByText(/Create/)).not.toBeInTheDocument()
  })

  it('creates and toggles new label on Enter', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'newlabel' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining([expect.objectContaining({ name: 'newlabel' })])
        })
      )
    })
    expect(onToggle).toHaveBeenCalledWith('newlabel')
  })

  it('closes dropdown on Escape', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByPlaceholderText('Search or create label...')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByPlaceholderText('Search or create label...')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByPlaceholderText('Search or create label...')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByPlaceholderText('Search or create label...')).not.toBeInTheDocument()
  })

  it('shows "No labels" when settings returns empty labels', async () => {
    mockApi.readSettings.mockResolvedValue({ labels: [] })

    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)

    // Wait for the empty labels to load
    await waitFor(() => {
      expect(mockApi.readSettings).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('No labels')).toBeInTheDocument()
    })
  })

  it('does not add empty label name', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockApi.writeSettings).not.toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('opens color picker when clicking color button', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
    })

    const colorBtns = screen.getAllByTitle('Change color')
    fireEvent.click(colorBtns[0])

    // 9 preset color swatches should appear in a portal
    const container = document.querySelector('[class*="colorPicker"]')
    expect(container).toBeTruthy()
  })

  it('updates labels when labels-updated event fires', async () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockApi.readSettings).toHaveBeenCalled()
    })

    // Dispatch update event with new labels
    window.dispatchEvent(
      new CustomEvent('labels-updated', {
        detail: [{ name: 'custom', color: '#ff0000' }]
      })
    )

    fireEvent.click(screen.getByTitle('Add label'))

    await waitFor(() => {
      expect(screen.getByText('custom')).toBeInTheDocument()
    })
  })
})
