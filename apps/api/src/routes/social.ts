import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createPost,
  getFeed,
  toggleLikePost,
  toggleBookmark,
  getBookmarkedPosts,
  toggleRepost,
  deletePost,
  getUserPosts,
  votePoll,
  getTrendingHashtags,
  getPostsByHashtag,
  getComments,
  addComment,
  toggleFollow,
  getFollowSuggestions,
} from '../controllers/social.controller';

const router: Router = Router();

// Posts
router.post('/posts', requireAuth, createPost);
router.get('/posts/feed', requireAuth, getFeed);
router.get('/posts/bookmarks', requireAuth, getBookmarkedPosts);
router.get('/posts/trending', requireAuth, getTrendingHashtags);
router.get('/posts/hashtag/:tag', requireAuth, getPostsByHashtag);
router.get('/posts/user/:userId', requireAuth, getUserPosts);
router.post('/posts/:postId/like', requireAuth, toggleLikePost);
router.post('/posts/:postId/bookmark', requireAuth, toggleBookmark);
router.post('/posts/:postId/repost', requireAuth, toggleRepost);
router.post('/posts/:postId/poll/vote', requireAuth, votePoll);
router.delete('/posts/:postId', requireAuth, deletePost);
router.get('/posts/:postId/comments', requireAuth, getComments);
router.post('/posts/:postId/comments', requireAuth, addComment);

// Users
router.post('/users/follow', requireAuth, toggleFollow);
router.get('/users/follow-suggestions', requireAuth, getFollowSuggestions);

export default router;
