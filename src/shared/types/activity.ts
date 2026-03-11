export interface ActivityEntry {
  id: string
  timestamp: string
  type: 'status_change' | 'agent_event' | 'note' | 'created' | 'updated'
  message: string
  metadata?: Record<string, unknown>
}
