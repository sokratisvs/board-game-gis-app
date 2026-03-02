const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/requireAdmin')

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
  const currentPlayer = players.find((p) => p.id === String(currentTurnUserId)) || players[0] || null
  const lastDice = Array.isArray(matchRow.last_dice_values) ? matchRow.last_dice_values : []
  return {
    matchId: matchRow.id,
    zoneName: matchRow.zone_name || '',
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
 * POST /api/matches
 * Create a new match. Body: { zoneName?, zonePosition? }. Creator is first player.
 */
router.post('/matches', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const userId = req.session.user.id
  const username = req.session.user.username
  const { zoneName, zonePosition } = req.body || {}

  try {
    const matchResult = await pool.query(
      `INSERT INTO matches (zone_name, zone_lat, zone_lng)
       VALUES ($1, $2, $3)
       RETURNING id, zone_name, zone_lat, zone_lng, current_turn_user_id, unread_chat_count, last_dice_values,
                 grid_rows, grid_cols, highlighted_row, highlighted_col`,
      [
        zoneName || '',
        zonePosition?.lat ?? null,
        zonePosition?.lng ?? null,
      ]
    )
    const match = matchResult.rows[0]
    await pool.query(
      `INSERT INTO match_players (match_id, user_id, display_name, "order", is_current_turn)
       VALUES ($1, $2, $3, 0, true)`,
      [match.id, userId, username]
    )
    await pool.query(
      'UPDATE matches SET current_turn_user_id = $1 WHERE id = $2',
      [userId, match.id]
    )
    const [matchRow, playersResult] = await Promise.all([
      pool.query(
        'SELECT id, zone_name, zone_lat, zone_lng, current_turn_user_id, unread_chat_count, last_dice_values, grid_rows, grid_cols, highlighted_row, highlighted_col FROM matches WHERE id = $1',
        [match.id]
      ),
      pool.query(
        'SELECT user_id, display_name, health_percent, mana_current, mana_max, "order", is_current_turn FROM match_players WHERE match_id = $1',
        [match.id]
      ),
    ])
    const state = toEventSessionState(matchRow.rows[0], playersResult.rows, userId)
    res.status(201).json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error creating match' })
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
      pool.query(
        'SELECT id, zone_name, zone_lat, zone_lng, current_turn_user_id, unread_chat_count, last_dice_values, grid_rows, grid_cols, highlighted_row, highlighted_col FROM matches WHERE id = $1',
        [matchId]
      ),
      pool.query(
        'SELECT user_id, display_name, health_percent, mana_current, mana_max, "order", is_current_turn FROM match_players WHERE match_id = $1',
        [matchId]
      ),
    ])
    const match = matchRow.rows[0]
    const state = toEventSessionState(match, playersResult.rows, match.current_turn_user_id)
    res.status(200).json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error joining match' })
  }
})

/**
 * GET /api/matches/:matchId
 * Current snapshot for initial load/reconnect. Response: EventSessionState.
 */
router.get('/matches/:matchId', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const matchId = req.params.matchId

  try {
    const [matchResult, playersResult] = await Promise.all([
      pool.query(
        'SELECT id, zone_name, zone_lat, zone_lng, current_turn_user_id, unread_chat_count, last_dice_values, grid_rows, grid_cols, highlighted_row, highlighted_col FROM matches WHERE id = $1',
        [matchId]
      ),
      pool.query(
        'SELECT user_id, display_name, health_percent, mana_current, mana_max, "order", is_current_turn FROM match_players WHERE match_id = $1',
        [matchId]
      ),
    ])
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ message: 'Match not found' })
    }
    const match = matchResult.rows[0]
    const state = toEventSessionState(match, playersResult.rows, match.current_turn_user_id)
    res.status(200).json(state)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error fetching match' })
  }
})

module.exports = router
