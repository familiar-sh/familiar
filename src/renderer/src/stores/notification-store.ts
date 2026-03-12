import { create } from 'zustand'
import type { AppNotification } from '@shared/types'

interface NotificationState {
  notifications: AppNotification[]
  loading: boolean

  loadNotifications: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markReadByTaskId: (taskId: string) => Promise<void>
  markAllRead: () => Promise<void>
  clearAll: () => Promise<void>
  unreadCount: () => number
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,

  loadNotifications: async () => {
    try {
      const notifications = await window.api.listNotifications()
      set({ notifications })
    } catch {
      // ignore — project may not be initialized
    }
  },

  markRead: async (id: string) => {
    await window.api.markNotificationRead(id)
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
    }))
  },

  markReadByTaskId: async (taskId: string) => {
    await window.api.markNotificationsByTaskRead(taskId)
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.taskId === taskId ? { ...n, read: true } : n
      )
    }))
  },

  markAllRead: async () => {
    await window.api.markAllNotificationsRead()
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true }))
    }))
  },

  clearAll: async () => {
    await window.api.clearNotifications()
    set({ notifications: [] })
  },

  unreadCount: () => {
    return get().notifications.filter((n) => !n.read).length
  }
}))
