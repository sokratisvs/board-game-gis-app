const express = require('express')
const router = express.Router()

router.get('/location/:id', (request, response) => {
  const pool = request.app.get('pool')
  const id = parseInt(request.params.id)

  pool.query(
    'SELECT ST_X(coordinates) as lng, \
    ST_Y(coordinates) as lat FROM location WHERE user_id = $1',
    [id],
    (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).json(results.rows)
    }
  )
})

router.post('/location', async (request, response) => {
  const pool = request.app.get('pool')
  const { userId, coordinates } = request.body

  if (!userId || !coordinates?.lng || !coordinates?.lat) {
    return response.status(400).json({ error: 'Missing userId or coordinates' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO location (user_id, coordinates) 
       VALUES ($1, ST_SetSRID(ST_POINT($2, $3), 4326))
       ON CONFLICT (user_id) 
       DO UPDATE SET coordinates = EXCLUDED.coordinates
       RETURNING *`,
      [userId, coordinates.lng, coordinates.lat]
    )
    response.status(201).json({
      message: `User ${userId} location updated`,
      location: result.rows[0],
    })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Internal Server Error' })
  }
})

router.put('/location/:id', (request, response) => {
  const pool = request.app.get('pool')
  const userId = parseInt(request.params.id)
  const { coordinates } = request.body

  if (
    !userId ||
    !coordinates ||
    isNaN(coordinates.lat) ||
    isNaN(coordinates.lng)
  ) {
    return response
      .status(400)
      .json({ message: 'Invalid user ID or coordinates' })
  }
  pool.query(
    'UPDATE location SET coordinates = ST_SetSRID(ST_POINT($1, $2), 4326) WHERE user_id = $3',
    [coordinates.lng, coordinates.lat, userId],
    (error, results) => {
      if (error) {
        throw error
      }
      if (results.rowCount === 0) {
        return response.status(404).send(`User ${userId} not found`)
      }
      response
        .status(200)
        .send(
          `User ${userId} updated with location: ${results.rows[0].coordinates}`
        )
    }
  )
})

router.delete('/location/:id', (request, response) => {
  const pool = request.app.get('pool')
  const userId = parseInt(request.params.id)

  pool.query(
    'DELETE FROM location WHERE user_id = $1',
    [userId],
    (error, results) => {
      if (error) {
        throw error
      }
      if (results.rowCount === 0) {
        return response.status(404).send(`User ${userId} not found`)
      }
      response.status(200).send(`User ${userId} deleted their location`)
    }
  )
})

module.exports = router
