import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { translateRouter } from './routes/translate';
import { transcriptRouter } from './routes/transcript';
import { chatRouter } from './routes/chat';
import { makeLimiter } from './lib/rateLimit';

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: ['https://www.youtube.com', 'http://localhost:3000'] }));
  app.use(express.json({ limit: '2mb' }));
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.use(translateRouter());
  app.use(transcriptRouter());
  const chatLimiter = makeLimiter({ maxPerHour: 100 });
  app.use('/chat', chatLimiter.middleware());
  app.use(chatRouter());
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`Listening on :${port}`);
  });
}
