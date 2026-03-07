const request = require('supertest')
const express = require('express')
const session = require('express-session')
const { createMockPool } = require('../helpers/mockPool')
const profileRouter = require('../../routes/profile')

/** Build app with optional session user. Profile route runs 4 queries: user, config, battlefields, exploration stats. */
function createApp(pool, sessionUser = null) {
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
    app.use((req, _res, next) => {
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
    const app = createApp(pool)
    const res = await request(app).get('/api/profile')
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/authentication required/i)
  })

  it('returns 404 when user not in DB', async () => {
    const pool = createMockPool([[], [], [], []])
    const app = createApp(pool, { id: 999 })
    const res = await request(app).get('/api/profile')
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
  })

  it('returns 200 and ProfileData shape when authenticated', async () => {
    const userRow = { user_id: 1, username: 'alice', interests: ['history', 'coffee'] }
    const configRow = {
      display_name: 'Alice',
      subtitle: 'Pro',
      avatar_uri: null,
      level: 10,
      play_style_tier: 'Pro',
    }
    const battlefields = [
      { id: 'bf1', name: 'Cafe', image_uri: null, last_match_at: '2 days ago', xp_delta: 10 },
    ]
    const explorationStats = {
      clues_collected: 12,
      experience_points: 180,
      routes_completed: 2,
    }
    const pool = createMockPool([
      [userRow],
      [configRow],
      battlefields,
      [explorationStats],
    ])
    const app = createApp(pool, { id: 1 })
    const res = await request(app).get('/api/profile')

    expect(res.status).toBe(200)

    expect(res.body.user).toMatchObject({
      displayName: 'Alice',
      level: 10,
    })
    expect(res.body.stats).toEqual({
      cluesCollected: 12,
      experiencePoints: 180,
      routesCompleted: 2,
    })
    expect(res.body.playStyle.tags).toEqual(['history', 'coffee'])
    expect(res.body.recentBattlefields).toHaveLength(1)
    expect(res.body.recentBattlefields[0]).toMatchObject({
      name: 'Cafe',
      xpDelta: 10,
    })
    expect(res.body.games).toEqual([])
  })
})
