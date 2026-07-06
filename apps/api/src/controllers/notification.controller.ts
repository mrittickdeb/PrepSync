import { Request, Response, NextFunction } from 'express';
import { Notification } from '../models';
import { ApiError } from '../middleware/error';

// ===== GET /notifications — List user's notifications =====
export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}

// ===== PATCH /notifications/:id/read — Mark one as read =====
export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: user._id },
      { read: true },
      { new: true }
    );

    if (!notification) throw ApiError.notFound('Notification not found');

    res.json({ notification });
  } catch (error) {
    next(error);
  }
}

// ===== PATCH /notifications/read-all — Mark all as read =====
export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    await Notification.updateMany(
      { userId: user._id, read: false },
      { read: true }
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ===== DELETE /notifications/:id — Delete a notification =====
export async function deleteNotification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;
    const result = await Notification.deleteOne({ _id: id, userId: user._id });

    if (result.deletedCount === 0) {
      throw ApiError.notFound('Notification not found');
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
