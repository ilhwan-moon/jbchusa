import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../lib/types'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarConfig } from '../lib/googleCalendar'

const att = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

const MAX_SERIES_OCCURRENCES = 200

type MeetingPayload = {
  group_id: number
  title: string
  meeting_type: string
  meeting_date: string
  start_time: string | null
  location: string | null
  address: string | null
  note: string | null
}

const parseDate = (value: string) => new Date(`${value}T00:00:00`)
const formatDate = (date: Date) => date.toISOString().slice(0, 10)

const normalizeMeetingPayload = (body: any): MeetingPayload => ({
  group_id: Number(body.group_id),
  title: body.title,
  meeting_type: body.meeting_type || '구역예배',
  meeting_date: body.meeting_date,
  start_time: body.start_time || null,
  location: body.location || null,
  address: body.address || null,
  note: body.note || null,
})

const parseRepeatEnabled = (body: any) => {
  const value = body.repeat_enabled
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on'
}

const generateRecurrenceDates = (startDate: string, untilDate: string, freq: string, interval: number) => {
  const start = parseDate(startDate)
  const end = parseDate(untilDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('invalid_date')
  }
  if (start > end) {
    throw new Error('until_before_start')
  }
  const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : 1
  const dates: string[] = []

  if (freq === 'monthly') {
    const day = start.getDate()
    let year = start.getFullYear()
    let month = start.getMonth()
    for (let i = 0; i < MAX_SERIES_OCCURRENCES; i += 1) {
      const lastDay = new Date(year, month + 1, 0).getDate()
      const targetDay = Math.min(day, lastDay)
      const candidate = new Date(year, month, targetDay)
      if (candidate >= start && candidate <= end) {
        dates.push(formatDate(candidate))
      }
      month += safeInterval
      year += Math.floor(month / 12)
      month %= 12
      if (candidate > end) break
      if (dates.length >= MAX_SERIES_OCCURRENCES) break
      if (new Date(year, month, 1) > end) break
    }
  } else {
    let cursor = new Date(start)
    while (cursor <= end && dates.length < MAX_SERIES_OCCURRENCES) {
      dates.push(formatDate(cursor))
      cursor.setDate(cursor.getDate() + 7 * safeInterval)
    }
  }

  return dates
}

const getGroupName = async (db: D1Database, groupId: number) => {
  const row = await db.prepare(`SELECT name FROM org_groups WHERE group_id=?`).bind(groupId).first<any>()
  return row?.name || ''
}

const insertMeeting = async (db: D1Database, payload: MeetingPayload, seriesId: number | null) => {
  const res = await db.prepare(
    `INSERT INTO meetings (church_id, group_id, title, meeting_type, meeting_date, start_time, location, address, note, series_id)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    payload.group_id,
    payload.title,
    payload.meeting_type,
    payload.meeting_date,
    payload.start_time,
    payload.location,
    payload.address,
    payload.note,
    seriesId
  ).run()
  return res.meta.last_row_id
}

const updateMeetingRow = async (db: D1Database, meetingId: number, payload: MeetingPayload, markException = false) => {
  await db.prepare(
    `UPDATE meetings SET group_id=?, title=?, meeting_type=?, meeting_date=?, start_time=?, location=?, address=?, note=?, is_series_exception=?
     WHERE meeting_id=? AND church_id=1`
  ).bind(
    payload.group_id,
    payload.title,
    payload.meeting_type,
    payload.meeting_date,
    payload.start_time,
    payload.location,
    payload.address,
    payload.note,
    markException ? 1 : 0,
    meetingId
  ).run()
}

const updateMeetingFieldsOnly = async (db: D1Database, meetingId: number, payload: MeetingPayload) => {
  await db.prepare(
    `UPDATE meetings SET group_id=?, title=?, meeting_type=?, start_time=?, location=?, address=?, note=?
     WHERE meeting_id=? AND church_id=1`
  ).bind(
    payload.group_id,
    payload.title,
    payload.meeting_type,
    payload.start_time,
    payload.location,
    payload.address,
    payload.note,
    meetingId
  ).run()
}

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
  const payload = normalizeMeetingPayload(b)
  const repeatEnabled = parseRepeatEnabled(b)

  const calendarConfig = await getCalendarConfig(c.env)
  const groupName = calendarConfig ? await getGroupName(c.env.DB, payload.group_id) : ''

  if (repeatEnabled) {
    const freq = b.repeat_freq || 'weekly'
    const interval = parseInt(b.repeat_interval || '1', 10)
    const untilDate = b.repeat_until
    if (!untilDate) return c.json({ error: '반복 종료일이 필요합니다.' }, 400)
    let dates: string[] = []
    try {
      dates = generateRecurrenceDates(payload.meeting_date, untilDate, freq, interval)
    } catch (err: any) {
      return c.json({ error: '반복 일정 생성에 실패했습니다.' }, 400)
    }
    if (!dates.length) return c.json({ error: '반복 일정이 생성되지 않았습니다.' }, 400)
    if (dates.length >= MAX_SERIES_OCCURRENCES) return c.json({ error: '반복 일정이 너무 많습니다.' }, 400)

    const seriesRes = await c.env.DB.prepare(
      `INSERT INTO meeting_series (church_id, group_id, title, meeting_type, start_date, start_time, location, address, note, recurrence_freq, recurrence_interval, until_date)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.group_id,
      payload.title,
      payload.meeting_type,
      payload.meeting_date,
      payload.start_time,
      payload.location,
      payload.address,
      payload.note,
      freq,
      interval,
      untilDate
    ).run()
    const seriesId = seriesRes.meta.last_row_id
    const createdMeetings: { meeting_id: number; event_id?: string }[] = []

    try {
      for (const date of dates) {
        const meetingId = await insertMeeting(c.env.DB, { ...payload, meeting_date: date }, seriesId)
        createdMeetings.push({ meeting_id: meetingId })
        if (calendarConfig) {
          const eventId = await createCalendarEvent(c.env, { ...payload, meeting_id: meetingId, meeting_date: date }, groupName)
          if (eventId) {
            await c.env.DB.prepare(`UPDATE meetings SET google_event_id=? WHERE meeting_id=?`).bind(eventId, meetingId).run()
            createdMeetings[createdMeetings.length - 1].event_id = eventId
          }
        }
      }
    } catch (err: any) {
      for (const meeting of createdMeetings) {
        if (calendarConfig && meeting.event_id) {
          try { await deleteCalendarEvent(c.env, meeting.event_id) } catch (e) { /* ignore */ }
        }
      }
      await c.env.DB.prepare(`DELETE FROM meetings WHERE series_id=?`).bind(seriesId).run()
      await c.env.DB.prepare(`DELETE FROM meeting_series WHERE series_id=?`).bind(seriesId).run()
      return c.json({ error: err?.message || '반복 모임 등록 실패' }, 500)
    }

    return c.json({ meeting_id: createdMeetings[0]?.meeting_id, series_id: seriesId, created_count: createdMeetings.length })
  }

  const meetingId = await insertMeeting(c.env.DB, payload, null)

  if (calendarConfig) {
    try {
      const eventId = await createCalendarEvent(c.env, { ...payload, meeting_id: meetingId }, groupName)
      if (eventId) {
        await c.env.DB.prepare(`UPDATE meetings SET google_event_id=? WHERE meeting_id=?`).bind(eventId, meetingId).run()
      }
    } catch (err: any) {
      await c.env.DB.prepare(`DELETE FROM meetings WHERE meeting_id=?`).bind(meetingId).run()
      return c.json({ error: err?.message || '구글 캘린더 등록 실패' }, 500)
    }
  }

  return c.json({ meeting_id: meetingId, created_count: 1 })
})

// Update meeting
att.put('/meetings/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const b = await c.req.json<any>()
  if (!b.group_id || !b.title || !b.meeting_date) return c.json({ error: '그룹/제목/날짜는 필수입니다.' }, 400)
  const payload = normalizeMeetingPayload(b)
  const scope = (c.req.query('scope') || b.repeat_scope || 'this') as string

  const existing = await c.env.DB.prepare(
    `SELECT meeting_id, meeting_date, series_id, google_event_id FROM meetings WHERE meeting_id=? AND church_id=1`
  ).bind(id).first<any>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const calendarConfig = await getCalendarConfig(c.env)
  const groupName = calendarConfig ? await getGroupName(c.env.DB, payload.group_id) : ''

  if (existing.series_id && scope !== 'this') {
    const seriesId = existing.series_id
    const dateClause = scope === 'future' ? 'AND meeting_date >= ?' : scope === 'past' ? 'AND meeting_date <= ?' : ''
    const binds: any[] = [seriesId]
    if (dateClause) binds.push(existing.meeting_date)
    const rows = await c.env.DB.prepare(
      `SELECT meeting_id, meeting_date, google_event_id FROM meetings WHERE church_id=1 AND series_id=? ${dateClause} AND is_series_exception=0`
    ).bind(...binds).all()

    for (const row of rows.results || []) {
      await updateMeetingFieldsOnly(c.env.DB, row.meeting_id, { ...payload, meeting_date: row.meeting_date })
      if (calendarConfig) {
        if (row.google_event_id) {
          await updateCalendarEvent(c.env, { ...payload, meeting_id: row.meeting_id, meeting_date: row.meeting_date }, groupName, row.google_event_id)
        } else {
          const eventId = await createCalendarEvent(c.env, { ...payload, meeting_id: row.meeting_id, meeting_date: row.meeting_date }, groupName)
          if (eventId) {
            await c.env.DB.prepare(`UPDATE meetings SET google_event_id=? WHERE meeting_id=?`).bind(eventId, row.meeting_id).run()
          }
        }
      }
    }

    await c.env.DB.prepare(
      `UPDATE meeting_series SET group_id=?, title=?, meeting_type=?, start_time=?, location=?, address=?, note=?, updated_at=datetime('now')
       WHERE series_id=?`
    ).bind(
      payload.group_id,
      payload.title,
      payload.meeting_type,
      payload.start_time,
      payload.location,
      payload.address,
      payload.note,
      seriesId
    ).run()

    return c.json({ ok: true, updated: rows.results?.length || 0 })
  }

  await updateMeetingRow(c.env.DB, id, payload, !!existing.series_id)

  if (calendarConfig) {
    try {
      if (existing?.google_event_id) {
        await updateCalendarEvent(c.env, { ...payload, meeting_id: id }, groupName, existing.google_event_id)
      } else {
        const eventId = await createCalendarEvent(c.env, { ...payload, meeting_id: id }, groupName)
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
  const scope = (c.req.query('scope') || 'this') as string
  const existing = await c.env.DB.prepare(
    `SELECT meeting_id, meeting_date, series_id, google_event_id FROM meetings WHERE meeting_id=? AND church_id=1`
  ).bind(id).first<any>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const calendarConfig = await getCalendarConfig(c.env)

  if (!existing.series_id || scope === 'this') {
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
  }

  const seriesId = existing.series_id
  const dateClause = scope === 'future' ? 'AND meeting_date >= ?' : scope === 'past' ? 'AND meeting_date <= ?' : ''
  const binds: any[] = [seriesId]
  if (dateClause) binds.push(existing.meeting_date)
  const rows = await c.env.DB.prepare(
    `SELECT meeting_id, google_event_id FROM meetings WHERE church_id=1 AND series_id=? ${dateClause}`
  ).bind(...binds).all()

  if (calendarConfig) {
    for (const row of rows.results || []) {
      if (row.google_event_id) {
        try {
          await deleteCalendarEvent(c.env, row.google_event_id)
        } catch (err: any) {
          return c.json({ error: err?.message || '구글 캘린더 삭제 실패' }, 500)
        }
      }
    }
  }

  for (const row of rows.results || []) {
    await c.env.DB.prepare(`DELETE FROM attendances WHERE meeting_id=?`).bind(row.meeting_id).run()
  }
  await c.env.DB.prepare(
    `DELETE FROM meetings WHERE church_id=1 AND series_id=? ${dateClause}`
  ).bind(...binds).run()
  if (scope === 'all') {
    await c.env.DB.prepare(`DELETE FROM meeting_series WHERE series_id=?`).bind(seriesId).run()
  }

  return c.json({ ok: true, deleted: rows.results?.length || 0 })
})

// Meeting detail + roster (members in group with their attendance status)
att.get('/meetings/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const meeting = await c.env.DB.prepare(
    `SELECT mt.*, g.name AS group_name,
       ms.recurrence_freq AS series_freq,
       ms.recurrence_interval AS series_interval,
       ms.start_date AS series_start_date,
       ms.until_date AS series_until_date
     FROM meetings mt
     JOIN org_groups g ON mt.group_id=g.group_id
     LEFT JOIN meeting_series ms ON mt.series_id=ms.series_id
     WHERE mt.meeting_id=?`
  ).bind(id).first<any>()
  if (!meeting) return c.json({ error: 'Not found' }, 404)

  // roster: members assigned to the group + existing attendance
  const roster = await c.env.DB.prepare(
    `SELECT m.member_id, m.first_name, m.last_name, m.korean_name, m.photo_url, m.title,
       a.attendance_id, a.status, a.note, a.absence_reason_id,
       ar.name AS absence_reason_name, ar.name_en AS absence_reason_name_en, ar.name_es AS absence_reason_name_es
     FROM member_assignments ma
     JOIN members m ON ma.member_id=m.member_id
     LEFT JOIN attendances a ON a.member_id=m.member_id AND a.meeting_id=?
     LEFT JOIN absence_reasons ar ON a.absence_reason_id = ar.reason_id
     WHERE ma.group_id=? AND ma.is_active=1 AND m.status='활동'
     GROUP BY m.member_id
     ORDER BY m.last_name, m.first_name`
  ).bind(id, meeting.group_id).all()

  const [reasons, notes] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM absence_reasons WHERE is_active=1 ORDER BY sort_order, name`).all(),
    c.env.DB.prepare(`SELECT * FROM meeting_notes WHERE meeting_id=? ORDER BY created_at DESC, note_id DESC`).bind(id).all(),
  ])

  return c.json({ meeting, roster: roster.results, absence_reasons: reasons.results, notes: notes.results })
})

// Absence reasons (active)
att.get('/absence-reasons', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM absence_reasons WHERE is_active=1 ORDER BY sort_order, name`).all()
  return c.json({ reasons: rows.results })
})

// Meeting notes CRUD
att.post('/meetings/:id/notes', async (c) => {
  const meetingId = parseInt(c.req.param('id'), 10)
  const { note_type, content } = await c.req.json<{ note_type: string; content: string }>()
  if (!note_type || !content) return c.json({ error: '내용이 필요합니다.' }, 400)
  const recorder = (c.get('user') as SessionUser | null)?.user_id || null
  await c.env.DB.prepare(
    `INSERT INTO meeting_notes (meeting_id, note_type, content, created_by)
     VALUES (?, ?, ?, ?)`
  ).bind(meetingId, note_type, content, recorder).run()
  return c.json({ ok: true })
})

att.put('/meetings/:id/notes/:noteId', async (c) => {
  const meetingId = parseInt(c.req.param('id'), 10)
  const noteId = parseInt(c.req.param('noteId'), 10)
  const { note_type, content } = await c.req.json<{ note_type: string; content: string }>()
  if (!note_type || !content) return c.json({ error: '내용이 필요합니다.' }, 400)
  await c.env.DB.prepare(
    `UPDATE meeting_notes SET note_type=?, content=?, updated_at=datetime('now')
     WHERE note_id=? AND meeting_id=?`
  ).bind(note_type, content, noteId, meetingId).run()
  return c.json({ ok: true })
})

att.delete('/meetings/:id/notes/:noteId', async (c) => {
  const meetingId = parseInt(c.req.param('id'), 10)
  const noteId = parseInt(c.req.param('noteId'), 10)
  await c.env.DB.prepare(`DELETE FROM meeting_notes WHERE note_id=? AND meeting_id=?`).bind(noteId, meetingId).run()
  return c.json({ ok: true })
})

// Record/update attendance (upsert)
att.post('/meetings/:id/record', async (c) => {
  const meetingId = parseInt(c.req.param('id'), 10)
  const { records } = await c.req.json<{ records: { member_id: number; status: string; note?: string; absence_reason_id?: number | null }[] }>()
  const recorder = (c.get('user') as SessionUser | null)?.user_id || null
  for (const r of records) {
    await c.env.DB.prepare(
      `INSERT INTO attendances (meeting_id, member_id, status, note, absence_reason_id, recorded_by, check_in_time)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(meeting_id, member_id) DO UPDATE SET status=excluded.status, note=excluded.note, absence_reason_id=excluded.absence_reason_id, recorded_by=excluded.recorded_by, updated_at=datetime('now')`
    ).bind(meetingId, r.member_id, r.status, r.note || null, r.absence_reason_id || null, recorder).run()
  }
  return c.json({ ok: true, count: records.length })
})

export default att
