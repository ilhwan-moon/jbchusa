// Auth utilities: PBKDF2 password hashing + JWT-like session tokens (HMAC)
// All using Web Crypto API (Cloudflare Workers compatible)

const enc = new TextEncoder()
const dec = new TextDecoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16)
  return arr
}

// ---------- Password hashing (PBKDF2-SHA256) ----------
export async function hashPassword(password: string): Promise<string> {
  const iterations = 100000
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return `pbkdf2$${iterations}$${toHex(salt.buffer)}$${toHex(bits)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterStr, saltHex, hashHex] = stored.split('$')
    if (scheme !== 'pbkdf2') return false
    const iterations = parseInt(iterStr, 10)
    const salt = fromHex(saltHex)
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    )
    return toHex(bits) === hashHex
  } catch {
    return false
  }
}

// ---------- Session token (HMAC-signed JSON) ----------
function b64urlEncode(data: Uint8Array): string {
  let str = ''
  for (const b of data) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signToken(payload: Record<string, any>, secret: string, ttlSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const json = b64urlEncode(enc.encode(JSON.stringify(body)))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(json))
  return `${json}.${b64urlEncode(new Uint8Array(sig))}`
}

export async function verifyToken(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const [json, sigStr] = token.split('.')
    if (!json || !sigStr) return null
    const key = await hmacKey(secret)
    const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(sigStr), enc.encode(json))
    if (!valid) return null
    const payload = JSON.parse(dec.decode(b64urlDecode(json)))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// Cookie helpers
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}
