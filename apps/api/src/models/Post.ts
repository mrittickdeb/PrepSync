import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  author: mongoose.Types.ObjectId;
  content: string;
  attachments: { type: 'image' | 'video'; url: string }[];
  likes: mongoose.Types.ObjectId[];
  reposts: mongoose.Types.ObjectId[];
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, maxlength: 500 },
    attachments: [
      {
        type: { type: String, enum: ['image', 'video'], required: true },
        url: { type: String, required: true },
      },
    ],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    reposts: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Post = mongoose.model<IPost>('Post', postSchema);
export default Post;
