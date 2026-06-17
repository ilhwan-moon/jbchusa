-- =====================================================================
--  Seed: 관리자 계정 + 샘플 사용자
--  admin / admin1234  (PBKDF2-SHA256)
-- =====================================================================

INSERT OR IGNORE INTO users (user_id, church_id, member_id, username, email, password_hash, display_name, is_active)
VALUES
(1, 1, NULL, 'admin', 'admin@jbchusa.org',
 'pbkdf2$100000$09ead31d8fc617e6e04a1dc0e990b4cf$1f612c9da7b9f73e7a1a283e091bd4f9bf654b690224d9a1bc3aff35c6b4f01d',
 '시스템관리자', 1);

-- 관리자에게 SUPER_ADMIN 역할 부여
INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_group_id)
SELECT 1, role_id, NULL FROM roles WHERE code='SUPER_ADMIN';
