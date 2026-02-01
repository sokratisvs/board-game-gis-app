const express = require('express')
const router = express.Router()

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

router.put('/user/:id', async (request, response) => {
  const pool = request.app.get('pool')
  const id = parseInt(request.params.id)
  const { username, email, active, type } = request.body

  if (!id || isNaN(id)) {
    return response.status(400).json({ message: 'Invalid user ID' })
  }

  try {
    // First get the current user data
    const currentResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [id]
    )

    if (currentResult.rows.length === 0) {
      return response.status(404).json({ message: 'User not found' })
    }

    const currentUser = currentResult.rows[0]

    // Use current values if new ones aren't provided
    const updatedUsername =
      username !== undefined ? username : currentUser.username
    const updatedEmail = email !== undefined ? email : currentUser.email
    const updatedActive = active !== undefined ? active : currentUser.active
    const updatedType = type !== undefined ? type : currentUser.type

    // Simple fixed query - always 5 parameters
    const query = `
      UPDATE users 
      SET username = $1, email = $2, active = $3, type = $4 
      WHERE user_id = $5 
      RETURNING *
    `

    const result = await pool.query(query, [
      updatedUsername,
      updatedEmail,
      updatedActive,
      updatedType,
      id,
    ])

    response.status(200).json({
      message: 'User updated successfully',
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Error updating user:', error)
    response
      .status(500)
      .json({ message: 'Error updating user', error: error.message })
  }
})

router.delete('/user/:id', (request, response) => {
  const pool = request.app.get('pool')
  const id = parseInt(request.params.id)

  pool.query('DELETE FROM users WHERE user_id = $1', [id], (error) => {
    if (error) {
      throw error
    }
    response.status(200).send(`User deleted with ID: ${id}`)
  })
})

module.exports = router
