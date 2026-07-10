import api from './api';

export interface Author {
  _id: string;
  name: string;
  avatarUrl?: string;
  readinessIndex?: {
    overall: number;
  };
}

export interface Attachment {
  type: 'image' | 'video';
  url: string;
}

export interface PostInfo {
  _id: string;
  author: Author;
  content: string;
  attachments: Attachment[];
  likes: string[];
  reposts: string[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentInfo {
  _id: string;
  post: string;
  author: Author;
  content: string;
  likes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionInfo {
  _id: string;
  name: string;
  avatarUrl?: string;
  readinessIndex?: {
    overall: number;
  };
  followers: string[];
}

export const socialService = {
  getFeed: async (): Promise<PostInfo[]> => {
    const { data } = await api.get('/posts/feed');
    return data;
  },

  createPost: async (content: string, attachments: Attachment[] = []): Promise<PostInfo> => {
    const { data } = await api.post('/posts', { content, attachments });
    return data;
  },

  likePost: async (postId: string): Promise<{ likes: string[]; likesCount: number; isLiked: boolean }> => {
    const { data } = await api.post(`/posts/${postId}/like`);
    return data;
  },

  getComments: async (postId: string): Promise<CommentInfo[]> => {
    const { data } = await api.get(`/posts/${postId}/comments`);
    return data;
  },

  addComment: async (postId: string, content: string): Promise<CommentInfo> => {
    const { data } = await api.post(`/posts/${postId}/comments`, { content });
    return data;
  },

  followUser: async (targetUserId: string): Promise<{ isFollowing: boolean; followingCount: number; followersCount: number }> => {
    const { data } = await api.post('/users/follow', { targetUserId });
    return data;
  },

  getFollowSuggestions: async (): Promise<SuggestionInfo[]> => {
    const { data } = await api.get('/users/follow-suggestions');
    return data;
  },
};
