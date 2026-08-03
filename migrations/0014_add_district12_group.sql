-- 12구역 멤버 일괄 추가 (이전 부정확한 쿼리 제거)
DELETE FROM member_assignments WHERE group_id=502;

-- 16~55번 모든 멤버를 12구역에 추가
INSERT INTO member_assignments (member_id, group_id, position_id, is_primary, joined_at, is_active)
SELECT m.member_id, 
       502,
       (SELECT position_id FROM positions WHERE name='부원' AND position_type='일반' LIMIT 1),
       0, 
       datetime('now'), 
       1
FROM members m
WHERE m.member_id >= 16 AND m.member_id <= 55;
