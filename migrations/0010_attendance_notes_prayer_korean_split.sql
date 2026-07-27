-- Add absence reasons (multi-language)
CREATE TABLE IF NOT EXISTS absence_reasons (
  reason_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  name_en     TEXT,
  name_es     TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);

INSERT INTO absence_reasons (name, name_en, name_es, sort_order, is_active)
VALUES
  ('건강', 'Health', 'Salud', 1, 1),
  ('출장', 'Business Trip', 'Viaje de negocios', 2, 1),
  ('여행', 'Travel', 'Viaje', 3, 1),
  ('가족행사', 'Family Event', 'Evento familiar', 4, 1),
  ('타지 방문', 'Out of Town Visit', 'Visita fuera de la ciudad', 5, 1),
  ('개인 사정', 'Personal Reasons', 'Asuntos personales', 6, 1),
  ('해외 방문', 'Overseas Visit', 'Visita al extranjero', 7, 1)
ON CONFLICT DO NOTHING;

-- Attendance: store absence reason
ALTER TABLE attendances ADD COLUMN absence_reason_id INTEGER;

-- Meeting notes (prayer/news/testimony)
CREATE TABLE IF NOT EXISTS meeting_notes (
  note_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  note_type  TEXT NOT NULL CHECK(note_type IN ('prayer','news','testimony','other')),
  content    TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting ON meeting_notes(meeting_id);

-- Member prayer requests
CREATE TABLE IF NOT EXISTS member_prayer_requests (
  prayer_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER NOT NULL,
  prayer_date TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_member_prayer_member ON member_prayer_requests(member_id);

-- Korean name split
ALTER TABLE members ADD COLUMN korean_last_name TEXT;
ALTER TABLE members ADD COLUMN korean_first_name TEXT;
