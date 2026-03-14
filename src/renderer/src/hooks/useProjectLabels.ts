import { useState, useEffect } from 'react'
import type { LabelConfig } from '@shared/types'
import { DEFAULT_LABELS } from '@shared/constants'
import { onFileChange } from '@renderer/lib/file-change-hub'

/**
 * Loads project labels from settings and listens for updates.
 * Re-fetches when settings change on disk (via file watcher) or
 * when labels are updated in the settings UI.
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

    // Re-fetch when labels are updated from the settings UI
    function handleLabelsUpdated(e: Event): void {
      const updated = (e as CustomEvent).detail as LabelConfig[]
      if (updated) {
        setLabels(updated)
      }
    }
    window.addEventListener('labels-updated', handleLabelsUpdated)

    // Re-fetch when any .familiar/ file changes (e.g. CLI edits settings.json)
    const unwatch = onFileChange(() => {
      load()
    })

    return () => {
      window.removeEventListener('labels-updated', handleLabelsUpdated)
      unwatch()
    }
  }, [])

  return labels
}
