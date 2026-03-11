import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
  onReady?: () => void
}

export function Terminal({ sessionId, onReady }: TerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: {
        background: '#0d0d12',
        foreground: '#f0f0f4',
        cursor: '#5e6ad2',
        selectionBackground: '#5e6ad233',
        black: '#1a1a27',
        red: '#e74c3c',
        green: '#27ae60',
        yellow: '#f2c94c',
        blue: '#5e6ad2',
        magenta: '#b07cd8',
        cyan: '#56b6c2',
        white: '#f0f0f4',
        brightBlack: '#5c5c6e',
        brightRed: '#e74c3c',
        brightGreen: '#27ae60',
        brightYellow: '#f2c94c',
        brightBlue: '#6e7ae2',
        brightMagenta: '#c49de8',
        brightCyan: '#6ec8d4',
        brightWhite: '#ffffff'
      },
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(containerRef.current)

    // Try WebGL renderer for better performance
    try {
      const webglAddon = new WebglAddon()
      term.loadAddon(webglAddon)
    } catch (e) {
      console.warn('WebGL renderer not available, falling back to canvas')
    }

    fitAddon.fit()
    termRef.current = term
    fitAddonRef.current = fitAddon

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

    // Handle resize
    term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      window.api.ptyResize(sessionId, cols, rows)
    })

    // ResizeObserver for container resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(containerRef.current)

    onReady?.()

    return (): void => {
      resizeObserver.disconnect()
      cleanup()
      term.dispose()
    }
  }, [sessionId])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: '4px' }}
    />
  )
}
