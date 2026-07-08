-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  reset_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_pwreset_token ON password_resets(token_hash);
