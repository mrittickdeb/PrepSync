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
  commentsCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const videoService = {
  listVideos: async (search?: string, tag?: string): Promise<VideoInfo[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tag) params.append('tag', tag);
    
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
  }): Promise<VideoInfo> => {
    const { data } = await api.post('/videos', video);
    return data;
  },

  getVideo: async (videoId: string): Promise<VideoInfo> => {
    const { data } = await api.get(`/videos/${videoId}`);
    return data;
  },

  likeVideo: async (videoId: string): Promise<{ likes: string[]; likesCount: number; isLiked: boolean }> => {
    const { data } = await api.post(`/videos/${videoId}/like`);
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
