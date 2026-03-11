export interface TerminalSession {
  id: string
  taskId: string
  paneIndex: number
  sessionName: string // e.g. "kanban-tsk_a1b2c3-0"
  isActive: boolean
}

export interface TerminalPane {
  id: string
  sessionName: string
  title: string
}
