-- =====================================================================
--  Church Management System (JBCHUSA) - D1/SQLite Schema
--  Adapted from MySQL 8.0 DDL to Cloudflare D1 (SQLite)
-- =====================================================================

-- ============ SECTION 1. 기준/마스터 ============

-- 1-1) 교회
CREATE TABLE IF NOT EXISTS churches (
  church_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  external_code TEXT,
  address       TEXT,
  phone         TEXT,
  senior_pastor TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- 1-2) 조직 대분류
CREATE TABLE IF NOT EXISTS group_categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER DEFAULT 0
);

-- 1-3) 직분 코드
CREATE TABLE IF NOT EXISTS positions (
  position_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  position_type TEXT NOT NULL DEFAULT '일반' CHECK(position_type IN ('임원','조직장','교역자','교사','학생','직원','일반')),
  rank_order    INTEGER DEFAULT 99,
  UNIQUE(name, position_type)
);

-- 1-4) 언어 코드
CREATE TABLE IF NOT EXISTS languages (
  language_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name_en     TEXT NOT NULL,
  name_native TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1
);

-- ============ SECTION 2. 조직 (트리) ============

CREATE TABLE IF NOT EXISTS org_groups (
  group_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id    INTEGER NOT NULL,
  category_id  INTEGER NOT NULL,
  parent_id    INTEGER,
  name         TEXT NOT NULL,
  level_type   TEXT NOT NULL DEFAULT '기타' CHECK(level_type IN ('교구','구역','조','부서','반','팀','기타')),
  service_area TEXT,
  description  TEXT,
  sort_order   INTEGER DEFAULT 0,
  is_active    INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (church_id)   REFERENCES churches(church_id),
  FOREIGN KEY (category_id) REFERENCES group_categories(category_id),
  FOREIGN KEY (parent_id)   REFERENCES org_groups(group_id)
);
CREATE INDEX IF NOT EXISTS idx_group_church ON org_groups(church_id);
CREATE INDEX IF NOT EXISTS idx_group_parent ON org_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_group_category ON org_groups(category_id);

-- ============ SECTION 3. 가족 & 교인 ============

-- 3-1) 가구(세대)
CREATE TABLE IF NOT EXISTS households (
  household_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id      INTEGER NOT NULL,
  household_name TEXT NOT NULL,
  head_member_id INTEGER,
  address_line1  TEXT,
  address_line2  TEXT,
  city           TEXT,
  state          TEXT,
  zip_code       TEXT,
  county         TEXT,
  country        TEXT NOT NULL DEFAULT 'US',
  home_phone     TEXT,
  mailing_label  TEXT,
  note           TEXT,
  is_active      INTEGER DEFAULT 1,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (church_id) REFERENCES churches(church_id)
);
CREATE INDEX IF NOT EXISTS idx_household_church ON households(church_id);
CREATE INDEX IF NOT EXISTS idx_household_zip ON households(zip_code);
CREATE INDEX IF NOT EXISTS idx_household_state_city ON households(state, city);

-- 3-2) 교인 기본정보
CREATE TABLE IF NOT EXISTS members (
  member_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id       INTEGER NOT NULL,
  household_id    INTEGER,
  household_role  TEXT CHECK(household_role IN ('head','spouse','child','parent','relative','other')),
  use_own_address INTEGER NOT NULL DEFAULT 0,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  korean_name     TEXT,
  preferred_name  TEXT,
  gender          TEXT CHECK(gender IN ('M','F')),
  title           TEXT,
  birth_date      TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state           TEXT,
  zip_code        TEXT,
  county          TEXT,
  country         TEXT NOT NULL DEFAULT 'US',
  salvation_date  TEXT,
  member_type     TEXT NOT NULL DEFAULT '교인' CHECK(member_type IN ('교인','새신자','목회자','직원','학생')),
  employment_type TEXT NOT NULL DEFAULT '봉사자' CHECK(employment_type IN ('봉사자','상근직원','목회자')),
  photo_url       TEXT,
  status          TEXT NOT NULL DEFAULT '활동' CHECK(status IN ('활동','휴면','이전','사망')),
  note            TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (church_id)    REFERENCES churches(church_id),
  FOREIGN KEY (household_id) REFERENCES households(household_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_member_church ON members(church_id);
CREATE INDEX IF NOT EXISTS idx_member_household ON members(household_id);
CREATE INDEX IF NOT EXISTS idx_member_lastname ON members(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_member_state_city ON members(state, city);
CREATE INDEX IF NOT EXISTS idx_member_zip ON members(zip_code);

-- 3-4) 교인 연락처
CREATE TABLE IF NOT EXISTS member_contacts (
  contact_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER NOT NULL,
  contact_type TEXT NOT NULL DEFAULT 'mobile' CHECK(contact_type IN ('mobile','home','office','email')),
  value        TEXT NOT NULL,
  is_primary   INTEGER DEFAULT 0,
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contact_member ON member_contacts(member_id);

-- 3-5) 교인 보유 언어
CREATE TABLE IF NOT EXISTS member_languages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL,
  language_id INTEGER NOT NULL,
  is_primary  INTEGER DEFAULT 0,
  proficiency TEXT CHECK(proficiency IN ('native','fluent','intermediate','basic')),
  FOREIGN KEY (member_id)   REFERENCES members(member_id) ON DELETE CASCADE,
  FOREIGN KEY (language_id) REFERENCES languages(language_id),
  UNIQUE(member_id, language_id)
);
CREATE INDEX IF NOT EXISTS idx_mlang_member ON member_languages(member_id);
CREATE INDEX IF NOT EXISTS idx_mlang_language ON member_languages(language_id);

-- 3-6) 가족 관계
CREATE TABLE IF NOT EXISTS member_relationships (
  relationship_id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id       INTEGER NOT NULL,
  related_id      INTEGER NOT NULL,
  relation_type   TEXT NOT NULL CHECK(relation_type IN ('spouse','parent','child','sibling','grandparent','grandchild','guardian','other')),
  note            TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id)  REFERENCES members(member_id) ON DELETE CASCADE,
  FOREIGN KEY (related_id) REFERENCES members(member_id) ON DELETE CASCADE,
  UNIQUE(member_id, related_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_rel_member ON member_relationships(member_id);
CREATE INDEX IF NOT EXISTS idx_rel_related ON member_relationships(related_id);

-- ============ SECTION 4. 소속/직분 매핑 ============

CREATE TABLE IF NOT EXISTS member_assignments (
  assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id     INTEGER NOT NULL,
  group_id      INTEGER NOT NULL,
  position_id   INTEGER NOT NULL,
  sub_role      TEXT,
  is_primary    INTEGER DEFAULT 0,
  joined_at     TEXT,
  left_at       TEXT,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id)   REFERENCES members(member_id),
  FOREIGN KEY (group_id)    REFERENCES org_groups(group_id),
  FOREIGN KEY (position_id) REFERENCES positions(position_id)
);
CREATE INDEX IF NOT EXISTS idx_assign_member ON member_assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_assign_group ON member_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_assign_active ON member_assignments(is_active);

CREATE TABLE IF NOT EXISTS pastor_charges (
  charge_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL,
  group_id    INTEGER NOT NULL,
  charge_note TEXT,
  is_active   INTEGER DEFAULT 1,
  FOREIGN KEY (member_id) REFERENCES members(member_id),
  FOREIGN KEY (group_id)  REFERENCES org_groups(group_id)
);
CREATE INDEX IF NOT EXISTS idx_charge_member ON pastor_charges(member_id);
CREATE INDEX IF NOT EXISTS idx_charge_group ON pastor_charges(group_id);

-- ============ SECTION 5. 사용자/권한 (RBAC) ============

CREATE TABLE IF NOT EXISTS users (
  user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id      INTEGER NOT NULL,
  member_id      INTEGER,
  username       TEXT NOT NULL,
  email          TEXT,
  password_hash  TEXT,
  oauth_provider TEXT,
  oauth_sub      TEXT,
  avatar_url     TEXT,
  display_name   TEXT,
  is_active      INTEGER DEFAULT 1,
  last_login_at  TEXT,
  failed_count   INTEGER DEFAULT 0,
  locked_until   TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (church_id) REFERENCES churches(church_id),
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE SET NULL,
  UNIQUE(church_id, username)
);
CREATE INDEX IF NOT EXISTS idx_user_member ON users(member_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);

CREATE TABLE IF NOT EXISTS roles (
  role_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code     TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  category TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(role_id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_role_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  role_id        INTEGER NOT NULL,
  scope_group_id INTEGER,
  granted_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id)        REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (role_id)        REFERENCES roles(role_id),
  FOREIGN KEY (scope_group_id) REFERENCES org_groups(group_id),
  UNIQUE(user_id, role_id, scope_group_id)
);
CREATE INDEX IF NOT EXISTS idx_ur_user ON user_roles(user_id);

-- ============ SECTION 6. 출석 ============

CREATE TABLE IF NOT EXISTS meetings (
  meeting_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id    INTEGER NOT NULL,
  group_id     INTEGER NOT NULL,
  title        TEXT NOT NULL,
  meeting_type TEXT NOT NULL DEFAULT '구역예배' CHECK(meeting_type IN ('주일예배','수요예배','구역예배','교구모임','부서모임','교회학교','새벽기도','특별집회','기타')),
  meeting_date TEXT NOT NULL,
  start_time   TEXT,
  location     TEXT,
  note         TEXT,
  created_by   INTEGER,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (church_id)  REFERENCES churches(church_id),
  FOREIGN KEY (group_id)   REFERENCES org_groups(group_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_meeting_group_date ON meetings(group_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_date ON meetings(meeting_date);

CREATE TABLE IF NOT EXISTS attendances (
  attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id    INTEGER NOT NULL,
  member_id     INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present','absent','excused','online','late')),
  check_in_time TEXT,
  note          TEXT,
  recorded_by   INTEGER,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (meeting_id)  REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id)   REFERENCES members(member_id),
  FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE(meeting_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_att_member ON attendances(member_id);
CREATE INDEX IF NOT EXISTS idx_att_status ON attendances(status);
