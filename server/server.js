const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const session = require('express-session');

// Docker / env vars
require('dotenv').config();

// Trust Nginx Proxy Manager
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: function (origin, callback) {
    // allow server-to-server, curl, Postman
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// Ensure COOKIE_SECRET is set (required for production)
if (!process.env.COOKIE_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: COOKIE_SECRET is required in production environment');
    process.exit(1);
  } else {
    console.warn('Warning: COOKIE_SECRET is not set. Session security may be compromised.');
  }
}

// Validate COOKIE_SECRET strength in production
if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECRET) {
  if (process.env.COOKIE_SECRET.length < 32) {
    console.error('ERROR: COOKIE_SECRET must be at least 32 characters long in production');
    process.exit(1);
  }
}

app.use(session({
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
}));

// DB connection (Docker-safe)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.set('pool', pool);

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/user'));
app.use('/', require('./routes/location'));
app.use('/', require('./routes/users'));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
