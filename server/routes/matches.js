const express = require('express')
const router = express.Router()
const { requireAuth, requireAdmin } = require('../middleware/requireAdmin')

function toEventSessionPlayer(row, currentTurnUserId) {
  return {
    id: String(row.user_id),
    displayName: row.display_name,
    healthPercent: row.health_percent,
    manaCurrent: row.mana_current,
    manaMax: row.mana_max,
    order: row.order,
    isCurrentTurn: row.user_id === currentTurnUserId,
  }
}

function toEventSessionState(matchRow, playerRows, currentTurnUserId) {
  const players = playerRows
    .sort((a, b) => a.order - b.order)
    .map((r) => toEventSessionPlayer(r, currentTurnUserId))
  const currentPlayer =
    players.find((p) => p.id === String(currentTurnUserId)) ||
    players[0] ||
    null
  const lastDice = Array.isArray(matchRow.last_dice_values)
    ? matchRow.last_dice_values
    : []
  return {
    matchId: matchRow.id,
    zoneName: matchRow.zone_name || '',
    matchType: matchRow.match_type || 'other',
    startTime: matchRow.start_time || null,
    endTime: matchRow.end_time || null,
    gameName: matchRow.game_name || null,
    zonePosition:
      matchRow.zone_lat != null && matchRow.zone_lng != null
        ? { lat: matchRow.zone_lat, lng: matchRow.zone_lng }
        : undefined,
    currentPlayer,
    players,
    currentTurnPlayerId: currentTurnUserId ? String(currentTurnUserId) : null,
    unreadChatCount: matchRow.unread_chat_count ?? 0,
    lastDiceValues: lastDice,
    gridSize:
      matchRow.grid_rows != null && matchRow.grid_cols != null
        ? { rows: matchRow.grid_rows, cols: matchRow.grid_cols }
        : undefined,
    highlightedCell:
      matchRow.highlighted_row != null && matchRow.highlighted_col != null
        ? { row: matchRow.highlighted_row, col: matchRow.highlighted_col }
        : null,
  }
}

/**
 * GET /api/matches
 * List matches for map (admin and users): lat, lng, optional radius, optional type filter.
 * Returns [{ matchId, zoneName, zonePosition, matchType, startTime, endTime, gameName, playerCount, created_at }].
 */
const VALID_MATCH_TYPES = ['tournament', 'casual', 'campaign', 'other']
const DEFAULT_LIST_RADIUS_M = 50000

async function queryMatchWithOptionalColumns(pool, matchId) {
  const baseCols =
    'id, zone_name, zone_lat, zone_lng, current_turn_user_id, unread_chat_count, last_dice_values, grid_rows, grid_cols, highlighted_row, highlighted_col'
  let optionalCols = ['match_type', 'start_time', 'end_time', 'game_name']
  while (true) {
    try {
      const result = await pool.query(
        `SELECT ${baseCols}${optionalCols.length ? `, ${optionalCols.join(', ')}` : ''} FROM matches WHERE id = $1`,
        [matchId]
      )
      const row = result.rows[0]
      if (row) {
        if (!optionalCols.includes('match_type')) row.match_type = 'other'
        if (!optionalCols.includes('start_time')) row.start_time = null
        if (!optionalCols.includes('end_time')) row.end_time = null
        if (!optionalCols.includes('game_name')) row.game_name = null
      }
      return result
    } catch (err) {
      const msg = String(err.message || '')
      const missingOptional = optionalCols.find(
        (c) =>
          err.code === '42703' &&
          msg.includes(c) &&
          msg.includes('does not exist')
      )
      if (!missingOptional) throw err
      optionalCols = optionalCols.filter((c) => c !== missingOptional)
    }
  }
}

function parseDateFilter(val) {
  if (!val || typeof val !== 'string') return null
  const d = new Date(val.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

router.get('/matches', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const lat = parseFloat(req.query.lat)
  const lng = parseFloat(req.query.lng)
  const radius = parseInt(req.query.radius, 10) || DEFAULT_LIST_RADIUS_M
  const typeFilter = req.query.type
  const dateFrom = parseDateFilter(req.query.dateFrom)
  const dateTo = parseDateFilter(req.query.dateTo)

  const hasGeo = !Number.isNaN(lat) && !Number.isNaN(lng)
  const typeOk =
    !typeFilter || VALID_MATCH_TYPES.includes(String(typeFilter).toLowerCase())

  try {
    let conditions = []
    let params = []
    let paramCount = 1

    if (typeOk && typeFilter) {
      conditions.push(`m.match_type = $${paramCount}`)
      params.push(String(typeFilter).toLowerCase())
      paramCount++
    }
    if (hasGeo) {
      conditions.push(`m.zone_lat IS NOT NULL AND m.zone_lng IS NOT NULL`)
      conditions.push(
        `ST_DWithin(
          ST_SetSRID(ST_MakePoint(m.zone_lng, m.zone_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint($${paramCount}, $${paramCount + 1}), 4326)::geography,
          $${paramCount + 2}
        )`
      )
      params.push(lng, lat, radius)
    }
    if (dateFrom) {
      conditions.push(
        `(m.start_time IS NOT NULL AND m.start_time >= $${paramCount})`
      )
      params.push(dateFrom.toISOString())
      paramCount++
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      conditions.push(
        `(m.start_time IS NOT NULL AND m.start_time <= $${paramCount})`
      )
      params.push(endOfDay.toISOString())
      paramCount++
    }

    const whereClause =
      conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
    const limit = hasGeo ? 100 : 200
    let result
    try {
      result = await pool.query(
        `SELECT m.id, m.zone_name, m.zone_lat, m.zone_lng, m.match_type, m.start_time, m.end_time, m.game_name, m.created_at,
                (SELECT COUNT(*) FROM match_players mp WHERE mp.match_id = m.id) AS player_count
         FROM matches m
         ${whereClause}
         ORDER BY m.created_at DESC
         LIMIT ${limit}`,
        params
      )
    } catch (listErr) {
      const msg = String(listErr.message || '')
      const noMatchType =
        listErr.code === '42703' &&
        msg.includes('match_type') &&
        msg.includes('does not exist')
      const noStartTime =
        listErr.code === '42703' &&
        msg.includes('start_time') &&
        msg.includes('does not exist')
      const noEndTime =
        listErr.code === '42703' &&
        msg.includes('end_time') &&
        msg.includes('does not exist')
      const noGameName =
        listErr.code === '42703' &&
        msg.includes('game_name') &&
        msg.includes('does not exist')
      if (noMatchType || noStartTime || noEndTime || noGameName) {
        const conds = []
        const prms = []
        let p = 1
        if (!noMatchType && typeOk && typeFilter) {
          conds.push(`m.match_type = $${p}`)
          prms.push(String(typeFilter).toLowerCase())
          p++
        }
        if (hasGeo) {
          conds.push(`m.zone_lat IS NOT NULL AND m.zone_lng IS NOT NULL`)
          conds.push(
            `ST_DWithin(
              ST_SetSRID(ST_MakePoint(m.zone_lng, m.zone_lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($${p}, $${p + 1}), 4326)::geography,
              $${p + 2}
            )`
          )
          prms.push(lng, lat, radius)
        }
        if (!noStartTime && dateFrom) {
          conds.push(`(m.start_time IS NOT NULL AND m.start_time >= $${p})`)
          prms.push(dateFrom.toISOString())
          p++
        }
        if (!noStartTime && dateTo) {
          const endOfDay = new Date(dateTo)
          endOfDay.setHours(23, 59, 59, 999)
          conds.push(`(m.start_time IS NOT NULL AND m.start_time <= $${p})`)
          prms.push(endOfDay.toISOString())
          p++
        }
        const whereNoType =
          conds.length > 0 ? ` WHERE ${conds.join(' AND ')}` : ''
        const optionalSelect = [
          noStartTime ? null : 'm.start_time',
          noEndTime ? null : 'm.end_time',
          noGameName ? null : 'm.game_name',
        ]
          .filter(Boolean)
          .join(', ')
        const limitNoGeo = hasGeo ? 100 : 200
        result = await pool.query(
          `SELECT m.id, m.zone_name, m.zone_lat, m.zone_lng${
            optionalSelect ? `, ${optionalSelect}` : ''
          }, m.created_at,
                  (SELECT COUNT(*) FROM match_players mp WHERE mp.match_id = m.id) AS player_count
           FROM matches m
           ${whereNoType}
           ORDER BY m.created_at DESC
           LIMIT ${limitNoGeo}`,
          prms
        )
      } else {
        throw listErr
      }
    }

    const list = result.rows.map((row) => ({
      matchId: row.id,
      zoneName: row.zone_name || '',
      zonePosition:
        row.zone_lat != null && row.zone_lng != null
          ? { lat: parseFloat(row.zone_lat), lng: parseFloat(row.zone_lng) }
          : null,
      matchType: row.match_type || 'other',
      startTime: row.start_time || null,
      endTime: row.end_time || null,
      gameName: row.game_name || null,
      playerCount: parseInt(row.player_count, 10) || 0,
      created_at: row.created_at,
    }))

    res.status(200).json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error listing matches' })
  }
})

/**
 * GET /api/matches/stats
 * Dashboard stats: live/upcoming counts, optional type filter.
 * Live = matches with at least 2 players, Upcoming = less than 2 players.
 */
router.get('/matches/stats', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const typeFilter = req.query.type
  const typeOk =
    !typeFilter || VALID_MATCH_TYPES.includes(String(typeFilter).toLowerCase())

  try {
    const where = []
    const params = []
    if (typeOk && typeFilter) {
      where.push('m.match_type = $1')
      params.push(String(typeFilter).toLowerCase())
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    let result
    try {
      result = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE COALESCE(mp.player_count, 0) >= 2)::int AS live_count,
           COUNT(*) FILTER (WHERE COALESCE(mp.player_count, 0) < 2)::int AS upcoming_count,
           COUNT(*)::int AS total_count
         FROM matches m
         LEFT JOIN (
           SELECT match_id, COUNT(*)::int AS player_count
           FROM match_players
           GROUP BY match_id
         ) mp ON mp.match_id = m.id
         ${whereClause}`,
        params
      )
    } catch (statsErr) {
      const msg = String(statsErr.message || '')
      const noMatchType =
        statsErr.code === '42703' ||
        (msg.includes('match_type') && msg.includes('does not exist'))
      if (!noMatchType) throw statsErr
      result = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE COALESCE(mp.player_count, 0) >= 2)::int AS live_count,
           COUNT(*) FILTER (WHERE COALESCE(mp.player_count, 0) < 2)::int AS upcoming_count,
           COUNT(*)::int AS total_count
         FROM matches m
         LEFT JOIN (
           SELECT match_id, COUNT(*)::int AS player_count
           FROM match_players
           GROUP BY match_id
         ) mp ON mp.match_id = m.id`
      )
    }
    const row = result.rows[0] || {}
    return res.status(200).json({
      live: row.live_count || 0,
      upcoming: row.upcoming_count || 0,
      total: row.total_count || 0,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Error fetching matches stats' })
  }
})

/**
 * POST /api/matches
 * Create a new match. Body: { zoneName?, zonePosition?, matchType?, startTime?, endTime?, gameName? }. Creator is first player.
 */
router.post('/matches', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const userId = req.session.user.id
  const username = req.session.user.username
  const { zoneName, zonePosition, matchType, startTime, endTime, gameName } =
    req.body || {}
  const typeVal =
    matchType && VALID_MATCH_TYPES.includes(String(matchType).toLowerCase())
      ? String(matchType).toLowerCase()
      : 'other'
  const parsedStartTime =
    startTime && !Number.isNaN(Date.parse(String(startTime)))
      ? new Date(String(startTime)).toISOString()
      : null
  const parsedEndTime =
    endTime && !Number.isNaN(Date.parse(String(endTime)))
      ? new Date(String(endTime)).toISOString()
      : null
  const gameNameVal =
    gameName != null ? String(gameName).trim().slice(0, 120) : ''

  if (
    parsedStartTime &&
    parsedEndTime &&
    new Date(parsedEndTime) <= new Date(parsedStartTime)
  ) {
    return res
      .status(400)
      .json({ message: 'End time must be after start time' })
  }

  let matchResult
  const optionalInsertCols = [
    { name: 'match_type', value: typeVal },
    { name: 'start_time', value: parsedStartTime },
    { name: 'end_time', value: parsedEndTime },
    { name: 'game_name', value: gameNameVal },
  ]
  let activeOptionalCols = [...optionalInsertCols]
  while (!matchResult) {
    const cols = [
      'zone_name',
      'zone_lat',
      'zone_lng',
      ...activeOptionalCols.map((c) => c.name),
    ]
    const values = [
      zoneName || '',
      zonePosition?.lat ?? null,
      zonePosition?.lng ?? null,
      ...activeOptionalCols.map((c) => c.value),
    ]
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    try {
      matchResult = await pool.query(
        `INSERT INTO matches (${cols.join(', ')})
         VALUES (${placeholders})
         RETURNING id, zone_name, zone_lat, zone_lng, current_turn_user_id, unread_chat_count, last_dice_values,
                   grid_rows, grid_cols, highlighted_row, highlighted_col`,
        values
      )
    } catch (insertErr) {
      const msg = String(insertErr.message || '')
      const missingOptional = activeOptionalCols.find(
        (c) =>
          insertErr.code === '42703' &&
          msg.includes(c.name) &&
          msg.includes('does not exist')
      )
      if (!missingOptional) {
        console.error(insertErr)
        return res.status(500).json({ message: msg || 'Error creating match' })
      }
      activeOptionalCols = activeOptionalCols.filter(
        (c) => c.name !== missingOptional.name
      )
      if (activeOptionalCols.length === 0) {
        // next loop will run base insert only
      }
    }
  }
  const match = matchResult.rows[0]
  try {
    await pool.query(
      `INSERT INTO match_players (match_id, user_id, display_name, "order", is_current_turn)
       VALUES ($1, $2, $3, 0, true)`,
      [match.id, userId, username]
    )
    await pool.query(
      'UPDATE matches SET current_turn_user_id = $1 WHERE id = $2',
      [userId, match.id]
    )
    const selectCols =
      'id, zone_name, zone_lat, zone_lng, current_turn_user_id, unread_chat_count, last_dice_values, grid_rows, grid_cols, highlighted_row, highlighted_col'
    let matchRowRes
    let playersResult
    let optionalSelectCols = [
      'match_type',
      'start_time',
      'end_time',
      'game_name',
    ]
    while (!matchRowRes) {
      try {
        ;[matchRowRes, playersResult] = await Promise.all([
          pool.query(
            `SELECT ${selectCols}${optionalSelectCols.length ? `, ${optionalSelectCols.join(', ')}` : ''} FROM matches WHERE id = $1`,
            [match.id]
          ),
          pool.query(
            'SELECT user_id, display_name, health_percent, mana_current, mana_max, "order", is_current_turn FROM match_players WHERE match_id = $1',
            [match.id]
          ),
        ])
      } catch (selectErr) {
        const msg = String(selectErr.message || '')
        const missingOptional = optionalSelectCols.find(
          (c) =>
            selectErr.code === '42703' &&
            msg.includes(c) &&
            msg.includes('does not exist')
        )
        if (!missingOptional) throw selectErr
        optionalSelectCols = optionalSelectCols.filter(
          (c) => c !== missingOptional
        )
      }
    }
    if (matchRowRes.rows[0]) {
      if (!optionalSelectCols.includes('match_type'))
        matchRowRes.rows[0].match_type = 'other'
      if (!optionalSelectCols.includes('start_time'))
        matchRowRes.rows[0].start_time = null
      if (!optionalSelectCols.includes('end_time'))
        matchRowRes.rows[0].end_time = null
      if (!optionalSelectCols.includes('game_name'))
        matchRowRes.rows[0].game_name = null
    }
    const state = toEventSessionState(
      matchRowRes.rows[0],
      playersResult.rows,
      userId
    )
    res.status(201).json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message || 'Error creating match' })
  }
})

/**
 * POST /api/matches/:matchId/join
 * Join match as authenticated user. Returns full EventSessionState.
 */
router.post('/matches/:matchId/join', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const userId = req.session.user.id
  const username = req.session.user.username
  const matchId = req.params.matchId

  try {
    const matchResult = await pool.query(
      'SELECT id FROM matches WHERE id = $1',
      [matchId]
    )
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ message: 'Match not found' })
    }
    await pool.query(
      `INSERT INTO match_players (match_id, user_id, display_name, "order", is_current_turn)
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX("order"), -1) + 1 FROM match_players WHERE match_id = $1), false)
       ON CONFLICT (match_id, user_id) DO NOTHING`,
      [matchId, userId, username]
    )
    const [matchRow, playersResult] = await Promise.all([
      queryMatchWithOptionalColumns(pool, matchId),
      pool.query(
        'SELECT user_id, display_name, health_percent, mana_current, mana_max, "order", is_current_turn FROM match_players WHERE match_id = $1',
        [matchId]
      ),
    ])
    const match = matchRow.rows[0]
    const state = toEventSessionState(
      match,
      playersResult.rows,
      match.current_turn_user_id
    )
    res.status(200).json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error joining match' })
  }
})

/**
 * PATCH /api/matches/:matchId
 * Admin only. Update match: zoneName, zonePosition, matchType, startTime, endTime, gameName (partial).
 */
router.patch(
  '/matches/:matchId',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const matchId = req.params.matchId
    const { zoneName, zonePosition, matchType, startTime, endTime, gameName } =
      req.body || {}

    const typeVal =
      matchType !== undefined &&
      VALID_MATCH_TYPES.includes(String(matchType).toLowerCase())
        ? String(matchType).toLowerCase()
        : undefined
    const parsedStartTime =
      startTime !== undefined &&
      startTime !== null &&
      !Number.isNaN(Date.parse(String(startTime)))
        ? new Date(String(startTime)).toISOString()
        : undefined
    const parsedEndTime =
      endTime !== undefined &&
      endTime !== null &&
      !Number.isNaN(Date.parse(String(endTime)))
        ? new Date(String(endTime)).toISOString()
        : undefined
    const gameNameVal =
      gameName !== undefined
        ? gameName == null
          ? null
          : String(gameName).trim().slice(0, 120)
        : undefined

    if (
      parsedStartTime &&
      parsedEndTime &&
      new Date(parsedEndTime) <= new Date(parsedStartTime)
    ) {
      return res
        .status(400)
        .json({ message: 'End time must be after start time' })
    }

    try {
      const exist = await pool.query('SELECT id FROM matches WHERE id = $1', [
        matchId,
      ])
      if (exist.rows.length === 0) {
        return res.status(404).json({ message: 'Match not found' })
      }

      const updates = []
      const values = []
      let p = 1
      if (zoneName !== undefined) {
        updates.push(`zone_name = $${p++}`)
        values.push(String(zoneName ?? ''))
      }
      if (zonePosition !== undefined) {
        updates.push(`zone_lat = $${p++}`)
        updates.push(`zone_lng = $${p++}`)
        values.push(zonePosition?.lat ?? null, zonePosition?.lng ?? null)
      }
      if (typeVal !== undefined) {
        updates.push(`match_type = $${p++}`)
        values.push(typeVal)
      }
      if (parsedStartTime !== undefined) {
        updates.push(`start_time = $${p++}`)
        values.push(parsedStartTime)
      }
      if (parsedEndTime !== undefined) {
        updates.push(`end_time = $${p++}`)
        values.push(parsedEndTime)
      }
      if (gameNameVal !== undefined) {
        updates.push(`game_name = $${p++}`)
        values.push(gameNameVal)
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields to update' })
      }

      values.push(matchId)
      await pool.query(
        `UPDATE matches SET ${updates.join(', ')} WHERE id = $${p}`,
        values
      )

      const [matchRow, playersResult] = await Promise.all([
        queryMatchWithOptionalColumns(pool, matchId),
        pool.query(
          'SELECT user_id, display_name, health_percent, mana_current, mana_max, "order", is_current_turn FROM match_players WHERE match_id = $1',
          [matchId]
        ),
      ])
      const match = matchRow.rows[0]
      const state = toEventSessionState(
        match,
        playersResult.rows,
        match.current_turn_user_id
      )
      res.status(200).json(state)
    } catch (err) {
      if (err.code === '42703') {
        return res
          .status(400)
          .json({ message: 'Match table missing expected columns' })
      }
      console.error(err)
      res.status(500).json({ message: 'Error updating match' })
    }
  }
)

/**
 * DELETE /api/matches/:matchId
 * Admin only. Deletes match (match_players cascade).
 */
router.delete(
  '/matches/:matchId',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const matchId = req.params.matchId

    try {
      const result = await pool.query(
        'DELETE FROM matches WHERE id = $1 RETURNING id',
        [matchId]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Match not found' })
      }
      res.status(204).send()
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Error deleting match' })
    }
  }
)

/**
 * GET /api/matches/:matchId
 * Current snapshot for initial load/reconnect. Response: EventSessionState.
 */
router.get('/matches/:matchId', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const matchId = req.params.matchId

  try {
    const [matchResult, playersResult] = await Promise.all([
      queryMatchWithOptionalColumns(pool, matchId),
      pool.query(
        'SELECT user_id, display_name, health_percent, mana_current, mana_max, "order", is_current_turn FROM match_players WHERE match_id = $1',
        [matchId]
      ),
    ])
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ message: 'Match not found' })
    }
    const match = matchResult.rows[0]
    const state = toEventSessionState(
      match,
      playersResult.rows,
      match.current_turn_user_id
    )
    res.status(200).json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error fetching match' })
  }
})

module.exports = router
