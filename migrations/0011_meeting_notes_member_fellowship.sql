-- Migration 0011: meeting_notes에 member_id 컬럼 추가 + note_type에 fellowship 추가 (news → fellowship 명칭 변경)

-- SQLite는 CHECK constraint를 ALTER TABLE로 변경할 수 없으므로
-- 테이블 재생성 방식을 사용합니다.

-- 1. 새 테이블 생성 (note_type에 fellowship 포함, member_id 컬럼 추가)
CREATE TABLE IF NOT EXISTS meeting_notes_new (
  note_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  note_type  TEXT NOT NULL CHECK(note_type IN ('prayer','fellowship','testimony','other')),
  content    TEXT NOT NULL,
  member_id  INTEGER,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id)  REFERENCES members(member_id) ON DELETE SET NULL
);

-- 2. 기존 데이터 이전 (note_type 'news' → 'fellowship' 변환)
INSERT INTO meeting_notes_new (note_id, meeting_id, note_type, content, member_id, created_by, created_at, updated_at)
SELECT
  note_id,
  meeting_id,
  CASE note_type WHEN 'news' THEN 'fellowship' ELSE note_type END,
  content,
  NULL,
  created_by,
  created_at,
  updated_at
FROM meeting_notes;

-- 3. 기존 테이블 삭제 및 이름 변경
DROP TABLE meeting_notes;
ALTER TABLE meeting_notes_new RENAME TO meeting_notes;

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting ON meeting_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_member ON meeting_notes(member_id);
