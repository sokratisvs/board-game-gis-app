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
      `SELECT user_id, games_owned, games_liked, game_types_interested, has_space, city, subscription, updated_at,
              display_name, subtitle, avatar_uri, level, play_style_tier, matches_count, wins_count, titles_count
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
        display_name: null,
        subtitle: null,
        avatar_uri: null,
        level: 0,
        play_style_tier: null,
        matches_count: 0,
        wins_count: 0,
        titles_count: 0,
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
      display_name: row.display_name ?? null,
      subtitle: row.subtitle ?? null,
      avatar_uri: row.avatar_uri ?? null,
      level: row.level ?? 0,
      play_style_tier: row.play_style_tier ?? null,
      matches_count: row.matches_count ?? 0,
      wins_count: row.wins_count ?? 0,
      titles_count: row.titles_count ?? 0,
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
    display_name,
    subtitle,
    avatar_uri,
    level,
    play_style_tier,
    matches_count,
    wins_count,
    titles_count,
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
  const dispName = display_name != null ? String(display_name).trim().slice(0, 120) : null
  const subVal = subtitle != null ? String(subtitle).trim().slice(0, 200) : null
  const avatarVal = avatar_uri != null ? String(avatar_uri).trim() : null
  const levelVal = Number.isInteger(level) ? level : (parseInt(level, 10) || 0)
  const tierVal = play_style_tier != null ? String(play_style_tier).trim().slice(0, 50) : null
  const matchesVal = Number.isInteger(matches_count) ? matches_count : (parseInt(matches_count, 10) || 0)
  const winsVal = Number.isInteger(wins_count) ? wins_count : (parseInt(wins_count, 10) || 0)
  const titlesVal = Number.isInteger(titles_count) ? titles_count : (parseInt(titles_count, 10) || 0)

  try {
    await pool.query(
      `INSERT INTO user_boardgames_config (
         user_id, games_owned, games_liked, game_types_interested, has_space, city, subscription, updated_at,
         display_name, subtitle, avatar_uri, level, play_style_tier, matches_count, wins_count, titles_count
       ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7::subscription_tier, CURRENT_TIMESTAMP,
                 $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (user_id) DO UPDATE SET
         games_owned = EXCLUDED.games_owned,
         games_liked = EXCLUDED.games_liked,
         game_types_interested = EXCLUDED.game_types_interested,
         has_space = EXCLUDED.has_space,
         city = EXCLUDED.city,
         subscription = EXCLUDED.subscription,
         updated_at = CURRENT_TIMESTAMP,
         display_name = COALESCE(EXCLUDED.display_name, user_boardgames_config.display_name),
         subtitle = COALESCE(EXCLUDED.subtitle, user_boardgames_config.subtitle),
         avatar_uri = COALESCE(EXCLUDED.avatar_uri, user_boardgames_config.avatar_uri),
         level = EXCLUDED.level,
         play_style_tier = COALESCE(EXCLUDED.play_style_tier, user_boardgames_config.play_style_tier),
         matches_count = EXCLUDED.matches_count,
         wins_count = EXCLUDED.wins_count,
         titles_count = EXCLUDED.titles_count`,
      [
        id,
        JSON.stringify(owned),
        JSON.stringify(liked),
        JSON.stringify(types),
        space,
        cityVal,
        sub,
        dispName,
        subVal,
        avatarVal,
        levelVal,
        tierVal,
        matchesVal,
        winsVal,
        titlesVal,
      ]
    )
    const result = await pool.query(
      `SELECT user_id, games_owned, games_liked, game_types_interested, has_space, city, subscription, updated_at,
              display_name, subtitle, avatar_uri, level, play_style_tier, matches_count, wins_count, titles_count
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
      display_name: row.display_name ?? null,
      subtitle: row.subtitle ?? null,
      avatar_uri: row.avatar_uri ?? null,
      level: row.level ?? 0,
      play_style_tier: row.play_style_tier ?? null,
      matches_count: row.matches_count ?? 0,
      wins_count: row.wins_count ?? 0,
      titles_count: row.titles_count ?? 0,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error saving config' })
  }
})

module.exports = router
