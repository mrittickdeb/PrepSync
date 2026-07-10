import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createVideo,
  listVideos,
  getVideo,
  toggleLikeVideo,
  getVideoComments,
  addVideoComment,
} from '../controllers/video.controller';

const router: Router = Router();

router.post('/videos', requireAuth, createVideo);
router.get('/videos', requireAuth, listVideos);
router.get('/videos/:videoId', requireAuth, getVideo);
router.post('/videos/:videoId/like', requireAuth, toggleLikeVideo);
router.get('/videos/:videoId/comments', requireAuth, getVideoComments);
router.post('/videos/:videoId/comments', requireAuth, addVideoComment);

export default router;
