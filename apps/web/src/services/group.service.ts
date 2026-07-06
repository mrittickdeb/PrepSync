import api from './api';

export interface GroupInfo {
  groupId: string;
  name: string;
  domain: string;
  color: string;
  lastMessage: {
    content: string;
    senderName: string;
    timestamp: string;
  } | null;
  totalMessages: number;
}

export interface GroupMessageUser {
  _id: string;
  name: string;
  avatarUrl?: string;
}

export interface PollOptionData {
  text: string;
  voteCount?: number;
  votes?: string[];
}

export interface AttachmentData {
  type: 'image' | 'video' | 'audio' | 'document' | 'voice';
  url: string;
  filename: string;
  filesize: number;
  mimeType?: string;
  duration?: number;
  thumbnailUrl?: string;
}

export interface GroupMessageData {
  _id: string;
  groupId: string;
  userId: GroupMessageUser;
  type: 'text' | 'file' | 'poll' | 'system' | 'voice';
  content?: string;
  attachments?: AttachmentData[];
  poll?: {
    question: string;
    options: PollOptionData[];
    expiresAt?: string;
    closed: boolean;
  };
  replyTo?: {
    messageId: string;
    senderName: string;
    content: string;
  };
  createdAt: string;
}

export async function listGroups(): Promise<{ groups: GroupInfo[] }> {
  const { data } = await api.get('/groups');
  return data;
}

export async function getGroupMessages(
  groupId: string,
  page = 1,
  limit = 50,
): Promise<{ messages: GroupMessageData[]; pagination: { total: number; totalPages: number } }> {
  const { data } = await api.get(`/groups/${groupId}/messages`, { params: { page, limit } });
  return data;
}

export async function sendGroupMessage(
  groupId: string,
  content: string,
  replyTo?: { messageId: string; senderName: string; content: string },
): Promise<GroupMessageData> {
  const { data } = await api.post(`/groups/${groupId}/messages`, { content, type: 'text', replyTo });
  return data;
}

export async function sendFileMessage(
  groupId: string,
  attachments: AttachmentData[],
  content?: string,
): Promise<GroupMessageData> {
  const { data } = await api.post(`/groups/${groupId}/messages`, {
    type: 'file',
    attachments,
    content: content?.trim() || undefined,
  });
  return data;
}

export async function sendVoiceMessage(
  groupId: string,
  attachment: AttachmentData,
): Promise<GroupMessageData> {
  const { data } = await api.post(`/groups/${groupId}/messages`, {
    type: 'voice',
    attachments: [attachment],
  });
  return data;
}

export async function createPoll(
  groupId: string,
  question: string,
  options: string[],
  expiresInMinutes?: number,
): Promise<GroupMessageData> {
  const { data } = await api.post(`/groups/${groupId}/polls`, { question, options, expiresInMinutes });
  return data;
}

export async function votePoll(
  groupId: string,
  pollId: string,
  optionIndex: number,
): Promise<{ pollId: string; options: PollOptionData[] }> {
  const { data } = await api.post(`/groups/${groupId}/polls/${pollId}/vote`, { optionIndex });
  return data;
}

export async function deleteGroupMessage(groupId: string, messageId: string): Promise<void> {
  await api.delete(`/groups/${groupId}/messages/${messageId}`);
}
