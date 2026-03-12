import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentStatusBadge } from './AgentStatusBadge'
import type { AgentStatus } from '@shared/types'

describe('AgentStatusBadge', () => {
  const statuses: AgentStatus[] = ['idle', 'running', 'done', 'error']

  it.each(statuses)('renders %s status with correct test id', (status) => {
    render(<AgentStatusBadge status={status} />)
    expect(screen.getByTestId(`agent-status-${status}`)).toBeTruthy()
  })

  it('shows label when showLabel is true', () => {
    render(<AgentStatusBadge status="running" showLabel />)
    expect(screen.getByText('Running')).toBeTruthy()
  })

  it('does not show label by default', () => {
    render(<AgentStatusBadge status="running" />)
    expect(screen.queryByText('Running')).toBeNull()
  })

  it('renders idle status with gray color', () => {
    render(<AgentStatusBadge status="idle" showLabel />)
    expect(screen.getByText('Idle')).toBeTruthy()
  })

  it('renders done status with green indicator', () => {
    render(<AgentStatusBadge status="done" showLabel />)
    expect(screen.getByText('Done')).toBeTruthy()
  })

  it('renders error status with red indicator', () => {
    render(<AgentStatusBadge status="error" showLabel />)
    expect(screen.getByText('Error')).toBeTruthy()
  })

  it('has correct aria-label attribute', () => {
    render(<AgentStatusBadge status="running" />)
    const badge = screen.getByTestId('agent-status-running')
    expect(badge.getAttribute('aria-label')).toBe('Agent: Running')
  })

  it('always shows running color regardless of task column', () => {
    render(<AgentStatusBadge status="running" showLabel />)
    expect(screen.getByText('Running')).toBeTruthy()
  })

  it('always shows done color regardless of task column', () => {
    render(<AgentStatusBadge status="done" showLabel />)
    expect(screen.getByText('Done')).toBeTruthy()
  })
})
