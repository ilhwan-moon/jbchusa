export type Bindings = {
  DB: D1Database
  SESSION_SECRET?: string
}

export type SessionUser = {
  user_id: number
  church_id: number
  username: string
  display_name: string
  member_id: number | null
  roles: string[]
  permissions: string[]
}
