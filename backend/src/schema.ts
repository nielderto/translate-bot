import { pgTable, text, integer, jsonb, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

export const translations = pgTable(
  'translations',
  {
    videoId: text('video_id').notNull(),
    lineIndex: integer('line_index').notNull(),
    sourceLang: text('source_lang').notNull(),
    targetLang: text('target_lang').notNull(),
    original: text('original').notNull(),
    translation: text('translation').notNull(),
    romanization: text('romanization').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.videoId, t.lineIndex, t.sourceLang, t.targetLang] }),
    videoLangIdx: index('translations_video_lang_idx').on(t.videoId, t.sourceLang, t.targetLang),
  }),
);

export const transcripts = pgTable(
  'transcripts',
  {
    videoId: text('video_id').notNull(),
    sourceLang: text('source_lang').notNull(),
    linesJson: jsonb('lines_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.videoId, t.sourceLang] }),
  }),
);
