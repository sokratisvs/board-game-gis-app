const express = require('express')
const router = express.Router()

/* Get all users (default pagination)
GET /users

# Get users with pagination
GET /users?page=2&limit=5

# Search active users with active filter & pagination
GET /users?username=john&active=true&page=1&limit=10
*/
router.get('/users', async (request, response) => {
  const pool = request.app.get('pool')
  const { username, active, type, page = 1, limit = 10 } = request.query

  // Calculate offset for pagination
  const offset = (parseInt(page) - 1) * parseInt(limit)

  let whereConditions = []
  let params = []
  let paramCount = 1

  // Build WHERE conditions dynamically
  if (username) {
    whereConditions.push(`username ILIKE $${paramCount}`)
    params.push(`%${username}%`)
    paramCount++
  }

  if (active !== undefined) {
    whereConditions.push(`active = $${paramCount}`)
    params.push(active === 'true')
    paramCount++
  }

  const validTypes = ['user', 'shop', 'event', 'admin']
  const typesParam = type
  const typesArray = typesParam
    ? (Array.isArray(typesParam)
        ? typesParam
        : String(typesParam)
            .split(',')
            .map((t) => t.trim())
      ).filter((t) => validTypes.includes(t))
    : []
  if (typesArray.length > 0) {
    const placeholders = typesArray.map(() => `$${paramCount++}`).join(', ')
    params.push(...typesArray)
    whereConditions.push(`type IN (${placeholders})`)
  }

  let query = `
    SELECT 
      user_id, username, email, created_on, last_login, active, type,
      CASE 
        WHEN last_login > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN true
        ELSE false
      END AS is_online
    FROM users
  `

  // Add WHERE clause if there are conditions
  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(' AND ')}`
  }

  // Add pagination
  query += ` ORDER BY user_id ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`
  params.push(parseInt(limit), offset)

  // Count query for total records
  let countQuery = `SELECT COUNT(*) FROM users`
  let countParams = []
  if (whereConditions.length > 0) {
    // Rebuild params for count query (same order as main query)
    if (username) {
      countParams.push(`%${username}%`)
    }
    if (active !== undefined) {
      countParams.push(active === 'true')
    }
    if (typesArray.length > 0) {
      countParams.push(...typesArray)
    }

    countQuery += ` WHERE ${whereConditions.join(' AND ')}`
  }

  try {
    // Execute both queries
    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ])

    const totalRecords = parseInt(countResult.rows[0].count)
    const totalPages = Math.ceil(totalRecords / parseInt(limit))

    response.status(200).json({
      users: result.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1,
      },
    })
  } catch (error) {
    console.error(error)
    response.status(500).json({ message: 'Error fetching users' })
  }
})

router.get('/users/stats', async (request, response) => {
  const pool = request.app.get('pool')
  try {
    const result = await pool.query(
      'SELECT type, COUNT(*)::int AS count FROM users GROUP BY type ORDER BY type'
    )
    const byType = { user: 0, shop: 0, event: 0, admin: 0 }
    result.rows.forEach((row) => {
      byType[row.type] = row.count
    })
    response.status(200).json(byType)
  } catch (error) {
    console.error(error)
    response.status(500).json({ message: 'Error fetching user stats' })
  }
})

router.get('/users/nearby', async (request, response) => {
  const pool = request.app.get('pool')
  const { latitude, longitude, radius, username } = request.query

  if (!latitude || !longitude || !radius) {
    return response.status(400).json({
      message: 'Missing required parameters: latitude, longitude, or radius',
    })
  }

  let query = `
    SELECT 
      u.user_id, u.username, u.email, u.created_on, u.last_login, u.active,
      ST_X(l.coordinates) as lng, 
      ST_Y(l.coordinates) as lat,
      ST_Distance(l.coordinates, ST_SetSRID(ST_Point($1, $2), 4326)) as distance,
      CASE 
        WHEN u.last_login > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN true
        ELSE false
      END AS is_online
    FROM users u
    JOIN location l ON u.user_id = l.user_id
      WHERE l.coordinates IS NOT NULL -- Only users who have shared a location
      AND u.active = true
      AND ST_Distance(l.coordinates, ST_SetSRID(ST_Point($1, $2), 4326)) <= $3
  `

  // If username is provided, add a filter to the query
  if (username) {
    query += ` AND u.username ILIKE $4`
  }

  query += ` ORDER BY distance ASC;` // Ensure users are ordered by distance

  // Radius is passed as meters, so convert it to an integer
  const radiusInMeters = parseInt(radius)

  try {
    const result = username
      ? await pool.query(query, [
          longitude,
          latitude,
          radiusInMeters,
          `%${username}%`,
        ]) // Include username filter
      : await pool.query(query, [longitude, latitude, radiusInMeters])

    response.status(200).json(result.rows)
  } catch (error) {
    console.error(error)
    response.status(500).json({ message: 'Error fetching nearby users' })
  }
})

module.exports = router
