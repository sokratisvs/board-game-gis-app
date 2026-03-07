const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const multer = require('multer')
const { requireAuth } = require('../middleware/requireAdmin')

const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars')
try {
  fs.mkdirSync(uploadsDir, { recursive: true })
} catch (e) {
  // ignore if exists
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = (file.originalname && path.extname(file.originalname)) || '.jpg'
      const safe = ext.toLowerCase().match(/\.(jpe?g|png|gif|webp)$/) ? ext : '.jpg'
      cb(null, `${req.session.user.id}_${Date.now()}${safe}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype && /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)
    cb(null, !!ok)
  },
})

/**
 * GET /api/profile
 * Profile screen. Contract: ProfileData { user, stats, playStyle, games, recentBattlefields }.
 * - Avatar: only the URL is stored in Postgres (avatar_uri); images live on disk (server/uploads/avatars/).
 * - Stats: computed on read from user_route_checkpoint_completions + route_checkpoints (one aggregation query).
 *   For very high scale, consider a materialized stats table updated when checkpoints are completed.
 */
router.get('/profile', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const userId = req.session.user.id

  try {
    const [userResult, configResult, battlefieldsResult, explorationStatsResult] = await Promise.all([
      pool.query(
        'SELECT user_id, username, interests FROM users WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        `SELECT display_name, subtitle, avatar_uri, level, play_style_tier
         FROM user_boardgames_config WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        'SELECT id, name, image_uri, last_match_at, xp_delta FROM user_recent_battlefields WHERE user_id = $1 ORDER BY last_match_at',
        [userId]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS clues_collected,
           COALESCE(SUM(rcp.xp_awarded), 0)::int AS experience_points,
           COUNT(DISTINCT rcp.route_id)::int AS routes_completed
         FROM user_route_checkpoint_completions u
         JOIN route_checkpoints rcp ON rcp.id = u.checkpoint_id
         WHERE u.user_id = $1`,
        [userId]
      ).catch(() => ({ rows: [{ clues_collected: 0, experience_points: 0, routes_completed: 0 }] })),
    ])

    const userRow = userResult.rows[0]
    const config = configResult.rows[0]
    const battlefields = battlefieldsResult.rows || []
    const expStats = explorationStatsResult.rows?.[0]

    if (!userRow) {
      return res.status(404).json({ message: 'User not found' })
    }

    const interests = Array.isArray(userRow.interests)
      ? userRow.interests
      : typeof userRow.interests === 'string'
        ? (() => {
            try {
              const a = JSON.parse(userRow.interests)
              return Array.isArray(a) ? a : []
            } catch {
              return []
            }
          })()
        : []

    const profile = {
      user: {
        displayName: config?.display_name || userRow.username,
        subtitle: config?.subtitle ?? undefined,
        avatarUri: config?.avatar_uri ?? null,
        level: config?.level ?? 0,
      },
      stats: {
        cluesCollected: expStats?.clues_collected ?? 0,
        experiencePoints: expStats?.experience_points ?? 0,
        routesCompleted: expStats?.routes_completed ?? 0,
      },
      playStyle: {
        tier: config?.play_style_tier ?? undefined,
        tags: interests,
      },
      games: [],
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

/**
 * POST /api/profile/avatar
 * Contract: multipart/form-data with file field "avatar". Returns { avatarUri: string }.
 * Images are stored on disk; Postgres holds only the path. For CDN later: upload to S3/R2, store CDN URL in avatar_uri.
 */
router.post('/profile/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Missing file: send multipart/form-data with field "avatar"' })
  }
  const pool = req.app.get('pool')
  const userId = req.session.user.id
  const relativePath = `/api/uploads/avatars/${req.file.filename}`
  try {
    await pool.query(
      `INSERT INTO user_boardgames_config (user_id, avatar_uri, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET avatar_uri = EXCLUDED.avatar_uri, updated_at = CURRENT_TIMESTAMP`,
      [userId, relativePath]
    )
    res.status(200).json({ avatarUri: relativePath })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error saving avatar' })
  }
})

module.exports = router
