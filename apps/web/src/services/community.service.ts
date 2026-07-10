import api from './api';
import { Author } from './social.service';

export interface CommunityInfo {
  _id: string;
  name: string;
  description: string;
  creator: Author;
  members: string[] | Author[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPost {
  _id: string;
  author: Author;
  content: string;
  attachments: { type: 'image' | 'video'; url: string }[];
  likes: string[];
  reposts: string[];
  commentsCount: number;
  community: string;
  createdAt: string;
  updatedAt: string;
}

export const communityService = {
  listCommunities: async (search?: string): Promise<CommunityInfo[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const { data } = await api.get(`/communities?${params.toString()}`);
    return data;
  },

  createCommunity: async (name: string, description: string): Promise<CommunityInfo> => {
    const { data } = await api.post('/communities', { name, description });
    return data;
  },

  getCommunityDetails: async (communityId: string): Promise<CommunityInfo> => {
    const { data } = await api.get(`/communities/${communityId}`);
    return data;
  },

  toggleJoin: async (communityId: string): Promise<{ isJoined: boolean; members: string[]; membersCount: number }> => {
    const { data } = await api.post(`/communities/${communityId}/join`);
    return data;
  },

  getCommunityPosts: async (communityId: string): Promise<CommunityPost[]> => {
    const { data } = await api.get(`/communities/${communityId}/posts`);
    return data;
  },

  createCommunityPost: async (communityId: string, content: string, attachments: { type: string; url: string }[] = []): Promise<CommunityPost> => {
    const { data } = await api.post(`/communities/${communityId}/posts`, { content, attachments });
    return data;
  },
};
