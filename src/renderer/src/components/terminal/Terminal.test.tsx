import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Terminal } from './Terminal'

// Track mock instances
const mockWrite = vi.fn()
const mockDispose = vi.fn()
const mockOpen = vi.fn()
const mockLoadAddon = vi.fn()
const mockFocus = vi.fn()
const mockOnData = vi.fn().mockReturnValue({ dispose: vi.fn() })
const mockOnResize = vi.fn().mockReturnValue({ dispose: vi.fn() })
const mockAttachCustomKeyEventHandler = vi.fn()

// Must use a class for `new XTerm(...)` to work
vi.mock('@xterm/xterm', () => {
  return {
    Terminal: class MockTerminal {
      write = mockWrite
      dispose = mockDispose
      open = mockOpen
      loadAddon = mockLoadAddon
      focus = mockFocus
      onData = mockOnData
      onResize = mockOnResize
      attachCustomKeyEventHandler = mockAttachCustomKeyEventHandler
      options: Record<string, unknown>
      constructor(opts: Record<string, unknown>) {
        this.options = opts
      }
    }
  }
})

// Mock FitAddon
const mockFit = vi.fn()
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = mockFit
  }
}))

// Mock WebglAddon
vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class MockWebglAddon {}
}))

// Mock WebLinksAddon — capture the handler so tests can invoke it
let capturedLinkHandler: ((event: MouseEvent, uri: string) => void) | undefined
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class MockWebLinksAddon {
    constructor(handler?: (event: MouseEvent, uri: string) => void) {
      capturedLinkHandler = handler
    }
  }
}))

// Mock CSS import
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

// Mock window.api
const mockPtyDataCleanup = vi.fn()
const mockOnPtyData = vi.fn().mockReturnValue(mockPtyDataCleanup)

const mockApi = {
  onPtyData: mockOnPtyData,
  ptyWrite: vi.fn().mockResolvedValue(undefined),
  ptyResize: vi.fn().mockResolvedValue(undefined),
  clipboardSaveImage: vi.fn().mockResolvedValue('/tmp/image.png'),
  clipboardReadNativeImage: vi.fn().mockResolvedValue('/tmp/native-image.png'),
  openExternal: vi.fn().mockResolvedValue(undefined)
}

;(window as any).api = mockApi

// Mock ResizeObserver
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()

class MockResizeObserver {
  observe = mockObserve
  disconnect = mockDisconnect
  unobserve = vi.fn()
  constructor(public callback: ResizeObserverCallback) {}
}

;(window as any).ResizeObserver = MockResizeObserver

// Mock getComputedStyle to return CSS variables
vi.spyOn(window, 'getComputedStyle').mockReturnValue({
  getPropertyValue: vi.fn().mockReturnValue('#1a1a27')
} as unknown as CSSStyleDeclaration)

// Mock requestAnimationFrame
vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
  cb(0)
  return 0
})

describe('Terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a container div', () => {
    const { container } = render(<Terminal sessionId="test-session" />)
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('opens the terminal in the container element', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockOpen).toHaveBeenCalledOnce()
  })

  it('loads FitAddon, WebglAddon, and WebLinksAddon', () => {
    render(<Terminal sessionId="test-session" />)
    // Should load 3 addons: FitAddon + WebglAddon + WebLinksAddon
    expect(mockLoadAddon).toHaveBeenCalledTimes(3)
  })

  it('calls fit after mount via requestAnimationFrame', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockFit).toHaveBeenCalled()
  })

  it('does not auto-focus after mount (requires Cmd+Enter)', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockFocus).not.toHaveBeenCalled()
  })

  it('registers onPtyData listener for the session', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockOnPtyData).toHaveBeenCalledOnce()
    expect(mockOnPtyData).toHaveBeenCalledWith(expect.any(Function))
  })

  it('writes incoming PTY data to xterm when session matches', () => {
    render(<Terminal sessionId="test-session" />)

    const dataCallback = mockOnPtyData.mock.calls[0][0]
    dataCallback('test-session', 'hello world')
    expect(mockWrite).toHaveBeenCalledWith('hello world')
  })

  it('ignores PTY data for other sessions', () => {
    render(<Terminal sessionId="test-session" />)

    const dataCallback = mockOnPtyData.mock.calls[0][0]
    dataCallback('other-session', 'should not show')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('sends terminal input to PTY via ptyWrite', () => {
    render(<Terminal sessionId="test-session" />)

    const inputCallback = mockOnData.mock.calls[0][0]
    inputCallback('user input')
    expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', 'user input')
  })

  it('notifies PTY of resize events', () => {
    render(<Terminal sessionId="test-session" />)

    const resizeCallback = mockOnResize.mock.calls[0][0]
    resizeCallback({ cols: 120, rows: 40 })
    expect(mockApi.ptyResize).toHaveBeenCalledWith('test-session', 120, 40)
  })

  it('sets up ResizeObserver on the container', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockObserve).toHaveBeenCalledOnce()
  })

  it('attaches a custom key handler to pass Shift+Escape through', () => {
    render(<Terminal sessionId="test-session" />)

    expect(mockAttachCustomKeyEventHandler).toHaveBeenCalledOnce()
    const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0]

    // Shift+Escape should return false (not handled by xterm)
    expect(handler({ key: 'Escape', shiftKey: true })).toBe(false)
    // Regular Escape should return true (handled by xterm)
    expect(handler({ key: 'Escape', shiftKey: false })).toBe(true)
    // Other keys should return true
    expect(handler({ key: 'a', shiftKey: false })).toBe(true)
  })

  it('sends CSI u for Shift+Enter on keydown and blocks ALL event types', () => {
    render(<Terminal sessionId="test-session" />)

    const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0]

    // Shift+Enter keydown: should send CSI u and return false
    expect(handler({ key: 'Enter', shiftKey: true, type: 'keydown' })).toBe(false)
    expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', '\x1b[13;2u')

    mockApi.ptyWrite.mockClear()

    // Shift+Enter keypress: should return false WITHOUT sending CSI u again
    // This prevents xterm from sending a duplicate \r via _keyPress
    expect(handler({ key: 'Enter', shiftKey: true, type: 'keypress' })).toBe(false)
    expect(mockApi.ptyWrite).not.toHaveBeenCalled()

    // Shift+Enter keyup: should also return false
    expect(handler({ key: 'Enter', shiftKey: true, type: 'keyup' })).toBe(false)
    expect(mockApi.ptyWrite).not.toHaveBeenCalled()

    // Plain Enter should return true (let xterm handle normally)
    expect(handler({ key: 'Enter', shiftKey: false, type: 'keydown' })).toBe(true)
  })

  it('opens URLs in default browser when clicked in terminal', () => {
    render(<Terminal sessionId="test-session" />)

    // WebLinksAddon should have captured the link handler
    expect(capturedLinkHandler).toBeDefined()

    // Simulate clicking a URL
    const fakeEvent = new MouseEvent('click')
    capturedLinkHandler!(fakeEvent, 'https://example.com')

    expect(mockApi.openExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('calls onReady callback after initialization', () => {
    const onReady = vi.fn()
    render(<Terminal sessionId="test-session" onReady={onReady} />)
    expect(onReady).toHaveBeenCalledOnce()
  })

  it('cleans up on unmount: disposes terminal, disconnects observer, removes PTY listener', () => {
    const { unmount } = render(<Terminal sessionId="test-session" />)
    unmount()

    expect(mockDispose).toHaveBeenCalledOnce()
    expect(mockDisconnect).toHaveBeenCalledOnce()
    expect(mockPtyDataCleanup).toHaveBeenCalledOnce()
  })

  it('focuses terminal when task-detail-focus terminal event is dispatched', () => {
    render(<Terminal sessionId="test-session" />)
    mockFocus.mockClear()

    window.dispatchEvent(new CustomEvent('task-detail-focus', { detail: 'terminal' }))
    expect(mockFocus).toHaveBeenCalled()
  })

  it('handles WebGL addon failure gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Make loadAddon succeed for FitAddon but throw for WebglAddon
    let callCount = 0
    mockLoadAddon.mockImplementation(() => {
      callCount++
      if (callCount === 2) throw new Error('WebGL not supported')
    })

    // Should not throw
    expect(() => render(<Terminal sessionId="test-session" />)).not.toThrow()

    consoleSpy.mockRestore()
  })

  describe('paste handling', () => {
    /**
     * Helper to create a synthetic ClipboardEvent with the given data.
     * jsdom doesn't fully support DataTransfer, so we mock it manually.
     */
    function createPasteEvent(options: {
      files?: Array<{ path?: string; name: string; type: string }>
      items?: Array<{ kind: string; type: string; file?: Blob | null }>
      text?: string
    }): ClipboardEvent {
      const files = options.files ?? []
      const items = options.items ?? []
      const text = options.text ?? ''

      const fileList = {
        length: files.length,
        item: (i: number) => files[i] ?? null,
        [Symbol.iterator]: function* () { for (const f of files) yield f }
      }
      for (let i = 0; i < files.length; i++) {
        (fileList as any)[i] = files[i]
      }

      const itemList = {
        length: items.length,
        [Symbol.iterator]: function* () { for (const item of items) yield item }
      }
      for (let i = 0; i < items.length; i++) {
        (itemList as any)[i] = {
          ...items[i],
          getAsFile: () => items[i].file ?? null
        }
      }

      const clipboardData = {
        files: fileList,
        items: itemList,
        getData: (type: string) => (type === 'text/plain' ? text : '')
      }

      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      return event
    }

    /** Returns the inner container div that has the paste listener (containerRef) */
    function getContainerRef(container: HTMLElement): HTMLElement {
      // Outer div > inner div (containerRef)
      const outer = container.firstElementChild as HTMLElement
      const inner = outer?.firstElementChild as HTMLElement
      return inner
    }

    it('pastes file paths for files copied from Finder', async () => {
      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const pasteEvent = createPasteEvent({
        files: [
          { path: '/Users/test/image.png', name: 'image.png', type: 'image/png' }
        ]
      })

      containerRef.dispatchEvent(pasteEvent)

      expect(pasteEvent.defaultPrevented).toBe(true)
      expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', '/Users/test/image.png')
    })

    it('pastes multiple file paths joined with spaces', async () => {
      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const pasteEvent = createPasteEvent({
        files: [
          { path: '/Users/test/a.png', name: 'a.png', type: 'image/png' },
          { path: '/Users/test/b.jpg', name: 'b.jpg', type: 'image/jpeg' }
        ]
      })

      containerRef.dispatchEvent(pasteEvent)

      expect(pasteEvent.defaultPrevented).toBe(true)
      expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', '/Users/test/a.png /Users/test/b.jpg')
    })

    it('saves clipboard images and pastes the temp path', async () => {
      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const imageBlob = new Blob(['fake png data'], { type: 'image/png' })

      const pasteEvent = createPasteEvent({
        items: [{ kind: 'file', type: 'image/png', file: imageBlob }]
      })

      containerRef.dispatchEvent(pasteEvent)

      expect(pasteEvent.defaultPrevented).toBe(true)

      // Wait for async operations (blob.arrayBuffer + IPC)
      await vi.waitFor(() => {
        expect(mockApi.clipboardSaveImage).toHaveBeenCalledOnce()
      })

      expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', '/tmp/image.png')
    })

    it('lets xterm handle text-only paste (no preventDefault)', () => {
      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const pasteEvent = createPasteEvent({ text: 'hello world' })

      containerRef.dispatchEvent(pasteEvent)

      // Should NOT prevent default — let xterm handle text paste
      expect(pasteEvent.defaultPrevented).toBe(false)
      // Should NOT write to PTY directly (xterm does it via onData)
      expect(mockApi.ptyWrite).not.toHaveBeenCalled()
      expect(mockApi.clipboardSaveImage).not.toHaveBeenCalled()
    })

    it('falls through to image check when files have no path', async () => {
      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const imageBlob = new Blob(['fake png data'], { type: 'image/png' })

      // File with no .path (like a clipboard screenshot) + image item
      const pasteEvent = createPasteEvent({
        files: [{ name: 'screenshot.png', type: 'image/png' }],
        items: [{ kind: 'file', type: 'image/png', file: imageBlob }]
      })

      containerRef.dispatchEvent(pasteEvent)

      expect(pasteEvent.defaultPrevented).toBe(true)

      await vi.waitFor(() => {
        expect(mockApi.clipboardSaveImage).toHaveBeenCalledOnce()
      })
      expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', '/tmp/image.png')
    })

    it('uses native clipboard fallback when paste has no text and no image items', async () => {
      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      // Paste event with no text, no files, and no image items
      // (simulates a clipboard source like CleanShot that puts image data
      //  in a format the paste event does not expose as kind: 'file')
      const pasteEvent = createPasteEvent({})

      containerRef.dispatchEvent(pasteEvent)

      expect(pasteEvent.defaultPrevented).toBe(true)

      await vi.waitFor(() => {
        expect(mockApi.clipboardReadNativeImage).toHaveBeenCalledOnce()
      })
      expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', '/tmp/native-image.png')
    })

    it('does not call native fallback when paste has text', () => {
      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const pasteEvent = createPasteEvent({ text: 'some text' })

      containerRef.dispatchEvent(pasteEvent)

      // Text-only paste: let xterm handle it
      expect(pasteEvent.defaultPrevented).toBe(false)
      expect(mockApi.clipboardReadNativeImage).not.toHaveBeenCalled()
    })

    it('handles native clipboard fallback returning null (no image)', async () => {
      mockApi.clipboardReadNativeImage.mockResolvedValueOnce(null)

      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const pasteEvent = createPasteEvent({})

      containerRef.dispatchEvent(pasteEvent)

      await vi.waitFor(() => {
        expect(mockApi.clipboardReadNativeImage).toHaveBeenCalledOnce()
      })

      // No image found — nothing to paste
      expect(mockApi.ptyWrite).not.toHaveBeenCalled()
    })

    it('handles clipboardSaveImage failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockApi.clipboardSaveImage.mockRejectedValueOnce(new Error('write failed'))

      const { container } = render(<Terminal sessionId="test-session" />)
      const containerRef = getContainerRef(container)

      const imageBlob = new Blob(['fake png data'], { type: 'image/png' })
      const pasteEvent = createPasteEvent({
        items: [{ kind: 'file', type: 'image/png', file: imageBlob }]
      })

      containerRef.dispatchEvent(pasteEvent)

      await vi.waitFor(() => {
        expect(mockApi.clipboardSaveImage).toHaveBeenCalledOnce()
      })

      // Should not crash — error is logged
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
