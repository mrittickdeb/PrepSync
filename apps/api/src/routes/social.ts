import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createPost,
  getFeed,
  toggleLikePost,
  getComments,
  addComment,
  toggleFollow,
  getFollowSuggestions,
} from '../controllers/social.controller';

const router: Router = Router();

router.post('/posts', requireAuth, createPost);
router.get('/posts/feed', requireAuth, getFeed);
router.post('/posts/:postId/like', requireAuth, toggleLikePost);
router.get('/posts/:postId/comments', requireAuth, getComments);
router.post('/posts/:postId/comments', requireAuth, addComment);
router.post('/users/follow', requireAuth, toggleFollow);
router.get('/users/follow-suggestions', requireAuth, getFollowSuggestions);

export default router;
