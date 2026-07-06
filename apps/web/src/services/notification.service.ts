import api from './api';

export interface NotificationData {
  _id: string;
  userId: string;
  type: 'dm' | 'reply' | 'mention' | 'info';
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(): Promise<{ notifications: NotificationData[] }> {
  const { data } = await api.get('/notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<{ notification: NotificationData }> {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  const { data } = await api.patch('/notifications/read-all');
  return data;
}

export async function deleteNotification(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/notifications/${id}`);
  return data;
}
