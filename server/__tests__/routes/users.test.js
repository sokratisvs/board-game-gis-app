const request = require('supertest')
const express = require('express')
const session = require('express-session')
const { createMockPool } = require('../helpers/mockPool')
const usersRouter = require('../../routes/users')

function appWithPool(pool, sessionUser = null) {
  const app = express()
  app.use(express.json())
  app.use(
    session({
      secret: 'test',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false },
    })
  )
  app.set('pool', pool)
  if (sessionUser) {
    app.use((req, res, next) => {
      req.session.user = sessionUser
      next()
    })
  }
  app.use('/api', usersRouter)
  return app
}

describe('GET /api/users', () => {
  it('returns 200 with users and pagination', async () => {
    const userRows = [
      {
        user_id: 1,
        username: 'alice',
        email: 'alice@example.com',
        created_on: new Date(),
        last_login: null,
        active: true,
        type: 'user',
        is_online: false,
      },
    ]
    const countRow = { count: '1' }
    const pool = createMockPool([userRows, [countRow]])
    const app = appWithPool(pool)
    const res = await request(app).get('/api/users?page=1&limit=10')
    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(1)
    expect(res.body.users[0].username).toBe('alice')
    expect(res.body.pagination).toBeDefined()
    expect(res.body.pagination.currentPage).toBe(1)
    expect(res.body.pagination.limit).toBe(10)
    expect(res.body.pagination.totalRecords).toBe(1)
  })
})
