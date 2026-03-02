const request = require('supertest')
const express = require('express')
const { createTestApp } = require('../helpers/app')
const { createMockPool } = require('../helpers/mockPool')

// Mock bcrypt so we don't depend on real hashing in unit tests
jest.mock('bcrypt', () => ({
  compare: jest.fn(() => Promise.resolve(true)),
  hash: jest.fn((pw) => Promise.resolve(`hashed_${pw}`)),
  genSalt: jest.fn(() => Promise.resolve('salt')),
}))

const authRouter = require('../../routes/auth')

describe('POST /api/login', () => {
  it('returns 403 when email or password missing', async () => {
    const pool = createMockPool([])
    const app = express().use(express.json()).set('pool', pool)
    app.use('/api', authRouter)

    const res = await request(app).post('/api/login').send({})
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/required/i)
  })

  it('returns 400 when user not found', async () => {
    const pool = createMockPool([[]]) // SELECT returns no rows
    const app = express().use(express.json()).set('pool', pool)
    app.use('/api', authRouter)

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'nobody@example.com', password: 'secret' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBeDefined()
  })

  it('returns 200 and user when credentials valid', async () => {
    const userRow = {
      user_id: 1,
      username: 'alice',
      password: 'hashed_secret',
      email: 'alice@example.com',
      type: 'user',
    }
    const pool = createMockPool([[userRow], []]) // SELECT user, then UPDATE last_login
    const app = express()
    app.use(express.json())
    app.use(
      require('express-session')({
        secret: 'test',
        resave: false,
        saveUninitialized: false,
      })
    )
    app.set('pool', pool)
    app.use('/api', authRouter)

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'alice@example.com', password: 'secret' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ username: 'alice', id: 1, type: 'user' })
  })
})

describe('POST /api/register', () => {
  it('returns 403 when required fields missing', async () => {
    const pool = createMockPool([])
    const app = express().use(express.json()).set('pool', pool)
    app.use('/api', authRouter)

    const res = await request(app).post('/api/register').send({ username: 'bob' })
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/required/i)
  })

  it('returns 400 for invalid type', async () => {
    const pool = createMockPool([[]]) // existing user check returns none
    const app = express().use(express.json()).set('pool', pool)
    app.use('/api', authRouter)

    const res = await request(app)
      .post('/api/register')
      .send({ username: 'bob', email: 'bob@example.com', password: 'pass', type: 'invalid' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid type/i)
  })

  it('returns 400 when email already exists', async () => {
    const pool = createMockPool([[{ user_id: 1 }]]) // existing user
    const app = express().use(express.json()).set('pool', pool)
    app.use('/api', authRouter)

    const res = await request(app)
      .post('/api/register')
      .send({ username: 'bob', email: 'bob@example.com', password: 'pass' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already exists/i)
  })

  it('returns 200 with user when registration succeeds', async () => {
    const newUser = { user_id: 2, username: 'bob', type: 'user', active: true }
    const pool = createMockPool([[], [newUser]]) // no existing, then INSERT RETURNING
    const app = express().use(express.json()).set('pool', pool)
    app.use('/api', authRouter)

    const res = await request(app)
      .post('/api/register')
      .send({ username: 'bob', email: 'bob@example.com', password: 'pass' })
    expect(res.status).toBe(200)
    expect(res.body.username).toBe('bob')
    expect(res.body.id).toBe(2)
    expect(res.body.type).toBe('user')
  })
})
