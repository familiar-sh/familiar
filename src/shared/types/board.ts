import type { Task, TaskStatus } from './task'

export interface ProjectState {
  version: number
  projectName: string
  tasks: Task[]
  columnOrder: TaskStatus[]
  labels: string[]
}
