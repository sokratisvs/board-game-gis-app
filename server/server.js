const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const { Pool } = require('pg')
const session = require('express-session')

const path = require('path')
const root = path.join(__dirname, '..')
// Local: .env. VM: .env (from deploy) or .env.backend. Load both; .env.backend overrides when present.
require('dotenv').config({ path: path.join(root, '.env') })
require('dotenv').config({ path: path.join(root, '.env.backend') })

// Trust Nginx Proxy Manager
app.set('trust proxy', 1)

// Middleware
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))

// CORS Configuration
const isProduction = process.env.NODE_ENV === 'production'
const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : []

// Validate CLIENT_URLS in production
if (isProduction && allowedOrigins.length === 0) {
  console.error(
    'ERROR: CLIENT_URLS environment variable is required in production'
  )
  process.exit(1)
}

// When any allowed origin uses HTTPS, set secure cookies (required behind NPM/TLS)
const useSecureCookies = allowedOrigins.some((o) => o.startsWith('https://'))

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin) {
        return callback(null, true)
      }

      // Production: Only allow configured origins
      if (isProduction) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true)
        }
        return callback(new Error(`CORS blocked: ${origin}`))
      }

      // Development: Allow localhost origins or configured origins
      const devOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://localhost:8081',
        'http://localhost:8082',
      ]
      if (devOrigins.includes(origin) || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// Ensure COOKIE_SECRET is set (required for production)
if (!process.env.COOKIE_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: COOKIE_SECRET is required in production environment')
    process.exit(1)
  } else {
    console.warn(
      'Warning: COOKIE_SECRET is not set. Session security may be compromised.'
    )
  }
}

// Validate COOKIE_SECRET strength in production
if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECRET) {
  if (process.env.COOKIE_SECRET.length < 32) {
    console.error(
      'ERROR: COOKIE_SECRET must be at least 32 characters long in production'
    )
    process.exit(1)
  }
}

const cookieDomain =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? (process.env.COOKIE_DOMAIN || '').trim() || undefined
    : undefined

if (
  (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') &&
  !cookieDomain
) {
  console.warn(
    'Session cookie: COOKIE_DOMAIN is not set. Set it (e.g. staging-apps.tail272227.ts.net) so the cookie is sent for your frontend origin.'
  )
}

app.use(
  session({
    name: 'sid',
    secret: process.env.COOKIE_SECRET || 'dev-secret-not-for-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
      secure:
        (process.env.NODE_ENV === 'production' ||
          process.env.NODE_ENV === 'staging') &&
        useSecureCookies,
      httpOnly: true,
      sameSite: useSecureCookies ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      ...(cookieDomain && { domain: cookieDomain }),
    },
  })
)

// DB connection (Docker-safe)
// Validate database configuration
if (
  !process.env.DB_HOST ||
  !process.env.DB_NAME ||
  !process.env.DB_USER ||
  !process.env.DB_PASSWORD
) {
  console.error(
    'ERROR: Database configuration is incomplete. Required: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD'
  )
  if (process.env.NODE_ENV === 'production') {
    process.exit(1)
  }
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD || ''), // Ensure password is a string
})

app.set('pool', pool)

// Bearer token auth for mobile: mobile app reads userToken from AsyncStorage and
// sets Authorization: Bearer <userToken> on every request (axios interceptor).
// If no session cookie but this header is present and valid, we set req.session.user
// so requireAuth and requireAdmin work unchanged.
const { verifyAuthToken } = require('./authToken')
app.use(async (req, res, next) => {
  if (req.session?.user) return next()
  const auth = req.headers.authorization
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) return next()
  const payload = verifyAuthToken(token)
  if (!payload) return next()
  try {
    const pool = req.app.get('pool')
    const result = await pool.query(
      'SELECT user_id, username, type FROM users WHERE user_id = $1',
      [payload.userId]
    )
    if (result.rows.length === 0) return next()
    const row = result.rows[0]
    req.session.user = {
      id: row.user_id,
      username: row.username,
      type: row.type,
      role: row.type,
    }
  } catch (err) {
    console.error('Bearer token user load error:', err.message)
  }
  next()
})

// Health check (for Docker / Jenkins / monitoring)
app.get('/health', async (_, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).type('text/plain').send('ok\n')
  } catch (err) {
    res.status(500).type('text/plain').send('db error\n')
  }
})

// Routes
app.use('/api', require('./routes/auth'))
app.use('/api', require('./routes/user'))
app.use('/api', require('./routes/location'))
app.use('/api', require('./routes/config'))
app.use('/api', require('./routes/users'))
app.use('/api', require('./routes/profile'))
app.use('/api', require('./routes/explore'))
app.use('/api', require('./routes/matches'))
app.use('/api', require('./routes/exploration'))
app.use('/api', require('./routes/routes'))
app.use('/api', require('./routes/quizzes'))
app.use('/api', require('./routes/ai_suggestions'))
app.use('/api', require('./routes/places'))

// Start server
const PORT = process.env.BACKEND_PORT || process.env.PORT || 4000
const HOST = process.env.HOST || '0.0.0.0'
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
})
