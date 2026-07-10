import { Request, Response, NextFunction } from 'express';
import Session from '../models/Session';
import { User } from '../models';
import { ApiError } from '../middleware/error';
import {
  generateQuestion,
  generateFollowUp,
  generateEvaluation,
  generateSummary,
} from '../services/ai.service';
import type { Domain, Difficulty } from '@prepsync/shared';

// ===== POST /sessions — Create a new AI interview session =====
export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { domain, difficulty, durationMinutes } = req.body as {
      domain: Domain;
      difficulty: Difficulty;
      durationMinutes: number;
    };

    if (!domain || !difficulty || !durationMinutes) {
      throw ApiError.badRequest('domain, difficulty, and durationMinutes are required');
    }

    // Check for active sessions
    const activeSession = await Session.findOne({
      userId: user._id,
      status: 'active',
    });
    if (activeSession) {
      throw ApiError.badRequest('You already have an active session. End it first.');
    }

    // Generate the opening question
    const question = await generateQuestion(domain, difficulty);

    // Create session with the first transcript entry
    const session = await Session.create({
      type: 'ai',
      userId: user._id,
      domain,
      difficulty,
      durationMinutes,
      startedAt: new Date(),
      status: 'active',
      transcript: [
        {
          role: 'ai',
          content: question,
          timestamp: new Date(),
          type: 'text',
        },
      ],
    });

    res.status(201).json({
      sessionId: session._id,
      question,
      domain,
      difficulty,
      durationMinutes,
      startedAt: session.startedAt,
    });
  } catch (error) {
    next(error);
  }
}

// ===== POST /sessions/:id/message — Send user message + get AI follow-up =====
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;
    const { content, type = 'text' } = req.body as {
      content: string;
      type?: 'text' | 'code';
    };

    if (!content) {
      throw ApiError.badRequest('content is required');
    }

    const session = await Session.findOne({ _id: id, userId: user._id });
    if (!session) throw ApiError.notFound('Session not found');
    if (session.status !== 'active') {
      throw ApiError.badRequest('Session is no longer active');
    }

    // Add the user's message
    session.transcript.push({
      role: 'user',
      content,
      timestamp: new Date(),
      type: type as 'text' | 'code' | 'whiteboard_snapshot',
    });

    // Decide: follow-up or wrap up based on time / transcript length
    const userMessages = session.transcript.filter((t) => t.role === 'user').length;
    const elapsed = (Date.now() - session.startedAt.getTime()) / 60000; // in minutes
    const timeRemaining = session.durationMinutes - elapsed;

    let aiResponse: string;

    if (userMessages >= 4 || timeRemaining < 3) {
      // Enough rounds — acknowledge and prepare for wrap-up
      aiResponse =
        "Thank you for your responses. That's a comprehensive answer. Feel free to end the session when ready, and I'll generate your evaluation report.";
    } else {
      // Generate follow-up
      const transcriptForAI = session.transcript.map((t) => ({
        role: t.role as 'ai' | 'user' | 'system',
        content: t.content,
        timestamp: t.timestamp.toISOString(),
        type: t.type as 'text' | 'code' | 'whiteboard_snapshot',
      }));
      aiResponse = await generateFollowUp(session.domain as Domain, transcriptForAI);
    }

    // Add AI response
    session.transcript.push({
      role: 'ai',
      content: aiResponse,
      timestamp: new Date(),
      type: 'text',
    });

    await session.save();

    res.json({
      aiResponse,
      transcriptLength: session.transcript.length,
      timeRemainingMinutes: Math.max(0, Math.round(timeRemaining)),
    });
  } catch (error) {
    next(error);
  }
}

// ===== PATCH /sessions/:id/end — End session + trigger evaluation =====
export async function endSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;

    const session = await Session.findOne({ _id: id, userId: user._id });
    if (!session) throw ApiError.notFound('Session not found');
    if (session.status !== 'active') {
      throw ApiError.badRequest('Session is already ended');
    }

    session.endedAt = new Date();
    session.status = 'completed';

    // Generate evaluation report
    const transcriptForEval = session.transcript.map((t) => ({
      role: t.role as 'ai' | 'user' | 'system',
      content: t.content,
      timestamp: t.timestamp.toISOString(),
      type: t.type as 'text' | 'code' | 'whiteboard_snapshot',
    }));

    const evaluation = await generateEvaluation(
      transcriptForEval,
      session.domain as Domain,
      session.difficulty as Difficulty,
    );

    session.evaluationReport = {
      ...evaluation,
      generatedAt: new Date(),
    };

    await session.save();

    // Update user's readiness index (async, don't block response) - only if not aborted (score > 0)
    if (evaluation.overallScore > 0) {
      updateReadinessIndex(user._id.toString(), session.domain as Domain, evaluation.overallScore).catch(
        (err) => console.error('Failed to update readiness index:', err),
      );
    }

    // Generate summary asynchronously (don't block response)
    generateSummary(transcriptForEval)
      .then(async (summary) => {
        session.summary = { ...summary, generatedAt: new Date() };
        await session.save();
      })
      .catch((err) => console.error('Failed to generate summary:', err));

    res.json({
      sessionId: session._id,
      status: 'completed',
      evaluationReport: session.evaluationReport,
    });
  } catch (error) {
    next(error);
  }
}

// ===== GET /sessions/:id — Get a session with report =====
export async function getSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const { id } = req.params;
    const session = await Session.findOne({ _id: id, userId: user._id });
    if (!session) throw ApiError.notFound('Session not found');

    res.json(session);
  } catch (error) {
    next(error);
  }
}

// ===== GET /sessions — List user sessions (paginated) =====
export async function listSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const domain = req.query.domain as string | undefined;
    const type = req.query.type as string | undefined;

    const filter: Record<string, unknown> = { userId: user._id };
    if (domain) filter.domain = domain;
    if (type) filter.type = type;

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-transcript') // Omit transcript in list view
        .lean(),
      Session.countDocuments(filter),
    ]);

    res.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ===== Helper: update user readiness index =====
async function updateReadinessIndex(
  userId: string,
  domain: Domain,
  latestScore: number,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  // Weighted moving average — 70% old, 30% new
  const currentDomainScore = user.readinessIndex?.[domain] || 50;
  const newDomainScore = Math.round(currentDomainScore * 0.7 + latestScore * 0.3);

  if (!user.readinessIndex) {
    (user as any).readinessIndex = {
      overall: 50,
      dsa: 50,
      systemDesign: 50,
      backend: 50,
      conceptual: 50,
      behavioural: 50,
      lastUpdated: new Date(),
    };
  }

  (user.readinessIndex as any)[domain] = newDomainScore;

  // Recalculate overall as average
  const domains: Domain[] = ['dsa', 'systemDesign', 'backend', 'conceptual', 'behavioural'];
  const avg = domains.reduce((sum, d) => sum + ((user.readinessIndex as any)[d] || 50), 0) / domains.length;
  (user.readinessIndex as any).overall = Math.round(avg);
  (user.readinessIndex as any).lastUpdated = new Date();

  // Update streak
  const today = new Date().toDateString();
  const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).toDateString() : '';
  if (lastActive !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    user.streak = lastActive === yesterday ? (user.streak || 0) + 1 : 1;
    user.lastActiveDate = new Date();
  }

  await user.save();
}
