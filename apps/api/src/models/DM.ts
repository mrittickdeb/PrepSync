import mongoose, { Schema, Document, Model } from 'mongoose';

// ===== Subdocument Interfaces =====

interface AttachmentDoc {
  type: 'image' | 'pdf';
  url: string;
  filename: string;
  filesize: number;
}

// ===== DMThread Interface =====

export interface IDMThread extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessageAt: Date;
  lastMessagePreview: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== DMMessage Interface =====

export interface IDMMessage extends Document {
  threadId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content?: string;
  type: 'text' | 'file' | 'system';
  attachments?: AttachmentDoc[];
  readBy: mongoose.Types.ObjectId[];
  replyTo?: {
    messageId: mongoose.Types.ObjectId;
    senderName: string;
    content: string;
  };
  createdAt: Date;
}

// ===== Schemas =====

const attachmentSchema = new Schema<AttachmentDoc>(
  {
    type: { type: String, required: true, enum: ['image', 'pdf'] },
    url: { type: String, required: true },
    filename: { type: String, required: true },
    filesize: { type: Number, required: true },
  },
  { _id: false },
);

const dmThreadSchema = new Schema<IDMThread>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: [(v: any[]) => v.length === 2, 'DM thread must have exactly 2 participants'],
    },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '' },
  },
  { timestamps: true },
);

dmThreadSchema.index({ participants: 1 });
dmThreadSchema.index({ lastMessageAt: -1 });

const dmMessageSchema = new Schema<IDMMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'DMThread', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    type: { type: String, required: true, enum: ['text', 'file', 'system'], default: 'text' },
    attachments: [attachmentSchema],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    replyTo: {
      messageId: { type: Schema.Types.ObjectId, ref: 'DMMessage' },
      senderName: { type: String },
      content: { type: String },
    },
  },
  { timestamps: true },
);

dmMessageSchema.index({ threadId: 1, createdAt: -1 });

export const DMThread: Model<IDMThread> = mongoose.model<IDMThread>('DMThread', dmThreadSchema);
export const DMMessage: Model<IDMMessage> = mongoose.model<IDMMessage>('DMMessage', dmMessageSchema);
