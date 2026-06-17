import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { loadUser, requireAuth } from './lib/middleware'
import type { Bindings, SessionUser } from './lib/types'

import authRoutes from './routes/auth'
import orgRoutes from './routes/orgs'
import memberRoutes from './routes/members'
import attendanceRoutes from './routes/attendance'
import householdRoutes from './routes/households'
import adminRoutes from './routes/admin'

import { renderShell } from './views/shell'

const app = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()

app.use('/api/*', cors())
app.use('/api/*', loadUser)

// Public auth endpoints
app.route('/api/auth', authRoutes)

// Protected API
const api = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser | null } }>()
api.use('*', requireAuth)
api.route('/orgs', orgRoutes)
api.route('/members', memberRoutes)
api.route('/attendance', attendanceRoutes)
api.route('/households', householdRoutes)
api.route('/admin', adminRoutes)
app.route('/api', api)

// Static assets
app.use('/static/*', serveStatic({ root: './public' }))

// SPA - serve shell for all non-API routes
app.get('*', (c) => c.html(renderShell()))

export default app
