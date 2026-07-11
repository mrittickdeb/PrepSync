import api from './api';
import { Author, CommentInfo } from './social.service';

export interface VideoInfo {
  _id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
  duration: string;
  author: Author;
  views: number;
  likes: string[];
  dislikes: string[];
  commentsCount: number;
  tags: string[];
  category: string;
  createdAt: string;
  updatedAt: string;
}

export const videoService = {
  listVideos: async (search?: string, tag?: string, category?: string, sort?: string): Promise<VideoInfo[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tag) params.append('tag', tag);
    if (category) params.append('category', category);
    if (sort) params.append('sort', sort);

    const { data } = await api.get(`/videos?${params.toString()}`);
    return data;
  },

  createVideo: async (video: {
    title: string;
    description?: string;
    url: string;
    thumbnailUrl?: string;
    duration?: string;
    tags?: string[];
    category?: string;
  }): Promise<VideoInfo> => {
    const { data } = await api.post('/videos', video);
    return data;
  },

  getVideo: async (videoId: string): Promise<VideoInfo> => {
    const { data } = await api.get(`/videos/${videoId}`);
    return data;
  },

  likeVideo: async (videoId: string): Promise<{ likes: string[]; dislikes: string[]; likesCount: number; dislikesCount: number; isLiked: boolean }> => {
    const { data } = await api.post(`/videos/${videoId}/like`);
    return data;
  },

  dislikeVideo: async (videoId: string): Promise<{ likes: string[]; dislikes: string[]; likesCount: number; dislikesCount: number; isDisliked: boolean }> => {
    const { data } = await api.post(`/videos/${videoId}/dislike`);
    return data;
  },

  getUserVideos: async (userId: string): Promise<VideoInfo[]> => {
    const { data } = await api.get(`/videos/user/${userId}`);
    return data;
  },

  getRecommendedVideos: async (videoId: string): Promise<VideoInfo[]> => {
    const { data } = await api.get(`/videos/${videoId}/recommended`);
    return data;
  },

  subscribeToChannel: async (channelUserId: string): Promise<{ isSubscribed: boolean; subscriberCount: number }> => {
    const { data } = await api.post(`/videos/channel/${channelUserId}/subscribe`);
    return data;
  },

  getVideoComments: async (videoId: string): Promise<CommentInfo[]> => {
    const { data } = await api.get(`/videos/${videoId}/comments`);
    return data;
  },

  addVideoComment: async (videoId: string, content: string): Promise<CommentInfo> => {
    const { data } = await api.post(`/videos/${videoId}/comments`, { content });
    return data;
  },
};
export type { CommentInfo };
