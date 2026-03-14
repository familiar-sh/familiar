export type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'archived'

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none'

export type AgentStatus = 'idle' | 'running' | 'done' | 'error'

export type PastedFileType = 'text' | 'image' | 'binary'

export interface TaskPastedFile {
  filename: string // e.g. "pasted-1710264000000.md"
  type: PastedFileType
  size: number // bytes
  lineCount?: number // for text files only
  label: string // auto-generated from first line, truncated
  createdAt: string // ISO 8601
}

export interface Task {
  id: string // nanoid, e.g. "tsk_a1b2c3"
  title: string
  status: TaskStatus
  priority: Priority
  labels: string[]
  agentStatus: AgentStatus
  createdAt: string // ISO 8601
  updatedAt: string
  sortOrder: number // within column
  statusChangedAt?: string // ISO 8601 — when the task entered its current status column
  attachments?: string[] // filenames in task attachments folder
  pastedFiles?: TaskPastedFile[] // large pasted content stored as files
  forkedFrom?: string // parent task ID when this task was forked
  forks?: string[] // child task IDs created by forking this task
}
