import mongoose, { Schema, Document } from 'mongoose';

export interface ILiveStream extends Document {
  title: string;
  description: string;
  host: mongoose.Types.ObjectId;
  roomName: string;
  status: 'live' | 'ended';
  viewers: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const liveStreamSchema = new Schema<ILiveStream>(
  {
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomName: { type: String, required: true, unique: true },
    status: { type: String, enum: ['live', 'ended'], default: 'live', index: true },
    viewers: { type: Number, default: 0 },
    category: { type: String, default: 'General' },
  },
  { timestamps: true }
);

const LiveStream = mongoose.model<ILiveStream>('LiveStream', liveStreamSchema);
export default LiveStream;
