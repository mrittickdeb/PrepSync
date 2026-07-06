import { Request, Response, NextFunction } from 'express';
import GroupMessage from '../models/GroupMessage';
import { ApiError } from '../middleware/error';

const VALID_GROUPS = ['dsa', 'system-design', 'backend', 'conceptual', 'behavioural'];

const GROUP_INFO: Record<string, { name: string; domain: string; color: string }> = {
  dsa: { name: 'DSA Group', domain: 'dsa', color: '#7C3AED' },
  'system-design': { name: 'System Design Group', domain: 'systemDesign', color: '#0EA5E9' },
  backend: { name: 'Backend Group', domain: 'backend', color: '#10B981' },
  conceptual: { name: 'Conceptual Group', domain: 'conceptual', color: '#F59E0B' },
  behavioural: { name: 'Behavioural Group', domain: 'behavioural', color: '#EC4899' },
};

// ===== GET /groups — List all 5 groups =====
export async function listGroups(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    // Get last message + unread count for each group
    const groups = await Promise.all(
      VALID_GROUPS.map(async (groupId) => {
        const lastMessage = await GroupMessage.findOne({ 
          groupId, 
          createdAt: { $gte: user.createdAt } 
        })
          .sort({ createdAt: -1 })
          .populate('userId', 'name avatarUrl')
          .lean();

        const totalMessages = await GroupMessage.countDocuments({ 
          groupId, 
          createdAt: { $gte: user.createdAt } 
        });

        return {
          groupId,
          ...GROUP_INFO[groupId],
          lastMessage: lastMessage
            ? {
                content: lastMessage.content || (lastMessage.type === 'poll' ? '📊 Poll' : '📎 File'),
                senderName: (lastMessage.userId as any)?.name || 'System',
                timestamp: lastMessage.createdAt,
              }
            : null,
          totalMessages,
        };
      }),
    );

    res.json({ groups });
  } catch (error) {
    next(error);
  }
}

// ===== GET /groups/:id/messages — Paginated message history =====
export async function getMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;
    if (!VALID_GROUPS.includes(id)) {
      throw ApiError.notFound('Group not found');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const [messages, total] = await Promise.all([
      GroupMessage.find({ groupId: id, createdAt: { $gte: user.createdAt } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name avatarUrl')
        .lean(),
      GroupMessage.countDocuments({ groupId: id, createdAt: { $gte: user.createdAt } }),
    ]);

    res.json({
      messages: messages.reverse(), // Return in chronological order
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /groups/:id/messages — Send a message =====
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;
    if (!VALID_GROUPS.includes(id)) {
      throw ApiError.notFound('Group not found');
    }

    const { content, type = 'text', attachments, replyTo } = req.body as {
      content?: string;
      type?: 'text' | 'file' | 'voice';
      attachments?: {
        type: 'image' | 'video' | 'audio' | 'document' | 'voice';
        url: string;
        filename: string;
        filesize: number;
        mimeType?: string;
        duration?: number;
        thumbnailUrl?: string;
      }[];
      replyTo?: {
        messageId: string;
        senderName: string;
        content: string;
      };
    };

    if (type === 'text' && (!content || !content.trim())) {
      throw ApiError.badRequest('Message content is required');
    }

    if ((type === 'file' || type === 'voice') && (!attachments || attachments.length === 0)) {
      throw ApiError.badRequest('Attachments are required for file/voice messages');
    }

    const message = await GroupMessage.create({
      groupId: id,
      userId: user._id,
      type,
      content: content?.trim(),
      attachments,
      replyTo,
    });

    const populated = await message.populate('userId', 'name avatarUrl');

    try {
      const { getIO } = require('../socket/socketHandler');
      getIO().to(`group:${id}`).emit('group:message', populated);
    } catch {
      // ignore socket emit error
    }

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}

// ===== POST /groups/:id/polls — Create a poll =====
export async function createPoll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;
    if (!VALID_GROUPS.includes(id)) {
      throw ApiError.notFound('Group not found');
    }

    const { question, options, expiresInMinutes } = req.body as {
      question: string;
      options: string[];
      expiresInMinutes?: number;
    };

    if (!question?.trim()) throw ApiError.badRequest('Poll question is required');
    if (!options || options.length < 2 || options.length > 4) {
      throw ApiError.badRequest('Poll must have 2-4 options');
    }

    const message = await GroupMessage.create({
      groupId: id,
      userId: user._id,
      type: 'poll',
      poll: {
        question: question.trim(),
        options: options.map((text) => ({ text: text.trim(), votes: [] })),
        expiresAt: expiresInMinutes
          ? new Date(Date.now() + expiresInMinutes * 60000)
          : undefined,
        closed: false,
      },
    });

    const populated = await message.populate('userId', 'name avatarUrl');
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}

// ===== POST /groups/:id/polls/:pollId/vote — Vote on a poll =====
export async function votePoll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id, pollId } = req.params;
    const { optionIndex } = req.body as { optionIndex: number };

    const message = await GroupMessage.findOne({ _id: pollId, groupId: id, type: 'poll' });
    if (!message || !message.poll) throw ApiError.notFound('Poll not found');

    if (message.poll.closed) throw ApiError.badRequest('Poll is closed');
    if (message.poll.expiresAt && message.poll.expiresAt < new Date()) {
      message.poll.closed = true;
      await message.save();
      throw ApiError.badRequest('Poll has expired');
    }

    if (optionIndex < 0 || optionIndex >= message.poll.options.length) {
      throw ApiError.badRequest('Invalid option index');
    }

    // Remove existing vote from any option
    message.poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((v) => v.toString() !== user._id.toString());
    });

    // Add vote to selected option
    message.poll.options[optionIndex].votes.push(user._id);
    await message.save();

    res.json({
      pollId: message._id,
      options: message.poll.options.map((opt) => ({
        text: opt.text,
        voteCount: opt.votes.length,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ===== DELETE /groups/:id/messages/:msgId — Delete own message =====
export async function deleteMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id, msgId } = req.params;

    const message = await GroupMessage.findOne({ _id: msgId, groupId: id });
    if (!message) throw ApiError.notFound('Message not found');

    if (message.userId.toString() !== user._id.toString()) {
      throw ApiError.forbidden('You can only delete your own messages');
    }

    await message.deleteOne();
    res.json({ message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
}
