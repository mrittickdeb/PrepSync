import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from '../controllers/notification.controller';

const router: Router = Router();

router.get('/notifications', requireAuth, listNotifications);
router.patch('/notifications/read-all', requireAuth, markAllRead);
router.patch('/notifications/:id/read', requireAuth, markRead);
router.delete('/notifications/:id', requireAuth, deleteNotification);

export default router;
