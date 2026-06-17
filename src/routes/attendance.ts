import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../lib/types'

const att = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

// Dashboard summary stats
att.get('/dashboard', async (c) => {
  const churchId = 1
  const totalMembers = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM members WHERE church_id=? AND status='활동'`).bind(churchId).first<any>()
  const totalMeetings = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM meetings WHERE church_id=?`).bind(churchId).first<any>()

  // Recent meetings with attendance rate
  const recent = await c.env.DB.prepare(
    `SELECT mt.meeting_id, mt.title, mt.meeting_type, mt.meeting_date, g.name AS group_name,
       (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id AND a.status IN ('present','online','late')) AS present,
       (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id) AS total
     FROM meetings mt JOIN org_groups g ON mt.group_id=g.group_id
     WHERE mt.church_id=?
     ORDER BY mt.meeting_date DESC, mt.meeting_id DESC LIMIT 12`
  ).bind(churchId).all()

  // Status distribution across all attendance
  const statusDist = await c.env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM attendances a JOIN meetings m ON a.meeting_id=m.meeting_id WHERE m.church_id=? GROUP BY status`
  ).bind(churchId).all()

  // Weekly trend (last 8 weeks by meeting_date)
  const trend = await c.env.DB.prepare(
    `SELECT mt.meeting_date AS d,
       SUM(CASE WHEN a.status IN ('present','online','late') THEN 1 ELSE 0 END) AS present,
       COUNT(a.attendance_id) AS total
     FROM meetings mt LEFT JOIN attendances a ON a.meeting_id=mt.meeting_id
     WHERE mt.church_id=?
     GROUP BY mt.meeting_date ORDER BY mt.meeting_date DESC LIMIT 8`
  ).bind(churchId).all()

  return c.json({
    totalMembers: totalMembers?.n || 0,
    totalMeetings: totalMeetings?.n || 0,
    recentMeetings: recent.results,
    statusDist: statusDist.results,
    trend: (trend.results || []).reverse(),
  })
})

// List meetings (optional group filter)
att.get('/meetings', async (c) => {
  const groupId = c.req.query('group_id')
  let sql = `SELECT mt.*, g.name AS group_name,
      (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id AND a.status IN ('present','online','late')) AS present,
      (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id) AS total
    FROM meetings mt JOIN org_groups g ON mt.group_id=g.group_id WHERE mt.church_id=1`
  const binds: any[] = []
  if (groupId) { sql += ` AND mt.group_id=?`; binds.push(groupId) }
  sql += ` ORDER BY mt.meeting_date DESC LIMIT 100`
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ meetings: rows.results })
})

// Create meeting
att.post('/meetings', async (c) => {
  const b = await c.req.json<any>()
  if (!b.group_id || !b.title || !b.meeting_date) return c.json({ error: '그룹/제목/날짜는 필수입니다.' }, 400)
  const res = await c.env.DB.prepare(
    `INSERT INTO meetings (church_id, group_id, title, meeting_type, meeting_date, start_time, location, note)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(b.group_id, b.title, b.meeting_type || '구역예배', b.meeting_date, b.start_time || null, b.location || null, b.note || null).run()
  return c.json({ meeting_id: res.meta.last_row_id })
})

// Meeting detail + roster (members in group with their attendance status)
att.get('/meetings/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const meeting = await c.env.DB.prepare(
    `SELECT mt.*, g.name AS group_name FROM meetings mt JOIN org_groups g ON mt.group_id=g.group_id WHERE mt.meeting_id=?`
  ).bind(id).first<any>()
  if (!meeting) return c.json({ error: 'Not found' }, 404)

  // roster: members assigned to the group + existing attendance
  const roster = await c.env.DB.prepare(
    `SELECT m.member_id, m.first_name, m.last_name, m.korean_name, m.photo_url, m.title,
       a.attendance_id, a.status, a.note
     FROM member_assignments ma
     JOIN members m ON ma.member_id=m.member_id
     LEFT JOIN attendances a ON a.member_id=m.member_id AND a.meeting_id=?
     WHERE ma.group_id=? AND ma.is_active=1
     GROUP BY m.member_id
     ORDER BY m.last_name, m.first_name`
  ).bind(id, meeting.group_id).all()

  return c.json({ meeting, roster: roster.results })
})

// Record/update attendance (upsert)
att.post('/meetings/:id/record', async (c) => {
  const meetingId = parseInt(c.req.param('id'), 10)
  const { records } = await c.req.json<{ records: { member_id: number; status: string; note?: string }[] }>()
  const recorder = (c.get('user') as SessionUser | null)?.user_id || null
  for (const r of records) {
    await c.env.DB.prepare(
      `INSERT INTO attendances (meeting_id, member_id, status, note, recorded_by, check_in_time)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(meeting_id, member_id) DO UPDATE SET status=excluded.status, note=excluded.note, recorded_by=excluded.recorded_by, updated_at=datetime('now')`
    ).bind(meetingId, r.member_id, r.status, r.note || null, recorder).run()
  }
  return c.json({ ok: true, count: records.length })
})

export default att
