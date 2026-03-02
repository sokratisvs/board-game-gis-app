const request = require('supertest')
const express = require('express')
const session = require('express-session')
const { createMockPool } = require('../helpers/mockPool')
const matchesRouter = require('../../routes/matches')

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
  app.use('/api', matchesRouter)
  return app
}

describe('POST /api/matches', () => {
  it('returns 401 when not authenticated', async () => {
    const pool = createMockPool([])
    const res = await request(appWithPoolAndSession(pool)).post('/api/matches').send({})
    expect(res.status).toBe(401)
  })

  it('returns 201 and EventSessionState when match created', async () => {
    const matchRow = {
      id: 'match-uuid-1',
      zone_name: 'Athens',
      zone_lat: 37.98,
      zone_lng: 23.73,
      current_turn_user_id: 1,
      unread_chat_count: 0,
      last_dice_values: [],
      grid_rows: null,
      grid_cols: null,
      highlighted_row: null,
      highlighted_col: null,
    }
    const playerRow = {
      user_id: 1,
      display_name: 'alice',
      health_percent: 100,
      mana_current: 0,
      mana_max: 100,
      order: 0,
      is_current_turn: true,
    }
    const pool = createMockPool([
      [matchRow],
      [],
      [],
      [matchRow],
      [playerRow],
    ])
    const app = appWithPoolAndSession(pool, { id: 1, username: 'alice' })
    const res = await request(app).post('/api/matches').send({ zoneName: 'Athens' })
    expect(res.status).toBe(201)
    expect(res.body.matchId).toBe('match-uuid-1')
    expect(res.body.zoneName).toBe('Athens')
    expect(res.body.players).toHaveLength(1)
    expect(res.body.players[0].displayName).toBe('alice')
    expect(res.body.currentTurnPlayerId).toBe('1')
  })
})

describe('GET /api/matches/:matchId', () => {
  it('returns 401 when not authenticated', async () => {
    const pool = createMockPool([])
    const res = await request(appWithPoolAndSession(pool)).get('/api/matches/match-uuid-1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when match not found', async () => {
    const pool = createMockPool([[], []])
    const app = appWithPoolAndSession(pool, { id: 1 })
    const res = await request(app).get('/api/matches/non-existent')
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
  })

  it('returns 200 and EventSessionState when match exists', async () => {
    const matchRow = {
      id: 'match-uuid-1',
      zone_name: 'Zone A',
      zone_lat: 37.98,
      zone_lng: 23.73,
      current_turn_user_id: 1,
      unread_chat_count: 0,
      last_dice_values: [3, 5],
      grid_rows: null,
      grid_cols: null,
      highlighted_row: null,
      highlighted_col: null,
    }
    const players = [
      {
        user_id: 1,
        display_name: 'alice',
        health_percent: 100,
        mana_current: 50,
        mana_max: 100,
        order: 0,
        is_current_turn: true,
      },
    ]
    const pool = createMockPool([[matchRow], players])
    const app = appWithPoolAndSession(pool, { id: 1 })
    const res = await request(app).get('/api/matches/match-uuid-1')
    expect(res.status).toBe(200)
    expect(res.body.matchId).toBe('match-uuid-1')
    expect(res.body.lastDiceValues).toEqual([3, 5])
    expect(res.body.players[0].manaCurrent).toBe(50)
  })
})

describe('POST /api/matches/:matchId/join', () => {
  it('returns 401 when not authenticated', async () => {
    const pool = createMockPool([])
    const res = await request(appWithPoolAndSession(pool)).post('/api/matches/m1/join')
    expect(res.status).toBe(401)
  })

  it('returns 404 when match not found', async () => {
    const pool = createMockPool([[]])
    const app = appWithPoolAndSession(pool, { id: 2, username: 'bob' })
    const res = await request(app).post('/api/matches/non-existent/join')
    expect(res.status).toBe(404)
  })
})
