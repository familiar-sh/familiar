import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Header } from './Header'
import { useUIStore } from '@renderer/stores/ui-store'

vi.mock('@renderer/hooks/useProjectLabels', () => ({
  useProjectLabels: () => [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#3b82f6' },
    { name: 'chore', color: '#6b7280' }
  ]
}))

describe('Header', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUIStore.setState({
      filters: {
        search: '',
        priority: [],
        labels: [],
        agentStatus: []
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the search input', () => {
    render(<Header />)
    expect(screen.getByTestId('search-input')).toBeTruthy()
    expect(screen.getByPlaceholderText('Search tasks...')).toBeTruthy()
  })

  it('renders priority, label, and agent status filter buttons', () => {
    render(<Header />)
    expect(screen.getByTestId('priority-filter-button')).toBeTruthy()
    expect(screen.getByTestId('label-filter-button')).toBeTruthy()
    expect(screen.getByTestId('agent-filter-button')).toBeTruthy()
  })

  // --- Debounced search ---

  it('updates search input immediately on typing', () => {
    render(<Header />)
    const input = screen.getByTestId('search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(input.value).toBe('hello')
  })

  it('debounces the search filter update by 200ms', () => {
    render(<Header />)
    const input = screen.getByTestId('search-input')
    fireEvent.change(input, { target: { value: 'bug' } })

    // Before debounce fires, store should still be empty
    expect(useUIStore.getState().filters.search).toBe('')

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(useUIStore.getState().filters.search).toBe('bug')
  })

  it('resets previous debounce timer on rapid typing', () => {
    render(<Header />)
    const input = screen.getByTestId('search-input')

    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'ab' } })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Only 100ms since last change — should not have fired yet
    expect(useUIStore.getState().filters.search).toBe('')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Now 200ms since last change
    expect(useUIStore.getState().filters.search).toBe('ab')
  })

  // --- Priority filter dropdown ---

  it('opens priority dropdown on button click', () => {
    render(<Header />)
    expect(screen.queryByTestId('priority-dropdown')).toBeNull()

    fireEvent.click(screen.getByTestId('priority-filter-button'))
    expect(screen.getByTestId('priority-dropdown')).toBeTruthy()
  })

  it('closes priority dropdown on second button click', () => {
    render(<Header />)
    const btn = screen.getByTestId('priority-filter-button')

    fireEvent.click(btn)
    expect(screen.getByTestId('priority-dropdown')).toBeTruthy()

    fireEvent.click(btn)
    expect(screen.queryByTestId('priority-dropdown')).toBeNull()
  })

  it('lists all priority options in dropdown', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('priority-filter-button'))

    expect(screen.getByText('Urgent')).toBeTruthy()
    expect(screen.getByText('High')).toBeTruthy()
    expect(screen.getByText('Medium')).toBeTruthy()
    expect(screen.getByText('Low')).toBeTruthy()
    expect(screen.getByText('None')).toBeTruthy()
  })

  it('toggles priority filter on checkbox click', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('priority-filter-button'))

    const highLabel = screen.getByText('High')
    fireEvent.click(highLabel)
    expect(useUIStore.getState().filters.priority).toEqual(['high'])

    // Toggle off
    fireEvent.click(highLabel)
    expect(useUIStore.getState().filters.priority).toEqual([])
  })

  it('shows badge count when priorities are selected', () => {
    useUIStore.setState({
      filters: { search: '', priority: ['high', 'urgent'], labels: [], agentStatus: [] }
    })
    render(<Header />)
    const btn = screen.getByTestId('priority-filter-button')
    expect(btn.textContent).toContain('2')
  })

  // --- Label filter dropdown ---

  it('opens label dropdown on button click', () => {
    render(<Header />)
    expect(screen.queryByTestId('label-dropdown')).toBeNull()

    fireEvent.click(screen.getByTestId('label-filter-button'))
    expect(screen.getByTestId('label-dropdown')).toBeTruthy()
  })

  it('lists all project labels in dropdown', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('label-filter-button'))

    expect(screen.getByText('bug')).toBeTruthy()
    expect(screen.getByText('feature')).toBeTruthy()
    expect(screen.getByText('chore')).toBeTruthy()
  })

  it('toggles label filter', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('label-filter-button'))

    fireEvent.click(screen.getByText('bug'))
    expect(useUIStore.getState().filters.labels).toEqual(['bug'])

    fireEvent.click(screen.getByText('bug'))
    expect(useUIStore.getState().filters.labels).toEqual([])
  })

  it('shows badge count for label filters', () => {
    useUIStore.setState({
      filters: { search: '', priority: [], labels: ['bug', 'feature'], agentStatus: [] }
    })
    render(<Header />)
    const btn = screen.getByTestId('label-filter-button')
    expect(btn.textContent).toContain('2')
  })

  // --- Agent status filter dropdown ---

  it('opens agent status dropdown on button click', () => {
    render(<Header />)
    expect(screen.queryByTestId('agent-dropdown')).toBeNull()

    fireEvent.click(screen.getByTestId('agent-filter-button'))
    expect(screen.getByTestId('agent-dropdown')).toBeTruthy()
  })

  it('shows Agent Status label on filter button', () => {
    render(<Header />)
    expect(screen.getByTestId('agent-filter-button').textContent).toContain('Agent Status')
  })

  it('lists all agent status options', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('agent-filter-button'))

    expect(screen.getByText('Idle')).toBeTruthy()
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
    expect(screen.getByText('Error')).toBeTruthy()
  })

  it('toggles agent status filter', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('agent-filter-button'))

    fireEvent.click(screen.getByText('Running'))
    expect(useUIStore.getState().filters.agentStatus).toEqual(['running'])

    fireEvent.click(screen.getByText('Running'))
    expect(useUIStore.getState().filters.agentStatus).toEqual([])
  })

  it('shows badge count for agent status filters', () => {
    useUIStore.setState({
      filters: { search: '', priority: [], labels: [], agentStatus: ['idle', 'error'] }
    })
    render(<Header />)
    const btn = screen.getByTestId('agent-filter-button')
    expect(btn.textContent).toContain('2')
  })

  // --- Mutual exclusion of dropdowns ---

  it('closes agent dropdown when opening priority dropdown', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('agent-filter-button'))
    expect(screen.getByTestId('agent-dropdown')).toBeTruthy()

    fireEvent.click(screen.getByTestId('priority-filter-button'))
    expect(screen.queryByTestId('agent-dropdown')).toBeNull()
    expect(screen.getByTestId('priority-dropdown')).toBeTruthy()
  })

  it('closes priority dropdown when opening agent dropdown', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('priority-filter-button'))
    expect(screen.getByTestId('priority-dropdown')).toBeTruthy()

    fireEvent.click(screen.getByTestId('agent-filter-button'))
    expect(screen.queryByTestId('priority-dropdown')).toBeNull()
    expect(screen.getByTestId('agent-dropdown')).toBeTruthy()
  })

  it('closes label dropdown when opening priority dropdown', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('label-filter-button'))
    expect(screen.getByTestId('label-dropdown')).toBeTruthy()

    fireEvent.click(screen.getByTestId('priority-filter-button'))
    expect(screen.queryByTestId('label-dropdown')).toBeNull()
    expect(screen.getByTestId('priority-dropdown')).toBeTruthy()
  })

  // --- Clear filters ---

  it('does not show clear filters button when no filters active', () => {
    render(<Header />)
    expect(screen.queryByTestId('clear-filters-button')).toBeNull()
  })

  it('shows clear filters button when search filter is active', () => {
    useUIStore.setState({
      filters: { search: 'test', priority: [], labels: [], agentStatus: [] }
    })
    render(<Header />)
    expect(screen.getByTestId('clear-filters-button')).toBeTruthy()
  })

  it('shows clear filters button when priority filter is active', () => {
    useUIStore.setState({
      filters: { search: '', priority: ['high'], labels: [], agentStatus: [] }
    })
    render(<Header />)
    expect(screen.getByTestId('clear-filters-button')).toBeTruthy()
  })

  it('shows clear filters button when label filter is active', () => {
    useUIStore.setState({
      filters: { search: '', priority: [], labels: ['bug'], agentStatus: [] }
    })
    render(<Header />)
    expect(screen.getByTestId('clear-filters-button')).toBeTruthy()
  })

  it('clears all filters and resets search input on click', () => {
    useUIStore.setState({
      filters: { search: 'test', priority: ['high'], labels: ['bug'], agentStatus: ['running'] }
    })
    render(<Header />)

    fireEvent.click(screen.getByTestId('clear-filters-button'))

    const { filters } = useUIStore.getState()
    expect(filters.search).toBe('')
    expect(filters.priority).toEqual([])
    expect(filters.labels).toEqual([])
    expect(filters.agentStatus).toEqual([])
  })

  it('syncs search input when filters are cleared externally', () => {
    useUIStore.setState({
      filters: { search: 'hello', priority: [], labels: [], agentStatus: [] }
    })
    const { rerender } = render(<Header />)
    const input = screen.getByTestId('search-input') as HTMLInputElement
    expect(input.value).toBe('hello')

    // Externally clear filters
    act(() => {
      useUIStore.getState().clearFilters()
    })
    rerender(<Header />)

    expect(input.value).toBe('')
  })

  // --- Outside click closes dropdowns ---

  it('closes priority dropdown on outside click', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('priority-filter-button'))
    expect(screen.getByTestId('priority-dropdown')).toBeTruthy()

    // Simulate outside click
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('priority-dropdown')).toBeNull()
  })

  it('closes agent dropdown on outside click', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('agent-filter-button'))
    expect(screen.getByTestId('agent-dropdown')).toBeTruthy()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('agent-dropdown')).toBeNull()
  })

  it('closes label dropdown on outside click', () => {
    render(<Header />)
    fireEvent.click(screen.getByTestId('label-filter-button'))
    expect(screen.getByTestId('label-dropdown')).toBeTruthy()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('label-dropdown')).toBeNull()
  })

})
