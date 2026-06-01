import { Router, type Request, type Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { transcripts } from '../schema';
import { streamChat } from '../anthropic';
import { buildChatPrompt, type TranscriptLine } from '../lib/promptBuilder';
import type { ChatMessage } from '../anthropic';

interface ChatRequestBody {
  videoId?: string;
  sourceLang?: string;
  clickedLineIndex?: number;
  question?: string;
  history?: ChatMessage[];
  lineText?: string;
  lineTranslation?: string;
}

export function chatRouter(): Router {
  const r = Router();

  r.post('/chat', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as ChatRequestBody;
    const { videoId, sourceLang, clickedLineIndex, question, lineText, lineTranslation } = body;
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];

    if (
      typeof videoId !== 'string' ||
      typeof sourceLang !== 'string' ||
      typeof clickedLineIndex !== 'number' ||
      typeof question !== 'string'
    ) {
      res.status(400).json({ error: 'invalid request' });
      return;
    }

    const rows = await getDb()
      .select({ linesJson: transcripts.linesJson })
      .from(transcripts)
      .where(and(eq(transcripts.videoId, videoId), eq(transcripts.sourceLang, sourceLang)))
      .limit(1);

    // Fall back to a single-line transcript built from the inline context the extension sent.
    // This handles the case where putTranscript hasn't landed in the DB yet.
    let transcript: TranscriptLine[];
    if (rows.length > 0) {
      transcript = rows[0]!.linesJson as TranscriptLine[];
    } else if (typeof lineText === 'string' && lineText) {
      transcript = [{
        index: clickedLineIndex,
        text: lineText,
        translation: lineTranslation ?? '',
      }];
    } else {
      res.status(404).json({ error: 'transcript not found' });
      return;
    }
    const { system, messages } = buildChatPrompt({
      transcript,
      sourceLang,
      clickedLineIndex,
      history,
      question,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of streamChat({ system, messages })) {
        res.write(`data: ${chunk}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'stream error';
      console.error('[chat] upstream error:', msg);
      res.write(`event: error\ndata: ${msg}\n\n`);
    } finally {
      res.end();
    }
  });

  return r;
}
