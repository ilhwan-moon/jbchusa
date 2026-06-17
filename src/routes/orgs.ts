import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../lib/types'

const orgs = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

// List categories
orgs.get('/categories', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM group_categories ORDER BY sort_order`).all()
  return c.json({ categories: rows.results })
})

// List groups by category code, with member counts
orgs.get('/groups', async (c) => {
  const categoryCode = c.req.query('category')
  const churchId = 1
  let sql = `
    SELECT g.*, gc.code AS category_code, gc.name AS category_name,
      (SELECT COUNT(DISTINCT ma.member_id) FROM member_assignments ma
        WHERE ma.group_id = g.group_id AND ma.is_active = 1) AS member_count
    FROM org_groups g
    JOIN group_categories gc ON g.category_id = gc.category_id
    WHERE g.church_id = ? AND g.is_active = 1`
  const binds: any[] = [churchId]
  if (categoryCode) {
    sql += ` AND gc.code = ?`
    binds.push(categoryCode)
  }
  sql += ` ORDER BY g.sort_order, g.name`
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ groups: rows.results })
})

// Single group detail
orgs.get('/groups/:id', async (c) => {
  const id = c.req.param('id')
  const group = await c.env.DB.prepare(
    `SELECT g.*, gc.code AS category_code, gc.name AS category_name
     FROM org_groups g JOIN group_categories gc ON g.category_id = gc.category_id
     WHERE g.group_id = ?`
  ).bind(id).first()
  if (!group) return c.json({ error: 'Not found' }, 404)
  return c.json({ group })
})

// Members in a group (includes sub-groups members)
orgs.get('/groups/:id/members', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const includeChildren = c.req.query('children') !== '0'

  // Collect group ids (self + descendants)
  let groupIds = [id]
  if (includeChildren) {
    const all = await c.env.DB.prepare(`SELECT group_id, parent_id FROM org_groups WHERE church_id = 1`).all<{ group_id: number; parent_id: number | null }>()
    const childrenMap = new Map<number, number[]>()
    for (const g of all.results || []) {
      if (g.parent_id != null) {
        if (!childrenMap.has(g.parent_id)) childrenMap.set(g.parent_id, [])
        childrenMap.get(g.parent_id)!.push(g.group_id)
      }
    }
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const child of childrenMap.get(cur) || []) {
        groupIds.push(child)
        stack.push(child)
      }
    }
  }

  const placeholders = groupIds.map(() => '?').join(',')
  const rows = await c.env.DB.prepare(
    `SELECT DISTINCT m.member_id, m.first_name, m.last_name, m.korean_name, m.preferred_name,
       m.gender, m.title, m.photo_url, m.status, m.member_type,
       p.name AS position_name, p.position_type, p.rank_order,
       g.name AS group_name, ma.group_id, ma.sub_role, ma.is_primary,
       (SELECT value FROM member_contacts mc WHERE mc.member_id = m.member_id AND mc.contact_type='mobile' AND mc.is_primary=1 LIMIT 1) AS mobile
     FROM member_assignments ma
     JOIN members m ON ma.member_id = m.member_id
     JOIN positions p ON ma.position_id = p.position_id
     JOIN org_groups g ON ma.group_id = g.group_id
     WHERE ma.group_id IN (${placeholders}) AND ma.is_active = 1
     ORDER BY p.rank_order, m.last_name, m.first_name`
  ).bind(...groupIds).all()

  return c.json({ members: rows.results })
})

export default orgs
