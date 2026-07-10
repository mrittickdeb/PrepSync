import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { env } from '../config/env';
import GroupMessage from '../models/GroupMessage';
import { DMThread, DMMessage } from '../models/DM';
import { User, Notification } from '../models';
import Room from '../models/Room';
import { sendDMNotification } from '../lib/email';

let io: Server;

const activeDocs = new Map<string, Y.Doc>();
const saveTimers = new Map<string, NodeJS.Timeout>();

function saveRoomCodeDebounced(roomId: string, doc: Y.Doc) {
  if (saveTimers.has(roomId)) {
    clearTimeout(saveTimers.get(roomId));
  }

  const timer = setTimeout(async () => {
    saveTimers.delete(roomId);
    try {
      const text = doc.getText('monaco').toString();
      const configMap = doc.getMap('config');
      const language = (configMap.get('language') as string) || 'javascript';

      await Room.findByIdAndUpdate(roomId, {
        code: text,
        codeLanguage: language,
      });
    } catch (err) {
      console.error('[Socket] Failed to auto-save code:', err);
    }
  }, 3000);

  saveTimers.set(roomId, timer);
}

const checkAndCleanupRoom = async (roomId: string) => {
  const roomClients = io.sockets.adapter.rooms.get(`editor:${roomId}`);
  if (!roomClients || roomClients.size === 0) {
    const doc = activeDocs.get(roomId);
    if (doc) {
      activeDocs.delete(roomId);
      if (saveTimers.has(roomId)) {
        clearTimeout(saveTimers.get(roomId));
        saveTimers.delete(roomId);
      }
      try {
        const text = doc.getText('monaco').toString();
        const configMap = doc.getMap('config');
        const language = (configMap.get('language') as string) || 'javascript';
        await Room.findByIdAndUpdate(roomId, {
          code: text,
          codeLanguage: language,
        });
      } catch (err) {
        console.error('[Socket] Final code save failed:', err);
      }
      doc.destroy();
    }
  }
};

export function initSocketServer(httpServer: HttpServer): Server {
  const allowedOrigin = env.CLIENT_URL.endsWith('/') 
    ? env.CLIENT_URL.slice(0, -1) 
    : env.CLIENT_URL;

  io = new Server(httpServer, {
    cors: {
      origin: [allowedOrigin, allowedOrigin + '/'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ===== USER SETUP =====
    socket.on('user:setup', (data: { userId: string }) => {
      socket.join(`user:${data.userId}`);
      socket.data.globalUserId = data.userId;
    });

    // ===== PEER ROOM EVENTS =====

    socket.on('room:join', async (data: { roomId: string; displayName: string }) => {
      const { roomId, displayName } = data;
      socket.join(`room:${roomId}`);
      socket.data.roomId = roomId;
      socket.data.displayName = displayName;

      // Notify others in the room
      socket.to(`room:${roomId}`).emit('room:user-joined', {
        socketId: socket.id,
        displayName,
      });

      // Send current participants to the joiner
      const roomSockets = await io.in(`room:${roomId}`).fetchSockets();
      const participants = roomSockets.map((s) => ({
        socketId: s.id,
        displayName: s.data.displayName || 'Unknown',
      }));
      socket.emit('room:participants', { participants });
    });

    socket.on('room:message', (data: { roomId: string; content: string; displayName: string }) => {
      const { roomId, content, displayName } = data;
      io.to(`room:${roomId}`).emit('room:message', {
        id: `${Date.now()}-${socket.id}`,
        content,
        displayName,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('room:role-switch', (data: { roomId: string }) => {
      io.to(`room:${data.roomId}`).emit('room:role-switched');
    });

    socket.on('room:leave', (data: { roomId: string }) => {
      socket.leave(`room:${data.roomId}`);
      socket.to(`room:${data.roomId}`).emit('room:user-left', {
        socketId: socket.id,
        displayName: socket.data.displayName,
      });
    });

    // ===== WEBRTC SIGNALING =====

    socket.on('webrtc:offer', (data: { roomId: string; offer: any }) => {
      socket.to(`room:${data.roomId}`).emit('webrtc:offer', {
        offer: data.offer,
        socketId: socket.id,
      });
    });

    socket.on('webrtc:answer', (data: { roomId: string; answer: any }) => {
      socket.to(`room:${data.roomId}`).emit('webrtc:answer', {
        answer: data.answer,
        socketId: socket.id,
      });
    });

    socket.on('webrtc:ice-candidate', (data: { roomId: string; candidate: any }) => {
      socket.to(`room:${data.roomId}`).emit('webrtc:ice-candidate', {
        candidate: data.candidate,
        socketId: socket.id,
      });
    });

    // ===== GROUP CHAT EVENTS =====

    socket.on('group:join', async (data: { groupId: string; user?: any }) => {
      socket.join(`group:${data.groupId}`);
      socket.data.groupId = data.groupId;
      if (data.user) {
        socket.data.user = data.user;
        socket.to(`group:${data.groupId}`).emit('group:user_joined', data.user);
      }
      
      // Fetch current online members
      const roomSockets = await io.in(`group:${data.groupId}`).fetchSockets();
      const presentMembers = new Map();
      roomSockets.forEach(s => {
        if (s.data.user && s.data.user._id) {
          presentMembers.set(s.data.user._id, s.data.user);
        }
      });
      socket.emit('group:presence', Array.from(presentMembers.values()));
    });

    socket.on('group:leave', (data: { groupId: string }) => {
      socket.leave(`group:${data.groupId}`);
      if (socket.data.user) {
        socket.to(`group:${data.groupId}`).emit('group:user_left', { userId: socket.data.user._id });
      }
      socket.data.groupId = undefined;
    });

    socket.on('group:message', async (data: {
      groupId: string;
      userId: string;
      content: string;
      displayName: string;
      replyTo?: {
        messageId: string;
        senderName: string;
        content: string;
      };
    }) => {
      try {
        // Persist to database
        const message = await GroupMessage.create({
          groupId: data.groupId,
          userId: data.userId,
          type: 'text',
          content: data.content,
          replyTo: data.replyTo,
        });

        const populated = await message.populate('userId', 'name avatarUrl');

        // Broadcast to all group members
        io.to(`group:${data.groupId}`).emit('group:message', populated);

        // Check if this is a reply to another user's message
        if (data.replyTo) {
          const parentMsg = await GroupMessage.findById(data.replyTo.messageId).lean();
          if (parentMsg && parentMsg.userId.toString() !== data.userId.toString()) {
            const senderName = data.displayName || 'Someone';
            // Save in-app notification to DB
            const dbNotification = await Notification.create({
              userId: parentMsg.userId,
              type: 'reply',
              title: `New reply from ${senderName}`,
              body: data.content.slice(0, 80),
              link: `/groups/${data.groupId}`,
            });

            // Emit to recipient's personal room
            io.to(`user:${parentMsg.userId}`).emit('notification:new', dbNotification);
          }
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to send group message' });
      }
    });

    socket.on('group:typing', (data: { groupId: string; displayName: string }) => {
      socket.to(`group:${data.groupId}`).emit('group:typing', {
        displayName: data.displayName,
      });
    });

    // ===== DM EVENTS =====

    socket.on('dm:join', (data: { threadId: string }) => {
      socket.join(`dm:${data.threadId}`);
    });

    socket.on('dm:leave', (data: { threadId: string }) => {
      socket.leave(`dm:${data.threadId}`);
    });

    socket.on('dm:message', async (data: {
      threadId: string;
      senderId: string;
      content: string;
      replyTo?: {
        messageId: string;
        senderName: string;
        content: string;
      };
    }) => {
      try {
        // Persist to database
        const message = await DMMessage.create({
          threadId: data.threadId,
          senderId: data.senderId,
          content: data.content,
          type: 'text',
          readBy: [data.senderId],
          replyTo: data.replyTo,
        });

        // Update thread preview
        const thread = await DMThread.findByIdAndUpdate(data.threadId, {
          lastMessageAt: new Date(),
          lastMessagePreview: data.content.slice(0, 80),
        }).lean();

        const populated = await message.populate('senderId', 'name avatarUrl');

        // Broadcast to thread participants
        io.to(`dm:${data.threadId}`).emit('dm:message', populated);

        // Check if recipient is offline to send email notification
        if (thread) {
          const recipientId = thread.participants.find(p => p.toString() !== data.senderId);
          if (recipientId) {
            const senderName = (populated.senderId as any)?.name || 'Someone';

            // Create in-app notification in DB
            const dbNotification = await Notification.create({
              userId: recipientId,
              type: 'dm',
              title: `New message from ${senderName}`,
              body: data.content.slice(0, 80),
              link: `/dms/${data.threadId}`,
            });

            // Emit to recipient's personal room
            io.to(`user:${recipientId}`).emit('notification:new', dbNotification);

            const recipientSockets = await io.in(`user:${recipientId}`).fetchSockets();
            if (recipientSockets.length === 0) {
              const recipient = await User.findById(recipientId).lean();
              if (recipient && recipient.email) {
                const dmLink = `${env.CLIENT_URL}/dms/${data.threadId}`;
                await sendDMNotification(recipient.email, senderName, data.content.slice(0, 80), dmLink);
              }
            }
          }
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to send DM' });
      }
    });

    socket.on('dm:typing', (data: { threadId: string; displayName: string }) => {
      socket.to(`dm:${data.threadId}`).emit('dm:typing', {
        displayName: data.displayName,
      });
    });

    socket.on('dm:mark_read', async (data: { threadId: string; userId: string }) => {
      try {
        await DMMessage.updateMany(
          { threadId: data.threadId, readBy: { $ne: data.userId } },
          { $addToSet: { readBy: data.userId } }
        );
        
        io.to(`dm:${data.threadId}`).emit('dm:read', {
          threadId: data.threadId,
          userId: data.userId,
        });
      } catch (err) {
        console.error('Failed to mark DM as read via socket:', err);
      }
    });

    // ===== CODE EDITOR SYNC (Yjs awareness) =====

    socket.on('editor:join', async (data: { roomId: string }) => {
      socket.join(`editor:${data.roomId}`);

      let doc = activeDocs.get(data.roomId);
      if (!doc) {
        doc = new Y.Doc();
        activeDocs.set(data.roomId, doc);

        try {
          const room = await Room.findById(data.roomId);
          if (room && room.code) {
            const type = doc.getText('monaco');
            type.insert(0, room.code);
            const configMap = doc.getMap('config');
            configMap.set('language', room.codeLanguage || 'javascript');
          }
        } catch (err) {
          console.error('[Socket] Failed to load code on editor:join:', err);
        }
      }

      const update = Y.encodeStateAsUpdate(doc);
      socket.emit('editor:update', {
        update: Array.from(update),
      });
    });

    socket.on('editor:update', (data: { roomId: string; update: number[] | Uint8Array }) => {
      socket.to(`editor:${data.roomId}`).emit('editor:update', {
        update: data.update,
      });

      const doc = activeDocs.get(data.roomId);
      if (doc) {
        try {
          Y.applyUpdate(doc, new Uint8Array(data.update));
          saveRoomCodeDebounced(data.roomId, doc);
        } catch (err) {
          console.error('[Socket] Y.applyUpdate failed:', err);
        }
      }
    });

    socket.on('editor:awareness', (data: { roomId: string; state: any }) => {
      socket.to(`editor:${data.roomId}`).emit('editor:awareness', {
        state: data.state,
        clientId: socket.id,
      });
    });

    // ===== WHITEBOARD SYNC =====

    socket.on('whiteboard:join', (data: { roomId: string }) => {
      socket.join(`whiteboard:${data.roomId}`);
    });

    socket.on('whiteboard:request-state', async (data: { roomId: string }) => {
      const roomClients = io.sockets.adapter.rooms.get(`whiteboard:${data.roomId}`);
      const otherClients = roomClients ? Array.from(roomClients).filter((id) => id !== socket.id) : [];

      if (otherClients.length > 0) {
        socket.to(`whiteboard:${data.roomId}`).emit('whiteboard:request-state', {
          requesterId: socket.id,
        });
      } else {
        try {
          const room = await Room.findById(data.roomId);
          if (room && room.whiteboardState) {
            socket.emit('whiteboard:state', {
              state: room.whiteboardState,
            });
          }
        } catch (err) {
          console.error('[Socket] Failed to load whiteboard state:', err);
        }
      }
    });

    socket.on('whiteboard:send-state', (data: { requesterId: string; state: string }) => {
      socket.to(data.requesterId).emit('whiteboard:state', {
        state: data.state,
      });
    });

    socket.on('whiteboard:save-state', async (data: { roomId: string; state: string }) => {
      try {
        await Room.findByIdAndUpdate(data.roomId, {
          whiteboardState: data.state,
        });
      } catch (err) {
        console.error('[Socket] Failed to save whiteboard state:', err);
      }
    });

    socket.on('whiteboard:update', (data: { roomId: string; objects: any }) => {
      socket.to(`whiteboard:${data.roomId}`).emit('whiteboard:update', {
        objects: data.objects,
      });
    });

    // ===== DISCONNECT =====

    socket.on('disconnecting', () => {
      for (const roomName of socket.rooms) {
        if (roomName.startsWith('editor:')) {
          const roomId = roomName.slice(7);
          setTimeout(() => checkAndCleanupRoom(roomId), 100);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      // Notify room if user was in one
      if (socket.data.roomId) {
        socket.to(`room:${socket.data.roomId}`).emit('room:user-left', {
          socketId: socket.id,
          displayName: socket.data.displayName,
        });
      }

      // Notify group if user was in one
      if (socket.data.groupId && socket.data.user) {
        socket.to(`group:${socket.data.groupId}`).emit('group:user_left', {
          userId: socket.data.user._id,
        });
      }
    });
  });

  console.log('[Socket] Socket.io server initialized');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
