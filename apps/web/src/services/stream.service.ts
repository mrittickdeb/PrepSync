import api from './api';
import { Author } from './social.service';

export interface StreamInfo {
  _id: string;
  title: string;
  description: string;
  host: Author;
  roomName: string;
  status: 'live' | 'ended';
  viewers: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export const streamService = {
  goLive: async (title: string, description: string, category: string): Promise<StreamInfo> => {
    const { data } = await api.post('/streams', { title, description, category });
    return data;
  },

  listActiveStreams: async (search?: string, category?: string): Promise<StreamInfo[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    const { data } = await api.get(`/streams?${params.toString()}`);
    return data;
  },

  getStream: async (streamId: string): Promise<StreamInfo> => {
    const { data } = await api.get(`/streams/${streamId}`);
    return data;
  },

  endStream: async (streamId: string): Promise<{ message: string; stream: StreamInfo }> => {
    const { data } = await api.post(`/streams/${streamId}/end`);
    return data;
  },
};
