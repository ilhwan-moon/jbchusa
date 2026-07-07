import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../lib/types'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarConfig } from '../lib/googleCalendar'

const att = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

// Dashboard summary stats
att.get('/dashboard', async (c) => {
  const churchId = 1
  const groupId = c.req.query('group_id')
  const fromYear = c.req.query('from_year')
  const toYear = c.req.query('to_year')
  const fromMonth = c.req.query('from_month')
  const toMonth = c.req.query('to_month')

  let dateClause = ''
  let dateBinds: any[] = []
  if (fromYear || toYear || fromMonth || toMonth) {
    const startYear = fromYear || toYear
    const endYear = toYear || fromYear
    const startMonth = (fromMonth || '01').padStart(2, '0')
    const endMonth = (toMonth || '12').padStart(2, '0')
    const startDate = `${startYear}-${startMonth}-01`
    const endDate = `${endYear}-${endMonth}-31`
    dateClause = `meeting_date BETWEEN ? AND ?`
    dateBinds = [startDate, endDate]
  }

  const buildFilters = (alias: string, includeDate = true) => {
    const clauses: string[] = []
    const binds: any[] = [churchId]
    if (groupId) { clauses.push(`${alias}.group_id=?`); binds.push(groupId) }
    if (includeDate && dateClause) { clauses.push(`${alias}.${dateClause}`); binds.push(...dateBinds) }
    const sql = clauses.length ? ` AND ${clauses.join(' AND ')}` : ''
    return { sql, binds }
  }

  const memberFilter = buildFilters('mt')
  const totalMembers = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT m.member_id) AS n
     FROM members m
     JOIN attendances a ON a.member_id=m.member_id
     JOIN meetings mt ON a.meeting_id=mt.meeting_id
     WHERE m.church_id=? AND m.status='활동'${memberFilter.sql}`
  ).bind(...memberFilter.binds).first<any>()

  const totalMeetingsFilter = buildFilters('mt')
  const totalMeetings = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM meetings mt WHERE mt.church_id=?${totalMeetingsFilter.sql}`
  ).bind(...totalMeetingsFilter.binds).first<any>()

  // Recent meetings with attendance rate
  const recentFilter = buildFilters('mt')
  const recent = await c.env.DB.prepare(
    `SELECT mt.meeting_id, mt.title, mt.meeting_type, mt.meeting_date, g.name AS group_name,
       (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id AND a.status IN ('present','online','late')) AS present,
       (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id) AS total
     FROM meetings mt JOIN org_groups g ON mt.group_id=g.group_id
     WHERE mt.church_id=?${recentFilter.sql}
     ORDER BY mt.meeting_date DESC, mt.meeting_id DESC LIMIT 12`
  ).bind(...recentFilter.binds).all()

  // Status distribution across all attendance
  const statusFilter = buildFilters('m')
  const statusDist = await c.env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM attendances a JOIN meetings m ON a.meeting_id=m.meeting_id
     WHERE m.church_id=?${statusFilter.sql} GROUP BY status`
  ).bind(...statusFilter.binds).all()

  const trendPeriod = c.req.query('trend') || 'weekly'
  const trendFilter = buildFilters('mt')

  let trendSql = `SELECT mt.meeting_date AS d,
       SUM(CASE WHEN a.status IN ('present','online','late') THEN 1 ELSE 0 END) AS present,
       COUNT(a.attendance_id) AS total
     FROM meetings mt LEFT JOIN attendances a ON a.meeting_id=mt.meeting_id
     WHERE mt.church_id=?${trendFilter.sql}
     GROUP BY mt.meeting_date ORDER BY mt.meeting_date DESC LIMIT 8`

  if (trendPeriod === 'monthly') {
    trendSql = `SELECT substr(mt.meeting_date, 1, 7) AS d,
       SUM(CASE WHEN a.status IN ('present','online','late') THEN 1 ELSE 0 END) AS present,
       COUNT(a.attendance_id) AS total
     FROM meetings mt LEFT JOIN attendances a ON a.meeting_id=mt.meeting_id
     WHERE mt.church_id=?${trendFilter.sql}
     GROUP BY substr(mt.meeting_date, 1, 7) ORDER BY d DESC LIMIT 12`
  } else if (trendPeriod === 'yearly') {
    trendSql = `SELECT substr(mt.meeting_date, 1, 4) AS d,
       SUM(CASE WHEN a.status IN ('present','online','late') THEN 1 ELSE 0 END) AS present,
       COUNT(a.attendance_id) AS total
     FROM meetings mt LEFT JOIN attendances a ON a.meeting_id=mt.meeting_id
     WHERE mt.church_id=?${trendFilter.sql}
     GROUP BY substr(mt.meeting_date, 1, 4) ORDER BY d DESC LIMIT 10`
  }

  const trend = await c.env.DB.prepare(trendSql).bind(...trendFilter.binds).all()

  const rangeFilter = buildFilters('mt', false)
  const rangeRow = await c.env.DB.prepare(
    `SELECT MIN(mt.meeting_date) AS min_date, MAX(mt.meeting_date) AS max_date
     FROM meetings mt WHERE mt.church_id=?${rangeFilter.sql}`
  ).bind(...rangeFilter.binds).first<any>()
  const range = {
    min_year: rangeRow?.min_date ? rangeRow.min_date.slice(0, 4) : null,
    max_year: rangeRow?.max_date ? rangeRow.max_date.slice(0, 4) : null,
  }

  return c.json({
    totalMembers: totalMembers?.n || 0,
    totalMeetings: totalMeetings?.n || 0,
    recentMeetings: recent.results,
    statusDist: statusDist.results,
    trend: (trend.results || []).reverse(),
    trend_period: trendPeriod,
    range,
  })
})

// List meetings (optional group filter)
att.get('/meetings', async (c) => {
  const groupId = c.req.query('group_id')
  const year = c.req.query('year')
  const month = c.req.query('month')
  let sql = `SELECT mt.*, g.name AS group_name,
      (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id AND a.status IN ('present','online','late')) AS present,
      (SELECT COUNT(*) FROM attendances a WHERE a.meeting_id=mt.meeting_id) AS total
    FROM meetings mt JOIN org_groups g ON mt.group_id=g.group_id WHERE mt.church_id=1`
  const binds: any[] = []
  if (groupId) { sql += ` AND mt.group_id=?`; binds.push(groupId) }
  if (year) { sql += ` AND substr(mt.meeting_date, 1, 4)=?`; binds.push(year) }
  if (month) { sql += ` AND substr(mt.meeting_date, 6, 2)=?`; binds.push(month.padStart(2, '0')) }
  sql += ` ORDER BY mt.meeting_date DESC LIMIT 100`
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ meetings: rows.results })
})

// Create meeting
att.post('/meetings', async (c) => {
  const b = await c.req.json<any>()
  if (!b.group_id || !b.title || !b.meeting_date) return c.json({ error: '그룹/제목/날짜는 필수입니다.' }, 400)
  const res = await c.env.DB.prepare(
    `INSERT INTO meetings (church_id, group_id, title, meeting_type, meeting_date, start_time, location, address, note)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    b.group_id,
    b.title,
    b.meeting_type || '구역예배',
    b.meeting_date,
    b.start_time || null,
    b.location || null,
    b.address || null,
    b.note || null
  ).run()
  const meetingId = res.meta.last_row_id

  const calendarConfig = await getCalendarConfig(c.env)
  if (calendarConfig) {
    try {
      const groupRow = await c.env.DB.prepare(`SELECT name FROM org_groups WHERE group_id=?`).bind(b.group_id).first<any>()
      const meetingPayload = { ...b, meeting_id: meetingId }
      const eventId = await createCalendarEvent(c.env, meetingPayload, groupRow?.name || '')
      if (eventId) {
        await c.env.DB.prepare(`UPDATE meetings SET google_event_id=? WHERE meeting_id=?`).bind(eventId, meetingId).run()
      }
    } catch (err: any) {
      await c.env.DB.prepare(`DELETE FROM meetings WHERE meeting_id=?`).bind(meetingId).run()
      return c.json({ error: err?.message || '구글 캘린더 등록 실패' }, 500)
    }
  }

  return c.json({ meeting_id: meetingId })
})

// Update meeting
att.put('/meetings/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const b = await c.req.json<any>()
  if (!b.group_id || !b.title || !b.meeting_date) return c.json({ error: '그룹/제목/날짜는 필수입니다.' }, 400)
  const existing = await c.env.DB.prepare(`SELECT google_event_id FROM meetings WHERE meeting_id=? AND church_id=1`).bind(id).first<any>()
  await c.env.DB.prepare(
    `UPDATE meetings SET group_id=?, title=?, meeting_type=?, meeting_date=?, start_time=?, location=?, address=?, note=?
     WHERE meeting_id=? AND church_id=1`
  ).bind(
    b.group_id,
    b.title,
    b.meeting_type || '구역예배',
    b.meeting_date,
    b.start_time || null,
    b.location || null,
    b.address || null,
    b.note || null,
    id
  ).run()

  const calendarConfig = await getCalendarConfig(c.env)
  if (calendarConfig) {
    try {
      const groupRow = await c.env.DB.prepare(`SELECT name FROM org_groups WHERE group_id=?`).bind(b.group_id).first<any>()
      const meetingPayload = { ...b, meeting_id: id }
      if (existing?.google_event_id) {
        await updateCalendarEvent(c.env, meetingPayload, groupRow?.name || '', existing.google_event_id)
      } else {
        const eventId = await createCalendarEvent(c.env, meetingPayload, groupRow?.name || '')
        if (eventId) {
          await c.env.DB.prepare(`UPDATE meetings SET google_event_id=? WHERE meeting_id=?`).bind(eventId, id).run()
        }
      }
    } catch (err: any) {
      return c.json({ error: err?.message || '구글 캘린더 수정 실패' }, 500)
    }
  }

  return c.json({ ok: true })
})

// Delete meeting (and its attendance records)
att.delete('/meetings/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const existing = await c.env.DB.prepare(`SELECT google_event_id FROM meetings WHERE meeting_id=? AND church_id=1`).bind(id).first<any>()
  const calendarConfig = await getCalendarConfig(c.env)
  if (calendarConfig && existing?.google_event_id) {
    try {
      await deleteCalendarEvent(c.env, existing.google_event_id)
    } catch (err: any) {
      return c.json({ error: err?.message || '구글 캘린더 삭제 실패' }, 500)
    }
  }
  await c.env.DB.prepare(`DELETE FROM attendances WHERE meeting_id=?`).bind(id).run()
  await c.env.DB.prepare(`DELETE FROM meetings WHERE meeting_id=? AND church_id=1`).bind(id).run()
  return c.json({ ok: true })
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
