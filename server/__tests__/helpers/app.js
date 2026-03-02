const express = require('express')
const session = require('express-session')

/**
 * Minimal Express app for testing: json, session, pool. Mount routes under /api.
 */
function createTestApp(mockPool, options = {}) {
  const app = express()
  app.use(express.json())
  app.use(
    session({
      name: 'sid',
      secret: options.secret || 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  )
  app.set('pool', mockPool)
  return app
}

module.exports = { createTestApp }
