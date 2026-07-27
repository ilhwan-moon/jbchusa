import { Hono } from 'hono'
import type { Bindings } from '../lib/types'

const publicRoutes = new Hono<{ Bindings: Bindings }>()

publicRoutes.get('/member-meta', async (c) => {
  const [mt, et, st, groups] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM member_types ORDER BY sort_order, name`).all(),
    c.env.DB.prepare(`SELECT * FROM employment_types ORDER BY sort_order, name`).all(),
    c.env.DB.prepare(`SELECT * FROM member_statuses ORDER BY sort_order, name`).all(),
    c.env.DB.prepare(
      `SELECT g.group_id, g.name, g.category_id, g.level_type, g.service_area, gc.code AS category_code
       FROM org_groups g JOIN group_categories gc ON g.category_id = gc.category_id
       WHERE g.is_active = 1 ORDER BY gc.sort_order, g.sort_order, g.name`
    ).all(),
  ])

  return c.json({
    member_types: mt.results,
    employment_types: et.results,
    member_statuses: st.results,
    groups: groups.results,
  })
})

publicRoutes.post('/members', async (c) => {
  const b = await c.req.json<any>()
  if (!b.first_name || !b.last_name) return c.json({ error: '이름(First/Last)은 필수입니다.' }, 400)
  if (!b.mobile) return c.json({ error: '연락처(휴대전화)는 필수입니다.' }, 400)
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email))) {
    return c.json({ error: '이메일 형식이 올바르지 않습니다.' }, 400)
  }
  if (b.photo_url && String(b.photo_url).length > 1_500_000) {
    return c.json({ error: '이미지가 너무 큽니다 (1MB 이하 권장).' }, 413)
  }

  const hasAddress = Boolean(b.address_line1 || b.address_line2 || b.city || b.state || b.zip_code)
  const gender = b.gender && ['M', 'F'].includes(b.gender) ? b.gender : null

  const res = await c.env.DB.prepare(
    `INSERT INTO members (church_id, first_name, last_name, korean_name, preferred_name,
       gender, birth_date, member_type, employment_type, status, photo_url,
       use_own_address, address_line1, address_line2, city, state, zip_code)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    b.first_name,
    b.last_name,
    b.korean_name || null,
    b.preferred_name || null,
    gender,
    b.birth_date || null,
    '성도',
    '봉사자',
    '활동',
    b.photo_url || null,
    hasAddress ? 1 : 0,
    b.address_line1 || null,
    b.address_line2 || null,
    b.city || null,
    b.state || null,
    b.zip_code || null
  ).run()

  const memberId = res.meta.last_row_id as number

  if (b.mobile) await c.env.DB.prepare(`INSERT INTO member_contacts (member_id, contact_type, value, is_primary) VALUES (?, 'mobile', ?, 1)`).bind(memberId, b.mobile).run()
  if (b.email) await c.env.DB.prepare(`INSERT INTO member_contacts (member_id, contact_type, value, is_primary) VALUES (?, 'email', ?, 0)`).bind(memberId, b.email).run()

  return c.json({ member_id: memberId })
})

export default publicRoutes
