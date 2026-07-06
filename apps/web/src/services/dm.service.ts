import api from './api';

export interface DMPartner {
  _id: string;
  name: string;
  avatarUrl?: string;
}

export interface DMThreadData {
  threadId: string;
  partner: DMPartner | null;
  lastMessageAt: string;
  lastMessagePreview: string;
}

export interface DMMessageData {
  _id: string;
  threadId: string;
  senderId: { _id: string; name: string; avatarUrl?: string };
  content?: string;
  type: 'text' | 'file' | 'system';
  attachments?: { url: string; filename: string; filesize: number; type: 'image' | 'pdf' }[];
  createdAt: string;
}

export async function listDMThreads(): Promise<{ threads: DMThreadData[] }> {
  const { data } = await api.get('/dms');
  return data;
}

export async function createDMThread(recipientId: string): Promise<{ threadId: string; existing: boolean }> {
  const { data } = await api.post('/dms', { recipientId });
  return data;
}

export async function getDMMessages(
  threadId: string,
  page = 1,
): Promise<{ messages: DMMessageData[]; pagination: { total: number } }> {
  const { data } = await api.get(`/dms/${threadId}/messages`, { params: { page } });
  return data;
}

export async function sendDMMessage(
  threadId: string, 
  content: string, 
  attachments?: { url: string; filename: string; filesize: number; type: 'image' | 'pdf' }[]
): Promise<DMMessageData> {
  const { data } = await api.post(`/dms/${threadId}/messages`, { 
    content, 
    type: attachments?.length ? 'file' : 'text',
    attachments 
  });
  return data;
}
