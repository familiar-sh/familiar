import { useState, useEffect } from 'react'
import type { LabelConfig } from '@shared/types'
import { DEFAULT_LABELS } from '@shared/constants'

/**
 * Loads project labels from settings and listens for updates.
 * Returns the current label configs.
 */
export function useProjectLabels(): LabelConfig[] {
  const [labels, setLabels] = useState<LabelConfig[]>(DEFAULT_LABELS)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const settings = await window.api.readSettings()
        if (settings.labels) {
          setLabels(settings.labels)
        }
      } catch {
        // Use defaults
      }
    }
    load()

    function handleLabelsUpdated(e: Event): void {
      const updated = (e as CustomEvent).detail as LabelConfig[]
      if (updated) {
        setLabels(updated)
      }
    }
    window.addEventListener('labels-updated', handleLabelsUpdated)
    return () => window.removeEventListener('labels-updated', handleLabelsUpdated)
  }, [])

  return labels
}
