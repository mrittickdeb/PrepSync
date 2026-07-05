import { Request, Response, NextFunction } from 'express';
import { User, AuthToken } from '../models';
import { generateAccessToken, generateRefreshToken } from '../lib/jwt';
import { hashPassword, comparePassword, hashToken, compareToken } from '../lib/hash';
import { generateOTP, hashOTP } from '../lib/crypto';
import { ApiError } from '../middleware/error';
import { sendVerificationOTP, sendResendVerificationOTP } from '../lib/email';
import { env } from '../config/env';
import { VALIDATION } from '@prepsync/shared';

// ===== POST /auth/register =====
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      throw ApiError.badRequest('Name, email, and password are required');
    }
    if (name.length < VALIDATION.NAME_MIN || name.length > VALIDATION.NAME_MAX) {
      throw ApiError.badRequest(`Name must be ${VALIDATION.NAME_MIN}-${VALIDATION.NAME_MAX} characters`);
    }
    if (password.length < VALIDATION.PASSWORD_MIN) {
      throw ApiError.badRequest(`Password must be at least ${VALIDATION.PASSWORD_MIN} characters`);
    }

    // Check existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw ApiError.badRequest('An account with this email already exists', 'EMAIL_EXISTS');
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      emailVerified: false,
      onboardingComplete: false,
    });

    // Generate and save OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    await AuthToken.create({
      userId: user._id,
      tokenHash: otpHash,
      purpose: 'email_verification',
      expiresAt: new Date(Date.now() + VALIDATION.OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    // Send OTP via email
    console.log(`[Auth] OTP for ${email}: ${otp}`); // Dev fallback
    await sendVerificationOTP(email, otp, name);

    res.status(201).json({
      message: 'Account created. Please check your email for the verification code.',
      userId: user._id,
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/verify-email =====
export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      throw ApiError.badRequest('User ID and OTP are required');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.emailVerified) {
      throw ApiError.badRequest('Email is already verified', 'ALREADY_VERIFIED');
    }

    // Find valid token
    const otpHash = hashOTP(otp);
    const tokenDoc = await AuthToken.findOne({
      userId: user._id,
      purpose: 'email_verification',
      tokenHash: otpHash,
      expiresAt: { $gt: new Date() },
      usedAt: { $exists: false },
    });

    if (!tokenDoc) {
      throw ApiError.badRequest('Invalid or expired verification code', 'INVALID_OTP');
    }

    // Mark token as used
    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    // Mark email as verified
    user.emailVerified = true;
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken({ userId: String(user._id), email: user.email });
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown',
      createdAt: new Date(),
    });
    await user.save();

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      accessToken,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/resend-verification =====
export async function resendVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = req.body;

    if (!userId) {
      throw ApiError.badRequest('User ID is required');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.emailVerified) {
      throw ApiError.badRequest('Email is already verified');
    }

    // Invalidate old OTPs
    await AuthToken.updateMany(
      { userId: user._id, purpose: 'email_verification', usedAt: { $exists: false } },
      { usedAt: new Date() },
    );

    // Generate new OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    await AuthToken.create({
      userId: user._id,
      tokenHash: otpHash,
      purpose: 'email_verification',
      expiresAt: new Date(Date.now() + VALIDATION.OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    console.log(`[Auth] Resend OTP for ${user.email}: ${otp}`); // Dev fallback
    await sendResendVerificationOTP(user.email, otp);

    res.json({ message: 'Verification code sent.' });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/login =====
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw ApiError.unauthorized('No account found with this email', 'USER_NOT_FOUND');
    }

    if (!user.passwordHash) {
      throw ApiError.unauthorized('This account uses Google sign-in. Please use "Continue with Google".', 'NO_PASSWORD');
    }

    // Check lockout
    if (user.isLocked()) {
      throw ApiError.tooMany('Too many attempts. Try again in 15 minutes.', 'ACCOUNT_LOCKED');
    }

    // Check email verification
    if (!user.emailVerified) {
      throw ApiError.forbidden('Please verify your email. Check your inbox for the verification code.', 'EMAIL_NOT_VERIFIED');
    }

    // Verify password
    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      // Increment login attempts
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      throw ApiError.unauthorized('Incorrect password', 'WRONG_PASSWORD');
    }

    // Reset login attempts
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    // Generate tokens
    const accessToken = generateAccessToken({ userId: String(user._id), email: user.email });
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);

    const ttl = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + ttl),
      deviceInfo: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown',
      createdAt: new Date(),
    });

    user.lastActiveDate = new Date();
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: ttl,
      path: '/',
    });

    res.json({
      accessToken,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/refresh =====
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const oldRefreshToken = req.cookies?.refreshToken;
    if (!oldRefreshToken) {
      throw ApiError.unauthorized('No refresh token', 'NO_REFRESH_TOKEN');
    }

    // Find user with matching refresh token
    const users = await User.find({ 'refreshTokens.expiresAt': { $gt: new Date() } });
    let foundUser = null;
    let foundTokenIndex = -1;

    for (const user of users) {
      for (let i = 0; i < user.refreshTokens.length; i++) {
        const storedToken = user.refreshTokens[i];
        const isMatch = await compareToken(oldRefreshToken, storedToken.tokenHash);
        if (isMatch) {
          foundUser = user;
          foundTokenIndex = i;
          break;
        }
      }
      if (foundUser) break;
    }

    if (!foundUser || foundTokenIndex === -1) {
      throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Token rotation: remove old token
    foundUser.refreshTokens.splice(foundTokenIndex, 1);

    // Issue new tokens
    const accessToken = generateAccessToken({
      userId: String(foundUser._id),
      email: foundUser.email,
    });
    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = await hashToken(newRefreshToken);

    foundUser.refreshTokens.push({
      tokenHash: newRefreshHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown',
      createdAt: new Date(),
    });

    foundUser.lastActiveDate = new Date();
    await foundUser.save();

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/logout =====
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      // Find and remove the refresh token
      const users = await User.find({});
      for (const user of users) {
        for (let i = 0; i < user.refreshTokens.length; i++) {
          const isMatch = await compareToken(refreshToken, user.refreshTokens[i].tokenHash);
          if (isMatch) {
            user.refreshTokens.splice(i, 1);
            await user.save();
            break;
          }
        }
      }
    }

    res.clearCookie('refreshToken', { path: '/' });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/forgot-password =====
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email } = req.body;

    // Always return 200 to prevent email enumeration
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });

    if (!email) return;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return;

    // Invalidate old reset tokens
    await AuthToken.updateMany(
      { userId: user._id, purpose: 'password_reset', usedAt: { $exists: false } },
      { usedAt: new Date() },
    );

    // Generate reset token
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashOTP(rawToken);

    await AuthToken.create({
      userId: user._id,
      tokenHash,
      purpose: 'password_reset',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    const resetLink = `${env.CLIENT_URL}/reset-password?token=${rawToken}&uid=${user._id}`;
    console.log(`[Auth] Reset link for ${email}: ${resetLink}`); // Dev only
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/reset-password =====
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token, userId, newPassword } = req.body;

    if (!token || !userId || !newPassword) {
      throw ApiError.badRequest('Token, user ID, and new password are required');
    }

    if (newPassword.length < VALIDATION.PASSWORD_MIN) {
      throw ApiError.badRequest(`Password must be at least ${VALIDATION.PASSWORD_MIN} characters`);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.badRequest('Invalid reset link', 'INVALID_RESET');
    }

    // Verify token
    const tokenHash = hashOTP(token);
    const tokenDoc = await AuthToken.findOne({
      userId: user._id,
      purpose: 'password_reset',
      tokenHash,
      expiresAt: { $gt: new Date() },
      usedAt: { $exists: false },
    });

    if (!tokenDoc) {
      throw ApiError.badRequest('Invalid or expired reset link', 'INVALID_RESET');
    }

    // Mark token as used
    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    // Update password and invalidate all refresh tokens
    user.passwordHash = await hashPassword(newPassword);
    user.refreshTokens = [];
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.clearCookie('refreshToken', { path: '/' });
    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/magic-link =====
export async function sendMagicLink(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email } = req.body;

    // Always return 200
    res.json({ message: 'If an account with that email exists, a magic link has been sent.' });

    if (!email) return;

    const user = await User.findOne({ email: email.toLowerCase(), emailVerified: true });
    if (!user) return;

    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashOTP(rawToken);

    await AuthToken.create({
      userId: user._id,
      tokenHash,
      purpose: 'magic_login',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    const magicLink = `${env.CLIENT_URL}/auth/magic?token=${rawToken}&uid=${user._id}`;
    console.log(`[Auth] Magic link for ${email}: ${magicLink}`); // Dev only
  } catch (error) {
    next(error);
  }
}

// ===== GET /auth/magic =====
export async function verifyMagicLink(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token, uid } = req.query;

    if (!token || !uid) {
      throw ApiError.badRequest('Missing token or user ID');
    }

    const user = await User.findById(uid as string);
    if (!user) {
      throw ApiError.badRequest('Invalid magic link', 'INVALID_MAGIC_LINK');
    }

    const tokenHash = hashOTP(token as string);
    const tokenDoc = await AuthToken.findOne({
      userId: user._id,
      purpose: 'magic_login',
      tokenHash,
      expiresAt: { $gt: new Date() },
      usedAt: { $exists: false },
    });

    if (!tokenDoc) {
      throw ApiError.badRequest('Invalid or expired magic link', 'INVALID_MAGIC_LINK');
    }

    // Mark token as used
    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    // Generate tokens
    const accessToken = generateAccessToken({ userId: String(user._id), email: user.email });
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown',
      createdAt: new Date(),
    });

    user.lastActiveDate = new Date();
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Redirect to frontend with access token
    res.redirect(`${env.CLIENT_URL}/auth/callback?token=${accessToken}`);
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/onboarding =====
export async function completeOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as any;
    if (!user) {
      throw ApiError.unauthorized();
    }

    const { goal, targetDomains, weeklyGoal } = req.body;

    if (!goal || !targetDomains || !weeklyGoal) {
      throw ApiError.badRequest('Goal, target domains, and weekly goal are required');
    }

    user.goal = goal;
    user.targetDomains = targetDomains;
    user.weeklyGoal = Math.max(1, Math.min(14, Number(weeklyGoal)));
    user.onboardingComplete = true;
    await user.save();

    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
}

// ===== GET /auth/google/callback =====
export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as any;
    if (!user) {
      throw ApiError.unauthorized('Google authentication failed');
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: String(user._id), email: user.email });
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || 'unknown',
      createdAt: new Date(),
    });

    user.lastActiveDate = new Date();
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Redirect to frontend callback page
    res.redirect(`${env.CLIENT_URL}/auth/callback?token=${accessToken}`);
  } catch (error) {
    next(error);
  }
}
