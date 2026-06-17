import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../lib/types'

const members = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

// List/search members (address book)
members.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim()
  const status = c.req.query('status') || ''
  const churchId = 1
  let sql = `
    SELECT m.member_id, m.first_name, m.last_name, m.korean_name, m.preferred_name,
      m.gender, m.title, m.photo_url, m.status, m.member_type,
      m.city, m.state,
      h.household_name, h.city AS h_city, h.state AS h_state,
      (SELECT value FROM member_contacts mc WHERE mc.member_id = m.member_id AND mc.contact_type='mobile' AND mc.is_primary=1 LIMIT 1) AS mobile,
      (SELECT value FROM member_contacts mc WHERE mc.member_id = m.member_id AND mc.contact_type='email' LIMIT 1) AS email
    FROM members m
    LEFT JOIN households h ON m.household_id = h.household_id
    WHERE m.church_id = ?`
  const binds: any[] = [churchId]
  if (q) {
    sql += ` AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.korean_name LIKE ? OR m.preferred_name LIKE ?)`
    const like = `%${q}%`
    binds.push(like, like, like, like)
  }
  if (status) {
    sql += ` AND m.status = ?`
    binds.push(status)
  }
  sql += ` ORDER BY m.last_name, m.first_name LIMIT 500`
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ members: rows.results })
})

// Member detail (full)
members.get('/:id', async (c) => {
  const id = c.req.param('id')
  const m = await c.env.DB.prepare(
    `SELECT m.*, h.household_name, h.address_line1 AS h_addr1, h.address_line2 AS h_addr2,
       h.city AS h_city, h.state AS h_state, h.zip_code AS h_zip, h.home_phone AS h_phone
     FROM members m LEFT JOIN households h ON m.household_id = h.household_id
     WHERE m.member_id = ?`
  ).bind(id).first<any>()
  if (!m) return c.json({ error: 'Not found' }, 404)

  const contacts = await c.env.DB.prepare(`SELECT * FROM member_contacts WHERE member_id = ? ORDER BY is_primary DESC`).bind(id).all()
  const languages = await c.env.DB.prepare(
    `SELECT ml.*, l.code, l.name_en, l.name_native FROM member_languages ml JOIN languages l ON ml.language_id = l.language_id WHERE ml.member_id = ?`
  ).bind(id).all()
  const assignments = await c.env.DB.prepare(
    `SELECT ma.*, g.name AS group_name, gc.code AS category_code, gc.name AS category_name,
       p.name AS position_name, p.position_type
     FROM member_assignments ma
     JOIN org_groups g ON ma.group_id = g.group_id
     JOIN group_categories gc ON g.category_id = gc.category_id
     JOIN positions p ON ma.position_id = p.position_id
     WHERE ma.member_id = ? AND ma.is_active = 1
     ORDER BY p.rank_order`
  ).bind(id).all()
  const relationships = await c.env.DB.prepare(
    `SELECT mr.relationship_id, mr.relation_type, mr.note,
       rm.member_id AS related_id, rm.first_name, rm.last_name, rm.korean_name, rm.photo_url, rm.title
     FROM member_relationships mr
     JOIN members rm ON mr.related_id = rm.member_id
     WHERE mr.member_id = ?`
  ).bind(id).all()

  // resolved address (own vs household)
  const useOwn = m.use_own_address === 1
  const address = {
    line1: useOwn ? m.address_line1 : m.h_addr1,
    line2: useOwn ? m.address_line2 : m.h_addr2,
    city: useOwn ? m.city : m.h_city,
    state: useOwn ? m.state : m.h_state,
    zip: useOwn ? m.zip_code : m.h_zip,
  }

  return c.json({
    member: m,
    address,
    contacts: contacts.results,
    languages: languages.results,
    assignments: assignments.results,
    relationships: relationships.results,
  })
})

// Create member
members.post('/', async (c) => {
  const b = await c.req.json<any>()
  if (!b.first_name || !b.last_name) return c.json({ error: '이름(First/Last)은 필수입니다.' }, 400)
  const res = await c.env.DB.prepare(
    `INSERT INTO members (church_id, household_id, household_role, first_name, last_name, korean_name, preferred_name,
       gender, title, birth_date, member_type, employment_type, status, photo_url, note,
       use_own_address, address_line1, address_line2, city, state, zip_code)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    b.household_id || null, b.household_role || null, b.first_name, b.last_name, b.korean_name || null,
    b.preferred_name || null, b.gender || null, b.title || null, b.birth_date || null,
    b.member_type || '교인', b.employment_type || '봉사자', b.status || '활동', b.photo_url || null, b.note || null,
    b.use_own_address ? 1 : 0, b.address_line1 || null, b.address_line2 || null, b.city || null, b.state || null, b.zip_code || null
  ).run()
  const memberId = res.meta.last_row_id

  if (b.mobile) await c.env.DB.prepare(`INSERT INTO member_contacts (member_id, contact_type, value, is_primary) VALUES (?, 'mobile', ?, 1)`).bind(memberId, b.mobile).run()
  if (b.email) await c.env.DB.prepare(`INSERT INTO member_contacts (member_id, contact_type, value, is_primary) VALUES (?, 'email', ?, 0)`).bind(memberId, b.email).run()

  return c.json({ member_id: memberId })
})

// Update member
members.put('/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json<any>()
  await c.env.DB.prepare(
    `UPDATE members SET first_name=?, last_name=?, korean_name=?, preferred_name=?, gender=?, title=?,
       birth_date=?, member_type=?, employment_type=?, status=?, note=?,
       household_id=?, household_role=?, use_own_address=?, address_line1=?, address_line2=?, city=?, state=?, zip_code=?,
       updated_at=datetime('now')
     WHERE member_id=?`
  ).bind(
    b.first_name, b.last_name, b.korean_name || null, b.preferred_name || null, b.gender || null, b.title || null,
    b.birth_date || null, b.member_type || '교인', b.employment_type || '봉사자', b.status || '활동', b.note || null,
    b.household_id || null, b.household_role || null, b.use_own_address ? 1 : 0,
    b.address_line1 || null, b.address_line2 || null, b.city || null, b.state || null, b.zip_code || null,
    id
  ).run()
  return c.json({ ok: true })
})

// Update photo (accepts data URL)
members.put('/:id/photo', async (c) => {
  const id = c.req.param('id')
  const { photo_url } = await c.req.json<{ photo_url: string }>()
  if (!photo_url) return c.json({ error: 'photo_url 필요' }, 400)
  if (photo_url.length > 1_500_000) return c.json({ error: '이미지가 너무 큽니다 (1MB 이하 권장).' }, 413)
  await c.env.DB.prepare(`UPDATE members SET photo_url=?, updated_at=datetime('now') WHERE member_id=?`).bind(photo_url, id).run()
  return c.json({ ok: true })
})

// Delete member
members.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare(`DELETE FROM members WHERE member_id=?`).bind(id).run()
  return c.json({ ok: true })
})

// ---- Contacts ----
members.post('/:id/contacts', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json<any>()
  await c.env.DB.prepare(`INSERT INTO member_contacts (member_id, contact_type, value, is_primary) VALUES (?, ?, ?, ?)`)
    .bind(id, b.contact_type || 'mobile', b.value, b.is_primary ? 1 : 0).run()
  return c.json({ ok: true })
})
members.delete('/contacts/:contactId', async (c) => {
  await c.env.DB.prepare(`DELETE FROM member_contacts WHERE contact_id=?`).bind(c.req.param('contactId')).run()
  return c.json({ ok: true })
})

// ---- Family relationships ----
members.post('/:id/relationships', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const b = await c.req.json<{ related_id: number; relation_type: string; reciprocal_type?: string; note?: string }>()
  if (!b.related_id || !b.relation_type) return c.json({ error: '대상과 관계유형이 필요합니다.' }, 400)
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO member_relationships (member_id, related_id, relation_type, note) VALUES (?, ?, ?, ?)`
  ).bind(id, b.related_id, b.relation_type, b.note || null).run()
  // reciprocal
  if (b.reciprocal_type) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO member_relationships (member_id, related_id, relation_type, note) VALUES (?, ?, ?, ?)`
    ).bind(b.related_id, id, b.reciprocal_type, b.note || null).run()
  }
  return c.json({ ok: true })
})
members.delete('/relationships/:relId', async (c) => {
  await c.env.DB.prepare(`DELETE FROM member_relationships WHERE relationship_id=?`).bind(c.req.param('relId')).run()
  return c.json({ ok: true })
})

// ---- Assignments (org membership) ----
members.post('/:id/assignments', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json<any>()
  if (!b.group_id || !b.position_id) return c.json({ error: '그룹과 직분이 필요합니다.' }, 400)
  await c.env.DB.prepare(
    `INSERT INTO member_assignments (member_id, group_id, position_id, sub_role, is_primary, joined_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(id, b.group_id, b.position_id, b.sub_role || null, b.is_primary ? 1 : 0, b.joined_at || null).run()
  return c.json({ ok: true })
})
members.delete('/assignments/:assignId', async (c) => {
  await c.env.DB.prepare(`DELETE FROM member_assignments WHERE assignment_id=?`).bind(c.req.param('assignId')).run()
  return c.json({ ok: true })
})

export default members
