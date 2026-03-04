const express = require('express')
const router = express.Router()
const { requireAuth, requireAdmin } = require('../middleware/requireAdmin')

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/** Geocode a place name using Nominatim (OpenStreetMap). Returns { lat, lng } or null. */
async function geocodePlace(placeName) {
  if (!placeName || typeof placeName !== 'string') return null
  const q = encodeURIComponent(placeName.trim())
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BoardGameGIS/1.0' },
    })
    const data = await res.json()
    if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
    return null
  } catch (e) {
    console.warn('Geocode failed for', placeName, e.message)
    return null
  }
}

/** Call AI to suggest checkpoints for a route. Returns array of { sequenceOrder, clueText, knowledgeCard, xpAwarded, placeName }. */
async function suggestRouteDesign(name, description) {
  if (!OPENAI_API_KEY) {
    return [
      {
        sequenceOrder: 0,
        clueText: 'Start at a notable landmark.',
        knowledgeCard: {
          title: 'First stop',
          description: 'Discover the beginning of the trail.',
        },
        xpAwarded: 10,
        placeName:
          name && description ? `${name}, ${description}` : 'Athens, Greece',
      },
      {
        sequenceOrder: 1,
        clueText: 'Find the place where history meets the street.',
        knowledgeCard: {
          title: 'Second stop',
          description: 'A place of historical importance.',
        },
        xpAwarded: 15,
        placeName: 'Athens, Greece',
      },
      {
        sequenceOrder: 2,
        clueText: 'Seek the view that overlooks the city.',
        knowledgeCard: {
          title: 'Third stop',
          funFact: 'Many visitors gather here at sunset.',
        },
        xpAwarded: 20,
        placeName: 'Athens, Greece',
      },
    ]
  }
  const prompt = `You are helping design an exploration/quiz route for a GeoExplorer app. Given a route name and description, suggest 3 to 6 checkpoints. For each checkpoint provide: a short clue (one sentence, evocative), a knowledge card (title, optional description, optional funFact), XP awarded (10-30), and a placeName (real address or place name in a real city so it can be geocoded, e.g. "Acropolis, Athens" or "Syntagma Square, Athens"). Route name: "${name || 'Unnamed'}". Description: "${description || 'No description'}". Reply with a JSON array only, no markdown, no explanation. Each item: { "sequenceOrder": 0-based index, "clueText": "string", "knowledgeCard": { "title": "string", "description": "optional", "funFact": "optional" }, "xpAwarded": number, "placeName": "string" }.`
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
      }),
    })
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error(data?.error?.message || 'No response from AI')
    const text = content.replace(/^```json?\s*|\s*```$/g, '').trim()
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list.map((c, i) => ({
      sequenceOrder: Number(c.sequenceOrder ?? i),
      clueText: String(c.clueText ?? 'Clue'),
      knowledgeCard:
        c.knowledgeCard && typeof c.knowledgeCard === 'object'
          ? {
              title: c.knowledgeCard.title,
              description: c.knowledgeCard.description,
              funFact: c.knowledgeCard.funFact,
            }
          : null,
      xpAwarded: Number(c.xpAwarded ?? 10),
      placeName: String(c.placeName ?? ''),
    }))
  } catch (err) {
    console.error('AI design-suggest error', err)
    throw err
  }
}

/** Map DB route row (with optional r_* from routes join, first_cp for map) to API shape */
function mapRouteRow(row) {
  const out = {
    id: row.id,
    name: row.name,
    description: row.description,
    created_by: row.created_by,
    is_public: row.is_public,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
  if (row.type != null) {
    out.type = row.type
    out.difficulty = row.difficulty
    out.city = row.city
    out.world = row.world
    out.estimated_duration_min = row.estimated_duration_min
    out.radius_meters = row.radius_meters
    out.is_active = row.is_active
    out.title = row.title
  }
  if (row.first_cp_lat != null && row.first_cp_lng != null) {
    out.firstCheckpointLat = parseFloat(row.first_cp_lat)
    out.firstCheckpointLng = parseFloat(row.first_cp_lng)
  }
  return out
}

/** Map checkpoint row to API shape (id, routeId, sequenceOrder, lat, lng, clueText, ..., quiz?). */
function mapCheckpointRow(row) {
  const out = {
    id: row.id,
    routeId: row.route_id,
    sequenceOrder: row.sequence_order,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    clueText: row.clue_text,
    imageUrl: row.image_url,
    knowledgeCard: row.knowledge_card || null,
    xpAwarded: row.xp_awarded ?? 0,
    createdAt: row.created_at,
  }
  const quiz = mapRowToQuiz(row)
  if (quiz) out.quiz = quiz
  return out
}

/**
 * GET /api/exploration/routes
 * List exploration routes (public ones for non-admin). Includes route metadata (type, difficulty, city, world) when linked.
 * Query: ?type=all|real|fantasy to filter by route type. ?includeCheckpoints=1 to include checkpoints (for map pins).
 * Includes firstCheckpointLat, firstCheckpointLng for map display.
 */
router.get('/exploration/routes', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const isAdmin = req.session?.user?.type === 'admin'
  const typeFilter =
    req.query.type === 'real' || req.query.type === 'fantasy'
      ? req.query.type
      : null
  const includeCheckpoints =
    req.query.includeCheckpoints === '1' ||
    req.query.includeCheckpoints === 'true'
  try {
    let query = `SELECT er.id, er.name, er.description, er.created_by, er.is_public, er.created_at, er.updated_at,
              r.type, r.difficulty, r.city, r.world, r.estimated_duration_min, r.radius_meters, r.is_active, r.title,
              first_cp.lat AS first_cp_lat, first_cp.lng AS first_cp_lng
       FROM exploration_routes er
       LEFT JOIN routes r ON er.route_id = r.id
       LEFT JOIN LATERAL (
         SELECT c.lat, c.lng FROM route_checkpoints c
         WHERE c.route_id = er.id ORDER BY c.sequence_order LIMIT 1
       ) first_cp ON true
       WHERE (er.is_public = true OR $1 = true)`
    const params = [isAdmin]
    if (typeFilter) {
      params.push(typeFilter)
      query += ` AND r.type = $${params.length}`
    }
    query += ' ORDER BY er.updated_at DESC'
    const result = await pool.query(query, params)
    const routes = result.rows.map(mapRouteRow)
    if (routes.length > 0) {
      const routeIds = routes.map((r) => r.id)
      const xpResult = await pool.query(
        `SELECT route_id, COALESCE(SUM(xp_awarded), 0)::int AS total_xp
         FROM route_checkpoints
         WHERE route_id = ANY($1::uuid[])
         GROUP BY route_id`,
        [routeIds]
      )
      const xpByRoute = {}
      for (const row of xpResult.rows) {
        const rid = row.route_id != null ? String(row.route_id) : null
        if (rid) xpByRoute[rid] = Number(row.total_xp ?? 0)
      }
      routes.forEach((r) => {
        const rid = r.id != null ? String(r.id) : null
        r.totalXp = rid ? (xpByRoute[rid] ?? 0) : 0
      })
    }
    if (includeCheckpoints && routes.length > 0) {
      const routeIds = routes.map((r) => r.id)
      const cpResult = await pool.query(
        `SELECT id, route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, created_at
         FROM route_checkpoints
         WHERE route_id = ANY($1::uuid[])
         ORDER BY route_id, sequence_order`,
        [routeIds]
      )
      const byRoute = {}
      for (const row of cpResult.rows) {
        if (!byRoute[row.route_id]) byRoute[row.route_id] = []
        byRoute[row.route_id].push(mapCheckpointRow(row))
      }
      routes.forEach((r) => {
        r.checkpoints = byRoute[r.id] || []
      })
    }
    res.json(routes)
  } catch (err) {
    if (err.code === '42P01') {
      return res.json([])
    }
    console.error(err)
    res.status(500).json({ message: 'Error listing routes' })
  }
})

/**
 * POST /api/exploration/routes
 * Create route (admin). Body: name, description, is_public, and optional type, difficulty, city, world, estimated_duration_min, radius_meters.
 */
router.post(
  '/exploration/routes',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const userId = req.session?.user?.id
    const {
      name,
      description,
      is_public,
      type,
      difficulty,
      city,
      world,
      estimated_duration_min,
      radius_meters,
    } = req.body || {}
    const routeType = type === 'fantasy' ? 'fantasy' : 'real'
    const routeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty)
      ? difficulty
      : 'medium'
    try {
      const routeResult = await pool.query(
        `INSERT INTO routes (title, description, type, difficulty, city, world, estimated_duration_min, radius_meters, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
       RETURNING id`,
        [
          name || 'New route',
          description || null,
          routeType,
          routeDifficulty,
          city || null,
          world || null,
          estimated_duration_min ?? null,
          radius_meters ?? null,
        ]
      )
      const routeId = routeResult.rows[0].id
      const erResult = await pool.query(
        `INSERT INTO exploration_routes (name, description, created_by, is_public, route_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, created_by, is_public, created_at, updated_at`,
        [
          name || 'New route',
          description || null,
          userId ?? null,
          is_public !== false,
          routeId,
        ]
      )
      const row = erResult.rows[0]
      res
        .status(201)
        .json(
          mapRouteRow({
            ...row,
            type: routeType,
            difficulty: routeDifficulty,
            city: city || null,
            world: world || null,
            estimated_duration_min: estimated_duration_min ?? null,
            radius_meters: radius_meters ?? null,
            is_active: true,
            title: name || 'New route',
          })
        )
    } catch (err) {
      if (err.code === '42P01') {
        return res
          .status(400)
          .json({
            message:
              'exploration_routes or routes table not found; run migrations 009 and 010',
          })
      }
      console.error(err)
      res.status(500).json({ message: 'Error creating route' })
    }
  }
)

/**
 * POST /api/exploration/design-suggest
 * AI suggests checkpoints from route name + description (admin). Body: { name, description }.
 */
router.post(
  '/exploration/design-suggest',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { name, description } = req.body || {}
    try {
      const checkpoints = await suggestRouteDesign(
        name || '',
        description || ''
      )
      res.json({ checkpoints })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: err.message || 'AI suggestion failed' })
    }
  }
)

/**
 * POST /api/exploration/routes/from-design
 * Create route and checkpoints from AI design (admin). Body: { name, description, is_public?, checkpoints: [{ sequenceOrder, clueText, knowledgeCard?, xpAwarded?, placeName }] }.
 * Geocodes each placeName; if geocode fails uses Athens center as fallback.
 */
const DEFAULT_LAT = 37.9838
const DEFAULT_LNG = 23.7275

/**
 * POST /api/exploration/routes/from-batch
 * Create route + checkpoints from pasted JSON. Body: { name?, title?, description?, type?, city?, world?, radiusMeters?, estimatedDurationMin?, difficulty?, checkpoints: [{ order, coordinates: { lat, lng }, validationRadiusMeters?, quiz: { question, options, correctAnswerIndex } }] }
 */
router.post(
  '/exploration/routes/from-batch',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const userId = req.session?.user?.id
    const body = req.body || {}
    const name = (body.name ?? body.title ?? '').trim() || null
    const description =
      (body.description != null ? String(body.description) : '').trim() || null
    const type = body.type === 'fantasy' ? 'fantasy' : 'real'
    const difficulty = ['easy', 'medium', 'hard'].includes(body.difficulty)
      ? body.difficulty
      : 'medium'
    const city =
      type === 'real' && body.city != null
        ? String(body.city).trim() || null
        : null
    const world =
      type === 'fantasy' && body.world != null
        ? String(body.world).trim() || null
        : null
    const radiusMeters =
      body.radiusMeters != null ? Math.max(0, Number(body.radiusMeters)) : null
    const estimatedDurationMin =
      body.estimatedDurationMin != null
        ? Math.max(0, Number(body.estimatedDurationMin))
        : null
    const rawCheckpoints = Array.isArray(body.checkpoints)
      ? body.checkpoints
      : []
    if (!name) {
      return res.status(400).json({ message: 'name or title required' })
    }
    if (rawCheckpoints.length === 0) {
      return res
        .status(400)
        .json({ message: 'checkpoints array required and must not be empty' })
    }
    try {
      const rResult = await pool.query(
        `INSERT INTO routes (title, description, type, difficulty, city, world, estimated_duration_min, radius_meters, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
       RETURNING id`,
        [
          name,
          description,
          type,
          difficulty,
          city,
          world,
          estimatedDurationMin,
          radiusMeters,
        ]
      )
      const metaRouteId = rResult.rows[0].id
      const routeResult = await pool.query(
        `INSERT INTO exploration_routes (name, description, created_by, is_public, route_id)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id, name, description, created_by, is_public, created_at, updated_at`,
        [name, description, userId ?? null, metaRouteId]
      )
      const route = routeResult.rows[0]
      const routeId = route.id
      for (let i = 0; i < rawCheckpoints.length; i++) {
        const c = rawCheckpoints[i]
        const coords =
          c.coordinates && typeof c.coordinates === 'object'
            ? c.coordinates
            : {}
        const lat = Number(coords.lat)
        const lng = Number(coords.lng)
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return res
            .status(400)
            .json({
              message: `Checkpoint ${i + 1}: coordinates.lat and coordinates.lng required`,
            })
        }
        const sequenceOrder = Number(c.order ?? i)
        const validationRadiusMeters =
          c.validationRadiusMeters != null
            ? Math.max(0, Number(c.validationRadiusMeters))
            : null
        const quiz = c.quiz && typeof c.quiz === 'object' ? c.quiz : null
        const clueText =
          quiz && quiz.question
            ? String(quiz.question).slice(0, 500)
            : 'Answer the quiz.'
        const quizOpts = buildQuizOptions(quiz)
        const quizQuestion =
          quiz && quiz.question != null ? String(quiz.question).trim() : null
        await pool.query(
          `INSERT INTO route_checkpoints (route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, validation_radius_meters)
         VALUES ($1, $2, $3, $4, $5, NULL, NULL, 10, $6, $7, $8)`,
          [
            routeId,
            sequenceOrder,
            lat,
            lng,
            clueText,
            quizQuestion,
            quizOpts ? JSON.stringify(quizOpts) : null,
            validationRadiusMeters,
          ]
        )
      }
      const checkpointsResult = await pool.query(
        `SELECT id, route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, validation_radius_meters, created_at
       FROM route_checkpoints WHERE route_id = $1 ORDER BY sequence_order`,
        [routeId]
      )
      const createdCheckpoints = checkpointsResult.rows.map((row) => {
        const out = {
          id: row.id,
          routeId: row.route_id,
          sequenceOrder: row.sequence_order,
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lng),
          clueText: row.clue_text,
          imageUrl: row.image_url,
          knowledgeCard: row.knowledge_card,
          xpAwarded: row.xp_awarded ?? 0,
          createdAt: row.created_at,
        }
        const q = mapRowToQuiz(row)
        if (q) out.quiz = q
        if (row.validation_radius_meters != null)
          out.validationRadiusMeters = row.validation_radius_meters
        return out
      })
      res.status(201).json({
        ...mapRouteRow({
          ...route,
          type,
          difficulty,
          city,
          world,
          estimated_duration_min: estimatedDurationMin,
          radius_meters: radiusMeters,
          is_active: true,
          title: name,
        }),
        id: route.id,
        checkpoints: createdCheckpoints,
      })
    } catch (err) {
      if (err.code === '42P01') {
        return res
          .status(400)
          .json({ message: 'Tables not found; run migrations 009, 019, 020' })
      }
      console.error(err)
      res.status(500).json({ message: 'Error creating route from batch' })
    }
  }
)

router.post(
  '/exploration/routes/from-design',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const userId = req.session?.user?.id
    const {
      name,
      description,
      is_public,
      type,
      difficulty,
      city,
      world,
      checkpoints: rawCheckpoints,
    } = req.body || {}
    const checkpoints = Array.isArray(rawCheckpoints) ? rawCheckpoints : []
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name required' })
    }
    const routeType = type === 'fantasy' ? 'fantasy' : 'real'
    const routeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty)
      ? difficulty
      : 'medium'
    try {
      const rResult = await pool.query(
        `INSERT INTO routes (title, description, type, difficulty, city, world, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING id`,
        [
          name.trim(),
          description?.trim() || null,
          routeType,
          routeDifficulty,
          city || null,
          world || null,
        ]
      )
      const metaRouteId = rResult.rows[0].id
      const routeResult = await pool.query(
        `INSERT INTO exploration_routes (name, description, created_by, is_public, route_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, created_by, is_public, created_at, updated_at`,
        [
          name.trim(),
          description?.trim() || null,
          userId ?? null,
          is_public !== false,
          metaRouteId,
        ]
      )
      const route = routeResult.rows[0]
      const routeId = route.id
      for (let i = 0; i < checkpoints.length; i++) {
        const c = checkpoints[i]
        const placeName = c.placeName || name
        const coords = await geocodePlace(placeName)
        const lat = coords?.lat ?? DEFAULT_LAT
        const lng = coords?.lng ?? DEFAULT_LNG
        const sequenceOrder = Number(c.sequenceOrder ?? i)
        const clueText = String(c.clueText ?? 'Clue')
        const knowledgeCard =
          c.knowledgeCard && typeof c.knowledgeCard === 'object'
            ? c.knowledgeCard
            : null
        const xpAwarded = Number(c.xpAwarded ?? 10)
        await pool.query(
          `INSERT INTO route_checkpoints (route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded)
         VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)`,
          [
            routeId,
            sequenceOrder,
            lat,
            lng,
            clueText,
            knowledgeCard ? JSON.stringify(knowledgeCard) : null,
            xpAwarded,
          ]
        )
      }
      const checkpointsResult = await pool.query(
        `SELECT id, route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, created_at
       FROM route_checkpoints WHERE route_id = $1 ORDER BY sequence_order`,
        [routeId]
      )
      const createdCheckpoints = checkpointsResult.rows.map((row) => ({
        id: row.id,
        routeId: row.route_id,
        sequenceOrder: row.sequence_order,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        clueText: row.clue_text,
        imageUrl: row.image_url,
        knowledgeCard: row.knowledge_card,
        xpAwarded: row.xp_awarded ?? 0,
        createdAt: row.created_at,
      }))
      res.status(201).json({
        ...mapRouteRow({
          ...route,
          type: routeType,
          difficulty: routeDifficulty,
          city: city || null,
          world: world || null,
          estimated_duration_min: null,
          radius_meters: null,
          is_active: true,
          title: name.trim(),
        }),
        checkpoints: createdCheckpoints,
      })
    } catch (err) {
      if (err.code === '42P01') {
        return res
          .status(400)
          .json({
            message: 'exploration_routes table not found; run migration 009',
          })
      }
      console.error(err)
      res.status(500).json({ message: 'Error creating route from design' })
    }
  }
)

/**
 * GET /api/exploration/routes/:id
 * Get route with checkpoints (ordered).
 */
router.get('/exploration/routes/:id', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const routeResult = await pool.query(
      `SELECT er.id, er.name, er.description, er.created_by, er.is_public, er.created_at, er.updated_at,
              r.type, r.difficulty, r.city, r.world, r.estimated_duration_min, r.radius_meters, r.is_active, r.title
       FROM exploration_routes er
       LEFT JOIN routes r ON er.route_id = r.id
       WHERE er.id = $1`,
      [id]
    )
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Route not found' })
    }
    const route = mapRouteRow(routeResult.rows[0])
    const checkpointsResult = await pool.query(
      `SELECT id, route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, created_at
       FROM route_checkpoints
       WHERE route_id = $1
       ORDER BY sequence_order`,
      [id]
    )
    const checkpoints = checkpointsResult.rows.map((row) => {
      const out = {
        id: row.id,
        routeId: row.route_id,
        sequenceOrder: row.sequence_order,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        clueText: row.clue_text,
        imageUrl: row.image_url,
        knowledgeCard: row.knowledge_card || null,
        xpAwarded: row.xp_awarded ?? 0,
        createdAt: row.created_at,
      }
      const quiz = mapRowToQuiz(row)
      if (quiz) out.quiz = quiz
      return out
    })
    const totalXp = checkpoints.reduce((sum, c) => sum + (c.xpAwarded ?? 0), 0)
    const recResult = await pool.query(
      `SELECT r.id, r.type, r.name, r.external_id, r.lat, r.lng, r.description, r.created_at
       FROM route_recommendations rr
       JOIN recommendations r ON r.id = rr.recommendation_id
       WHERE rr.route_id = $1
       ORDER BY r.type, r.name`,
      [id]
    )
    const recommendations = recResult.rows.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      externalId: r.external_id,
      lat: r.lat != null ? parseFloat(r.lat) : null,
      lng: r.lng != null ? parseFloat(r.lng) : null,
      description: r.description,
      createdAt: r.created_at,
    }))
    res.json({ ...route, checkpoints, totalXp, recommendations })
  } catch (err) {
    if (err.code === '42P01')
      return res.status(404).json({ message: 'Route not found' })
    console.error(err)
    res.status(500).json({ message: 'Error fetching route' })
  }
})

/**
 * PATCH /api/exploration/routes/:id
 * Update route (admin). Can update name, description, is_public on exploration_routes and type, difficulty, city, world, estimated_duration_min, radius_meters, is_active on routes.
 */
router.patch(
  '/exploration/routes/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id } = req.params
    const {
      name,
      description,
      is_public,
      type,
      difficulty,
      city,
      world,
      estimated_duration_min,
      radius_meters,
      is_active,
      recommendationIds,
    } = req.body || {}
    try {
      const erUpdates = []
      const erValues = []
      let p = 1
      if (name !== undefined) {
        erUpdates.push(`name = $${p++}`)
        erValues.push(name)
      }
      if (description !== undefined) {
        erUpdates.push(`description = $${p++}`)
        erValues.push(description)
      }
      if (is_public !== undefined) {
        erUpdates.push(`is_public = $${p++}`)
        erValues.push(!!is_public)
      }
      if (erUpdates.length > 0) {
        erUpdates.push('updated_at = CURRENT_TIMESTAMP')
        erValues.push(id)
        await pool.query(
          `UPDATE exploration_routes SET ${erUpdates.join(', ')} WHERE id = $${p}`,
          erValues
        )
      }
      const routeMeta = await pool.query(
        'SELECT route_id FROM exploration_routes WHERE id = $1',
        [id]
      )
      const routeId = routeMeta.rows[0]?.route_id
      if (routeId) {
        const rUpdates = []
        const rValues = []
        let q = 1
        if (type !== undefined && ['real', 'fantasy'].includes(type)) {
          rUpdates.push(`type = $${q++}`)
          rValues.push(type)
        }
        if (
          difficulty !== undefined &&
          ['easy', 'medium', 'hard'].includes(difficulty)
        ) {
          rUpdates.push(`difficulty = $${q++}`)
          rValues.push(difficulty)
        }
        if (city !== undefined) {
          rUpdates.push(`city = $${q++}`)
          rValues.push(city)
        }
        if (world !== undefined) {
          rUpdates.push(`world = $${q++}`)
          rValues.push(world)
        }
        if (estimated_duration_min !== undefined) {
          rUpdates.push(`estimated_duration_min = $${q++}`)
          rValues.push(estimated_duration_min)
        }
        if (radius_meters !== undefined) {
          rUpdates.push(`radius_meters = $${q++}`)
          rValues.push(radius_meters)
        }
        if (is_active !== undefined) {
          rUpdates.push(`is_active = $${q++}`)
          rValues.push(!!is_active)
        }
        if (rUpdates.length > 0) {
          rUpdates.push('updated_at = NOW()')
          rValues.push(routeId)
          await pool.query(
            `UPDATE routes SET ${rUpdates.join(', ')} WHERE id = $${q}`,
            rValues
          )
        }
      }
      if (Array.isArray(recommendationIds)) {
        await pool.query(
          'DELETE FROM route_recommendations WHERE route_id = $1',
          [id]
        )
        for (const recId of recommendationIds) {
          if (recId) {
            await pool.query(
              'INSERT INTO route_recommendations (route_id, recommendation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [id, recId]
            )
          }
        }
      }
      const result = await pool.query(
        `SELECT er.id, er.name, er.description, er.created_by, er.is_public, er.created_at, er.updated_at,
              r.type, r.difficulty, r.city, r.world, r.estimated_duration_min, r.radius_meters, r.is_active, r.title
       FROM exploration_routes er
       LEFT JOIN routes r ON er.route_id = r.id
       WHERE er.id = $1`,
        [id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Route not found' })
      }
      const route = mapRouteRow(result.rows[0])
      const recResult = await pool.query(
        `SELECT r.id, r.type, r.name, r.external_id, r.lat, r.lng, r.description, r.created_at
       FROM route_recommendations rr
       JOIN recommendations r ON r.id = rr.recommendation_id
       WHERE rr.route_id = $1 ORDER BY r.type, r.name`,
        [id]
      )
      route.recommendations = recResult.rows.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        externalId: r.external_id,
        lat: r.lat != null ? parseFloat(r.lat) : null,
        lng: r.lng != null ? parseFloat(r.lng) : null,
        description: r.description,
        createdAt: r.created_at,
      }))
      const xpResult = await pool.query(
        'SELECT COALESCE(SUM(xp_awarded), 0) AS total_xp FROM route_checkpoints WHERE route_id = $1',
        [id]
      )
      route.totalXp = Number(xpResult.rows[0]?.total_xp ?? 0)
      res.json(route)
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Error updating route' })
    }
  }
)

/**
 * DELETE /api/exploration/routes/:id
 * Delete route and its checkpoints (admin). Also deletes linked routes row if any.
 */
router.delete(
  '/exploration/routes/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id } = req.params
    try {
      const routeMeta = await pool.query(
        'SELECT route_id FROM exploration_routes WHERE id = $1',
        [id]
      )
      const routeId = routeMeta.rows[0]?.route_id
      const result = await pool.query(
        'DELETE FROM exploration_routes WHERE id = $1 RETURNING id',
        [id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Route not found' })
      }
      if (routeId) {
        await pool.query('DELETE FROM routes WHERE id = $1', [routeId])
      }
      res.status(204).send()
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Error deleting route' })
    }
  }
)

/**
 * GET /api/exploration/routes/:id/checkpoints
 * List checkpoints for a route (ordered).
 */
/** Map DB quiz_question + quiz_options to API { question, options, correctAnswerIndex }. */
function mapRowToQuiz(row) {
  if (
    row.quiz_question == null &&
    (!row.quiz_options ||
      !Array.isArray(row.quiz_options) ||
      row.quiz_options.length === 0)
  ) {
    return null
  }
  const opts = Array.isArray(row.quiz_options) ? row.quiz_options : []
  const options = opts.map((o) =>
    o && o.optionText != null
      ? String(o.optionText)
      : o && o.option_text != null
        ? String(o.option_text)
        : ''
  )
  const correctIndex = opts.findIndex(
    (o) => o && (o.isCorrect === true || o.is_correct === true)
  )
  return {
    question: row.quiz_question != null ? String(row.quiz_question) : '',
    options: options.length ? options : [],
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
  }
}

/** Build quiz_options JSON from API { question, options, correctAnswerIndex }. */
function buildQuizOptions(quiz) {
  if (!quiz || !Array.isArray(quiz.options) || quiz.options.length === 0)
    return null
  const correctIndex = Math.max(
    0,
    Math.min(Number(quiz.correctAnswerIndex) || 0, quiz.options.length - 1)
  )
  return quiz.options.map((text, i) => ({
    optionText: String(text ?? ''),
    isCorrect: i === correctIndex,
  }))
}

router.get(
  '/exploration/routes/:id/checkpoints',
  requireAuth,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id } = req.params
    try {
      const result = await pool.query(
        `SELECT c.id, c.route_id, c.sequence_order, c.lat, c.lng, c.clue_text, c.image_url, c.knowledge_card, c.xp_awarded, c.quiz_question, c.quiz_options, c.created_at,
              (SELECT json_agg(json_build_object('type', r.type, 'id', r.external_id))
               FROM route_checkpoint_recommendations cpr
               JOIN recommendations r ON r.id = cpr.recommendation_id
               WHERE cpr.checkpoint_id = c.id) AS nearby_recommendations
       FROM route_checkpoints c
       WHERE c.route_id = $1
       ORDER BY c.sequence_order`,
        [id]
      )
      const checkpoints = result.rows.map((row) => {
        const out = {
          id: row.id,
          routeId: row.route_id,
          sequenceOrder: row.sequence_order,
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lng),
          clueText: row.clue_text,
          imageUrl: row.image_url,
          knowledgeCard: row.knowledge_card || null,
          xpAwarded: row.xp_awarded ?? 0,
          nearbyRecommendations: row.nearby_recommendations || [],
          createdAt: row.created_at,
        }
        const quiz = mapRowToQuiz(row)
        if (quiz) out.quiz = quiz
        return out
      })
      res.json(checkpoints)
    } catch (err) {
      if (err.code === '42P01') return res.json([])
      console.error(err)
      res.status(500).json({ message: 'Error fetching checkpoints' })
    }
  }
)

/**
 * POST /api/exploration/routes/:id/checkpoints
 * Add checkpoint (admin). Body: { sequenceOrder, lat, lng, clueText, imageUrl?, knowledgeCard?, xpAwarded?, recommendationIds?, quiz?: { question, options, correctAnswerIndex } }
 */
router.post(
  '/exploration/routes/:id/checkpoints',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id: routeId } = req.params
    const {
      sequenceOrder,
      lat,
      lng,
      clueText,
      imageUrl,
      knowledgeCard,
      xpAwarded,
      recommendationIds,
      quiz,
    } = req.body || {}
    if (
      lat == null ||
      lng == null ||
      clueText == null ||
      sequenceOrder == null
    ) {
      return res
        .status(400)
        .json({ message: 'sequenceOrder, lat, lng, clueText required' })
    }
    const quizOpts = buildQuizOptions(quiz)
    const quizQuestion =
      quiz && quiz.question != null ? String(quiz.question).trim() : null
    try {
      const cpResult = await pool.query(
        `INSERT INTO route_checkpoints (route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, created_at`,
        [
          routeId,
          Number(sequenceOrder),
          Number(lat),
          Number(lng),
          String(clueText),
          imageUrl || null,
          knowledgeCard ? JSON.stringify(knowledgeCard) : null,
          xpAwarded ?? 0,
          quizQuestion || null,
          quizOpts ? JSON.stringify(quizOpts) : null,
        ]
      )
      const checkpoint = cpResult.rows[0]
      const checkpointId = checkpoint.id
      if (Array.isArray(recommendationIds) && recommendationIds.length > 0) {
        for (const recId of recommendationIds) {
          await pool.query(
            'INSERT INTO route_checkpoint_recommendations (checkpoint_id, recommendation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [checkpointId, recId]
          )
        }
      }
      const out = {
        id: checkpoint.id,
        routeId: checkpoint.route_id,
        sequenceOrder: checkpoint.sequence_order,
        lat: parseFloat(checkpoint.lat),
        lng: parseFloat(checkpoint.lng),
        clueText: checkpoint.clue_text,
        imageUrl: checkpoint.image_url,
        knowledgeCard: checkpoint.knowledge_card,
        xpAwarded: checkpoint.xp_awarded ?? 0,
        createdAt: checkpoint.created_at,
      }
      const mappedQuiz = mapRowToQuiz(checkpoint)
      if (mappedQuiz) out.quiz = mappedQuiz
      res.status(201).json(out)
    } catch (err) {
      if (err.code === '23503') {
        return res.status(404).json({ message: 'Route not found' })
      }
      if (err.code === '42P01') {
        return res
          .status(400)
          .json({ message: 'Tables not found; run migration 009' })
      }
      console.error(err)
      res.status(500).json({ message: 'Error creating checkpoint' })
    }
  }
)

/**
 * PATCH /api/exploration/routes/:routeId/checkpoints/:checkpointId
 * Update checkpoint (admin). Body may include quiz: { question, options, correctAnswerIndex }.
 */
router.patch(
  '/exploration/routes/:routeId/checkpoints/:checkpointId',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { routeId, checkpointId } = req.params
    const {
      sequenceOrder,
      lat,
      lng,
      clueText,
      imageUrl,
      knowledgeCard,
      xpAwarded,
      recommendationIds,
      quiz,
    } = req.body || {}
    try {
      const updates = []
      const values = []
      let p = 1
      if (sequenceOrder !== undefined) {
        updates.push(`sequence_order = $${p++}`)
        values.push(Number(sequenceOrder))
      }
      if (lat !== undefined) {
        updates.push(`lat = $${p++}`)
        values.push(Number(lat))
      }
      if (lng !== undefined) {
        updates.push(`lng = $${p++}`)
        values.push(Number(lng))
      }
      if (clueText !== undefined) {
        updates.push(`clue_text = $${p++}`)
        values.push(String(clueText))
      }
      if (imageUrl !== undefined) {
        updates.push(`image_url = $${p++}`)
        values.push(imageUrl || null)
      }
      if (knowledgeCard !== undefined) {
        updates.push(`knowledge_card = $${p++}`)
        values.push(knowledgeCard ? JSON.stringify(knowledgeCard) : null)
      }
      if (xpAwarded !== undefined) {
        updates.push(`xp_awarded = $${p++}`)
        values.push(Number(xpAwarded))
      }
      if (quiz !== undefined) {
        const quizOpts = buildQuizOptions(quiz)
        updates.push(`quiz_question = $${p++}`)
        values.push(
          quiz && quiz.question != null ? String(quiz.question).trim() : null
        )
        updates.push(`quiz_options = $${p++}`)
        values.push(quizOpts ? JSON.stringify(quizOpts) : null)
      }
      if (updates.length === 0 && !Array.isArray(recommendationIds)) {
        return res.status(400).json({ message: 'No fields to update' })
      }
      if (updates.length > 0) {
        values.push(checkpointId, routeId)
        const result = await pool.query(
          `UPDATE route_checkpoints SET ${updates.join(', ')} WHERE id = $${p} AND route_id = $${p + 1} RETURNING *`,
          values
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Checkpoint not found' })
        }
      }
      if (Array.isArray(recommendationIds)) {
        await pool.query(
          'DELETE FROM route_checkpoint_recommendations WHERE checkpoint_id = $1',
          [checkpointId]
        )
        for (const recId of recommendationIds) {
          await pool.query(
            'INSERT INTO route_checkpoint_recommendations (checkpoint_id, recommendation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [checkpointId, recId]
          )
        }
      }
      const row = await pool.query(
        'SELECT id, route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, created_at FROM route_checkpoints WHERE id = $1',
        [checkpointId]
      )
      if (row.rows.length === 0) {
        return res.status(404).json({ message: 'Checkpoint not found' })
      }
      const c = row.rows[0]
      const out = {
        id: c.id,
        routeId: c.route_id,
        sequenceOrder: c.sequence_order,
        lat: parseFloat(c.lat),
        lng: parseFloat(c.lng),
        clueText: c.clue_text,
        imageUrl: c.image_url,
        knowledgeCard: c.knowledge_card,
        xpAwarded: c.xp_awarded ?? 0,
        createdAt: c.created_at,
      }
      const mappedQuiz = mapRowToQuiz(c)
      if (mappedQuiz) out.quiz = mappedQuiz
      res.json(out)
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Error updating checkpoint' })
    }
  }
)

/**
 * DELETE /api/exploration/routes/:routeId/checkpoints/:checkpointId
 * Delete checkpoint (admin).
 */
router.delete(
  '/exploration/routes/:routeId/checkpoints/:checkpointId',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { routeId, checkpointId } = req.params
    try {
      const result = await pool.query(
        'DELETE FROM route_checkpoints WHERE id = $1 AND route_id = $2 RETURNING id',
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
  }
)

/**
 * GET /api/exploration/routes/:id/play/checkpoint/:order
 * Player flow: get clue, knowledge card, nearby recommendations, xp for checkpoint at sequence order.
 * Response shape: { nextCheckpointId, clue, knowledgeCard, nearbyRecommendations, xpAwarded }
 */
router.get(
  '/exploration/routes/:id/play/checkpoint/:order',
  requireAuth,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id: routeId, order } = req.params
    const seq = parseInt(order, 10)
    if (Number.isNaN(seq) || seq < 0) {
      return res.status(400).json({ message: 'Invalid sequence order' })
    }
    try {
      const cpResult = await pool.query(
        `SELECT c.id, c.sequence_order, c.clue_text, c.image_url, c.knowledge_card, c.xp_awarded,
              (SELECT json_agg(json_build_object('type', r.type, 'id', r.external_id))
               FROM route_checkpoint_recommendations cpr
               JOIN recommendations r ON r.id = cpr.recommendation_id
               WHERE cpr.checkpoint_id = c.id) AS nearby_recommendations
       FROM route_checkpoints c
       WHERE c.route_id = $1 AND c.sequence_order = $2`,
        [routeId, seq]
      )
      if (cpResult.rows.length === 0) {
        return res.status(404).json({ message: 'Checkpoint not found' })
      }
      const c = cpResult.rows[0]
      const nextResult = await pool.query(
        'SELECT id FROM route_checkpoints WHERE route_id = $1 AND sequence_order = $2',
        [routeId, seq + 1]
      )
      const nextRow = nextResult.rows[0] || null
      res.json({
        nextCheckpointId: nextRow?.id ?? null,
        nextSequenceOrder: nextRow ? seq + 1 : null,
        clue: c.clue_text,
        knowledgeCard: c.knowledge_card || null,
        nearbyRecommendations: c.nearby_recommendations || [],
        xpAwarded: c.xp_awarded ?? 0,
      })
    } catch (err) {
      if (err.code === '42P01')
        return res.status(404).json({ message: 'Route not found' })
      console.error(err)
      res.status(500).json({ message: 'Error fetching checkpoint' })
    }
  }
)

/**
 * GET /api/exploration/recommendations
 * List recommendations (optional ?type=).
 */
router.get('/exploration/recommendations', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const typeFilter = req.query.type
  try {
    const query =
      typeFilter && typeFilter.trim()
        ? 'SELECT id, type, name, external_id, lat, lng, description, created_at FROM recommendations WHERE type = $1 ORDER BY type, name'
        : 'SELECT id, type, name, external_id, lat, lng, description, created_at FROM recommendations ORDER BY type, name'
    const params = typeFilter && typeFilter.trim() ? [typeFilter.trim()] : []
    const result = await pool.query(query, params)
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        externalId: r.external_id,
        lat: r.lat != null ? parseFloat(r.lat) : null,
        lng: r.lng != null ? parseFloat(r.lng) : null,
        description: r.description,
        createdAt: r.created_at,
      }))
    )
  } catch (err) {
    if (err.code === '42P01') return res.json([])
    console.error(err)
    res.status(500).json({ message: 'Error listing recommendations' })
  }
})

/**
 * POST /api/exploration/recommendations
 * Create recommendation (admin). Body: { type, name?, external_id?, lat?, lng?, description? }
 */
router.post(
  '/exploration/recommendations',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { type, name, external_id, lat, lng, description } = req.body || {}
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ message: 'type required' })
    }
    try {
      const result = await pool.query(
        `INSERT INTO recommendations (type, name, external_id, lat, lng, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, name, external_id, lat, lng, description, created_at`,
        [
          type.trim(),
          name != null ? String(name).slice(0, 200) : null,
          external_id != null ? String(external_id).slice(0, 100) : null,
          lat != null ? Number(lat) : null,
          lng != null ? Number(lng) : null,
          description != null ? String(description) : null,
        ]
      )
      const r = result.rows[0]
      res.status(201).json({
        id: r.id,
        type: r.type,
        name: r.name,
        externalId: r.external_id,
        lat: r.lat != null ? parseFloat(r.lat) : null,
        lng: r.lng != null ? parseFloat(r.lng) : null,
        description: r.description,
        createdAt: r.created_at,
      })
    } catch (err) {
      if (err.code === '42P01') {
        return res
          .status(400)
          .json({ message: 'Tables not found; run migration 009' })
      }
      console.error(err)
      res.status(500).json({ message: 'Error creating recommendation' })
    }
  }
)

/**
 * PATCH /api/exploration/recommendations/:id
 * UPDATE recommendation (admin).
 */
router.patch(
  '/exploration/recommendations/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id } = req.params
    const { type, name, external_id, lat, lng, description } = req.body || {}
    try {
      const updates = []
      const values = []
      let p = 1
      if (type !== undefined) {
        updates.push(`type = $${p++}`)
        values.push(String(type).trim())
      }
      if (name !== undefined) {
        updates.push(`name = $${p++}`)
        values.push(name != null ? String(name).slice(0, 200) : null)
      }
      if (external_id !== undefined) {
        updates.push(`external_id = $${p++}`)
        values.push(
          external_id != null ? String(external_id).slice(0, 100) : null
        )
      }
      if (lat !== undefined) {
        updates.push(`lat = $${p++}`)
        values.push(lat == null ? null : Number(lat))
      }
      if (lng !== undefined) {
        updates.push(`lng = $${p++}`)
        values.push(lng == null ? null : Number(lng))
      }
      if (description !== undefined) {
        updates.push(`description = $${p++}`)
        values.push(description != null ? String(description) : null)
      }
      if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields to update' })
      }
      values.push(id)
      const result = await pool.query(
        `UPDATE recommendations SET ${updates.join(', ')} WHERE id = $${p} RETURNING id, type, name, external_id, lat, lng, description, created_at`,
        values
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Recommendation not found' })
      }
      const r = result.rows[0]
      res.json({
        id: r.id,
        type: r.type,
        name: r.name,
        externalId: r.external_id,
        lat: r.lat != null ? parseFloat(r.lat) : null,
        lng: r.lng != null ? parseFloat(r.lng) : null,
        description: r.description,
        createdAt: r.created_at,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Error updating recommendation' })
    }
  }
)

/**
 * DELETE /api/exploration/recommendations/:id
 * Delete recommendation (admin).
 */
router.delete(
  '/exploration/recommendations/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id } = req.params
    try {
      const result = await pool.query(
        'DELETE FROM recommendations WHERE id = $1 RETURNING id',
        [id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Recommendation not found' })
      }
      res.status(204).send()
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Error deleting recommendation' })
    }
  }
)

module.exports = router
