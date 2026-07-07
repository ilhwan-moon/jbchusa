-- =====================================================================
--  Seed: 샘플 데이터 (JBCHUSA)
-- =====================================================================

-- 교회
INSERT OR IGNORE INTO churches (church_id, name, external_code, address, phone, senior_pastor) VALUES
(1, 'JBCHUSA', 'JBCH-US', '3000 W Olympic Blvd, Los Angeles, CA 90006', '(213) 555-0100', '이그리스도 목사');

-- ===== 조직 그룹 =====
-- 교구구역(PARISH): 교구 > 구역
INSERT OR IGNORE INTO org_groups (group_id, church_id, category_id, parent_id, name, level_type, service_area, sort_order) VALUES
(101, 1, 1, NULL, '1교구', '교구', 'Los Angeles, CA', 1),
(102, 1, 1, NULL, '2교구', '교구', 'Orange County, CA', 2),
(103, 1, 1, NULL, '3교구', '교구', 'San Diego, CA', 3),
(111, 1, 1, 101, '1교구 1구역', '구역', 'Koreatown 90006', 1),
(112, 1, 1, 101, '1교구 2구역', '구역', 'Mid-Wilshire 90019', 2),
(113, 1, 1, 102, '2교구 1구역', '구역', 'Fullerton 92831', 1),
(114, 1, 1, 102, '2교구 2구역', '구역', 'Irvine 92602', 2),
(115, 1, 1, 103, '3교구 1구역', '구역', 'San Diego 92101', 1);

-- 교제부서(FELLOWSHIP)
INSERT OR IGNORE INTO org_groups (group_id, church_id, category_id, parent_id, name, level_type, sort_order) VALUES
(201, 1, 2, NULL, '청년부', '부서', 1),
(202, 1, 2, NULL, '장년부', '부서', 2),
(203, 1, 2, NULL, '여전도회', '부서', 3),
(204, 1, 2, NULL, '남선교회', '부서', 4);

-- 교회학교(SCHOOL)
INSERT OR IGNORE INTO org_groups (group_id, church_id, category_id, parent_id, name, level_type, sort_order) VALUES
(301, 1, 3, NULL, '영유아부', '부서', 1),
(302, 1, 3, NULL, '유치부', '부서', 2),
(303, 1, 3, NULL, '초등부', '부서', 3),
(304, 1, 3, NULL, '중고등부', '부서', 4),
(311, 1, 3, 303, '초등 3학년반', '반', 1),
(312, 1, 3, 303, '초등 4학년반', '반', 2);

-- 봉사부서(MINISTRY)
INSERT OR IGNORE INTO org_groups (group_id, church_id, category_id, parent_id, name, level_type, sort_order) VALUES
(401, 1, 4, NULL, '찬양팀', '팀', 1),
(402, 1, 4, NULL, '미디어방송팀', '팀', 2),
(403, 1, 4, NULL, '주차안내팀', '팀', 3),
(404, 1, 4, NULL, '새가족환영팀', '팀', 4);

-- 직원(STAFF)
INSERT OR IGNORE INTO org_groups (group_id, church_id, category_id, parent_id, name, level_type, sort_order) VALUES
(501, 1, 5, NULL, '행정사무실', '부서', 1);

-- ===== 가구(세대) =====
INSERT OR IGNORE INTO households (household_id, church_id, household_name, address_line1, city, state, zip_code, home_phone) VALUES
(1, 1, 'The Kim Family', '350 S Western Ave', 'Los Angeles', 'CA', '90020', '(213) 555-1001'),
(2, 1, 'The Lee Family', '120 N Vermont Ave', 'Los Angeles', 'CA', '90004', '(213) 555-1002'),
(3, 1, 'The Park Family', '500 N Harbor Blvd', 'Fullerton', 'CA', '92832', '(714) 555-1003'),
(4, 1, 'The Choi Family', '88 Technology Dr', 'Irvine', 'CA', '92618', '(949) 555-1004'),
(5, 1, 'The Jung Family', '700 W Beech St', 'San Diego', 'CA', '92101', '(619) 555-1005');

-- ===== 성도 =====
INSERT OR IGNORE INTO members (member_id, church_id, household_id, household_role, first_name, last_name, korean_name, preferred_name, gender, title, birth_date, member_type, employment_type, status) VALUES
(1, 1, 1, 'head',   'David',  'Kim',  '김다윗', 'David',  'M', '장로', '1972-03-15', '성도', '봉사자', '활동'),
(2, 1, 1, 'spouse', 'Grace',  'Kim',  '김은혜', 'Grace',  'F', '권사', '1975-07-22', '성도', '봉사자', '활동'),
(3, 1, 1, 'child',  'Daniel', 'Kim',  '김다니엘','Daniel', 'M', '학생', '2010-01-10', '학생', '봉사자', '활동'),
(4, 1, 2, 'head',   'John',   'Lee',  '이요한', 'John',   'M', '목사', '1968-11-03', '목회자','목회자', '활동'),
(5, 1, 2, 'spouse', 'Sarah',  'Lee',  '이사라', 'Sarah',  'F', '사모', '1970-05-19', '성도', '봉사자', '활동'),
(6, 1, 3, 'head',   'Peter',  'Park', '박베드로','Peter',  'M', '집사', '1980-09-08', '성도', '봉사자', '활동'),
(7, 1, 3, 'spouse', 'Esther', 'Park', '박에스더','Esther', 'F', '집사', '1982-12-25', '성도', '봉사자', '활동'),
(8, 1, 3, 'child',  'Joshua', 'Park', '박여호수아','Joshua','M', '학생', '2013-04-17', '학생', '봉사자', '활동'),
(9, 1, 4, 'head',   'James',  'Choi', '최야고보','James',  'M', '집사', '1978-06-30', '성도', '봉사자', '활동'),
(10,1, 4, 'spouse', 'Hannah', 'Choi', '최한나', 'Hannah', 'F', '자매', '1985-02-14', '성도', '봉사자', '활동'),
(11,1, 5, 'head',   'Samuel', 'Jung', '정사무엘','Samuel', 'M', '장로', '1965-08-21', '성도', '봉사자', '활동'),
(12,1, 5, 'spouse', 'Rebecca','Jung', '정리브가','Rebecca','F', '권사', '1967-10-05', '성도', '봉사자', '활동'),
(13,1, NULL,NULL,    'Andrew', 'Yoon', '윤안드레','Andrew', 'M', '형제', '1995-03-03', '성도', '봉사자', '활동'),
(14,1, NULL,NULL,    'Mary',   'Han',  '한마리아','Mary',   'F', '자매', '1998-07-07', '성도', '봉사자', '활동'),
(15,1, NULL,NULL,    'Paul',   'Cho',  '조바울', 'Paul',   'M', '전도사', '1990-01-01', '목회자','목회자', '활동');

-- 세대주 설정
UPDATE households SET head_member_id=1 WHERE household_id=1;
UPDATE households SET head_member_id=4 WHERE household_id=2;
UPDATE households SET head_member_id=6 WHERE household_id=3;
UPDATE households SET head_member_id=9 WHERE household_id=4;
UPDATE households SET head_member_id=11 WHERE household_id=5;

-- 연락처
INSERT OR IGNORE INTO member_contacts (member_id, contact_type, value, is_primary) VALUES
(1,'mobile','(213) 555-2001',1), (1,'email','david.kim@example.com',0),
(2,'mobile','(213) 555-2002',1),
(4,'mobile','(213) 555-2004',1), (4,'email','pastor.lee@jbchusa.org',0),
(6,'mobile','(714) 555-2006',1),
(9,'mobile','(949) 555-2009',1),
(11,'mobile','(619) 555-2011',1),
(13,'mobile','(310) 555-2013',1), (13,'email','andrew.yoon@example.com',0),
(14,'mobile','(310) 555-2014',1);

-- 보유 언어
INSERT OR IGNORE INTO member_languages (member_id, language_id, is_primary, proficiency) VALUES
(1,1,1,'native'), (1,2,0,'fluent'),
(3,2,1,'native'), (3,1,0,'intermediate'),
(13,2,1,'native'),(13,1,0,'fluent');

-- 가족 관계
INSERT OR IGNORE INTO member_relationships (member_id, related_id, relation_type) VALUES
(1,2,'spouse'), (2,1,'spouse'),
(1,3,'child'),  (3,1,'parent'),
(6,7,'spouse'), (7,6,'spouse'),
(6,8,'child'),  (8,6,'parent'),
(9,10,'spouse'),(10,9,'spouse'),
(11,12,'spouse'),(12,11,'spouse');

-- ===== 소속/직분 매핑 (position_id는 이름 기반 조회) =====
-- 교구/구역 배치
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 1, 101, position_id, 1, '2015-01-01', 1 FROM positions WHERE name='교구장' AND position_type='조직장';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 2, 111, position_id, 1, '2016-01-01', 1 FROM positions WHERE name='구역장' AND position_type='조직장';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 6, 113, position_id, 1, '2018-01-01', 1 FROM positions WHERE name='구역장' AND position_type='조직장';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 11, 115, position_id, 1, '2017-01-01', 1 FROM positions WHERE name='구역장' AND position_type='조직장';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 9, 114, position_id, 1, '2019-01-01', 1 FROM positions WHERE name='부원' AND position_type='일반';

-- 교역자
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 4, 101, position_id, 1, '2010-01-01', 1 FROM positions WHERE name='담당목회자' AND position_type='교역자';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 15, 304, position_id, 1, '2020-01-01', 1 FROM positions WHERE name='전도사' AND position_type='교역자';

-- 교제부서
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 13, 201, position_id, 1, '2021-01-01', 1 FROM positions WHERE name='회장' AND position_type='임원';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 14, 201, position_id, 0, '2021-01-01', 1 FROM positions WHERE name='부원' AND position_type='일반';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 2, 203, position_id, 0, '2018-01-01', 1 FROM positions WHERE name='회장' AND position_type='임원';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 7, 203, position_id, 0, '2019-01-01', 1 FROM positions WHERE name='부원' AND position_type='일반';

-- 교회학교
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 3, 311, position_id, 1, '2022-01-01', 1 FROM positions WHERE name='학생' AND position_type='학생';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 8, 311, position_id, 1, '2022-01-01', 1 FROM positions WHERE name='학생' AND position_type='학생';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 10, 311, position_id, 0, '2021-01-01', 1 FROM positions WHERE name='교사' AND position_type='교사';

-- 봉사부서
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 13, 401, position_id, 0, '2021-06-01', 1 FROM positions WHERE name='팀장' AND position_type='조직장';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 14, 401, position_id, 0, '2021-06-01', 1 FROM positions WHERE name='부원' AND position_type='일반';
INSERT OR IGNORE INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT 9, 403, position_id, 0, '2020-01-01', 1 FROM positions WHERE name='팀장' AND position_type='조직장';

-- ===== 모임 & 출석 (샘플) =====
INSERT OR IGNORE INTO meetings (meeting_id, church_id, group_id, title, meeting_type, meeting_date, start_time, location) VALUES
(1, 1, 111, '1교구1구역 구역예배', '구역예배', '2026-06-07', '14:00', 'Kim Family Home'),
(2, 1, 111, '1교구1구역 구역예배', '구역예배', '2026-06-14', '14:00', 'Kim Family Home'),
(3, 1, 201, '청년부 모임', '부서모임', '2026-06-07', '13:00', 'Youth Room'),
(4, 1, 311, '초등 3학년 교회학교', '교회학교', '2026-06-07', '11:00', 'Classroom 3');

INSERT OR IGNORE INTO attendances (meeting_id, member_id, status) VALUES
(1,1,'present'),(1,2,'present'),(1,3,'present'),
(2,1,'present'),(2,2,'absent'),(2,3,'present'),
(3,13,'present'),(3,14,'present'),
(4,3,'present'),(4,8,'present'),(4,10,'present');
