import api from './api';

export interface Author {
  _id: string;
  name: string;
  avatarUrl?: string;
  readinessIndex?: {
    overall: number;
  };
  followers?: string[];
  following?: string[];
}

export interface Attachment {
  type: 'image' | 'video';
  url: string;
}

export interface PollOption {
  text: string;
  votes: string[];
}

export interface PostInfo {
  _id: string;
  author: Author;
  content: string;
  attachments: Attachment[];
  likes: string[];
  reposts: string[];
  bookmarks: string[];
  commentsCount: number;
  hashtags: string[];
  postType: 'text' | 'media' | 'poll';
  isPinned: boolean;
  impressions: number;
  poll?: {
    options: PollOption[];
    expiresAt?: string;
  };
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
  following?: string[];
}

export interface TrendingHashtag {
  _id: string;
  count: number;
}

export const socialService = {
  getFeed: async (tab: 'foryou' | 'following' = 'foryou'): Promise<PostInfo[]> => {
    const { data } = await api.get(`/posts/feed?tab=${tab}`);
    return data;
  },

  createPost: async (
    content: string,
    attachments: Attachment[] = [],
    poll?: { options: string[]; expiresAt?: string }
  ): Promise<PostInfo> => {
    const { data } = await api.post('/posts', { content, attachments, poll });
    return data;
  },

  likePost: async (postId: string): Promise<{ likes: string[]; likesCount: number; isLiked: boolean }> => {
    const { data } = await api.post(`/posts/${postId}/like`);
    return data;
  },

  bookmarkPost: async (postId: string): Promise<{ bookmarks: string[]; isBookmarked: boolean }> => {
    const { data } = await api.post(`/posts/${postId}/bookmark`);
    return data;
  },

  getBookmarkedPosts: async (): Promise<PostInfo[]> => {
    const { data } = await api.get('/posts/bookmarks');
    return data;
  },

  repostPost: async (postId: string): Promise<{ reposts: string[]; repostsCount: number; isReposted: boolean }> => {
    const { data } = await api.post(`/posts/${postId}/repost`);
    return data;
  },

  deletePost: async (postId: string): Promise<void> => {
    await api.delete(`/posts/${postId}`);
  },

  getUserPosts: async (userId: string): Promise<PostInfo[]> => {
    const { data } = await api.get(`/posts/user/${userId}`);
    return data;
  },

  votePoll: async (postId: string, optionIndex: number): Promise<{ poll: { options: PollOption[]; expiresAt?: string } }> => {
    const { data } = await api.post(`/posts/${postId}/poll/vote`, { optionIndex });
    return data;
  },

  getTrendingHashtags: async (): Promise<TrendingHashtag[]> => {
    const { data } = await api.get('/posts/trending');
    return data;
  },

  getPostsByHashtag: async (tag: string): Promise<PostInfo[]> => {
    const { data } = await api.get(`/posts/hashtag/${encodeURIComponent(tag)}`);
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
