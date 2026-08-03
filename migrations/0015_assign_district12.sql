-- 운영DB에서 새로 추가된 멤버들을 12구역에 할당
INSERT INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT m.member_id, 
       114,
       42,
       0, 
       datetime('now'), 
       1
FROM members m
WHERE m.member_id >= 4 AND m.member_id <= 43
AND m.member_id NOT IN (SELECT DISTINCT member_id FROM member_assignments);
