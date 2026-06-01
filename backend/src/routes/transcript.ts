import { Router, type Request, type Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { transcripts } from '../schema';

interface PostBody {
  sourceLang?: string;
  lines?: unknown[];
}

export function transcriptRouter(): Router {
  const r = Router();

  r.post('/transcript/:videoId', async (req: Request, res: Response) => {
    const videoId = typeof req.params.videoId === 'string' ? req.params.videoId : '';
    const body = (req.body ?? {}) as PostBody;
    if (typeof body.sourceLang !== 'string' || !Array.isArray(body.lines)) {
      res.status(400).json({ error: 'invalid' });
      return;
    }
    await getDb()
      .insert(transcripts)
      .values({
        videoId,
        sourceLang: body.sourceLang,
        linesJson: body.lines,
      })
      .onConflictDoUpdate({
        target: [transcripts.videoId, transcripts.sourceLang],
        set: { linesJson: body.lines, createdAt: new Date() },
      });
    res.status(204).end();
  });

  r.get('/transcript/:videoId', async (req: Request, res: Response) => {
    const videoId = typeof req.params.videoId === 'string' ? req.params.videoId : '';
    const sourceLang = typeof req.query.sourceLang === 'string' ? req.query.sourceLang : '';
    if (!sourceLang) {
      res.status(400).json({ error: 'sourceLang required' });
      return;
    }
    const rows = await getDb()
      .select({ linesJson: transcripts.linesJson })
      .from(transcripts)
      .where(and(eq(transcripts.videoId, videoId), eq(transcripts.sourceLang, sourceLang)))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ lines: rows[0]?.linesJson });
  });

  return r;
}
