const express = require('express')
const router = express.Router()
const { requireAuth, requireAdmin } = require('../middleware/requireAdmin')

function mapPlaceRow (row) {
  let lat = null
  let lng = null
  if (row.location) {
    const r = row.location.match(/POINT\(([\d.-]+)\s+([\d.-]+)\)/)
    if (r) {
      lng = parseFloat(r[1])
      lat = parseFloat(r[2])
    }
  }
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    lat,
    lng,
    description: row.description,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  }
}

/**
 * GET /api/places
 * List places. Optional: ?lat=&lng=&radius= (meters) for radius query via ST_DWithin.
 */
router.get('/places', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { lat, lng, radius } = req.query
  const hasRadius = lat != null && lng != null && radius != null &&
    !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)) && !Number.isNaN(Number(radius))
  const radiusM = hasRadius ? Math.max(0, Number(radius)) : 300
  try {
    let result
    if (hasRadius) {
      result = await pool.query(
        `SELECT id, name, category, ST_AsText(location) AS location, description, is_active, created_at
         FROM places
         WHERE is_active = TRUE
           AND location IS NOT NULL
           AND ST_DWithin(
               location,
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
               $3
             )
         ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
         LIMIT 50`,
        [Number(lng), Number(lat), radiusM]
      )
    } else {
      result = await pool.query(
        `SELECT id, name, category, ST_AsText(location) AS location, description, is_active, created_at
         FROM places
         WHERE is_active = TRUE
         ORDER BY name
         LIMIT 100`
      )
    }
    res.json(result.rows.map(mapPlaceRow))
  } catch (err) {
    if (err.code === '42P01') return res.json([])
    console.error(err)
    res.status(500).json({ message: 'Error listing places' })
  }
})

/**
 * GET /api/places/:id
 */
router.get('/places/:id', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT id, name, category, ST_AsText(location) AS location, description, is_active, created_at
       FROM places WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Place not found' })
    }
    res.json(mapPlaceRow(result.rows[0]))
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ message: 'Place not found' })
    console.error(err)
    res.status(500).json({ message: 'Error fetching place' })
  }
})

/**
 * POST /api/places
 * Create place. Admin. Body: name, category, lat, lng, description?, is_active?
 */
router.post('/places', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { name, category, lat, lng, description, is_active } = req.body || {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'name is required' })
  }
  const cat = ['museum', 'cafe', 'monument', 'restaurant'].includes(category) ? category : null
  if (!cat) {
    return res.status(400).json({ message: 'category must be one of: museum, cafe, monument, restaurant' })
  }
  const hasCoords = lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
  try {
    const result = await pool.query(
      hasCoords
        ? `INSERT INTO places (name, category, location, description, is_active)
           VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6)
           RETURNING id, name, category, ST_AsText(location) AS location, description, is_active, created_at`
        : `INSERT INTO places (name, category, location, description, is_active)
           VALUES ($1, $2, NULL, $3, $4)
           RETURNING id, name, category, ST_AsText(location) AS location, description, is_active, created_at`,
      hasCoords
        ? [name.trim(), cat, Number(lng), Number(lat), description?.trim() || null, is_active !== false]
        : [name.trim(), cat, description?.trim() || null, is_active !== false]
    )
    res.status(201).json(mapPlaceRow(result.rows[0]))
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'places table not found; run migration 015' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error creating place' })
  }
})

/**
 * PATCH /api/places/:id
 * Update place. Admin.
 */
router.patch('/places/:id', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  const { name, category, lat, lng, description, is_active } = req.body || {}
  try {
    const existing = await pool.query(
      'SELECT id, name, category, ST_AsText(location) AS location, description, is_active FROM places WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Place not found' })
    }
    const updates = []
    const values = []
    let p = 1
    if (name !== undefined) {
      updates.push(`name = $${p++}`)
      values.push(String(name).trim())
    }
    if (category !== undefined) {
      if (!['museum', 'cafe', 'monument', 'restaurant'].includes(category)) {
        return res.status(400).json({ message: 'category must be one of: museum, cafe, monument, restaurant' })
      }
      updates.push(`category = $${p++}`)
      values.push(category)
    }
    if (lat !== undefined && lng !== undefined && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
      updates.push(`location = ST_SetSRID(ST_MakePoint($${p}, $${p + 1}), 4326)::geography`)
      values.push(Number(lng), Number(lat))
      p += 2
    }
    if (description !== undefined) {
      updates.push(`description = $${p++}`)
      values.push(description?.trim() || null)
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${p++}`)
      values.push(!!is_active)
    }
    if (updates.length === 0) {
      return res.json(mapPlaceRow(existing.rows[0]))
    }
    values.push(id)
    const result = await pool.query(
      `UPDATE places SET ${updates.join(', ')} WHERE id = $${p}
       RETURNING id, name, category, ST_AsText(location) AS location, description, is_active, created_at`,
      values
    )
    res.json(mapPlaceRow(result.rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error updating place' })
  }
})

/**
 * DELETE /api/places/:id
 * Admin.
 */
router.delete('/places/:id', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const result = await pool.query('DELETE FROM places WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Place not found' })
    }
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error deleting place' })
  }
})

module.exports = router
