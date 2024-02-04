const express = require('express')
const router = express.Router()

router.get('/users', (request, response) => {
  const pool = request.app.get('pool')
  pool.query('SELECT * FROM users ORDER BY user_id ASC', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
})

router.get('/user/:id', (request, response) => {
  const pool = request.app.get('pool')
  const id = parseInt(request.params.id)

  pool.query(
    'SELECT * FROM users WHERE user_id = $1',
    [id],
    (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).json(results.rows)
    }
  )
})

router.post('/user', (request, response) => {
  const pool = request.app.get('pool')
  const { username, email, password } = request.body
  const timestamp = new Date(new Date().toISOString())
  pool.query(
    'INSERT INTO users (username, email, password, created_on) VALUES ($1, $2, $3, $4) RETURNING *',
    [username, email, password, timestamp],
    (error, results) => {
      if (error) {
        throw error
      }
      response
        .status(201)
        .send(`User ${username} added with ID: ${results.rows[0].user_id}`)
    }
  )
})

router.put('/user/:id', (request, response) => {
  const pool = request.app.get('pool')
  const id = parseInt(request.params.id)
  const { username, email } = request.body

  pool.query(
    'UPDATE users SET username = $1, email = $2 WHERE user_id = $3',
    [username, email, id],
    (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).send(`User ${username} modified with ID: ${id}`)
    }
  )
})

router.delete('/user/:id', (request, response) => {
  const pool = request.app.get('pool')
  const id = parseInt(request.params.id)

  pool.query('DELETE FROM users WHERE user_id = $1', [id], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).send(`User deleted with ID: ${id}`)
  })
})

module.exports = router
