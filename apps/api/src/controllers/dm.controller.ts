import { Request, Response, NextFunction } from 'express';
import { DMThread, DMMessage } from '../models/DM';
import { User } from '../models';
import { ApiError } from '../middleware/error';

// ===== GET /dms — List user's DM threads =====
export async function listThreads(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const threads = await DMThread.find({ participants: user._id })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'name avatarUrl readinessIndex.overall')
      .lean();

    const result = threads.map((thread) => {
      const other = thread.participants.find(
        (p: any) => p._id.toString() !== user._id.toString(),
      );
      return {
        threadId: thread._id,
        partner: other
          ? { _id: (other as any)._id, name: (other as any).name, avatarUrl: (other as any).avatarUrl }
          : null,
        lastMessageAt: thread.lastMessageAt,
        lastMessagePreview: thread.lastMessagePreview,
      };
    });

    res.json({ threads: result });
  } catch (error) {
    next(error);
  }
}

// ===== POST /dms — Start a new DM thread =====
export async function createThread(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { recipientId } = req.body as { recipientId: string };
    if (!recipientId) throw ApiError.badRequest('recipientId is required');

    // Check if thread already exists between these two users
    const existing = await DMThread.findOne({
      participants: { $all: [user._id, recipientId] },
    });

    if (existing) {
      res.json({ threadId: existing._id, existing: true });
      return;
    }

    // Verify the recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) throw ApiError.notFound('User not found');

    const thread = await DMThread.create({
      participants: [user._id, recipientId],
    });

    res.status(201).json({ threadId: thread._id, existing: false });
  } catch (error) {
    next(error);
  }
}

// ===== GET /dms/:threadId/messages — Paginated messages =====
export async function getMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { threadId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Verify user is participant
    const thread = await DMThread.findById(threadId);
    if (!thread) throw ApiError.notFound('Thread not found');
    if (!thread.participants.some((p) => p.toString() === user._id.toString())) {
      throw ApiError.forbidden('You are not a participant of this conversation');
    }

    const [messages, total] = await Promise.all([
      DMMessage.find({ threadId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('senderId', 'name avatarUrl')
        .lean(),
      DMMessage.countDocuments({ threadId }),
    ]);

    // Mark messages as read
    await DMMessage.updateMany(
      { threadId, readBy: { $ne: user._id } },
      { $addToSet: { readBy: user._id } },
    );

    res.json({
      messages: messages.reverse(),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /dms/:threadId/messages — Send a DM =====
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { threadId } = req.params;
    const { content, type = 'text', attachments, replyTo } = req.body as { 
      content?: string; 
      type?: 'text' | 'file';
      attachments?: { url: string; filename: string; filesize: number; type: 'image' | 'pdf' }[];
      replyTo?: {
        messageId: string;
        senderName: string;
        content: string;
      };
    };

    if (type === 'text' && (!content || !content.trim())) {
      throw ApiError.badRequest('Message content is required');
    }

    // Verify user is participant
    const thread = await DMThread.findById(threadId);
    if (!thread) throw ApiError.notFound('Thread not found');
    if (!thread.participants.some((p) => p.toString() === user._id.toString())) {
      throw ApiError.forbidden('You are not a participant of this conversation');
    }

    const message = await DMMessage.create({
      threadId,
      senderId: user._id,
      content: content?.trim(),
      type,
      attachments,
      readBy: [user._id],
      replyTo,
    });

    // Update thread with last message info
    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = content?.trim().slice(0, 80) || (type === 'file' ? '📎 File' : '');
    await thread.save();

    const populated = await message.populate('senderId', 'name avatarUrl');

    try {
      const { getIO } = require('../socket/socketHandler');
      getIO().to(`dm:${threadId}`).emit('dm:message', populated);
    } catch {
      // ignore socket emit error
    }

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}
