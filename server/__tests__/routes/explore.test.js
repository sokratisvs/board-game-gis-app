const request = require('supertest')
const express = require('express')
const session = require('express-session')
const { createMockPool } = require('../helpers/mockPool')
const exploreRouter = require('../../routes/explore')

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
  app.use('/api', exploreRouter)
  return app
}

describe('GET /api/explore', () => {
  it('returns 401 when not authenticated', async () => {
    const pool = createMockPool([])
    const app = appWithPoolAndSession(pool)
    const res = await request(app).get('/api/explore?lat=37.98&lng=23.73')
    expect(res.status).toBe(401)
  })

  it('returns 400 when lat or lng missing or invalid', async () => {
    const pool = createMockPool([])
    const app = appWithPoolAndSession(pool, { id: 1 })
    const res1 = await request(app).get('/api/explore')
    expect(res1.status).toBe(400)
    const res2 = await request(app).get('/api/explore?lat=foo&lng=23.73')
    expect(res2.status).toBe(400)
  })

  it('returns 200 with userPosition, currentMatch null, nearbyEvents', async () => {
    const events = [
      {
        id: 'uuid-1',
        title: 'Mana Well',
        subtitle: '+10 Mana',
        lat: 37.982,
        lng: 23.726,
        image_uri: 'https://example.com/img.png',
        reward_label: '+10',
        is_active: true,
        type: 'mana_well',
      },
    ]
    const pool = createMockPool([events])
    const app = appWithPoolAndSession(pool, { id: 1 })
    const res = await request(app).get('/api/explore?lat=37.98&lng=23.73')
    expect(res.status).toBe(200)
    expect(res.body.userPosition).toEqual({ lat: 37.98, lng: 23.73 })
    expect(res.body.currentMatch).toBeNull()
    expect(Array.isArray(res.body.nearbyEvents)).toBe(true)
    expect(res.body.nearbyEvents[0].title).toBe('Mana Well')
    expect(res.body.nearbyEvents[0].position).toEqual({ lat: 37.982, lng: 23.726 })
    expect(res.body.nearbyEvents[0].type).toBe('mana_well')
  })
})
