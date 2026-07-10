import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  post?: mongoose.Types.ObjectId;
  video?: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  likes: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: false, index: true },
    video: { type: Schema.Types.ObjectId, ref: 'Video', required: false, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, maxlength: 300 },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
  },
  { timestamps: true }
);

const Comment = mongoose.model<IComment>('Comment', commentSchema);
export default Comment;
