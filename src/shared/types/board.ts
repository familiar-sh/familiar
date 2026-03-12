import type { Task, TaskStatus } from './task'

export interface LabelConfig {
  name: string
  color: string // hex color, e.g. "#ef4444"
  description?: string
}

export interface ProjectState {
  version: number
  projectName: string
  tasks: Task[]
  columnOrder: TaskStatus[]
  labels: LabelConfig[]
}
