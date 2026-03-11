import { useState, useCallback, useEffect } from 'react'

interface ContextMenuState {
  isOpen: boolean
  position: { x: number; y: number }
}

interface UseContextMenuReturn {
  isOpen: boolean
  position: { x: number; y: number }
  open: (e: React.MouseEvent) => void
  close: () => void
}

export function useContextMenu(): UseContextMenuReturn {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 }
  })

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Clamp to viewport bounds
    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 200)

    setState({ isOpen: true, position: { x, y } })
  }, [])

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  // Close on outside click or scroll
  useEffect(() => {
    if (!state.isOpen) return

    const handleClick = (): void => close()
    const handleScroll = (): void => close()
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }

    window.addEventListener('click', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.isOpen, close])

  return {
    isOpen: state.isOpen,
    position: state.position,
    open,
    close
  }
}
