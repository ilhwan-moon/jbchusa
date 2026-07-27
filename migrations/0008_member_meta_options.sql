-- Member meta option tables + relax member_type/employment_type/status constraints
CREATE TABLE IF NOT EXISTS member_types (
  type_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employment_types (
  type_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS member_statuses (
  status_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO member_types (name, sort_order) VALUES
  ('성도', 1), ('새신자', 2), ('목회자', 3), ('직원', 4), ('학생', 5);

INSERT OR IGNORE INTO employment_types (name, sort_order) VALUES
  ('봉사자', 1), ('상근직원', 2), ('목회자', 3);

INSERT OR IGNORE INTO member_statuses (name, sort_order) VALUES
  ('활동', 1), ('휴면', 2), ('이전', 3), ('사망', 4);

-- NOTE: In D1/SQLite, rebuilding the members table can violate FK constraints
-- because related tables reference members. We keep the existing members schema
-- and only introduce the meta option tables here.
