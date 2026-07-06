import { create } from 'zustand';
import { 
  NotificationData, 
  listNotifications, 
  markNotificationRead, 
  markAllNotificationsRead, 
  deleteNotification as apiDeleteNotification 
} from '../services/notification.service';
import { Socket } from 'socket.io-client';

interface NotificationState {
  notifications: NotificationData[];
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  addNotification: (notification: NotificationData) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  initSocket: (socket: Socket) => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const data = await listNotifications();
      set({ notifications: data.notifications });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      set({ loading: false });
    }
  },

  addNotification: (notification) => {
    set((state) => {
      // Avoid duplicate notifications if already added
      if (state.notifications.some((n) => n._id === notification._id)) {
        return state;
      }
      return { notifications: [notification, ...state.notifications] };
    });
  },

  markAsRead: async (id) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, read: true } : n
      ),
    }));

    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // Revert if API fails
      get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));

    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      get().fetchNotifications();
    }
  },

  deleteNotification: async (id) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.filter((n) => n._id !== id),
    }));

    try {
      await apiDeleteNotification(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
      get().fetchNotifications();
    }
  },

  initSocket: (socket: Socket) => {
    const handleNewNotification = (notification: NotificationData) => {
      get().addNotification(notification);

      // Play a subtle notification sound if enabled
      try {
        const audio = new Audio('/assets/notification.mp3');
        audio.play().catch(() => {
          // Ignore audio play block by browser
        });
      } catch {
        // Ignore errors
      }
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  },
}));
