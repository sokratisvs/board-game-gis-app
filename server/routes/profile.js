const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/requireAdmin')

/**
 * GET /api/profile
 * Mobile app: Profile screen. Returns ProfileData shape (user, stats, playStyle, games, recentBattlefields).
 * Aggregates from users + user_boardgames_config; stats/battlefields stubbed until we have those tables.
 */
router.get('/profile', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const userId = req.session.user.id

  try {
    const [userResult, configResult, battlefieldsResult] = await Promise.all([
      pool.query(
        'SELECT user_id, username FROM users WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        `SELECT games_owned, games_liked, game_types_interested,
                display_name, subtitle, avatar_uri, level, play_style_tier,
                matches_count, wins_count, titles_count
         FROM user_boardgames_config WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        'SELECT id, name, image_uri, last_match_at, xp_delta FROM user_recent_battlefields WHERE user_id = $1 ORDER BY last_match_at',
        [userId]
      ),
    ])

    const userRow = userResult.rows[0]
    const config = configResult.rows[0]
    const battlefields = battlefieldsResult.rows || []

    if (!userRow) {
      return res.status(404).json({ message: 'User not found' })
    }

    const gamesOwned = Array.isArray(config?.games_owned) ? config.games_owned : []
    const gameTypes = Array.isArray(config?.game_types_interested) ? config.game_types_interested : []

    const profile = {
      user: {
        displayName: config?.display_name || userRow.username,
        subtitle: config?.subtitle ?? null,
        avatarUri: config?.avatar_uri ?? null,
        level: config?.level ?? 0,
      },
      stats: {
        matches: config?.matches_count ?? 0,
        wins: config?.wins_count ?? 0,
        titles: config?.titles_count ?? 0,
      },
      playStyle: {
        tier: config?.play_style_tier ?? null,
        tags: gameTypes,
      },
      games: gamesOwned.map((name, i) => ({
        id: String(i + 1),
        name: typeof name === 'string' ? name : String(name),
        imageUri: null,
      })),
      recentBattlefields: battlefields.map((b) => ({
        id: b.id,
        name: b.name,
        imageUri: b.image_uri ?? null,
        lastMatchAt: b.last_match_at,
        xpDelta: b.xp_delta,
      })),
    }

    res.status(200).json(profile)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error fetching profile' })
  }
})

module.exports = router
