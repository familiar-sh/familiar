/**
 * Platform abstraction for PTY (pseudo-terminal) operations.
 * Electron implementation lives in src/main/platform/.
 */
export interface IPtyManager {
  create(taskId: string, paneId: string, cwd: string): Promise<string> // returns sessionId
  write(sessionId: string, data: string): Promise<void>
  resize(sessionId: string, cols: number, rows: number): Promise<void>
  destroy(sessionId: string): Promise<void>
  onData(callback: (sessionId: string, data: string) => void): () => void // returns unsubscribe
}
