import mongoose, { Schema, Document } from 'mongoose';

export interface IPollOption {
  text: string;
  votes: mongoose.Types.ObjectId[];
}

export interface IPost extends Document {
  author: mongoose.Types.ObjectId;
  content: string;
  attachments: { type: 'image' | 'video'; url: string }[];
  likes: mongoose.Types.ObjectId[];
  reposts: mongoose.Types.ObjectId[];
  bookmarks: mongoose.Types.ObjectId[];
  commentsCount: number;
  community?: mongoose.Types.ObjectId;
  hashtags: string[];
  postType: 'text' | 'media' | 'poll';
  isPinned: boolean;
  impressions: number;
  poll?: {
    options: IPollOption[];
    expiresAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, maxlength: 1000 },
    attachments: [
      {
        type: { type: String, enum: ['image', 'video'], required: true },
        url: { type: String, required: true },
      },
    ],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    reposts: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    bookmarks: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    commentsCount: { type: Number, default: 0 },
    community: { type: Schema.Types.ObjectId, ref: 'Community', required: false, index: true },
    hashtags: [{ type: String, default: [] }],
    postType: { type: String, enum: ['text', 'media', 'poll'], default: 'text' },
    isPinned: { type: Boolean, default: false },
    impressions: { type: Number, default: 0 },
    poll: {
      type: {
        options: [
          {
            text: { type: String, required: true },
            votes: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
          },
        ],
        expiresAt: { type: Date },
      },
      required: false,
    },
  },
  { timestamps: true }
);

// Auto-extract hashtags from content before saving
postSchema.pre('save', function (next) {
  if (this.isModified('content')) {
    const hashtagRegex = /#(\w+)/g;
    const matches = this.content.match(hashtagRegex);
    this.hashtags = matches ? matches.map((tag) => tag.slice(1).toLowerCase()) : [];
  }
  next();
});

const Post = mongoose.model<IPost>('Post', postSchema);
export default Post;
