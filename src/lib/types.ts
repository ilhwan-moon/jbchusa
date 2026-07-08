export type Bindings = {
  DB: D1Database
  SESSION_SECRET?: string
  GMAIL_CLIENT_ID?: string
  GMAIL_CLIENT_SECRET?: string
  GMAIL_REFRESH_TOKEN?: string
  GMAIL_SENDER?: string
  APP_BASE_URL?: string
}

export type SessionUser = {
  user_id: number
  church_id: number
  username: string
  display_name: string
  email?: string | null
  member_id: number | null
  roles: string[]
  permissions: string[]
}
