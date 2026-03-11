/**
 * Platform abstraction for tmux session management.
 * Electron implementation lives in src/main/platform/.
 */
export interface ITmuxManager {
  listSessions(): Promise<string[]>
  createSession(sessionName: string, cwd: string): Promise<void>
  attachSession(sessionName: string): Promise<void>
  detachSession(sessionName: string): Promise<void>
  killSession(sessionName: string): Promise<void>
  hasSession(sessionName: string): Promise<boolean>
  getSessionName(taskId: string, paneIndex: number): string
}
