import mongoose from 'mongoose';
import User from './models/User';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://insane:baban@cluster0.y4o8me4.mongodb.net/';

async function check() {
  console.log('Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');
  const users = await User.find({});
  console.log('Users count:', users.length);
  for (const user of users) {
    console.log({
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      onboardingComplete: user.onboardingComplete,
      loginAttempts: user.loginAttempts,
      lockUntil: user.lockUntil,
    });
  }
  await mongoose.disconnect();
}

check().catch(console.error);
