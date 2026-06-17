import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../lib/types'

const hh = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

hh.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim()
  let sql = `SELECT h.*, (SELECT COUNT(*) FROM members m WHERE m.household_id=h.household_id) AS member_count
    FROM households h WHERE h.church_id=1`
  const binds: any[] = []
  if (q) { sql += ` AND h.household_name LIKE ?`; binds.push(`%${q}%`) }
  sql += ` ORDER BY h.household_name LIMIT 300`
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ households: rows.results })
})

hh.get('/:id', async (c) => {
  const id = c.req.param('id')
  const household = await c.env.DB.prepare(`SELECT * FROM households WHERE household_id=?`).bind(id).first()
  if (!household) return c.json({ error: 'Not found' }, 404)
  const memberRows = await c.env.DB.prepare(
    `SELECT member_id, first_name, last_name, korean_name, household_role, title, photo_url, birth_date
     FROM members WHERE household_id=? ORDER BY
     CASE household_role WHEN 'head' THEN 0 WHEN 'spouse' THEN 1 WHEN 'child' THEN 2 ELSE 3 END`
  ).bind(id).all()
  return c.json({ household, members: memberRows.results })
})

hh.post('/', async (c) => {
  const b = await c.req.json<any>()
  if (!b.household_name) return c.json({ error: '세대 이름이 필요합니다.' }, 400)
  const res = await c.env.DB.prepare(
    `INSERT INTO households (church_id, household_name, address_line1, address_line2, city, state, zip_code, county, home_phone, note)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(b.household_name, b.address_line1 || null, b.address_line2 || null, b.city || null, b.state || null,
    b.zip_code || null, b.county || null, b.home_phone || null, b.note || null).run()
  return c.json({ household_id: res.meta.last_row_id })
})

hh.put('/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json<any>()
  await c.env.DB.prepare(
    `UPDATE households SET household_name=?, address_line1=?, address_line2=?, city=?, state=?, zip_code=?, county=?, home_phone=?, head_member_id=?, note=?, updated_at=datetime('now')
     WHERE household_id=?`
  ).bind(b.household_name, b.address_line1 || null, b.address_line2 || null, b.city || null, b.state || null,
    b.zip_code || null, b.county || null, b.home_phone || null, b.head_member_id || null, b.note || null, id).run()
  return c.json({ ok: true })
})

// Assign a member to this household
hh.post('/:id/members', async (c) => {
  const id = c.req.param('id')
  const { member_id, household_role } = await c.req.json<any>()
  await c.env.DB.prepare(`UPDATE members SET household_id=?, household_role=? WHERE member_id=?`)
    .bind(id, household_role || null, member_id).run()
  return c.json({ ok: true })
})

// Remove member from household
hh.delete('/:id/members/:memberId', async (c) => {
  await c.env.DB.prepare(`UPDATE members SET household_id=NULL, household_role=NULL WHERE member_id=?`)
    .bind(c.req.param('memberId')).run()
  return c.json({ ok: true })
})

export default hh
