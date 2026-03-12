import type { TaskStatus, Priority, AgentStatus, LabelConfig } from './types'

export const DEFAULT_COLUMNS: TaskStatus[] = [
  'todo',
  'in-progress',
  'in-review',
  'done',
  'archived'
]

export const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  done: 'Done',
  archived: 'Archive'
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: '#f44336',
  high: '#ff9800',
  medium: '#ffeb3b',
  low: '#4caf50',
  none: '#6b7280'
}

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  done: 'Done',
  error: 'Error'
}

// Default label color for labels without a configured color
export const DEFAULT_LABEL_COLOR = '#6b7280'

// Default labels seeded on project init
export const DEFAULT_LABELS: LabelConfig[] = [
  { name: 'bug', color: '#ef4444' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'chore', color: '#6b7280' }
]

// File system paths
export const DATA_DIR = '.kanban-agent'
export const STATE_FILE = 'state.json'
export const TASKS_DIR = 'tasks'
export const TASK_FILE = 'task.json'
export const DOCUMENT_FILE = 'document.md'
export const ACTIVITY_FILE = 'activity.json'
export const ATTACHMENTS_DIR = 'attachments'
export const SETTINGS_FILE = 'settings.json'
export const NOTIFICATIONS_FILE = 'notifications.json'

export const APP_NAME = 'Kanban Agent'
