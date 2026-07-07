import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../lib/types'

const hh = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

const getMemberName = (m: any) => (m?.korean_name || `${m?.first_name || ''} ${m?.last_name || ''}`.trim() || '');

const fetchPrimaryContact = async (c: any, memberId: number) => {
  const row = await c.env.DB.prepare(
    `SELECT value FROM member_contacts
     WHERE member_id = ?
     ORDER BY is_primary DESC,
       CASE contact_type WHEN 'home' THEN 0 WHEN 'mobile' THEN 1 WHEN 'office' THEN 2 WHEN 'email' THEN 3 ELSE 9 END
     LIMIT 1`
  ).bind(memberId).first<any>();
  return row?.value || null;
};

const updateHouseholdFromHead = async (c: any, householdId: number, headMember: any) => {
  const headName = getMemberName(headMember);
  const contactValue = await fetchPrimaryContact(c, headMember.member_id);
  await c.env.DB.prepare(
    `UPDATE households SET household_name=?, address_line1=?, address_line2=?, city=?, state=?, zip_code=?, home_phone=?, head_member_id=?, updated_at=datetime('now')
     WHERE household_id=?`
  ).bind(
    headName ? `${headName} 가족` : '가족',
    headMember.address_line1 || null,
    headMember.address_line2 || null,
    headMember.city || null,
    headMember.state || null,
    headMember.zip_code || null,
    contactValue || null,
    headMember.member_id,
    householdId
  ).run();
};

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
  const household = await c.env.DB.prepare(`SELECT * FROM households WHERE household_id=?`).bind(id).first<any>()
  if (!household) return c.json({ error: 'Not found' }, 404)
  const memberRows = await c.env.DB.prepare(
    `SELECT member_id, first_name, last_name, korean_name, household_role, title, photo_url, birth_date
     FROM members WHERE household_id=? ORDER BY
     CASE household_role WHEN 'head' THEN 0 WHEN 'spouse' THEN 1 WHEN 'child' THEN 2 ELSE 3 END`
  ).bind(id).all()

  let headMemberId = household.head_member_id as number | null
  if (!headMemberId) {
    const headRow = await c.env.DB.prepare(
      `SELECT member_id FROM members WHERE household_id=? AND household_role='head' LIMIT 1`
    ).bind(id).first<any>()
    headMemberId = headRow?.member_id || null
  }

  const headMember = headMemberId ? await c.env.DB.prepare(
    `SELECT member_id, first_name, last_name, korean_name, title, photo_url, use_own_address,
      address_line1, address_line2, city, state, zip_code
     FROM members WHERE member_id=?`
  ).bind(headMemberId).first<any>() : null

  const headContacts = headMemberId ? await c.env.DB.prepare(
    `SELECT contact_type, value, is_primary FROM member_contacts WHERE member_id=? ORDER BY is_primary DESC`
  ).bind(headMemberId).all() : { results: [] }

  const headAddress = headMember ? {
    address_line1: headMember.address_line1,
    address_line2: headMember.address_line2,
    city: headMember.city,
    state: headMember.state,
    zip_code: headMember.zip_code,
  } : {
    address_line1: household.address_line1,
    address_line2: household.address_line2,
    city: household.city,
    state: household.state,
    zip_code: household.zip_code,
  }

  return c.json({
    household,
    members: memberRows.results,
    head_member: headMember,
    head_contacts: headContacts.results,
    head_address: headAddress,
  })
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

hh.put('/:id/head', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json<{ head_member_id: number }>()
  if (!b.head_member_id) return c.json({ error: '대표 성도가 필요합니다.' }, 400)

  const headMember = await c.env.DB.prepare(
    `SELECT member_id, first_name, last_name, korean_name, address_line1, address_line2, city, state, zip_code
     FROM members WHERE member_id=? AND household_id=?`
  ).bind(b.head_member_id, id).first<any>()
  if (!headMember) return c.json({ error: '세대에 속한 성도가 아닙니다.' }, 400)

  await updateHouseholdFromHead(c, Number(id), headMember)

  await c.env.DB.prepare(`UPDATE members SET household_role='relative' WHERE household_id=? AND household_role='head' AND member_id<>?`)
    .bind(id, b.head_member_id).run()
  await c.env.DB.prepare(`UPDATE members SET household_role='head' WHERE member_id=?`).bind(b.head_member_id).run()

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

// Update member role in household
hh.put('/:id/members/:memberId', async (c) => {
  const id = c.req.param('id')
  const memberId = c.req.param('memberId')
  const { household_role } = await c.req.json<any>()
  if (!household_role) return c.json({ error: '가족 역할이 필요합니다.' }, 400)

  if (household_role === 'head') {
    const headMember = await c.env.DB.prepare(
      `SELECT member_id, first_name, last_name, korean_name, address_line1, address_line2, city, state, zip_code
       FROM members WHERE member_id=? AND household_id=?`
    ).bind(memberId, id).first<any>()
    if (!headMember) return c.json({ error: '세대에 속한 성도가 아닙니다.' }, 400)
    await updateHouseholdFromHead(c, Number(id), headMember)
    await c.env.DB.prepare(`UPDATE members SET household_role='relative' WHERE household_id=? AND household_role='head' AND member_id<>?`)
      .bind(id, memberId).run()
    await c.env.DB.prepare(`UPDATE members SET household_role='head' WHERE member_id=?`).bind(memberId).run()
    return c.json({ ok: true })
  }

  await c.env.DB.prepare(`UPDATE members SET household_role=? WHERE member_id=? AND household_id=?`)
    .bind(household_role, memberId, id).run()
  return c.json({ ok: true })
})

// Remove member from household
hh.delete('/:id/members/:memberId', async (c) => {
  await c.env.DB.prepare(`UPDATE members SET household_id=NULL, household_role=NULL WHERE member_id=?`)
    .bind(c.req.param('memberId')).run()
  return c.json({ ok: true })
})

export default hh
