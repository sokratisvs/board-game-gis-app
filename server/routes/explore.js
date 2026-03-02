const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/requireAdmin')

const DEFAULT_RADIUS_M = 5000

/**
 * GET /api/explore?lat=&lng=
 * Mobile app: map, current match bar, nearby events. WGS84.
 * Returns ExploreData: userPosition, currentMatch (null for now), nearbyEvents.
 */
router.get('/explore', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const lat = parseFloat(req.query.lat)
  const lng = parseFloat(req.query.lng)

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ message: 'Query params lat and lng (numbers) required' })
  }

  try {
    const distanceM = DEFAULT_RADIUS_M
    const eventsResult = await pool.query(
      `SELECT id, title, subtitle, ST_X(position) as lng, ST_Y(position) as lat,
              image_uri, reward_label, is_active, type
       FROM explore_events
       WHERE position IS NOT NULL
         AND ST_DWithin(position::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY position <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       LIMIT 50`,
      [lng, lat, distanceM]
    )

    const nearbyEvents = eventsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle || undefined,
      position: { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
      imageUri: row.image_uri || null,
      rewardLabel: row.reward_label || undefined,
      isActive: row.is_active,
      type: row.type || 'other',
    }))

    const explore = {
      userPosition: { lat, lng },
      currentMatch: null,
      nearbyEvents,
    }

    res.status(200).json(explore)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error fetching explore data' })
  }
})

module.exports = router
