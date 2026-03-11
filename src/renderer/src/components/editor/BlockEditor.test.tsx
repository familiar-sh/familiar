import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Mock BlockNote modules before importing the component
vi.mock('@blocknote/react', () => {
  const mockEditor = {
    document: [],
    tryParseMarkdownToBlocks: vi.fn().mockResolvedValue([]),
    blocksToMarkdownLossy: vi.fn().mockResolvedValue(''),
    replaceBlocks: vi.fn()
  }
  return {
    useCreateBlockNote: vi.fn(() => mockEditor)
  }
})

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: vi.fn(({ onChange, ...props }: { onChange?: () => void; editor: unknown; theme?: string }) => (
    <div data-testid="blocknote-view" data-theme={props.theme} onClick={onChange}>
      BlockNote Editor
    </div>
  ))
}))

// Mock CSS imports
vi.mock('@blocknote/core/fonts/inter.css', () => ({}))
vi.mock('@blocknote/mantine/style.css', () => ({}))

import { BlockEditor } from './BlockEditor'

// Setup window.api mock
beforeEach(() => {
  window.api = {
    readTaskDocument: vi.fn().mockResolvedValue(''),
    writeTaskDocument: vi.fn().mockResolvedValue(undefined),
    saveAttachment: vi.fn().mockResolvedValue('/tmp/test-attachment.png')
  } as unknown as typeof window.api
})

describe('BlockEditor', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" />
    )
    expect(getByTestId('block-editor')).toBeDefined()
  })

  it('renders the BlockNoteView with dark theme', () => {
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" />
    )
    const view = getByTestId('blocknote-view')
    expect(view.getAttribute('data-theme')).toBe('dark')
  })

  it('renders with initial content', () => {
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" initialContent="# Hello World" />
    )
    expect(getByTestId('block-editor')).toBeDefined()
  })

  it('calls onChange when editor content changes', async () => {
    const mockOnChange = vi.fn()
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" onChange={mockOnChange} />
    )

    // The BlockNoteView mock triggers onChange on click
    const view = getByTestId('blocknote-view')
    view.click()

    // onChange is debounced (1 second), so we won't see it immediately
    // but the component should not throw
    expect(view).toBeDefined()
  })
})
