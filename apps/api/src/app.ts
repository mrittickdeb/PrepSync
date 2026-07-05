import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import sessionRoutes from './routes/session';
import roomRoutes from './routes/room';
import groupRoutes from './routes/group';
import dmRoutes from './routes/dm';
import codeRoutes from './routes/code';
import uploadRoutes from './routes/upload';
import magicLinkRoutes from './routes/magicLink';
import livekitRoutes from './routes/livekit';
import passport from './config/passport';

const app = express();

// Security middleware
app.use(helmet());

// CORS (Tolerant of trailing slashes in env var)
const allowedOrigin = env.CLIENT_URL.endsWith('/') 
  ? env.CLIENT_URL.slice(0, -1) 
  : env.CLIENT_URL;

app.use(
  cors({
    origin: [allowedOrigin, allowedOrigin + '/'],
    credentials: true,
  })
);

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Passport init
app.use(passport.initialize());

// Routes
app.use(healthRoutes);
app.use(authRoutes);
app.use(userRoutes);
app.use(sessionRoutes);
app.use(roomRoutes);
app.use(groupRoutes);
app.use(dmRoutes);
app.use(codeRoutes);
app.use(uploadRoutes);
app.use(magicLinkRoutes);
app.use(livekitRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
