export interface AppNotification {
  id: string
  title: string
  body?: string
  taskId?: string
  read: boolean
  createdAt: string // ISO 8601
}
