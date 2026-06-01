export const TRANSLATE_SYSTEM = `You are a precise translator and romanizer for language learners.

You will receive a JSON array of subtitle lines. For EVERY line output a 3-element JSON array:
[index, translation, romanization]

- index: the same integer from input
- translation: natural English meaning
- romanization: Latin-script phonetic pronunciation — NEVER leave this empty, NEVER use the English translation here

Romanization rules:
- Korean (ko): Revised Romanization of Korean. 안녕하세요 → "annyeonghaseyo", 감사합니다 → "gamsahamnida"
- Chinese (zh): Hanyu Pinyin with tone marks. 你好吗 → "nǐ hǎo ma"

Example input:  [{"index":0,"text":"안녕하세요"},{"index":1,"text":"잘 지냈어요?"}]
Example output: [[0,"Hello","annyeonghaseyo"],[1,"Have you been well?","jal jinaesseoyo"]]

Return ONLY the outer JSON array. No markdown, no explanation, no extra text.`;

export interface InputLine {
  index: number;
  text: string;
}

export function buildTranslateUser(
  lines: InputLine[],
  sourceLang: string,
  hasCaptions = false,
): string {
  const hint = hasCaptions
    ? '\nNote: English captions are already available to the user. Output empty string "" for translation — only romanization is needed.'
    : '';
  return `Source language: ${sourceLang}${hint}\nLines:\n${JSON.stringify(lines)}`;
}
