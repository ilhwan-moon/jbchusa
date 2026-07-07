-- Add address and Google Calendar sync fields for meetings
ALTER TABLE meetings ADD COLUMN address TEXT;
ALTER TABLE meetings ADD COLUMN google_event_id TEXT;

-- Admin calendar settings (service account config)
CREATE TABLE IF NOT EXISTS admin_calendar_settings (
  church_id INTEGER PRIMARY KEY,
  calendar_id TEXT,
  service_account_json TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  is_enabled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (church_id) REFERENCES churches(church_id)
);
