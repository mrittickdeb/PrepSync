import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { User } from '../models';
import { AuthToken } from '../models';
import { ApiError } from '../middleware/error';
import jwt from 'jsonwebtoken';

// Send magic link email via Resend
async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/magic?token=${token}`;

  // Using Resend (already a dependency)
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'PrepSync <noreply@prepsync.app>',
    to: email,
    subject: 'Your PrepSync Magic Link',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #00D4FF;">PrepSync</h2>
        <p>Click the link below to sign in to your account:</p>
        <a href="${link}" style="display: inline-block; background: #00D4FF; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Sign In to PrepSync
        </a>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          This link expires in 15 minutes. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  });
}

// ===== POST /auth/magic-link — Send magic link =====
export async function sendMagicLink(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email } = req.body as { email: string };
    if (!email?.trim()) throw ApiError.badRequest('Email is required');

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    let user = await User.findOne({ email: normalizedEmail });

    // Create user if they don't exist (magic link doubles as signup)
    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
        authProvider: 'magic',
        isVerified: true,
      });
    }

    // Generate a magic link token
    const magicToken = crypto.randomBytes(32).toString('hex');

    // Store as an auth token with 15-min expiry
    await AuthToken.create({
      userId: user._id,
      token: magicToken,
      type: 'magic_link',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Send email
    await sendMagicLinkEmail(normalizedEmail, magicToken);

    res.json({ message: 'Magic link sent! Check your email.' });
  } catch (error) {
    next(error);
  }
}

// ===== POST /auth/magic-link/verify — Verify magic link =====
export async function verifyMagicLink(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    if (!token) throw ApiError.badRequest('Token is required');

    // Find valid magic token
    const authToken = await AuthToken.findOne({
      token,
      type: 'magic_link',
      expiresAt: { $gt: new Date() },
    });

    if (!authToken) {
      throw ApiError.unauthorized('Invalid or expired magic link');
    }

    // Get user
    const user = await User.findById(authToken.userId);
    if (!user) throw ApiError.notFound('User not found');

    // Mark as verified
    (user as any).isVerified = true;
    await user.save();

    // Issue JWT
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';

    const accessToken = jwt.sign(
      { userId: user._id },
      jwtSecret,
      { expiresIn: '7d' },
    );

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh' },
      jwtSecret,
      { expiresIn: '30d' },
    );

    // Clean up magic token
    await authToken.deleteOne();

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isVerified: (user as any).isVerified,
        onboardingComplete: (user as any).onboardingComplete,
      },
    });
  } catch (error) {
    next(error);
  }
}
