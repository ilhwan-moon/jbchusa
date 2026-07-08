import { Context, Next } from 'hono'
import { verifyToken, parseCookies } from './auth'
import type { Bindings, SessionUser } from './types'

const DEFAULT_SECRET = 'jbchusa-dev-secret-change-in-production'

export function getSecret(c: Context<{ Bindings: Bindings }>): string {
  return c.env.SESSION_SECRET || DEFAULT_SECRET
}

// Loads the session user (if any) and attaches to context. Does not block.
export async function loadUser(c: Context, next: Next) {
  const cookies = parseCookies(c.req.header('Cookie') || null)
  const token = cookies['session']
  let user: SessionUser | null = null
  if (token) {
    const payload = await verifyToken(token, getSecret(c as any))
    if (payload) user = payload as unknown as SessionUser
  }
  c.set('user', user)
  await next()
}

// Requires authentication for API routes
export async function requireAuth(c: Context, next: Next) {
  const user = c.get('user') as SessionUser | null
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  await next()
}

// Requires a specific permission
export function requirePermission(perm: string) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as SessionUser | null
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    if (!user.permissions.includes(perm) && !user.roles.includes('SUPER_ADMIN')) {
      return c.json({ error: 'Forbidden', required: perm }, 403)
    }
    await next()
  }
}

// Builds the full SessionUser (roles + permissions) from DB given a user_id
export async function buildSessionUser(DB: D1Database, userId: number): Promise<SessionUser | null> {
  const u = await DB.prepare(
    `SELECT user_id, church_id, username, email, COALESCE(display_name, username) AS display_name, member_id FROM users WHERE user_id = ? AND is_active = 1`
  ).bind(userId).first<any>()
  if (!u) return null

  const roles = await DB.prepare(
    `SELECT DISTINCT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?`
  ).bind(userId).all<{ code: string }>()

  const perms = await DB.prepare(
    `SELECT DISTINCT p.code FROM user_roles ur
     JOIN role_permissions rp ON ur.role_id = rp.role_id
     JOIN permissions p ON rp.permission_id = p.permission_id
     WHERE ur.user_id = ?`
  ).bind(userId).all<{ code: string }>()

  return {
    user_id: u.user_id,
    church_id: u.church_id,
    username: u.username,
    display_name: u.display_name,
    email: u.email,
    member_id: u.member_id,
    roles: (roles.results || []).map((r) => r.code),
    permissions: (perms.results || []).map((p) => p.code),
  }
}
