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

app.use(
  session({
    name: 'sid',
    secret: process.env.COOKIE_SECRET || 'dev-secret-not-for-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
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

// Routes
app.use('/', require('./routes/auth'))
app.use('/', require('./routes/user'))
app.use('/', require('./routes/location'))
app.use('/', require('./routes/users'))

// Start server
const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
