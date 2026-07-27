-- Recurring meeting series
CREATE TABLE IF NOT EXISTS meeting_series (
  series_id INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL DEFAULT '구역예배' CHECK(meeting_type IN ('주일예배','수요예배','구역예배','교구모임','부서모임','교회학교','새벽기도','특별집회','기타')),
  start_date TEXT NOT NULL,
  start_time TEXT,
  location TEXT,
  address TEXT,
  note TEXT,
  recurrence_freq TEXT NOT NULL DEFAULT 'weekly' CHECK(recurrence_freq IN ('weekly','monthly')),
  recurrence_interval INTEGER NOT NULL DEFAULT 1,
  until_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (church_id) REFERENCES churches(church_id),
  FOREIGN KEY (group_id) REFERENCES org_groups(group_id)
);

ALTER TABLE meetings ADD COLUMN series_id INTEGER;
ALTER TABLE meetings ADD COLUMN is_series_exception INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_meeting_series ON meetings(series_id);
