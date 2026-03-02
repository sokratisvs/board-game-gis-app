const request = require('supertest')
const express = require('express')
const session = require('express-session')
const { createMockPool } = require('../helpers/mockPool')
const configRouter = require('../../routes/config')

function appWithPoolAndSession(pool, sessionUser = null) {
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
  app.use('/api', configRouter)
  return app
}

describe('GET /api/users/:id/config', () => {
  it('returns 401 when not authenticated', async () => {
    const pool = createMockPool([])
    const res = await request(appWithPoolAndSession(pool)).get('/api/users/1/config')
    expect(res.status).toBe(401)
  })

  it('returns 403 when user requests another user config and is not admin', async () => {
    const pool = createMockPool([])
    const app = appWithPoolAndSession(pool, { id: 5, type: 'user' })
    const res = await request(app).get('/api/users/99/config')
    expect(res.status).toBe(403)
  })

  it('returns 200 with default config when no row exists', async () => {
    const pool = createMockPool([[]])
    const app = appWithPoolAndSession(pool, { id: 1, type: 'user' })
    const res = await request(app).get('/api/users/1/config')
    expect(res.status).toBe(200)
    expect(res.body.user_id).toBe(1)
    expect(res.body.games_owned).toEqual([])
    expect(res.body.subscription).toBe('free')
  })

  it('returns 200 with config when admin or self', async () => {
    const row = {
      user_id: 1,
      games_owned: ['Catan'],
      games_liked: [],
      game_types_interested: ['Strategy'],
      has_space: true,
      city: 'Athens',
      subscription: 'extra',
      updated_at: new Date(),
      display_name: 'Alice',
      subtitle: null,
      avatar_uri: null,
      level: 10,
      play_style_tier: 'Pro',
      matches_count: 5,
      wins_count: 3,
      titles_count: 0,
    }
    const pool = createMockPool([[row]])
    const app = appWithPoolAndSession(pool, { id: 1, type: 'user' })
    const res = await request(app).get('/api/users/1/config')
    expect(res.status).toBe(200)
    expect(res.body.user_id).toBe(1)
    expect(res.body.games_owned).toEqual(['Catan'])
    expect(res.body.subscription).toBe('extra')
    expect(res.body.display_name).toBe('Alice')
  })
})

describe('PUT /api/users/:id/config', () => {
  it('returns 401 when not authenticated', async () => {
    const pool = createMockPool([])
    const app = appWithPoolAndSession(pool)
    const res = await request(app).put('/api/users/1/config').send({ games_owned: ['Catan'] })
    expect(res.status).toBe(401)
  })

  it('returns 200 and updated config on success', async () => {
    const updated = {
      user_id: 1,
      games_owned: ['Catan', 'Chess'],
      games_liked: [],
      game_types_interested: ['Strategy'],
      has_space: true,
      city: 'Athens',
      subscription: 'extra',
      updated_at: new Date(),
      display_name: 'Alice',
      subtitle: null,
      avatar_uri: null,
      level: 10,
      play_style_tier: 'Pro',
      matches_count: 5,
      wins_count: 3,
      titles_count: 0,
    }
    const pool = createMockPool([[], [updated]])
    const app = appWithPoolAndSession(pool, { id: 1, type: 'user' })
    const res = await request(app)
      .put('/api/users/1/config')
      .send({ games_owned: ['Catan', 'Chess'] })
    expect(res.status).toBe(200)
    expect(res.body.games_owned).toEqual(['Catan', 'Chess'])
  })
})
