import { useState, useCallback, useRef, useEffect } from 'react'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface MarqueeState {
  isSelecting: boolean
  rect: Rect | null
}

interface UseMarqueeSelectionOptions {
  /** CSS selector for elements that can be selected */
  itemSelector: string
  /** Called with the set of data-task-id values that intersect the marquee */
  onSelect: (ids: Set<string>) => void
  /** Attribute on selectable elements that holds the ID */
  idAttribute?: string
  /** Minimum drag distance before marquee activates */
  threshold?: number
}

export function useMarqueeSelection({
  itemSelector,
  onSelect,
  idAttribute = 'data-task-id',
  threshold = 5
}: UseMarqueeSelectionOptions) {
  const [state, setState] = useState<MarqueeState>({ isSelecting: false, rect: null })
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isActive = useRef(false)
  const didMarquee = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start marquee on left-click on the board/column background, not on cards
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      // Don't start marquee if clicking on a task card or interactive element
      if (target.closest('[data-task-id]') || target.closest('button') || target.closest('input')) {
        return
      }

      e.preventDefault() // Prevent native text selection
      startPoint.current = { x: e.clientX, y: e.clientY }
      isActive.current = false
    },
    []
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!startPoint.current) return

      const dx = e.clientX - startPoint.current.x
      const dy = e.clientY - startPoint.current.y

      // Don't activate until threshold is met
      if (!isActive.current && Math.sqrt(dx * dx + dy * dy) < threshold) {
        return
      }

      isActive.current = true
      e.preventDefault() // Prevent text selection while dragging

      const rect: Rect = {
        x: Math.min(e.clientX, startPoint.current.x),
        y: Math.min(e.clientY, startPoint.current.y),
        width: Math.abs(dx),
        height: Math.abs(dy)
      }

      setState({ isSelecting: true, rect })

      // Find intersecting task cards
      if (containerRef.current) {
        const cards = containerRef.current.querySelectorAll(itemSelector)
        const selected = new Set<string>()

        cards.forEach((card) => {
          const cardRect = card.getBoundingClientRect()
          const id = card.getAttribute(idAttribute)
          if (id && rectsIntersect(rect, cardRect)) {
            selected.add(id)
          }
        })

        onSelect(selected)
      }
    }

    const handleMouseUp = (): void => {
      if (startPoint.current) {
        const wasActive = isActive.current
        startPoint.current = null
        isActive.current = false
        didMarquee.current = wasActive
        // Keep selection intact — only hide the rectangle
        setState({ isSelecting: false, rect: null })
        // Clear any native text selection that may have snuck through
        if (wasActive) {
          window.getSelection()?.removeAllRanges()
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [itemSelector, idAttribute, onSelect, threshold])

  /** Returns true (and resets) if a marquee drag just finished — call from onClick to suppress clearing. */
  const consumeMarqueeClick = useCallback((): boolean => {
    if (didMarquee.current) {
      didMarquee.current = false
      return true
    }
    return false
  }, [])

  return {
    containerRef,
    marqueeRect: state.rect,
    isSelecting: state.isSelecting,
    handleMouseDown,
    consumeMarqueeClick
  }
}

function rectsIntersect(a: Rect, b: DOMRect): boolean {
  return !(
    a.x + a.width < b.left ||
    a.x > b.right ||
    a.y + a.height < b.top ||
    a.y > b.bottom
  )
}
