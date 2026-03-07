const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const multer = require('multer')
const { requireAuth, requireAdmin } = require('../middleware/requireAdmin')

// -----------------------------------------------------------------------------
// Constants & config
// -----------------------------------------------------------------------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_CLOUD_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY
const VISION_MATCH_RADIUS_METERS = 600
const UPLOAD_MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const IMAGE_MIME_REGEX = /^image\/(jpeg|png|gif|webp)$/i
const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i

const checkpointsUploadsDir = path.join(__dirname, '..', 'uploads', 'checkpoints')
try {
  fs.mkdirSync(checkpointsUploadsDir, { recursive: true })
} catch {
  // ignore
}

/** Parse boolean from req.query or req.body (for consent flags etc.). */
function parseBoolParam(req, key) {
  const v = req.body?.[key] ?? req.query?.[key]
  return v === true || v === 'true'
}

/** Shared multer options for checkpoint image uploads. */
const imageUploadOpts = {
  limits: { fileSize: UPLOAD_MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, !!(file.mimetype && IMAGE_MIME_REGEX.test(file.mimetype)))
  },
}

const checkpointPhotoUpload = multer({
  ...imageUploadOpts,
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, checkpointsUploadsDir),
    filename: (req, file, cb) => {
      const ext = (file.originalname && path.extname(file.originalname)) || '.jpg'
      const safe = ext.toLowerCase().match(IMAGE_EXT_REGEX) ? ext : '.jpg'
      cb(null, `${req.params.id}_${req.params.order}_${Date.now()}${safe}`)
    },
  }),
})

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

/** SELECT list for routes metadata from routes r (with theme for content type). Use routesSelectWithoutTheme when theme column is missing (migration 024 not run). */
const ROUTES_SELECT_WITH_THEME = 'r.type, r.difficulty, r.theme, r.city, r.world, r.estimated_duration_min, r.radius_meters, r.is_active, r.title, r.image_url AS route_image_url'
const ROUTES_SELECT_WITHOUT_THEME = 'r.type, r.difficulty, r.city, r.world, r.estimated_duration_min, r.radius_meters, r.is_active, r.title, r.image_url AS route_image_url'

/** Content types for exploration routes (map symbols, filtering). Exposed as "type" in API. */
const ROUTE_TYPES = ['history', 'literature', 'culture', 'architecture', 'sports']
const ROUTE_DIFFICULTIES = ['easy', 'medium', 'hard']

function normalizeRouteType(t) {
  return ROUTE_TYPES.includes(t) ? t : 'history'
}

function normalizeDifficulty(d) {
  return ROUTE_DIFFICULTIES.includes(d) ? d : 'medium'
}

/**
 * Run a query that may reference routes.theme; on undefined_column (42703) retry with buildQueries(false).
 * buildQueries(useTheme) must return { text, values }. Returns the pg result.
 */
async function queryWithThemeFallback(pool, app, buildQueries) {
  const useTheme = app.get('routes_has_theme') !== false
  try {
    const { text, values } = buildQueries(useTheme)
    return await pool.query(text, values)
  } catch (err) {
    if (err.code === '42703' && useTheme) {
      app.set('routes_has_theme', false)
      const fallback = buildQueries(false)
      return await pool.query(fallback.text, fallback.values)
    }
    throw err
  }
}

/**
 * Run a query that inserts/updates with theme column; on 42703 retry with the fallback query.
 * withTheme and withoutTheme are { text, values }. Returns the pg result.
 */
async function queryWithThemeColumnFallback(pool, app, withTheme, withoutTheme) {
  try {
    return await pool.query(withTheme.text, withTheme.values)
  } catch (err) {
    if (err.code === '42703') {
      app.set('routes_has_theme', false)
      return await pool.query(withoutTheme.text, withoutTheme.values)
    }
    throw err
  }
}

/** Map DB route row (with optional r_* from routes join, first_cp for map) to API shape. type = content type (theme) when present, else route type (real/fantasy). */
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
  if (row.theme != null) {
    out.type = row.theme
  }
  if (row.first_cp_lat != null && row.first_cp_lng != null) {
    out.firstCheckpointLat = parseFloat(row.first_cp_lat)
    out.firstCheckpointLng = parseFloat(row.first_cp_lng)
  }
  if (row.route_image_url != null) {
    out.imageUrl = row.route_image_url
  } else if (row.first_cp_image_url != null) {
    out.imageUrl = row.first_cp_image_url
  }
  return out
}

/** Map checkpoint row to API shape. knowledgeCard includes quiz (question, answers, correctAnswerIndex) per contract. */
function mapCheckpointRow(row) {
  const out = {
    id: row.id,
    routeId: row.route_id,
    sequenceOrder: row.sequence_order,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    clueText: row.clue_text,
    imageUrl: row.image_url,
    knowledgeCard: buildRouteKnowledgeCard(row),
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
 * Query: ?type=history|literature|culture|architecture|sports to filter by route type. ?includeCheckpoints=1 to include checkpoints (for map pins).
 * Includes firstCheckpointLat, firstCheckpointLng for map display.
 */
// -----------------------------------------------------------------------------
// Routes: list, detail, create, update, delete
// -----------------------------------------------------------------------------

const ROUTES_LIST_FROM_JOIN = `FROM exploration_routes er
       LEFT JOIN routes r ON er.route_id = r.id
       LEFT JOIN LATERAL (
         SELECT c.lat, c.lng, c.image_url FROM route_checkpoints c
         WHERE c.route_id = er.id ORDER BY c.sequence_order LIMIT 1
       ) first_cp ON true`

router.get('/exploration/routes', async (req, res) => {
  const pool = req.app.get('pool')
  const app = req.app
  const isAdmin = req.session?.user?.type === 'admin'
  const typeFilter = ROUTE_TYPES.includes(req.query.type) ? req.query.type : null
  const includeCheckpoints =
    req.query.includeCheckpoints === '1' ||
    req.query.includeCheckpoints === 'true'
  try {
    const result = await queryWithThemeFallback(pool, app, (useTheme) => {
      const routesSelect = useTheme ? ROUTES_SELECT_WITH_THEME : ROUTES_SELECT_WITHOUT_THEME
      const values = [isAdmin]
      if (typeFilter && useTheme) values.push(typeFilter)
      let text = `SELECT er.id, er.name, er.description, er.created_by, er.is_public, er.created_at, er.updated_at,
              ${routesSelect},
              first_cp.lat AS first_cp_lat, first_cp.lng AS first_cp_lng, first_cp.image_url AS first_cp_image_url
       ${ROUTES_LIST_FROM_JOIN}
       WHERE (er.is_public = true OR $1 = true)`
      if (typeFilter && useTheme) text += ` AND r.theme = $${values.length}`
      text += ' ORDER BY er.updated_at DESC'
      return { text, values }
    })
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
        const xp = rid ? (xpByRoute[rid] ?? 0) : 0
        r.totalXp = xp
        r.expectedPoints = xp
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
 * GET /api/exploration/nearby-clues?lat=&lng=&radius=
 * Returns checkpoints (clues) within the given radius (meters) of the user position. For mobile "clues near you" list.
 * Auth: Optional.
 */
router.get('/exploration/nearby-clues', async (req, res) => {
  const pool = req.app.get('pool')
  const lat = parseFloat(req.query.lat)
  const lng = parseFloat(req.query.lng)
  const radiusM = parseInt(req.query.radius, 10) || 1000
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ message: 'Query parameters lat and lng are required and must be numbers' })
  }
  if (radiusM < 100 || radiusM > 50000) {
    return res.status(400).json({ message: 'radius must be between 100 and 50000 (meters)' })
  }
  try {
    const result = await pool.query(
      `SELECT c.id AS checkpoint_id, c.route_id, c.sequence_order, c.clue_text, c.image_url, c.lat, c.lng, c.xp_awarded,
              er.name AS route_name,
              ( 6371000 * 2 * asin(sqrt(
                  sin(radians(c.lat - $1) / 2) * sin(radians(c.lat - $1) / 2) +
                  cos(radians($1)) * cos(radians(c.lat)) *
                  sin(radians(c.lng - $2) / 2) * sin(radians(c.lng - $2) / 2)
                )) )::int AS distance_meters
       FROM route_checkpoints c
       JOIN exploration_routes er ON er.id = c.route_id
       LEFT JOIN routes r ON r.id = er.route_id
       WHERE er.is_public = true
         AND ( 6371000 * 2 * asin(sqrt(
                sin(radians(c.lat - $1) / 2) * sin(radians(c.lat - $1) / 2) +
                cos(radians($1)) * cos(radians(c.lat)) *
                sin(radians(c.lng - $2) / 2) * sin(radians(c.lng - $2) / 2)
              )) ) <= $3
       ORDER BY distance_meters ASC
       LIMIT 100`,
      [lat, lng, radiusM]
    )
    const clues = result.rows.map((row) => ({
      checkpointId: row.checkpoint_id,
      routeId: row.route_id,
      routeName: row.route_name,
      clueText: row.clue_text,
      imageUrl: row.image_url || null,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      sequenceOrder: row.sequence_order,
      xpAwarded: row.xp_awarded ?? 0,
      distanceMeters: row.distance_meters ?? 0,
    }))
    res.json({ clues })
  } catch (err) {
    if (err.code === '42P01') return res.json({ clues: [] })
    console.error(err)
    res.status(500).json({ message: 'Error fetching nearby clues' })
  }
})

/**
 * GET /api/exploration/quiz?clue=<clue>
 * Quiz by checkpoint clue. Contract: RoutePlayCheckpointResult (clue, knowledgeCard with question/answers/correctAnswerIndex, nearbyRecommendations, xpAwarded, nextCheckpointId, nextSequenceOrder).
 * Auth: Required.
 */
router.get('/exploration/quiz', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const clue = req.query.clue
  if (!clue || typeof clue !== 'string' || !clue.trim()) {
    return res.status(400).json({ message: 'Missing or empty query parameter: clue' })
  }
  const normalized = clue.trim()
  try {
    const cpResult = await pool.query(
      `SELECT c.id, c.route_id, c.sequence_order, c.clue_text, c.image_url, c.knowledge_card, c.xp_awarded, c.quiz_question, c.quiz_options,
              (SELECT json_agg(json_build_object('type', r.type, 'id', r.external_id))
               FROM route_checkpoint_recommendations cpr
               JOIN recommendations r ON r.id = cpr.recommendation_id
               WHERE cpr.checkpoint_id = c.id) AS nearby_recommendations
       FROM route_checkpoints c
       WHERE TRIM(c.clue_text) = $1
       LIMIT 1`,
      [normalized]
    )
    if (cpResult.rows.length === 0) {
      return res.status(404).json({ message: 'Checkpoint not found for this clue' })
    }
    const c = cpResult.rows[0]
    const routeId = c.route_id
    const seq = c.sequence_order
    const nextResult = await pool.query(
      'SELECT id, sequence_order FROM route_checkpoints WHERE route_id = $1 AND sequence_order = $2',
      [routeId, seq + 1]
    )
    const nextRow = nextResult.rows[0] || null
    res.json({
      nextCheckpointId: nextRow?.id ?? null,
      nextSequenceOrder: nextRow != null ? nextRow.sequence_order : null,
      clue: c.clue_text,
      imageUrl: c.image_url || null,
      knowledgeCard: buildRouteKnowledgeCard(c),
      nearbyRecommendations: c.nearby_recommendations || [],
      xpAwarded: c.xp_awarded ?? 0,
    })
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ message: 'Route or checkpoint not found' })
    console.error(err)
    res.status(500).json({ message: 'Error fetching quiz by clue' })
  }
})

/**
 * POST /api/exploration/routes
 * Create route (admin). Body: name, description, is_public, and optional difficulty, type, city, estimated_duration_min, radius_meters. type = history|literature|culture|architecture|sports.
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
      difficulty,
      type: bodyType,
      city,
      estimated_duration_min,
      radius_meters,
    } = req.body || {}
    const routeDifficulty = normalizeDifficulty(difficulty)
    const routeType = normalizeRouteType(bodyType)
    try {
      const routeResult = await queryWithThemeColumnFallback(
        pool,
        req.app,
        {
          text: `INSERT INTO routes (title, description, type, difficulty, theme, city, world, estimated_duration_min, radius_meters, is_active, updated_at)
       VALUES ($1, $2, 'real', $3, $4, $5, NULL, $6, $7, true, NOW())
       RETURNING id`,
          values: [
            name || 'New route',
            description || null,
            routeDifficulty,
            routeType,
            city || null,
            estimated_duration_min ?? null,
            radius_meters ?? null,
          ],
        },
        {
          text: `INSERT INTO routes (title, description, type, difficulty, city, world, estimated_duration_min, radius_meters, is_active, updated_at)
       VALUES ($1, $2, 'real', $3, $4, NULL, $5, $6, true, NOW())
       RETURNING id`,
          values: [
            name || 'New route',
            description || null,
            routeDifficulty,
            city || null,
            estimated_duration_min ?? null,
            radius_meters ?? null,
          ],
        }
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
            type: 'real',
            difficulty: routeDifficulty,
            theme: routeType,
            city: city || null,
            world: null,
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
 * Create route + checkpoints from pasted JSON. Body: one route object. name/title optional (default "Imported route"). checkpoints required.
 * Frontend may send one or more objects by calling this endpoint per object.
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
    const difficulty = normalizeDifficulty(body.difficulty)
    const city =
      body.city != null ? String(body.city).trim() || null : null
    const radiusMeters =
      body.radiusMeters != null ? Math.max(0, Number(body.radiusMeters)) : null
    const estimatedDurationMin =
      body.estimatedDurationMin != null
        ? Math.max(0, Number(body.estimatedDurationMin))
        : null
    const routeImageUrl =
      body.imageUrl != null || body.image_url != null
        ? String(body.imageUrl ?? body.image_url).trim() || null
        : null
    const routeType = normalizeRouteType(body.type ?? body.theme)
    const rawCheckpoints = Array.isArray(body.checkpoints)
      ? body.checkpoints
      : []
    const routeName = name || 'Imported route'
    if (rawCheckpoints.length === 0) {
      return res
        .status(400)
        .json({ message: 'checkpoints array required and must not be empty' })
    }
    try {
      const rResult = await queryWithThemeColumnFallback(
        pool,
        req.app,
        {
          text: `INSERT INTO routes (title, description, type, difficulty, theme, city, world, estimated_duration_min, radius_meters, image_url, is_active, updated_at)
       VALUES ($1, $2, 'real', $3, $4, $5, NULL, $6, $7, $8, true, NOW())
       RETURNING id`,
          values: [
            routeName,
            description,
            difficulty,
            routeType,
            city,
            estimatedDurationMin,
            radiusMeters,
            routeImageUrl,
          ],
        },
        {
          text: `INSERT INTO routes (title, description, type, difficulty, city, world, estimated_duration_min, radius_meters, image_url, is_active, updated_at)
       VALUES ($1, $2, 'real', $3, $4, NULL, $5, $6, $7, true, NOW())
       RETURNING id`,
          values: [
            routeName,
            description,
            difficulty,
            city,
            estimatedDurationMin,
            radiusMeters,
            routeImageUrl,
          ],
        }
      )
      const metaRouteId = rResult.rows[0].id
      const routeResult = await pool.query(
        `INSERT INTO exploration_routes (name, description, created_by, is_public, route_id)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id, name, description, created_by, is_public, created_at, updated_at`,
        [routeName, description, userId ?? null, metaRouteId]
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
        const cpImageUrl =
          c.imageUrl != null || c.image_url != null
            ? String(c.imageUrl ?? c.image_url).trim() || null
            : null
        await pool.query(
          `INSERT INTO route_checkpoints (route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, validation_radius_meters)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, 10, $7, $8, $9)`,
          [
            routeId,
            sequenceOrder,
            lat,
            lng,
            clueText,
            cpImageUrl,
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
          type: 'real',
          difficulty,
          theme: routeType,
          city,
          world: null,
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
      difficulty,
      type: bodyType,
      city,
      checkpoints: rawCheckpoints,
    } = req.body || {}
    const checkpoints = Array.isArray(rawCheckpoints) ? rawCheckpoints : []
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name required' })
    }
    const routeDifficulty = normalizeDifficulty(difficulty)
    const routeType = normalizeRouteType(bodyType)
    try {
      const rResult = await queryWithThemeColumnFallback(
        pool,
        req.app,
        {
          text: `INSERT INTO routes (title, description, type, difficulty, theme, city, world, is_active, updated_at)
       VALUES ($1, $2, 'real', $3, $4, $5, NULL, true, NOW())
       RETURNING id`,
          values: [
            name.trim(),
            description?.trim() || null,
            routeDifficulty,
            routeType,
            city || null,
          ],
        },
        {
          text: `INSERT INTO routes (title, description, type, difficulty, city, world, is_active, updated_at)
       VALUES ($1, $2, 'real', $3, $4, NULL, true, NOW())
       RETURNING id`,
          values: [
            name.trim(),
            description?.trim() || null,
            routeDifficulty,
            city || null,
          ],
        }
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
          type: 'real',
          difficulty: routeDifficulty,
          theme: routeType,
          city: city || null,
          world: null,
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
const ROUTE_BY_ID_SELECT = (routesSelect) =>
  `SELECT er.id, er.name, er.description, er.created_by, er.is_public, er.created_at, er.updated_at,
       ${routesSelect}
   FROM exploration_routes er
   LEFT JOIN routes r ON er.route_id = r.id
   WHERE er.id = $1`

router.get('/exploration/routes/:id', async (req, res) => {
  const pool = req.app.get('pool')
  const app = req.app
  const { id } = req.params
  try {
    const routeResult = await queryWithThemeFallback(pool, app, (useTheme) => ({
      text: ROUTE_BY_ID_SELECT(useTheme ? ROUTES_SELECT_WITH_THEME : ROUTES_SELECT_WITHOUT_THEME),
      values: [id],
    }))
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Route not found' })
    }
    const row0 = routeResult.rows[0]
    const route = mapRouteRow(row0)
    if (row0.route_image_url) route.imageUrl = row0.route_image_url
    const checkpointsResult = await pool.query(
      `SELECT id, route_id, sequence_order, lat, lng, clue_text, image_url, knowledge_card, xp_awarded, quiz_question, quiz_options, created_at
       FROM route_checkpoints
       WHERE route_id = $1
       ORDER BY sequence_order`,
      [id]
    )
    const checkpoints = checkpointsResult.rows.map((row) => mapCheckpointRow(row))
    const totalXp = checkpoints.reduce((sum, c) => sum + (c.xpAwarded ?? 0), 0)
    if (route.imageUrl == null && checkpoints.length > 0 && checkpoints[0].imageUrl != null) {
      route.imageUrl = checkpoints[0].imageUrl
    }
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
    res.json({ ...route, checkpoints, totalXp, expectedPoints: totalXp, recommendations })
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
      difficulty,
      type: patchType,
      city,
      world,
      estimated_duration_min,
      radius_meters,
      is_active,
      image_url,
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
        if (difficulty !== undefined && ROUTE_DIFFICULTIES.includes(difficulty)) {
          rUpdates.push(`difficulty = $${q++}`)
          rValues.push(difficulty)
        }
        if (patchType !== undefined && ROUTE_TYPES.includes(patchType) && req.app.get('routes_has_theme') !== false) {
          rUpdates.push(`theme = $${q++}`)
          rValues.push(patchType)
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
        if (image_url !== undefined) {
          rUpdates.push(`image_url = $${q++}`)
          rValues.push(image_url != null ? String(image_url).trim() || null : null)
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
      const result = await queryWithThemeFallback(pool, req.app, (useTheme) => ({
        text: ROUTE_BY_ID_SELECT(useTheme ? ROUTES_SELECT_WITH_THEME : ROUTES_SELECT_WITHOUT_THEME),
        values: [id],
      }))
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Route not found' })
      }
      const patchRow = result.rows[0]
      const route = mapRouteRow(patchRow)
      if (patchRow.route_image_url) route.imageUrl = patchRow.route_image_url
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
      route.expectedPoints = route.totalXp
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

// -----------------------------------------------------------------------------
// Checkpoints: list, create, update, delete
// -----------------------------------------------------------------------------

/**
 * GET /api/exploration/routes/:id/checkpoints
 * List checkpoints for a route (ordered).
 */
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

/** Build RouteKnowledgeCard for API: merge knowledge_card JSON with quiz (question, answers, correctAnswerIndex). */
function buildRouteKnowledgeCard(row) {
  const base =
    row.knowledge_card && typeof row.knowledge_card === 'object'
      ? { ...row.knowledge_card }
      : {}
  const quiz = mapRowToQuiz(row)
  if (quiz) {
    base.question = quiz.question
    base.answers = quiz.options
    base.correctAnswerIndex = quiz.correctAnswerIndex
  }
  return Object.keys(base).length ? base : null
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

/**
 * Build API response for clue/checkpoint content (photo, photo-for-clue, play).
 * row: DB checkpoint row. overrides: { imageUrl?, selfieUrl?, visionConfirmed? } merged into result.
 */
function buildClueResponseFromRow(row, overrides = {}) {
  const quiz = mapRowToQuiz(row)
  const out = {
    clueText: row.clue_text,
    imageUrl: row.image_url || null,
    knowledgeCard: buildRouteKnowledgeCard(row),
    nearbyRecommendations: row.nearby_recommendations || [],
    xpAwarded: row.xp_awarded ?? 0,
    ...overrides,
  }
  if (quiz) out.quiz = quiz
  return out
}

/** SQL: fetch one checkpoint by route_id and sequence_order, with nearby_recommendations. */
const SELECT_CHECKPOINT_BY_ORDER = `
  SELECT c.id, c.sequence_order, c.lat, c.lng, c.clue_text, c.image_url, c.quiz_question, c.quiz_options, c.knowledge_card, c.xp_awarded,
    (SELECT json_agg(json_build_object('type', r.type, 'id', r.external_id))
     FROM route_checkpoint_recommendations cpr
     JOIN recommendations r ON r.id = cpr.recommendation_id
     WHERE cpr.checkpoint_id = c.id) AS nearby_recommendations
  FROM route_checkpoints c
  WHERE c.route_id = $1 AND c.sequence_order = $2
`

/** Haversine distance in meters between two lat/lng points. */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Call Google Cloud Vision API: LANDMARK_DETECTION + WEB_DETECTION.
 * imageBase64: raw base64 string (no data URL prefix).
 * Returns { landmarkAnnotations, webDetection } from first response, or null on error.
 */
async function visionAnnotate(imageBase64) {
  if (!GOOGLE_CLOUD_VISION_API_KEY) return null
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(GOOGLE_CLOUD_VISION_API_KEY)}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [
              { type: 'LANDMARK_DETECTION', maxResults: 5 },
              { type: 'WEB_DETECTION', maxResults: 5 },
            ],
          },
        ],
      }),
    })
    const data = await res.json()
    if (data.responses?.[0]?.error) {
      console.warn('Vision API error', data.responses[0].error)
      return null
    }
    const r = data.responses[0] || {}
    return {
      landmarkAnnotations: r.landmarkAnnotations || [],
      webDetection: r.webDetection || {},
    }
  } catch (e) {
    console.warn('Vision request failed', e.message)
    return null
  }
}

/**
 * Decide if Vision result matches this quiz point (checkpoint).
 * - Landmark: any detected landmark location within VISION_MATCH_RADIUS_METERS of checkpoint.
 * - Web: any webEntity description or bestGuessLabel that appears in clueOrQuestion (case-insensitive).
 */
function visionMatchesCheckpoint(visionResult, checkpointLat, checkpointLng, clueOrQuestion) {
  if (!visionResult) return false
  const text = (clueOrQuestion || '').toLowerCase()
  const words = text.split(/\s+/).filter((w) => w.length > 3)
  if (visionResult.landmarkAnnotations?.length) {
    for (const ann of visionResult.landmarkAnnotations) {
      const locs = ann.locations || []
      for (const loc of locs) {
        const lat = loc.latLng?.latitude ?? loc.latLng?.lat
        const lng = loc.latLng?.longitude ?? loc.latLng?.lng
        if (lat != null && lng != null) {
          const dist = haversineMeters(checkpointLat, checkpointLng, lat, lng)
          if (dist <= VISION_MATCH_RADIUS_METERS) return true
        }
      }
    }
  }
  const web = visionResult.webDetection || {}
  const labels = [
    ...(web.webEntities || []).map((e) => (e.description || '').toLowerCase()),
    ...(web.bestGuessLabels || []).map((l) => (l.label || '').toLowerCase()),
  ].filter(Boolean)
  for (const label of labels) {
    for (const word of words) {
      if (word.length > 3 && label.includes(word)) return true
    }
    if (label.length > 4 && text.includes(label)) return true
  }
  return false
}

/** Multer for photo-for-clue: photo (required) + optional selfie. */
const photoForClueUpload = multer({
  ...imageUploadOpts,
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, checkpointsUploadsDir),
    filename: (req, file, cb) => {
      const ext = (file.originalname && path.extname(file.originalname)) || '.jpg'
      const safe = ext.toLowerCase().match(IMAGE_EXT_REGEX) ? ext : '.jpg'
      const prefix = file.fieldname === 'selfie' ? 'selfie_' : 'photo_'
      cb(null, `${prefix}${req.params.id}_${req.params.order}_${Date.now()}${safe}`)
    },
  }),
}).fields([{ name: 'photo', maxCount: 1 }, { name: 'selfie', maxCount: 1 }])

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

// -----------------------------------------------------------------------------
// Photo upload: clue (optional camera after wrong answer)
// -----------------------------------------------------------------------------

/**
 * POST /api/exploration/routes/:id/checkpoints/:order/photo
 * Upload a photo at the checkpoint location. Returns stored clue + quiz.
 * Body: multipart "photo". Query/body: consentToSaveImage to store as checkpoint image_url.
 */
router.post(
  '/exploration/routes/:id/checkpoints/:order/photo',
  requireAuth,
  checkpointPhotoUpload.single('photo'),
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id: routeId, order } = req.params
    const seq = parseInt(order, 10)
    if (Number.isNaN(seq) || seq < 0) {
      return res.status(400).json({ message: 'Invalid sequence order' })
    }
    const consentToSaveImage = parseBoolParam(req, 'consentToSaveImage')
    try {
      let imageUrlOverride = null
      if (req.file) {
        imageUrlOverride = `/api/uploads/checkpoints/${req.file.filename}`
        if (consentToSaveImage) {
          await pool.query(
            `UPDATE route_checkpoints SET image_url = $1 WHERE route_id = $2 AND sequence_order = $3`,
            [imageUrlOverride, routeId, seq]
          )
        }
      }
      const cpResult = await pool.query(SELECT_CHECKPOINT_BY_ORDER, [routeId, seq])
      if (cpResult.rows.length === 0) {
        return res.status(404).json({ message: 'Checkpoint not found' })
      }
      const row = cpResult.rows[0]
      const out = buildClueResponseFromRow(row, {
        imageUrl: imageUrlOverride ?? row.image_url ?? null,
      })
      res.json(out)
    } catch (err) {
      if (err.code === '42P01')
        return res.status(404).json({ message: 'Route not found' })
      console.error(err)
      res.status(500).json({ message: 'Error processing photo' })
    }
  }
)

/**
 * POST /api/exploration/routes/:id/checkpoints/:order/photo-for-clue
 * After a wrong answer, user can use camera to get the stored clue. Always returns stored clue + quiz.
 * Optional fallback: if GOOGLE_CLOUD_VISION_API_KEY is set, Vision (landmark + web detection) is used
 * to confirm the photo matches this quiz point; when Vision is not set or does not match, the clue is
 * still returned (Vision is not required).
 * Body: multipart "photo" (required), optional "selfie". Query/body: consentToSaveImage, consentToSaveSelfie.
 */
router.post(
  '/exploration/routes/:id/checkpoints/:order/photo-for-clue',
  requireAuth,
  photoForClueUpload,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { id: routeId, order } = req.params
    const seq = parseInt(order, 10)
    if (Number.isNaN(seq) || seq < 0) {
      return res.status(400).json({ message: 'Invalid sequence order' })
    }
    const photoFile = req.files?.photo?.[0]
    if (!photoFile) {
      return res.status(400).json({ message: 'Missing photo: send multipart form with field "photo"' })
    }
    const consentToSaveImage = parseBoolParam(req, 'consentToSaveImage')
    const consentToSaveSelfie = parseBoolParam(req, 'consentToSaveSelfie')

    try {
      const cpResult = await pool.query(SELECT_CHECKPOINT_BY_ORDER, [routeId, seq])
      if (cpResult.rows.length === 0) {
        return res.status(404).json({ message: 'Checkpoint not found' })
      }
      const row = cpResult.rows[0]

      // Optional: run Vision to set visionConfirmed (does not block response)
      let visionConfirmed = null
      if (GOOGLE_CLOUD_VISION_API_KEY) {
        const lat = parseFloat(row.lat)
        const lng = parseFloat(row.lng)
        const clueOrQuestion = [row.clue_text, row.quiz_question].filter(Boolean).join(' ')
        const imageBase64 = fs.readFileSync(photoFile.path, { encoding: 'base64' })
        const visionResult = await visionAnnotate(imageBase64)
        visionConfirmed = visionMatchesCheckpoint(visionResult, lat, lng, clueOrQuestion)
      }

      let imageUrl = `/api/uploads/checkpoints/${photoFile.filename}`
      if (consentToSaveImage) {
        await pool.query(
          `UPDATE route_checkpoints SET image_url = $1 WHERE route_id = $2 AND sequence_order = $3`,
          [imageUrl, routeId, seq]
        )
      }

      const selfieFile = req.files?.selfie?.[0]
      const selfieUrl =
        selfieFile && consentToSaveSelfie
          ? `/api/uploads/checkpoints/${selfieFile.filename}`
          : null

      const overrides = { imageUrl }
      if (selfieUrl) overrides.selfieUrl = selfieUrl
      if (visionConfirmed !== null) overrides.visionConfirmed = visionConfirmed
      const out = buildClueResponseFromRow(row, overrides)
      res.json(out)
    } catch (err) {
      if (err.code === '42P01') {
        return res.status(404).json({ message: 'Route not found' })
      }
      console.error(err)
      res.status(500).json({ message: 'Error processing photo for clue' })
    }
  }
)

// -----------------------------------------------------------------------------
// Play flow: get checkpoint, submit answer, photo-for-clue
// -----------------------------------------------------------------------------

/**
 * GET /api/exploration/routes/:id/play/checkpoint/:order
 * Player: get clue, knowledge card, nearby recommendations, xp for checkpoint.
 * Response: { nextCheckpointId, nextSequenceOrder, clue, imageUrl, knowledgeCard, nearbyRecommendations, xpAwarded }
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
        `SELECT c.id, c.sequence_order, c.clue_text, c.image_url, c.knowledge_card, c.xp_awarded, c.quiz_question, c.quiz_options,
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
        imageUrl: c.image_url || null,
        knowledgeCard: buildRouteKnowledgeCard(c),
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
 * POST /api/exploration/routes/:routeId/play/checkpoint/:order/answer
 * Contract: body { selectedAnswerIndex: number }. Returns { correct, xpAwarded, message? }.
 */
router.post(
  '/exploration/routes/:id/play/checkpoint/:order/answer',
  requireAuth,
  async (req, res) => {
    const pool = req.app.get('pool')
    const userId = req.session?.user?.id
    const { id: routeId, order } = req.params
    const { selectedAnswerIndex } = req.body || {}
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' })
    }
    const seq = parseInt(order, 10)
    if (Number.isNaN(seq) || seq < 0) {
      return res.status(400).json({ message: 'Invalid sequence order' })
    }
    const selected = typeof selectedAnswerIndex === 'number' ? selectedAnswerIndex : parseInt(selectedAnswerIndex, 10)
    if (Number.isNaN(selected) || selected < 0) {
      return res.status(400).json({ message: 'Invalid selectedAnswerIndex' })
    }
    try {
      const cpResult = await pool.query(
        'SELECT id, xp_awarded, quiz_question, quiz_options FROM route_checkpoints WHERE route_id = $1 AND sequence_order = $2',
        [routeId, seq]
      )
      if (cpResult.rows.length === 0) {
        return res.status(404).json({ message: 'Checkpoint not found' })
      }
      const c = cpResult.rows[0]
      const quiz = mapRowToQuiz(c)
      const correctIndex = quiz ? quiz.correctAnswerIndex : 0
      const correct = selected === correctIndex
      const xpAwarded = correct ? (c.xp_awarded ?? 0) : 0
      if (correct) {
        await pool.query(
          `INSERT INTO user_route_checkpoint_completions (user_id, checkpoint_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, checkpoint_id) DO NOTHING`,
          [userId, c.id]
        )
      }
      res.status(200).json({
        correct,
        xpAwarded,
        ...(correct && { message: 'Correct!' }),
      })
    } catch (err) {
      if (err.code === '42P01') return res.status(404).json({ message: 'Checkpoint not found' })
      console.error(err)
      res.status(500).json({ message: 'Error submitting answer' })
    }
  }
)

/**
 * GET /api/exploration/users/me/completed-checkpoints
 * Returns checkpoint IDs the current user has completed (solved). Query: ?routeId= to filter by route.
 */
router.get('/exploration/users/me/completed-checkpoints', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const userId = req.session?.user?.id
  const routeId = req.query.routeId
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' })
  }
  try {
    let result
    if (routeId) {
      result = await pool.query(
        `SELECT c.checkpoint_id
         FROM user_route_checkpoint_completions c
         JOIN route_checkpoints rcp ON rcp.id = c.checkpoint_id
         WHERE c.user_id = $1 AND rcp.route_id = $2`,
        [userId, routeId]
      )
    } else {
      result = await pool.query(
        'SELECT checkpoint_id FROM user_route_checkpoint_completions WHERE user_id = $1',
        [userId]
      )
    }
    const completedCheckpointIds = result.rows.map((r) => r.checkpoint_id)
    res.json({ completedCheckpointIds })
  } catch (err) {
    if (err.code === '42P01') return res.json({ completedCheckpointIds: [] })
    console.error(err)
    res.status(500).json({ message: 'Error fetching completed checkpoints' })
  }
})

/**
 * POST /api/exploration/routes/:routeId/checkpoints/:checkpointId/complete
 * Mark checkpoint as completed (solved) for the current user. Call after user answers correctly.
 */
router.post(
  '/exploration/routes/:routeId/checkpoints/:checkpointId/complete',
  requireAuth,
  async (req, res) => {
    const pool = req.app.get('pool')
    const userId = req.session?.user?.id
    const { routeId, checkpointId } = req.params
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' })
    }
    try {
      const check = await pool.query(
        'SELECT id FROM route_checkpoints WHERE id = $1 AND route_id = $2',
        [checkpointId, routeId]
      )
      if (check.rows.length === 0) {
        return res.status(404).json({ message: 'Checkpoint not found' })
      }
      await pool.query(
        `INSERT INTO user_route_checkpoint_completions (user_id, checkpoint_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, checkpoint_id) DO NOTHING`,
        [userId, checkpointId]
      )
      res.status(204).send()
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Error completing checkpoint' })
    }
  }
)

/**
 * POST /api/exploration/routes/:routeId/checkpoints/:checkpointId/scan-clue
 * User scans with camera; server uses vision AI to return a short clue for the quiz answer.
 * Body: { imageBase64: string } (raw base64 or data URL e.g. "data:image/jpeg;base64,...").
 * Response: { clue: string }.
 */
router.post(
  '/exploration/routes/:routeId/checkpoints/:checkpointId/scan-clue',
  requireAuth,
  async (req, res) => {
    const pool = req.app.get('pool')
    const { routeId, checkpointId } = req.params
    const { imageBase64 } = req.body || {}
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ message: 'Missing imageBase64 in body' })
    }
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ message: 'Scan-for-clue not available; set OPENAI_API_KEY' })
    }
    try {
      const cpResult = await pool.query(
        'SELECT quiz_question, quiz_options FROM route_checkpoints WHERE id = $1 AND route_id = $2',
        [checkpointId, routeId]
      )
      if (cpResult.rows.length === 0) {
        return res.status(404).json({ message: 'Checkpoint not found' })
      }
      const row = cpResult.rows[0]
      const question = row.quiz_question || ''
      const options = Array.isArray(row.quiz_options) ? row.quiz_options : []
      const optionsText = options.length ? options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n') : ''

      let imageUrl = imageBase64.trim()
      if (!imageUrl.startsWith('data:')) {
        imageUrl = `data:image/jpeg;base64,${imageUrl}`
      }

      const prompt = `The user is at a location and has opened a quiz. They took a photo with their camera to get a hint.

Quiz question: ${question}
Answer options:
${optionsText || '(none)'}

Based only on what you see in the image, give a short clue (1–2 sentences) that helps them choose the correct answer. Do NOT say which option is correct. Be suggestive and refer to what is visible (e.g. text, object, building).`

      const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 150,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
        }),
      })
      const visionData = await visionRes.json()
      const clue = visionData?.choices?.[0]?.message?.content?.trim()
      if (!clue) {
        throw new Error(visionData?.error?.message || 'No clue from vision')
      }
      res.json({ clue })
    } catch (err) {
      console.error('scan-clue error', err)
      if (err.message && err.message.includes('not available')) {
        return res.status(503).json({ message: err.message })
      }
      res.status(500).json({ message: 'Failed to get clue from image' })
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
