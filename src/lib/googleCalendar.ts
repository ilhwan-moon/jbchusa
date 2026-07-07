type CalendarConfig = {
  calendar_id: string
  service_account_json: string
  timezone: string
  is_enabled: number
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

const base64Url = (input: string | ArrayBuffer) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  const b64 = btoa(binary)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const pemToArrayBuffer = (pem: string) => {
  const clean = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(clean)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) buffer[i] = binary.charCodeAt(i)
  return buffer.buffer
}

const importPrivateKey = async (pem: string) => {
  const keyData = pemToArrayBuffer(pem)
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

const getAccessToken = async (serviceAccountJson: string) => {
  const sa = JSON.parse(serviceAccountJson)
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claimSet = base64Url(JSON.stringify({
    iss: sa.client_email,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    iat,
    exp,
  }))
  const unsignedToken = `${header}.${claimSet}`
  const key = await importPrivateKey(sa.private_key)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken))
  const jwt = `${unsignedToken}.${base64Url(signature)}`

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  })

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Google token error: ${errText}`)
  }

  const json = await resp.json<any>()
  return json.access_token as string
}

export const getCalendarConfig = async (env: any) => {
  const row = await env.DB.prepare(
    `SELECT calendar_id, service_account_json, timezone, is_enabled
     FROM admin_calendar_settings WHERE church_id=1`
  ).first<CalendarConfig>()
  if (!row || !row.is_enabled || !row.calendar_id || !row.service_account_json) return null
  return row
}

const buildEventPayload = (meeting: any, groupName: string, timezone: string) => {
  const startTime = meeting.start_time || '09:00'
  const startDateTime = `${meeting.meeting_date}T${startTime}:00`
  const endDate = new Date(`${meeting.meeting_date}T${startTime}:00`)
  endDate.setHours(endDate.getHours() + 1)
  const endDateTime = `${endDate.toISOString().slice(0, 19)}`
  const location = [meeting.location, meeting.address].filter(Boolean).join(' / ') || undefined
  const description = [
    `조직: ${groupName}`,
    `유형: ${meeting.meeting_type}`,
    meeting.note ? `메모: ${meeting.note}` : null,
    meeting.address ? `주소: ${meeting.address}` : null,
  ].filter(Boolean).join('\n')

  return {
    summary: meeting.title,
    description,
    location,
    start: { dateTime: startDateTime, timeZone: timezone },
    end: { dateTime: endDateTime, timeZone: timezone },
  }
}

export const createCalendarEvent = async (env: any, meeting: any, groupName: string) => {
  const config = await getCalendarConfig(env)
  if (!config) return null
  const accessToken = await getAccessToken(config.service_account_json)
  const payload = buildEventPayload(meeting, groupName, config.timezone || 'America/Los_Angeles')

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Google Calendar create error: ${errText}`)
  }

  const json = await resp.json<any>()
  return json.id as string
}

export const updateCalendarEvent = async (env: any, meeting: any, groupName: string, eventId: string) => {
  const config = await getCalendarConfig(env)
  if (!config) return null
  const accessToken = await getAccessToken(config.service_account_json)
  const payload = buildEventPayload(meeting, groupName, config.timezone || 'America/Los_Angeles')

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Google Calendar update error: ${errText}`)
  }

  return true
}

export const deleteCalendarEvent = async (env: any, eventId: string) => {
  const config = await getCalendarConfig(env)
  if (!config) return null
  const accessToken = await getAccessToken(config.service_account_json)

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Google Calendar delete error: ${errText}`)
  }

  return true
}
