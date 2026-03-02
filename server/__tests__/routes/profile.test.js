const request = require('supertest')
const express = require('express')
const session = require('express-session')
const { createMockPool } = require('../helpers/mockPool')
const profileRouter = require('../../routes/profile')

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
  app.use('/api', profileRouter)
  return app
}

describe('GET /api/profile', () => {
  it('returns 401 when not authenticated', async () => {
    const pool = createMockPool([])
    const app = appWithPoolAndSession(pool)
    const res = await request(app).get('/api/profile')
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/authentication required/i)
  })

  it('returns 404 when user not in DB', async () => {
    const pool = createMockPool([[], [], []]) // user empty, config empty, battlefields empty
    const app = appWithPoolAndSession(pool, { id: 999 })
    const res = await request(app).get('/api/profile')
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
  })

  it('returns 200 and ProfileData shape when authenticated', async () => {
    const userRow = { user_id: 1, username: 'alice' }
    const configRow = {
      games_owned: ['Catan'],
      games_liked: [],
      game_types_interested: ['Strategy'],
      display_name: 'Alice',
      subtitle: 'Pro',
      avatar_uri: null,
      level: 10,
      play_style_tier: 'Pro',
      matches_count: 5,
      wins_count: 3,
      titles_count: 0,
    }
    const battlefields = [
      { id: 'bf1', name: 'Cafe', image_uri: null, last_match_at: '2 days ago', xp_delta: 10 },
    ]
    const pool = createMockPool([[userRow], [configRow], battlefields])
    const app = appWithPoolAndSession(pool, { id: 1 })
    const res = await request(app).get('/api/profile')
    expect(res.status).toBe(200)
    expect(res.body.user.displayName).toBe('Alice')
    expect(res.body.user.level).toBe(10)
    expect(res.body.stats.matches).toBe(5)
    expect(res.body.playStyle.tags).toEqual(['Strategy'])
    expect(res.body.games).toHaveLength(1)
    expect(res.body.games[0].name).toBe('Catan')
    expect(res.body.recentBattlefields).toHaveLength(1)
    expect(res.body.recentBattlefields[0].name).toBe('Cafe')
    expect(res.body.recentBattlefields[0].xpDelta).toBe(10)
  })
})
