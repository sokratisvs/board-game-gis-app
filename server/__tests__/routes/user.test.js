const request = require('supertest')
const express = require('express')
const { createMockPool } = require('../helpers/mockPool')
const userRouter = require('../../routes/user')

function appWithPool(pool) {
  const app = express().use(express.json()).set('pool', pool)
  app.use('/api', userRouter)
  return app
}

describe('GET /api/user/:id', () => {
  it('returns 200 and user array when user exists', async () => {
    const row = {
      user_id: 1,
      username: 'alice',
      email: 'alice@example.com',
      created_on: new Date(),
      last_login: null,
      type: 'user',
      active: true,
    }
    const pool = createMockPool([[row]])
    const res = await request(appWithPool(pool)).get('/api/user/1')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].user_id).toBe(1)
    expect(res.body[0].username).toBe('alice')
    expect(res.body[0]).not.toHaveProperty('password')
  })

  it('returns 200 and empty array when user not found', async () => {
    const pool = createMockPool([[]])
    const res = await request(appWithPool(pool)).get('/api/user/999')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('PUT /api/user/:id', () => {
  it('returns 400 for invalid id', async () => {
    const pool = createMockPool([])
    const res = await request(appWithPool(pool)).put('/api/user/abc').send({})
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid/i)
  })

  it('returns 404 when user not found', async () => {
    const pool = createMockPool([[]]) // SELECT returns no rows
    const res = await request(appWithPool(pool)).put('/api/user/999').send({})
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
  })

  it('returns 200 and updated user on success', async () => {
    const current = {
      user_id: 1,
      username: 'alice',
      email: 'alice@example.com',
      active: true,
      type: 'user',
    }
    const updated = { ...current, username: 'alice2', active: false }
    const pool = createMockPool([[current], [updated]])
    const res = await request(appWithPool(pool))
      .put('/api/user/1')
      .send({ username: 'alice2', active: false })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/updated/i)
    expect(res.body.user.username).toBe('alice2')
    expect(res.body.user.active).toBe(false)
    expect(res.body.user).not.toHaveProperty('password')
  })
})
