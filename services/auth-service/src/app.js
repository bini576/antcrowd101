import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/authRoutes.js';

export function createApp() {
  const app = express();
  const allowLocalhostInDev = config.nodeEnv !== 'production';

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        if (allowLocalhostInDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS origin denied: ${origin}`));
      },
      credentials: true
    })
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/', authRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
