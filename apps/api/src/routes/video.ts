import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createVideo,
  listVideos,
  getVideo,
  toggleLikeVideo,
  toggleDislikeVideo,
  getUserVideos,
  getRecommendedVideos,
  subscribeToChannel,
  getVideoComments,
  addVideoComment,
} from '../controllers/video.controller';

const router: Router = Router();

router.post('/videos', requireAuth, createVideo);
router.get('/videos', requireAuth, listVideos);
router.get('/videos/user/:userId', requireAuth, getUserVideos);
router.get('/videos/:videoId', requireAuth, getVideo);
router.get('/videos/:videoId/recommended', requireAuth, getRecommendedVideos);
router.post('/videos/:videoId/like', requireAuth, toggleLikeVideo);
router.post('/videos/:videoId/dislike', requireAuth, toggleDislikeVideo);
router.get('/videos/:videoId/comments', requireAuth, getVideoComments);
router.post('/videos/:videoId/comments', requireAuth, addVideoComment);
router.post('/videos/channel/:channelUserId/subscribe', requireAuth, subscribeToChannel);

export default router;
