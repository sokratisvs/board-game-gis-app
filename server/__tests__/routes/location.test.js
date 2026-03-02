const request = require('supertest')
const express = require('express')
const { createMockPool } = require('../helpers/mockPool')
const locationRouter = require('../../routes/location')

function appWithPool(pool) {
  const app = express().use(express.json()).set('pool', pool)
  app.use('/api', locationRouter)
  return app
}

describe('GET /api/location/:id', () => {
  it('returns 200 and coordinates array', async () => {
    const pool = createMockPool([[{ lng: 23.73, lat: 37.98 }]])
    const res = await request(appWithPool(pool)).get('/api/location/1')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].lng).toBe(23.73)
    expect(res.body[0].lat).toBe(37.98)
  })

  it('returns 200 and empty array when no location', async () => {
    const pool = createMockPool([[]])
    const res = await request(appWithPool(pool)).get('/api/location/999')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /api/location', () => {
  it('returns 400 when userId or coordinates missing', async () => {
    const pool = createMockPool([])
    const app = appWithPool(pool)
    const res = await request(app).post('/api/location').send({})
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/missing/i)
  })

  it('returns 201 and message on success', async () => {
    const pool = createMockPool([[{ user_id: 1 }]])
    const app = appWithPool(pool)
    const res = await request(app)
      .post('/api/location')
      .send({ userId: 1, coordinates: { lng: 23.73, lat: 37.98 } })
    expect(res.status).toBe(201)
    expect(res.body.message).toMatch(/updated/i)
  })
})
