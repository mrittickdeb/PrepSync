import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Room from '../models/Room';
import { ApiError } from '../middleware/error';

// ===== Helpers =====

/** Generate a 6-character uppercase alphanumeric invite code */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O/0/I/1 to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/** Generate a unique invite code (retry on collision) */
async function uniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateInviteCode();
    const exists = await Room.findOne({ inviteCode: code, status: { $ne: 'ended' } });
    if (!exists) return code;
  }
  throw new Error('Failed to generate unique invite code');
}

// ===== POST /rooms — Create a new peer room =====
export async function createRoom(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const u = user as any;
    const inviteCode = await uniqueInviteCode();

    const room = await Room.create({
      inviteCode,
      createdBy: u._id,
      participants: [
        {
          userId: u._id,
          displayName: u.name,
          role: 'interviewer',
          isGuest: false,
          joinedAt: new Date(),
        },
      ],
      status: 'waiting',
    });

    res.status(201).json({
      roomId: room._id,
      inviteCode: room.inviteCode,
      link: `/room/${room.inviteCode}`,
    });
  } catch (error) {
    next(error);
  }
}

// ===== GET /rooms/:inviteCode — Get room details by invite code =====
export async function getRoomByCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { inviteCode } = req.params;

    const room = await Room.findOne({
      inviteCode: inviteCode.toUpperCase(),
      status: { $ne: 'ended' },
    });

    if (!room) {
      throw ApiError.notFound('Room not found or has already ended');
    }

    res.json({
      roomId: room._id,
      inviteCode: room.inviteCode,
      status: room.status,
      participants: room.participants.map((p) => ({
        displayName: p.displayName,
        role: p.role,
        isGuest: p.isGuest,
      })),
      createdAt: room.createdAt,
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /rooms/:id/join — Join a room (authenticated or guest) =====
export async function joinRoom(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { displayName } = req.body as { displayName?: string };
    const user = req.user; // May be undefined for guests (optionalAuth)

    const u = user as any;

    const room = await Room.findById(id);
    if (!room) throw ApiError.notFound('Room not found');

    if (room.status === 'ended') {
      throw ApiError.badRequest('This room has already ended');
    }

    // Check if user is already in the room
    if (u) {
      const alreadyIn = room.participants.some(
        (p) => p.userId && p.userId.toString() === u._id.toString(),
      );
      if (alreadyIn) {
        res.json({
          roomId: room._id,
          inviteCode: room.inviteCode,
          status: room.status,
          participants: room.participants.map((p) => ({
            displayName: p.displayName,
            role: p.role,
            isGuest: p.isGuest,
          })),
        });
        return;
      }
    }

    if (room.participants.length >= 2) {
      throw ApiError.badRequest('Room is full (max 2 participants)');
    }

    const name = u?.name || displayName || 'Guest User';

    room.participants.push({
      userId: u?._id,
      displayName: name,
      role: 'candidate',
      isGuest: !user,
      joinedAt: new Date(),
    });

    // Room becomes active when partner joins
    if (room.participants.length === 2) {
      room.status = 'active';
    }

    await room.save();

    res.json({
      roomId: room._id,
      inviteCode: room.inviteCode,
      status: room.status,
      participants: room.participants.map((p) => ({
        displayName: p.displayName,
        role: p.role,
        isGuest: p.isGuest,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ===== PATCH /rooms/:id/end — End a room =====
export async function endRoom(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    const u = user as any;
    const { id } = req.params;

    const room = await Room.findById(id);
    if (!room) throw ApiError.notFound('Room not found');

    if (room.status === 'ended') {
      res.json({
        roomId: room._id,
        status: 'ended',
        endedAt: room.endedAt,
      });
      return;
    }

    // Only participants can end the room
    if (u) {
      const isParticipant = room.participants.some(
        (p) => p.userId && p.userId.toString() === u._id.toString(),
      );
      if (!isParticipant) {
        throw ApiError.forbidden('You are not a participant of this room');
      }
    }

    room.status = 'ended';
    room.endedAt = new Date();
    await room.save();

    try {
      // Use dynamic import or require to avoid circular dependency if getIO is imported at top
      const { getIO } = require('../socket/socketHandler');
      getIO().to(`room:${room._id}`).emit('room:ended');
    } catch (e) {
      console.error('Failed to emit room:ended via socket', e);
    }

    res.json({
      roomId: room._id,
      status: 'ended',
      endedAt: room.endedAt,
    });
  } catch (error) {
    next(error);
  }
}

// ===== PATCH /rooms/:id/role — Switch interviewer/candidate role =====
export async function switchRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;

    const room = await Room.findById(id);
    if (!room) throw ApiError.notFound('Room not found');

    if (room.status !== 'active') {
      res.json({
        roomId: room._id,
        participants: room.participants.map((p) => ({
          displayName: p.displayName,
          role: p.role,
          isGuest: p.isGuest,
        })),
      });
      return;
    }

    // Swap roles for all participants
    room.participants.forEach((p) => {
      p.role = p.role === 'interviewer' ? 'candidate' : 'interviewer';
    });

    await room.save();

    res.json({
      roomId: room._id,
      participants: room.participants.map((p) => ({
        displayName: p.displayName,
        role: p.role,
        isGuest: p.isGuest,
      })),
    });
  } catch (error) {
    next(error);
  }
}
