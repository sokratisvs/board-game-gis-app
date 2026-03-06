/**
 * Simple signed auth token for mobile clients where cookies are unreliable.
 * Token is HMAC-signed payload (userId + expiry); no DB or JWT dependency.
 */
const crypto = require('crypto')

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SEP = '.'

function getSecret() {
  const secret = process.env.COOKIE_SECRET || 'dev-secret-not-for-production'
  return secret
}

/**
 * Create a signed token for the user. Mobile app can store this and send
 * Authorization: Bearer <token> when cookies are not sent (e.g. WebView, cross-origin).
 * @param {number} userId
 * @returns {string} token
 */
function createAuthToken(userId) {
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = JSON.stringify({ userId: Number(userId), exp })
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url')
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url')
  return payloadB64 + SEP + sig
}

/**
 * Verify token and return payload or null.
 * @param {string} token
 * @returns {{ userId: number } | null}
 */
function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null
  const i = token.indexOf(SEP)
  if (i === -1) return null
  const payloadB64 = token.slice(0, i)
  const sig = token.slice(i + SEP.length)
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url')
  if (sig !== expectedSig) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (payload.exp && payload.exp < Date.now()) return null
  if (payload.userId == null) return null
  return { userId: Number(payload.userId) }
}

module.exports = { createAuthToken, verifyAuthToken }
