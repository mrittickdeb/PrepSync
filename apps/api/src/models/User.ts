import mongoose, { Schema, Document, Model } from 'mongoose';
import type { Domain, UserGoal, ReadinessIndex } from '@prepsync/shared';

// ===== Subdocument Interfaces =====

interface RefreshTokenDoc {
  tokenHash: string;
  expiresAt: Date;
  deviceInfo: string;
  ipAddress: string;
  createdAt: Date;
}

// ===== User Interface =====

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  googleId?: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  goal?: UserGoal;
  targetDomains: Domain[];
  weeklyGoal: number;
  streak: number;
  lastActiveDate?: Date;
  refreshTokens: RefreshTokenDoc[];
  readinessIndex: ReadinessIndex;
  loginAttempts: number;
  lockUntil?: Date;
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isLocked(): boolean;
}

// ===== Schemas =====

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    deviceInfo: { type: String, default: 'unknown' },
    ipAddress: { type: String, default: 'unknown' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const readinessIndexSchema = new Schema(
  {
    overall: { type: Number, default: 0, min: 0, max: 100 },
    dsa: { type: Number, default: 0, min: 0, max: 100 },
    systemDesign: { type: Number, default: 0, min: 0, max: 100 },
    backend: { type: Number, default: 0, min: 0, max: 100 },
    conceptual: { type: Number, default: 0, min: 0, max: 100 },
    behavioural: { type: Number, default: 0, min: 0, max: 100 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String },
    googleId: { type: String, sparse: true },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    avatarUrl: { type: String },
    emailVerified: { type: Boolean, default: false },
    onboardingComplete: { type: Boolean, default: false },
    goal: {
      type: String,
      enum: ['placement', 'switch', 'practice'],
    },
    targetDomains: [{
      type: String,
      enum: ['dsa', 'systemDesign', 'backend', 'conceptual', 'behavioural'],
    }],
    weeklyGoal: { type: Number, default: 5, min: 1, max: 14 },
    streak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
    refreshTokens: [refreshTokenSchema],
    readinessIndex: { type: readinessIndexSchema, default: () => ({}) },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    followers: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ===== Methods =====

userSchema.methods.isLocked = function (this: IUser): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// ===== Model =====

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;
