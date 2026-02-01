const express = require('express')
const router = express.Router()
const { requireAdminOrSelf } = require('../middleware/requireAdmin')

const VALID_SUBSCRIPTION = ['free', 'extra']

/**
 * GET /users/:id/config
 * Returns board games config for a user. Admin or self.
 */
router.get('/users/:id/config', requireAdminOrSelf, async (req, res) => {
  const pool = req.app.get('pool')
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid user ID' })
  }
  try {
    const result = await pool.query(
      `SELECT user_id, games_owned, games_liked, game_types_interested, has_space, city, subscription, updated_at
       FROM user_boardgames_config WHERE user_id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(200).json({
        user_id: id,
        games_owned: [],
        games_liked: [],
        game_types_interested: [],
        has_space: false,
        city: null,
        subscription: 'free',
        updated_at: null,
      })
    }
    const row = result.rows[0]
    res.status(200).json({
      user_id: row.user_id,
      games_owned: row.games_owned || [],
      games_liked: row.games_liked || [],
      game_types_interested: row.game_types_interested || [],
      has_space: row.has_space ?? false,
      city: row.city,
      subscription: row.subscription || 'free',
      updated_at: row.updated_at,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error fetching config' })
  }
})

/**
 * PUT /users/:id/config
 * Upsert board games config. Admin or self.
 */
router.put('/users/:id/config', requireAdminOrSelf, async (req, res) => {
  const pool = req.app.get('pool')
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid user ID' })
  }
  const {
    games_owned,
    games_liked,
    game_types_interested,
    has_space,
    city,
    subscription,
  } = req.body

  const sub =
    subscription && VALID_SUBSCRIPTION.includes(subscription)
      ? subscription
      : 'free'
  const owned = Array.isArray(games_owned) ? games_owned : []
  const liked = Array.isArray(games_liked) ? games_liked : []
  const types = Array.isArray(game_types_interested)
    ? game_types_interested
    : []
  const space = Boolean(has_space)
  const cityVal = city != null ? String(city).trim().slice(0, 120) : null

  try {
    await pool.query(
      `INSERT INTO user_boardgames_config (user_id, games_owned, games_liked, game_types_interested, has_space, city, subscription, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7::subscription_tier, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         games_owned = EXCLUDED.games_owned,
         games_liked = EXCLUDED.games_liked,
         game_types_interested = EXCLUDED.game_types_interested,
         has_space = EXCLUDED.has_space,
         city = EXCLUDED.city,
         subscription = EXCLUDED.subscription,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        JSON.stringify(owned),
        JSON.stringify(liked),
        JSON.stringify(types),
        space,
        cityVal,
        sub,
      ]
    )
    const result = await pool.query(
      `SELECT user_id, games_owned, games_liked, game_types_interested, has_space, city, subscription, updated_at
       FROM user_boardgames_config WHERE user_id = $1`,
      [id]
    )
    const row = result.rows[0]
    res.status(200).json({
      user_id: row.user_id,
      games_owned: row.games_owned || [],
      games_liked: row.games_liked || [],
      game_types_interested: row.game_types_interested || [],
      has_space: row.has_space ?? false,
      city: row.city,
      subscription: row.subscription || 'free',
      updated_at: row.updated_at,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error saving config' })
  }
})

module.exports = router
