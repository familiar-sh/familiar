import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useTerminalStore } from '@renderer/stores/terminal-store'

/**
 * Cleans up terminal sessions for tasks that no longer belong to the active
 * project when the user switches between projects in a multi-project workspace.
 *
 * Background tmux sessions keep running (they are OS-level processes), but the
 * in-memory terminal store entries are removed so stale tabs don't appear.
 *
 * We listen to projectState changes (not activeProjectPath) because the task
 * store is only updated AFTER loadProjectState() completes. Reading projectState
 * at the moment activeProjectPath changes would still see the OLD project's tasks.
 */
export function useProjectSwitchCleanup(): void {
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)
  const projectState = useTaskStore((s) => s.projectState)
  const prevProjectPath = useRef<string | null>(activeProjectPath)

  useEffect(() => {
    // Only act when the project path actually changed (not on initial mount
    // or when projectState refreshes within the same project)
    if (prevProjectPath.current === activeProjectPath) return
    prevProjectPath.current = activeProjectPath

    // Now projectState reflects the newly active project's tasks
    const activeTaskIds = (projectState?.tasks ?? []).map((t) => t.id)
    useTerminalStore.getState().clearSessionsForNonActiveTasks(activeTaskIds)
  }, [activeProjectPath, projectState])
}
