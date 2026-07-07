import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../middleware/error';
import Session from '../models/Session';

// ===== GET /users/me =====
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw ApiError.unauthorized();
    }
    res.json((user as any).toJSON());
  } catch (error) {
    next(error);
  }
}

// ===== PATCH /users/me =====
export async function updateMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw ApiError.unauthorized();
    }

    const allowedFields = ['name', 'avatarUrl', 'goal', 'targetDomains', 'weeklyGoal'];
    const updates = Object.keys(req.body);
    const invalidFields = updates.filter((f) => !allowedFields.includes(f));

    if (invalidFields.length > 0) {
      throw ApiError.badRequest(`Cannot update: ${invalidFields.join(', ')}`);
    }

    for (const field of updates) {
      if (allowedFields.includes(field)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (user as any)[field] = req.body[field];
      }
    }

    await (user as any).save();
    res.json((user as any).toJSON());
  } catch (error) {
    next(error);
  }
}

// ===== GET /users/me/activity =====
export async function getActivity(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { timezone = 'UTC' } = req.query as { timezone?: string };

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const userObjId = new mongoose.Types.ObjectId(String((user as any)._id));

    const activity = await Session.aggregate([
      { 
        $match: { 
          $or: [{ userId: userObjId }, { peerId: userObjId }],
          startedAt: { $gte: oneYearAgo } 
        } 
      },
      { 
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt", timezone } },
          count: { $sum: 1 }
        }
      }
    ]);

    const result: Record<string, number> = {};
    for (const item of activity) {
      result[item._id] = item.count;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
}
