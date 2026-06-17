import { Hono } from 'hono'
import { hashPassword } from '../lib/auth'
import type { Bindings, SessionUser } from '../lib/types'

const admin = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

// ---- Positions ----
admin.get('/positions', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM positions ORDER BY rank_order, name`).all()
  return c.json({ positions: rows.results })
})
admin.post('/positions', async (c) => {
  const b = await c.req.json<any>()
  if (!b.name) return c.json({ error: '직분명 필요' }, 400)
  await c.env.DB.prepare(`INSERT INTO positions (name, position_type, rank_order) VALUES (?, ?, ?)`)
    .bind(b.name, b.position_type || '일반', b.rank_order ?? 99).run()
  return c.json({ ok: true })
})
admin.delete('/positions/:id', async (c) => {
  await c.env.DB.prepare(`DELETE FROM positions WHERE position_id=?`).bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ---- Languages ----
admin.get('/languages', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM languages ORDER BY sort_order`).all()
  return c.json({ languages: rows.results })
})
admin.post('/languages', async (c) => {
  const b = await c.req.json<any>()
  await c.env.DB.prepare(`INSERT INTO languages (code, name_en, name_native, sort_order) VALUES (?, ?, ?, ?)`)
    .bind(b.code, b.name_en, b.name_native || null, b.sort_order ?? 0).run()
  return c.json({ ok: true })
})

// ---- Categories ----
admin.get('/categories', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM group_categories ORDER BY sort_order`).all()
  return c.json({ categories: rows.results })
})

// ---- Org groups management ----
admin.post('/groups', async (c) => {
  const b = await c.req.json<any>()
  if (!b.category_id || !b.name) return c.json({ error: '분류와 이름 필요' }, 400)
  await c.env.DB.prepare(
    `INSERT INTO org_groups (church_id, category_id, parent_id, name, level_type, service_area, sort_order)
     VALUES (1, ?, ?, ?, ?, ?, ?)`
  ).bind(b.category_id, b.parent_id || null, b.name, b.level_type || '기타', b.service_area || null, b.sort_order ?? 0).run()
  return c.json({ ok: true })
})
admin.put('/groups/:id', async (c) => {
  const b = await c.req.json<any>()
  await c.env.DB.prepare(`UPDATE org_groups SET name=?, level_type=?, service_area=?, parent_id=?, sort_order=?, is_active=?, updated_at=datetime('now') WHERE group_id=?`)
    .bind(b.name, b.level_type || '기타', b.service_area || null, b.parent_id || null, b.sort_order ?? 0, b.is_active ?? 1, c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.delete('/groups/:id', async (c) => {
  await c.env.DB.prepare(`UPDATE org_groups SET is_active=0 WHERE group_id=?`).bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ---- Users management ----
admin.get('/users', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT u.user_id, u.username, u.email, u.display_name, u.is_active, u.oauth_provider, u.last_login_at, u.member_id,
       (SELECT GROUP_CONCAT(r.name, ', ') FROM user_roles ur JOIN roles r ON ur.role_id=r.role_id WHERE ur.user_id=u.user_id) AS roles
     FROM users u WHERE u.church_id=1 ORDER BY u.user_id`
  ).all()
  return c.json({ users: rows.results })
})

admin.get('/roles', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM roles ORDER BY role_id`).all()
  return c.json({ roles: rows.results })
})

admin.post('/users', async (c) => {
  const b = await c.req.json<any>()
  if (!b.username || !b.password) return c.json({ error: '아이디/비밀번호 필요' }, 400)
  const hash = await hashPassword(b.password)
  const res = await c.env.DB.prepare(
    `INSERT INTO users (church_id, username, email, password_hash, display_name, member_id, is_active) VALUES (1, ?, ?, ?, ?, ?, 1)`
  ).bind(b.username, b.email || null, hash, b.display_name || b.username, b.member_id || null).run()
  const userId = res.meta.last_row_id
  if (b.role_id) {
    await c.env.DB.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_group_id) VALUES (?, ?, ?)`)
      .bind(userId, b.role_id, b.scope_group_id || null).run()
  }
  return c.json({ user_id: userId })
})

admin.put('/users/:id/roles', async (c) => {
  const id = c.req.param('id')
  const { role_ids } = await c.req.json<{ role_ids: number[] }>()
  await c.env.DB.prepare(`DELETE FROM user_roles WHERE user_id=?`).bind(id).run()
  for (const rid of role_ids || []) {
    await c.env.DB.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_group_id) VALUES (?, ?, NULL)`).bind(id, rid).run()
  }
  return c.json({ ok: true })
})

admin.put('/users/:id/active', async (c) => {
  const { is_active } = await c.req.json<{ is_active: number }>()
  await c.env.DB.prepare(`UPDATE users SET is_active=? WHERE user_id=?`).bind(is_active ? 1 : 0, c.req.param('id')).run()
  return c.json({ ok: true })
})

admin.put('/users/:id/password', async (c) => {
  const { password } = await c.req.json<{ password: string }>()
  if (!password || password.length < 6) return c.json({ error: '비밀번호는 6자 이상' }, 400)
  const hash = await hashPassword(password)
  await c.env.DB.prepare(`UPDATE users SET password_hash=? WHERE user_id=?`).bind(hash, c.req.param('id')).run()
  return c.json({ ok: true })
})

export default admin
