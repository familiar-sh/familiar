import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No tasks yet" />)
    expect(screen.getByText('No tasks yet')).toBeTruthy()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try creating a task" />)
    expect(screen.getByText('Try creating a task')).toBeTruthy()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })

  it('renders action button and handles click', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="No results"
        action={{ label: 'Create Task', onClick }}
      />
    )

    const button = screen.getByText('Create Task')
    expect(button).toBeTruthy()

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not render action button when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />)
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(0)
  })

  it('renders icon when provided', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">📋</span>} />)
    expect(screen.getByTestId('icon')).toBeTruthy()
  })
})
