import { Hono } from 'hono'
import { hashPassword, verifyPassword, signToken } from '../lib/auth'
import { buildSessionUser, getSecret } from '../lib/middleware'
import type { Bindings, SessionUser } from '../lib/types'

const auth = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

// Current user
auth.get('/me', (c) => {
  const user = c.get('user')
  if (!user) return c.json({ user: null })
  return c.json({ user })
})

// Login (username/email + password)
auth.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()
  if (!username || !password) return c.json({ error: '아이디와 비밀번호를 입력하세요.' }, 400)

  const row = await c.env.DB.prepare(
    `SELECT user_id, password_hash, is_active, locked_until FROM users
     WHERE (username = ? OR email = ?) LIMIT 1`
  ).bind(username, username).first<any>()

  if (!row || !row.password_hash) return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  if (!row.is_active) return c.json({ error: '비활성화된 계정입니다.' }, 403)

  const ok = await verifyPassword(password, row.password_hash)
  if (!ok) {
    await c.env.DB.prepare(`UPDATE users SET failed_count = failed_count + 1 WHERE user_id = ?`).bind(row.user_id).run()
    return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }

  await c.env.DB.prepare(`UPDATE users SET last_login_at = datetime('now'), failed_count = 0 WHERE user_id = ?`).bind(row.user_id).run()

  const sessionUser = await buildSessionUser(c.env.DB, row.user_id)
  const token = await signToken(sessionUser as any, getSecret(c))
  setSessionCookie(c, token)
  return c.json({ user: sessionUser })
})

// Sign up (email/password)
auth.post('/signup', async (c) => {
  const body = await c.req.json<any>()
  const { username, email, password, display_name } = body
  if (!username || !password) return c.json({ error: '아이디와 비밀번호는 필수입니다.' }, 400)
  if (password.length < 6) return c.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400)

  const churchId = 1
  const exists = await c.env.DB.prepare(
    `SELECT user_id FROM users WHERE church_id = ? AND (username = ? OR (email IS NOT NULL AND email = ?))`
  ).bind(churchId, username, email || '').first()
  if (exists) return c.json({ error: '이미 사용 중인 아이디 또는 이메일입니다.' }, 409)

  const hash = await hashPassword(password)
  const res = await c.env.DB.prepare(
    `INSERT INTO users (church_id, username, email, password_hash, display_name, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).bind(churchId, username, email || null, hash, display_name || username).run()

  const userId = res.meta.last_row_id as number
  // Default role: MEMBER
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_group_id)
     SELECT ?, role_id, NULL FROM roles WHERE code = 'MEMBER'`
  ).bind(userId).run()

  const sessionUser = await buildSessionUser(c.env.DB, userId)
  const token = await signToken(sessionUser as any, getSecret(c))
  setSessionCookie(c, token)
  return c.json({ user: sessionUser })
})

// OAuth (simulated/demo). Real providers would require client secrets configured as Cloudflare secrets.
// This endpoint provisions/links an account by provider + email for demo purposes.
auth.post('/oauth/:provider', async (c) => {
  const provider = c.req.param('provider')
  const { email, name, sub, avatar_url } = await c.req.json<any>()
  if (!email) return c.json({ error: '이메일이 필요합니다.' }, 400)

  const churchId = 1
  let user = await c.env.DB.prepare(`SELECT user_id FROM users WHERE email = ? LIMIT 1`).bind(email).first<any>()

  let userId: number
  if (user) {
    userId = user.user_id
    await c.env.DB.prepare(
      `UPDATE users SET oauth_provider = ?, oauth_sub = ?, avatar_url = COALESCE(?, avatar_url), last_login_at = datetime('now') WHERE user_id = ?`
    ).bind(provider, sub || null, avatar_url || null, userId).run()
  } else {
    const username = email.split('@')[0] + '_' + provider
    const res = await c.env.DB.prepare(
      `INSERT INTO users (church_id, username, email, oauth_provider, oauth_sub, avatar_url, display_name, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(churchId, username, email, provider, sub || null, avatar_url || null, name || username).run()
    userId = res.meta.last_row_id as number
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_group_id)
       SELECT ?, role_id, NULL FROM roles WHERE code = 'MEMBER'`
    ).bind(userId).run()
  }

  const sessionUser = await buildSessionUser(c.env.DB, userId)
  const token = await signToken(sessionUser as any, getSecret(c))
  setSessionCookie(c, token)
  return c.json({ user: sessionUser })
})

auth.post('/logout', (c) => {
  c.header('Set-Cookie', `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return c.json({ ok: true })
})

function setSessionCookie(c: any, token: string) {
  const maxAge = 60 * 60 * 24 * 7
  c.header('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`)
}

export default auth
