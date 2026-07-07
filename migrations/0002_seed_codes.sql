-- =====================================================================
--  Seed: 기준 코드 데이터
-- =====================================================================

-- 조직 대분류
INSERT OR IGNORE INTO group_categories (code, name, description, sort_order) VALUES
('PARISH',     '교구구역', '지역 중심 교구와 구역', 1),
('FELLOWSHIP', '교제부서', '연령·성별 중심 부서', 2),
('SCHOOL',     '교회학교', '5세~고3 학생 및 교사봉사자', 3),
('MINISTRY',   '봉사부서', '전문 달란트 기반 봉사 조직', 4),
('STAFF',      '직원',     '상근 직원/행정조직', 5);

-- 직분
INSERT OR IGNORE INTO positions (name, position_type, rank_order) VALUES
('담임목사','교역자',1), ('부목사','교역자',2), ('전도사','교역자',3), ('담당목회자','교역자',4),
('회장','임원',10), ('부회장','임원',11), ('총무','임원',12), ('부총무','임원',13),
('회계','임원',14), ('서기','임원',15), ('자문','임원',16), ('고문','임원',16),
('후원회장','임원',17), ('헌금위원','임원',18),
('교구장','조직장',20), ('부교구장','조직장',21), ('교구총무','조직장',22),
('교구조장','조직장',23), ('부교구조장','조직장',24), ('교구자매총무','조직장',25),
('구역장','조직장',30), ('부구역장','조직장',31), ('구역총무','조직장',32), ('구역서기','조직장',33),
('조장','조직장',40), ('조총무','조직장',41), ('조회계','조직장',42), ('조서기','조직장',43),
('부장','조직장',50), ('차장','조직장',51), ('자매부장','조직장',52),
('대장','조직장',53), ('지휘','조직장',54), ('부지휘','조직장',55),
('팀장','조직장',56), ('실장','조직장',57), ('교무','교사',60),
('교사','교사',61), ('통역','조직장',62), ('부원','일반',70),
('학생','학생',80), ('일반회원','일반',99),
('총괄관리부장','직원',5), ('사무행정','직원',6), ('시설','직원',7), ('방송차량','직원',8), ('주방','직원',9);

-- 언어
INSERT OR IGNORE INTO languages (code, name_en, name_native, sort_order) VALUES
('ko','Korean','한국어',1),
('en','English','English',2),
('zh','Chinese','中文',3),
('es','Spanish','Español',4),
('ja','Japanese','日本語',5);

-- 역할
INSERT OR IGNORE INTO roles (code, name, description) VALUES
('SUPER_ADMIN',   '시스템관리자', '전체 시스템 관리'),
('SENIOR_PASTOR', '담임목사',     '교회 전체 조회/관리'),
('PASTOR',        '교역자',       '담당 교구·부서 관리'),
('PARISH_LEADER', '교구장',       '자기 교구 관리'),
('ZONE_LEADER',   '구역장',       '자기 구역 출석/명단 관리'),
('DEPT_LEADER',   '부서장',       '자기 부서 관리'),
('STAFF',         '직원',         '행정 업무'),
('MEMBER',        '일반성도',     '본인 정보 조회');

-- 권한
INSERT OR IGNORE INTO permissions (code, name, category) VALUES
('member.view',     '성도 조회',      '성도'),
('member.edit',     '성도 등록/수정',  '성도'),
('member.delete',   '성도 삭제',      '성도'),
('attendance.view', '출석 조회',      '출석'),
('attendance.edit', '출석 입력/수정',  '출석'),
('meeting.manage',  '모임 관리',      '출석'),
('org.manage',      '조직 관리',      '조직'),
('report.view',     '통계 조회',      '통계'),
('user.manage',     '사용자/권한 관리','시스템');

-- 역할-권한 매핑
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.code='SUPER_ADMIN';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
WHERE r.code='SENIOR_PASTOR' AND p.code<>'user.manage';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
WHERE r.code='PASTOR' AND p.code IN ('member.view','member.edit','attendance.view','attendance.edit','meeting.manage','report.view');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
WHERE r.code='PARISH_LEADER' AND p.code IN ('member.view','attendance.view','attendance.edit','meeting.manage','report.view');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
WHERE r.code='ZONE_LEADER' AND p.code IN ('member.view','attendance.view','attendance.edit','meeting.manage');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
WHERE r.code='DEPT_LEADER' AND p.code IN ('member.view','attendance.view','attendance.edit','meeting.manage');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
WHERE r.code='STAFF' AND p.code IN ('member.view','member.edit','report.view');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
WHERE r.code='MEMBER' AND p.code IN ('member.view');
