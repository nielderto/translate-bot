CREATE TABLE IF NOT EXISTS translations (
  video_id text NOT NULL,
  line_index integer NOT NULL,
  source_lang text NOT NULL,
  target_lang text NOT NULL,
  original text NOT NULL,
  translation text NOT NULL,
  romanization text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, line_index, source_lang, target_lang)
);

CREATE INDEX IF NOT EXISTS translations_video_lang_idx
  ON translations (video_id, source_lang, target_lang);

CREATE TABLE IF NOT EXISTS transcripts (
  video_id text NOT NULL,
  source_lang text NOT NULL,
  lines_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, source_lang)
);
