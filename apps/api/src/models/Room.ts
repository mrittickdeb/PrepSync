import mongoose, { Schema, Document, Model } from 'mongoose';
import type { RoomStatus, UserRole } from '@prepsync/shared';

// ===== Subdocument Interfaces =====

interface ParticipantDoc {
  userId?: mongoose.Types.ObjectId;
  displayName: string;
  role: UserRole;
  isGuest: boolean;
  joinedAt: Date;
}

// ===== Room Interface =====

export interface IRoom extends Document {
  inviteCode: string;
  createdBy: mongoose.Types.ObjectId;
  participants: ParticipantDoc[];
  status: RoomStatus;
  sessionId?: mongoose.Types.ObjectId;
  code?: string;
  codeLanguage?: string;
  whiteboardState?: string;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
}

// ===== Schemas =====

const participantSchema = new Schema<ParticipantDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['interviewer', 'candidate'], default: 'candidate' },
    isGuest: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const roomSchema = new Schema<IRoom>(
  {
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
      minlength: 6,
      maxlength: 6,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [participantSchema],
    status: {
      type: String,
      default: 'waiting',
      enum: ['waiting', 'active', 'ended'],
    },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    code: { type: String, default: '' },
    codeLanguage: { type: String, default: 'javascript' },
    whiteboardState: { type: String, default: '' },
    endedAt: { type: Date },
  },
  { timestamps: true },
);

// TTL index — auto-delete ended rooms after 24 hours
roomSchema.index({ endedAt: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { status: 'ended' } });

const Room: Model<IRoom> = mongoose.model<IRoom>('Room', roomSchema);

export default Room;
