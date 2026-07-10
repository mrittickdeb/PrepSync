import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createCommunity,
  listCommunities,
  getCommunityDetails,
  toggleJoinCommunity,
  getCommunityPosts,
  createCommunityPost,
} from '../controllers/community.controller';

const router: Router = Router();

router.post('/communities', requireAuth, createCommunity);
router.get('/communities', requireAuth, listCommunities);
router.get('/communities/:communityId', requireAuth, getCommunityDetails);
router.post('/communities/:communityId/join', requireAuth, toggleJoinCommunity);
router.get('/communities/:communityId/posts', requireAuth, getCommunityPosts);
router.post('/communities/:communityId/posts', requireAuth, createCommunityPost);

export default router;
