import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { translations } from '../schema';

export interface CachedLine {
  index: number;
  original: string;
  translation: string;
  romanization: string;
}

export async function getCachedLines(
  videoId: string,
  sourceLang: string,
  targetLang: string,
  indices: number[],
): Promise<CachedLine[]> {
  if (indices.length === 0) return [];
  const rows = await getDb()
    .select({
      index: translations.lineIndex,
      original: translations.original,
      translation: translations.translation,
      romanization: translations.romanization,
    })
    .from(translations)
    .where(
      and(
        eq(translations.videoId, videoId),
        eq(translations.sourceLang, sourceLang),
        eq(translations.targetLang, targetLang),
        inArray(translations.lineIndex, indices),
      ),
    )
    .orderBy(asc(translations.lineIndex));
  return rows;
}

export async function getAllCachedLines(
  videoId: string,
  sourceLang: string,
  targetLang: string,
): Promise<CachedLine[]> {
  const rows = await getDb()
    .select({
      index: translations.lineIndex,
      original: translations.original,
      translation: translations.translation,
      romanization: translations.romanization,
    })
    .from(translations)
    .where(
      and(
        eq(translations.videoId, videoId),
        eq(translations.sourceLang, sourceLang),
        eq(translations.targetLang, targetLang),
      ),
    )
    .orderBy(asc(translations.lineIndex));
  return rows;
}

export async function putCachedLines(
  videoId: string,
  sourceLang: string,
  targetLang: string,
  lines: CachedLine[],
): Promise<void> {
  if (lines.length === 0) return;
  const rows = lines.map((l) => ({
    videoId,
    lineIndex: l.index,
    sourceLang,
    targetLang,
    original: l.original,
    translation: l.translation,
    romanization: l.romanization,
  }));
  await getDb()
    .insert(translations)
    .values(rows)
    .onConflictDoNothing();
}
