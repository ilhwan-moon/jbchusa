-- Migration 0012: member_prayer_requests 테이블에 note_type 컬럼 추가
-- SQLite는 CHECK constraint가 있는 컬럼을 직접 ALTER로 추가할 수 없으므로
-- 테이블을 재생성하는 방식으로 처리

CREATE TABLE IF NOT EXISTS member_prayer_requests_new (
  prayer_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER NOT NULL,
  note_type  TEXT NOT NULL DEFAULT 'prayer' CHECK(note_type IN ('prayer','testimony')),
  prayer_date TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);

INSERT INTO member_prayer_requests_new
  (prayer_id, member_id, note_type, prayer_date, content, created_by, created_at, updated_at)
SELECT
  prayer_id, member_id, 'prayer', prayer_date, content, created_by, created_at, updated_at
FROM member_prayer_requests;

DROP TABLE member_prayer_requests;
ALTER TABLE member_prayer_requests_new RENAME TO member_prayer_requests;

CREATE INDEX IF NOT EXISTS idx_mpr_member   ON member_prayer_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_mpr_type     ON member_prayer_requests(note_type);
CREATE INDEX IF NOT EXISTS idx_mpr_date     ON member_prayer_requests(prayer_date);
