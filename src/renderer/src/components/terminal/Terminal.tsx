import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
  onReady?: () => void
}

export function Terminal({ sessionId, onReady }: TerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    if (!containerRef.current) return

    // Read CSS custom properties from the app's design system
    const rootStyles = getComputedStyle(document.documentElement)
    const cssVar = (name: string): string => rootStyles.getPropertyValue(name).trim()

    const term = new XTerm({
      theme: {
        background: cssVar('--bg-primary'),
        foreground: cssVar('--text-primary'),
        cursor: cssVar('--accent'),
        cursorAccent: cssVar('--bg-primary'),
        selectionBackground: cssVar('--accent-subtle'),
        selectionForeground: cssVar('--text-primary'),
        black: cssVar('--term-black'),
        red: cssVar('--term-red'),
        green: cssVar('--term-green'),
        yellow: cssVar('--term-yellow'),
        blue: cssVar('--term-blue'),
        magenta: cssVar('--term-magenta'),
        cyan: cssVar('--term-cyan'),
        white: cssVar('--term-white'),
        brightBlack: cssVar('--term-bright-black'),
        brightRed: cssVar('--term-bright-red'),
        brightGreen: cssVar('--term-bright-green'),
        brightYellow: cssVar('--term-bright-yellow'),
        brightBlue: cssVar('--term-bright-blue'),
        brightMagenta: cssVar('--term-bright-magenta'),
        brightCyan: cssVar('--term-bright-cyan'),
        brightWhite: cssVar('--term-bright-white')
      },
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 0, // tmux manages scrollback, disable xterm's scrollbar
      overviewRuler: { width: 0 },
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(containerRef.current)

    // Try WebGL renderer for better performance
    let webglAddon: WebglAddon | null = null
    try {
      webglAddon = new WebglAddon()
      term.loadAddon(webglAddon)
    } catch {
      console.warn('WebGL renderer not available, falling back to canvas')
    }

    // Enable clickable URLs — opens in default browser on click
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.api.openExternal(uri)
    })
    term.loadAddon(webLinksAddon)

    // Custom key event handler for keys that need special treatment
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Let Shift+Escape bubble up to the app (not consumed by xterm)
      // so users can close the task detail view from the terminal
      if (e.key === 'Escape' && e.shiftKey) return false

      // Shift+Enter: xterm.js 6.0 doesn't support the kitty keyboard protocol,
      // so it sends plain \r for both Enter and Shift+Enter. Intercept Shift+Enter
      // and manually send the CSI u escape sequence that Claude Code expects.
      // IMPORTANT: Return false for ALL event types (keydown, keypress, keyup).
      // xterm.js fires both keydown and keypress for Enter. If we only block keydown,
      // _keyDownHandled stays false and _keyPress still processes the event, leaking
      // a plain \r to the PTY alongside our CSI u sequence.
      if (e.key === 'Enter' && e.shiftKey) {
        if (e.type === 'keydown') {
          window.api.ptyWrite(sessionId, '\x1b[13;2u')
        }
        return false
      }

      return true
    })

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Fit after DOM settles
    requestAnimationFrame(() => {
      fitAddon.fit()
    })
    // No auto-focus — use Cmd+Enter or click to focus terminal

    // Connect to PTY data
    const cleanup = window.api.onPtyData((sid: string, data: string) => {
      if (sid === sessionId) {
        term.write(data)
      }
    })

    // Send terminal input to PTY
    term.onData((data: string) => {
      window.api.ptyWrite(sessionId, data)
    })

    // Handle resize — notify PTY of new dimensions
    term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      window.api.ptyResize(sessionId, cols, rows)
    })

    // Intercept paste in capture phase (before xterm.js processes it).
    // When clipboard contains files or image data, paste the file path instead
    // of raw content. This enables Claude Code and CLI tools to receive usable paths.
    const handlePaste = async (e: ClipboardEvent): Promise<void> => {
      const clipData = e.clipboardData
      if (!clipData) return

      // Diagnostic: log clipboard content types so we can debug paste issues
      const types = clipData.types ?? []
      const fileCount = clipData.files?.length ?? 0
      const itemCount = clipData.items?.length ?? 0
      const itemDetails = clipData.items
        ? Array.from({ length: clipData.items.length }, (_, i) => {
            const it = clipData.items[i]
            return `${it.kind}:${it.type}`
          })
        : []
      const target = (e.target as HTMLElement)?.tagName ?? 'unknown'
      console.debug(`[paste] target=${target} types=${types} files=${fileCount} items=[${itemDetails}]`)

      // Case 1: Files with paths (e.g. copied from Finder)
      const files = clipData.files
      if (files && files.length > 0) {
        const paths: string[] = []
        for (let i = 0; i < files.length; i++) {
          const filePath = (files[i] as File & { path?: string }).path
          if (filePath) paths.push(filePath)
        }
        if (paths.length > 0) {
          e.preventDefault()
          e.stopImmediatePropagation()
          console.debug(`[paste] case 1: file paths → ${paths.join(' ')}`)
          window.api.ptyWrite(sessionIdRef.current, paths.join(' '))
          return
        }
      }

      // Case 2: Image data in clipboard (e.g. screenshot from clipboard manager)
      // No file path available — save to temp file, then paste that path.
      const items = clipData.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile()
            if (blob) {
              e.preventDefault()
              e.stopImmediatePropagation()
              try {
                const arrayBuffer = await blob.arrayBuffer()
                const savedPath = await window.api.clipboardSaveImage(arrayBuffer, item.type)
                console.debug(`[paste] case 2: image saved → ${savedPath}`)
                window.api.ptyWrite(sessionIdRef.current, savedPath)
              } catch (err) {
                console.error('[paste] Failed to save clipboard image:', err)
              }
              return
            }
          }
        }
      }
      // Case 3: Native clipboard fallback — the paste event may lack image items
      // (e.g. CleanShot screenshots, some macOS clipboard sources). Use Electron's
      // native clipboard.readImage() as a last resort before falling through to text.
      const plainText = clipData.getData('text/plain')
      if (!plainText) {
        e.preventDefault()
        e.stopImmediatePropagation()
        try {
          const savedPath = await window.api.clipboardReadNativeImage()
          if (savedPath) {
            console.debug(`[paste] case 3: native clipboard image → ${savedPath}`)
            window.api.ptyWrite(sessionIdRef.current, savedPath)
            return
          }
        } catch (err) {
          console.error('[paste] Failed to read native clipboard image:', err)
        }
        // No image found and no text — nothing to paste
        console.debug('[paste] case 3: no native image found, nothing to paste')
        return
      }

      // Text-only paste: let xterm.js handle it normally
      console.debug('[paste] fallthrough: text-only, letting xterm handle')
    }
    containerRef.current.addEventListener('paste', handlePaste, { capture: true })

    // ResizeObserver for container resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout>
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        fitAddon.fit()
      }, 50)
    })
    resizeObserver.observe(containerRef.current)

    onReady?.()

    // Watch for theme changes and update xterm colors in-place
    const themeObserver = new MutationObserver(() => {
      const newStyles = getComputedStyle(document.documentElement)
      const v = (name: string): string => newStyles.getPropertyValue(name).trim()
      term.options.theme = {
        background: v('--bg-primary'),
        foreground: v('--text-primary'),
        cursor: v('--accent'),
        cursorAccent: v('--bg-primary'),
        selectionBackground: v('--accent-subtle'),
        selectionForeground: v('--text-primary'),
        black: v('--term-black'),
        red: v('--term-red'),
        green: v('--term-green'),
        yellow: v('--term-yellow'),
        blue: v('--term-blue'),
        magenta: v('--term-magenta'),
        cyan: v('--term-cyan'),
        white: v('--term-white'),
        brightBlack: v('--term-bright-black'),
        brightRed: v('--term-bright-red'),
        brightGreen: v('--term-bright-green'),
        brightYellow: v('--term-bright-yellow'),
        brightBlue: v('--term-bright-blue'),
        brightMagenta: v('--term-bright-magenta'),
        brightCyan: v('--term-bright-cyan'),
        brightWhite: v('--term-bright-white')
      }
      // Clear WebGL texture cache to force re-render with updated colors
      try {
        if (webglAddon) {
          webglAddon.clearTextureAtlas()
        }
      } catch {
        /* ignore if not available */
      }
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    return (): void => {
      clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      containerRef.current?.removeEventListener('paste', handlePaste, { capture: true })
      cleanup()
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Listen for focus requests from keyboard navigation (Cmd+Enter)
  useEffect(() => {
    const handleFocusRequest = (e: Event): void => {
      const target = (e as CustomEvent).detail
      if (target === 'terminal' && termRef.current) {
        termRef.current.focus()
      }
    }
    window.addEventListener('task-detail-focus', handleFocusRequest)
    return () => window.removeEventListener('task-detail-focus', handleFocusRequest)
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        padding: 6
      }}
      className="terminal-focus-container"
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
