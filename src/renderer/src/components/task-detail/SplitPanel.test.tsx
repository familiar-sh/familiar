import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SplitPanel } from './SplitPanel'

describe('SplitPanel', () => {
  it('renders left and right content', () => {
    const { getByText } = render(
      <SplitPanel left={<div>Left Content</div>} right={<div>Right Content</div>} />
    )
    expect(getByText('Left Content')).toBeDefined()
    expect(getByText('Right Content')).toBeDefined()
  })

  it('applies default left width of 400px capped at 45%', () => {
    const { getByTestId } = render(
      <SplitPanel left={<div>L</div>} right={<div>R</div>} />
    )
    const leftPanel = getByTestId('split-left')
    expect(leftPanel.style.width).toBe('400px')
    expect(leftPanel.style.maxWidth).toBe('45%')
  })

  it('applies custom default left width', () => {
    const { getByTestId } = render(
      <SplitPanel left={<div>L</div>} right={<div>R</div>} defaultLeftWidth={300} />
    )
    const leftPanel = getByTestId('split-left')
    expect(leftPanel.style.width).toBe('300px')
    expect(leftPanel.style.maxWidth).toBe('45%')
  })

  it('renders the drag handle with separator role', () => {
    const { getByTestId } = render(
      <SplitPanel left={<div>L</div>} right={<div>R</div>} />
    )
    const handle = getByTestId('split-handle')
    expect(handle.getAttribute('role')).toBe('separator')
  })

  it('starts drag on mousedown and stops on mouseup', () => {
    const onWidthChange = vi.fn()
    const { getByTestId } = render(
      <SplitPanel
        left={<div>L</div>}
        right={<div>R</div>}
        onWidthChange={onWidthChange}
      />
    )
    const handle = getByTestId('split-handle')

    // Mousedown starts dragging
    fireEvent.mouseDown(handle)

    // Mouseup on document stops dragging
    fireEvent.mouseUp(document)

    // Verify cursor is restored
    expect(document.body.style.cursor).toBe('')
  })

  it('clamps width to min and max', () => {
    const onWidthChange = vi.fn()
    const { getByTestId } = render(
      <SplitPanel
        left={<div>L</div>}
        right={<div>R</div>}
        minLeftWidth={300}
        maxLeftWidth={700}
        onWidthChange={onWidthChange}
      />
    )
    const handle = getByTestId('split-handle')
    const container = getByTestId('split-panel')

    // Mock getBoundingClientRect
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
      right: 1000,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    fireEvent.mouseDown(handle)

    // Move to 100px (should be clamped to 300px)
    fireEvent.mouseMove(document, { clientX: 100 })
    expect(onWidthChange).toHaveBeenLastCalledWith(300)

    // Move to 900px (should be clamped to 700px)
    fireEvent.mouseMove(document, { clientX: 900 })
    expect(onWidthChange).toHaveBeenLastCalledWith(700)

    // Move to 500px (should be exact)
    fireEvent.mouseMove(document, { clientX: 500 })
    expect(onWidthChange).toHaveBeenLastCalledWith(500)

    fireEvent.mouseUp(document)
  })
})
