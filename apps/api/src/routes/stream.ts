import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  goLive,
  listActiveStreams,
  getStream,
  endStream,
} from '../controllers/stream.controller';

const router: Router = Router();

router.post('/streams', requireAuth, goLive);
router.get('/streams', requireAuth, listActiveStreams);
router.get('/streams/:streamId', requireAuth, getStream);
router.post('/streams/:streamId/end', requireAuth, endStream);

export default router;
