import mongoose, { Schema, Document } from 'mongoose';

export interface IVideo extends Document {
  title: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
  duration: string;
  author: mongoose.Types.ObjectId;
  views: number;
  likes: mongoose.Types.ObjectId[];
  commentsCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const videoSchema = new Schema<IVideo>(
  {
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 1000 },
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    duration: { type: String, default: '00:00' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    views: { type: Number, default: 0 },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    commentsCount: { type: Number, default: 0 },
    tags: [{ type: String, default: [] }],
  },
  { timestamps: true }
);

const Video = mongoose.model<IVideo>('Video', videoSchema);
export default Video;
