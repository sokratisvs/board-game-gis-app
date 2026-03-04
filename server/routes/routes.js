const express = require('express')
const router = express.Router()
const { requireAuth, requireAdmin } = require('../middleware/requireAdmin')

/**
 * Load route by id (routes.id). Returns route row or 404.
 */
async function getRoute (pool, routeId) {
  const result = await pool.query(
    'SELECT id, type FROM routes WHERE id = $1',
    [routeId]
  )
  return result.rows[0] || null
}

/**
 * Validate checkpoint body for route type: real → lat/lng required; fantasy → scene required.
 */
function validateCheckpointForRoute (route, body) {
  if (route.type === 'real') {
    const lat = body.lat
    const lng = body.lng
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      return { valid: false, message: 'Real routes require lat and lng' }
    }
  }
  if (route.type === 'fantasy') {
    const scene = body.scene
    if (scene == null || String(scene).trim() === '') {
      return { valid: false, message: 'Fantasy routes require scene' }
    }
  }
  return { valid: true }
}

function mapCheckpointRow (row) {
  const out = {
    id: row.id,
    routeId: row.route_id,
    title: row.title,
    description: row.description,
    orderIndex: row.order_index,
    lat: row.lat != null ? parseFloat(row.lat) : null,
    lng: row.lng != null ? parseFloat(row.lng) : null,
    validationRadiusMeters: row.validation_radius_meters ?? null,
    scene: row.scene,
    createdAt: row.created_at,
  }
  if (row.clue !== undefined) out.clue = row.clue
  if (row.knowledge_card !== undefined) out.knowledgeCard = row.knowledge_card || null
  if (row.xp_awarded !== undefined) out.xpAwarded = row.xp_awarded ?? 0
  return out
}

/**
 * GET /api/routes/:id/checkpoints
 * List checkpoints for a route (routes.id). Auth required.
 */
router.get('/routes/:id/checkpoints', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: routeId } = req.params
  try {
    const route = await getRoute(pool, routeId)
    if (!route) {
      return res.status(404).json({ message: 'Route not found' })
    }
    const result = await pool.query(
      `SELECT id, route_id, title, description, order_index, lat, lng, validation_radius_meters, scene, clue, knowledge_card, xp_awarded, created_at
       FROM checkpoints
       WHERE route_id = $1
       ORDER BY order_index`,
      [routeId]
    )
    res.json(result.rows.map(mapCheckpointRow))
  } catch (err) {
    if (err.code === '42P01') {
      return res.json([])
    }
    console.error(err)
    res.status(500).json({ message: 'Error listing checkpoints' })
  }
})

/**
 * POST /api/routes/:id/checkpoints
 * Create checkpoint. Admin. Real route → lat/lng required; fantasy → scene required.
 */
router.post('/routes/:id/checkpoints', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: routeId } = req.params
  const { title, description, order_index, lat, lng, validation_radius_meters, scene, clue, knowledge_card, xp_awarded } = req.body || {}
  try {
    const route = await getRoute(pool, routeId)
    if (!route) {
      return res.status(404).json({ message: 'Route not found' })
    }
    const validation = validateCheckpointForRoute(route, { lat, lng, scene })
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message })
    }
    const orderIndex = order_index != null ? Number(order_index) : 0
    const xp = xp_awarded != null ? Number(xp_awarded) : 0
    const result = await pool.query(
      `INSERT INTO checkpoints (route_id, title, description, order_index, lat, lng, validation_radius_meters, scene, clue, knowledge_card, xp_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, route_id, title, description, order_index, lat, lng, validation_radius_meters, scene, clue, knowledge_card, xp_awarded, created_at`,
      [
        routeId,
        title ?? null,
        description ?? null,
        orderIndex,
        lat != null ? Number(lat) : null,
        lng != null ? Number(lng) : null,
        validation_radius_meters != null ? Number(validation_radius_meters) : null,
        scene != null ? String(scene).trim() : null,
        clue != null ? String(clue).trim() : null,
        knowledge_card && typeof knowledge_card === 'object' ? JSON.stringify(knowledge_card) : null,
        xp,
      ]
    )
    res.status(201).json(mapCheckpointRow(result.rows[0]))
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'checkpoints table not found; run migration 011' })
    }
    if (err.code === '23503') {
      return res.status(404).json({ message: 'Route not found' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error creating checkpoint' })
  }
})

/**
 * PATCH /api/routes/:id/checkpoints/:checkpointId
 * Update checkpoint. Admin. Same validation by route type.
 */
router.patch('/routes/:id/checkpoints/:checkpointId', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: routeId, checkpointId } = req.params
  const { title, description, order_index, lat, lng, validation_radius_meters, scene, clue, knowledge_card, xp_awarded } = req.body || {}
  try {
    const route = await getRoute(pool, routeId)
    if (!route) {
      return res.status(404).json({ message: 'Route not found' })
    }
    const existing = await pool.query(
      'SELECT id, lat, lng, scene FROM checkpoints WHERE id = $1 AND route_id = $2',
      [checkpointId, routeId]
    )
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    const current = existing.rows[0]
    const merged = {
      lat: lat !== undefined ? lat : current.lat,
      lng: lng !== undefined ? lng : current.lng,
      scene: scene !== undefined ? scene : current.scene,
    }
    const validation = validateCheckpointForRoute(route, merged)
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message })
    }
    const updates = []
    const values = []
    let p = 1
    if (title !== undefined) {
      updates.push(`title = $${p++}`)
      values.push(title)
    }
    if (description !== undefined) {
      updates.push(`description = $${p++}`)
      values.push(description)
    }
    if (order_index !== undefined) {
      updates.push(`order_index = $${p++}`)
      values.push(Number(order_index))
    }
    if (lat !== undefined) {
      updates.push(`lat = $${p++}`)
      values.push(lat != null ? Number(lat) : null)
    }
    if (lng !== undefined) {
      updates.push(`lng = $${p++}`)
      values.push(lng != null ? Number(lng) : null)
    }
    if (validation_radius_meters !== undefined) {
      updates.push(`validation_radius_meters = $${p++}`)
      values.push(validation_radius_meters != null ? Number(validation_radius_meters) : null)
    }
    if (scene !== undefined) {
      updates.push(`scene = $${p++}`)
      values.push(scene != null ? String(scene).trim() : null)
    }
    if (clue !== undefined) {
      updates.push(`clue = $${p++}`)
      values.push(clue != null ? String(clue).trim() : null)
    }
    if (knowledge_card !== undefined) {
      updates.push(`knowledge_card = $${p++}`)
      values.push(knowledge_card && typeof knowledge_card === 'object' ? JSON.stringify(knowledge_card) : null)
    }
    if (xp_awarded !== undefined) {
      updates.push(`xp_awarded = $${p++}`)
      values.push(Number(xp_awarded) || 0)
    }
    if (updates.length === 0) {
      const row = await pool.query(
        'SELECT id, route_id, title, description, order_index, lat, lng, validation_radius_meters, scene, clue, knowledge_card, xp_awarded, created_at FROM checkpoints WHERE id = $1',
        [checkpointId]
      )
      return res.json(mapCheckpointRow(row.rows[0]))
    }
    values.push(checkpointId, routeId)
    const result = await pool.query(
      `UPDATE checkpoints SET ${updates.join(', ')} WHERE id = $${p} AND route_id = $${p + 1}
       RETURNING id, route_id, title, description, order_index, lat, lng, validation_radius_meters, scene, clue, knowledge_card, xp_awarded, created_at`,
      values
    )
    res.json(mapCheckpointRow(result.rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error updating checkpoint' })
  }
})

/**
 * DELETE /api/routes/:id/checkpoints/:checkpointId
 * Delete checkpoint. Admin.
 */
router.delete('/routes/:id/checkpoints/:checkpointId', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: routeId, checkpointId } = req.params
  try {
    const result = await pool.query(
      'DELETE FROM checkpoints WHERE id = $1 AND route_id = $2 RETURNING id',
      [checkpointId, routeId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error deleting checkpoint' })
  }
})

/**
 * GET /api/routes/:id/play/checkpoint/:order
 * Play flow (new routes table): unlock content for checkpoint at 0-based order.
 * Response: { nextCheckpointId, nextOrderIndex, clue, knowledgeCard, xpAwarded, nearbyRecommendations }.
 * Fantasy routes: no GPS; nearbyRecommendations = [].
 */
router.get('/routes/:id/play/checkpoint/:order', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: routeId, order } = req.params
  const seq = parseInt(order, 10)
  if (Number.isNaN(seq) || seq < 0) {
    return res.status(400).json({ message: 'Invalid order' })
  }
  try {
    const route = await getRoute(pool, routeId)
    if (!route) {
      return res.status(404).json({ message: 'Route not found' })
    }
    const list = await pool.query(
      `SELECT id, order_index, clue, knowledge_card, xp_awarded
       FROM checkpoints
       WHERE route_id = $1
       ORDER BY order_index`,
      [routeId]
    )
    const current = list.rows[seq] || null
    if (!current) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    const next = list.rows[seq + 1] || null
    res.json({
      nextCheckpointId: next?.id ?? null,
      nextOrderIndex: next != null ? next.order_index : null,
      clue: current.clue ?? '',
      knowledgeCard: current.knowledge_card || null,
      xpAwarded: current.xp_awarded ?? 0,
      nearbyRecommendations: route.type === 'fantasy' ? [] : [],
    })
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ message: 'Route not found' })
    console.error(err)
    res.status(500).json({ message: 'Error fetching checkpoint' })
  }
})

module.exports = router
