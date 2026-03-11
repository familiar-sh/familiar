export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done' | 'cancelled'

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none'

export type AgentStatus = 'idle' | 'running' | 'done' | 'error'

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
}
