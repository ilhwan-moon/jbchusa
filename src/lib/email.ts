import type { Bindings } from './types'

const enc = new TextEncoder()

function base64UrlEncode(input: string): string {
  const bytes = enc.encode(input)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encodeSubject(subject: string): string {
  const b64 = base64UrlEncode(subject).replace(/-/g, '+').replace(/_/g, '/')
  return `=?UTF-8?B?${b64}?=`
}

async function getGmailAccessToken(env: Bindings): Promise<string> {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = env
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error('Gmail 설정이 필요합니다.')
  }

  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    client_secret: GMAIL_CLIENT_SECRET,
    refresh_token: GMAIL_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  })

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Gmail 토큰 발급 실패: ${text}`)
  }

  const data = await resp.json<{ access_token: string }>()
  if (!data.access_token) throw new Error('Gmail 토큰 발급 실패')
  return data.access_token
}

export async function sendPasswordResetEmail(env: Bindings, to: string, resetUrl: string) {
  const sender = env.GMAIL_SENDER
  if (!sender) throw new Error('GMAIL_SENDER 설정이 필요합니다.')

  const subject = encodeSubject('JBCHUSA 비밀번호 재설정 안내')
  const body = [
    `안녕하세요.`,
    `요청하신 비밀번호 재설정 링크입니다:`,
    resetUrl,
    `링크는 1시간 동안 유효합니다.`,
    `요청하지 않으셨다면 이 메일을 무시하세요.`,
  ].join('\n')

  const raw = [
    `From: ${sender}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\n')

  const accessToken = await getGmailAccessToken(env)
  const payload = { raw: base64UrlEncode(raw) }

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`메일 발송 실패: ${text}`)
  }
}
