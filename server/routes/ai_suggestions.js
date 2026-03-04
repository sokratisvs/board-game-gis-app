const express = require('express')
const router = express.Router()
const { requireAuth, requireAdmin } = require('../middleware/requireAdmin')

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const SUGGESTION_SELECT = `id, checkpoint_id, generated_clue, generated_knowledge_title, generated_knowledge_description,
  generated_fun_fact, generated_quiz_question, generated_quiz_options, status, reviewed_by, reviewed_at, approved_by_username, created_at`

async function getCheckpoint (pool, checkpointId) {
  const r = await pool.query('SELECT id, title, description, scene FROM checkpoints WHERE id = $1', [checkpointId])
  return r.rows[0] || null
}

async function getSuggestion (pool, id) {
  const r = await pool.query(
    `SELECT ${SUGGESTION_SELECT} FROM ai_suggestions WHERE id = $1`,
    [id]
  )
  return r.rows[0] || null
}

/** Normalize options from DB: array of { optionText, isCorrect }. */
function parseOptions (raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((o) => ({
    optionText: o?.optionText ?? o?.option_text ?? String(o),
    isCorrect: Boolean(o?.isCorrect ?? o?.is_correct),
  }))
}

/** API response: { aiSuggestion: { clue, knowledgeCard, quizQuestion, options }, status, approvedBy?, approvedAt?, id, checkpointId, createdAt }. */
function mapSuggestionToApi (row) {
  const options = parseOptions(row.generated_quiz_options)
  const api = {
    id: row.id,
    checkpointId: row.checkpoint_id,
    aiSuggestion: {
      clue: row.generated_clue ?? '',
      knowledgeCard: {
        title: row.generated_knowledge_title ?? '',
        description: row.generated_knowledge_description ?? '',
        funFact: row.generated_fun_fact ?? undefined,
      },
      quizQuestion: row.generated_quiz_question ?? '',
      options,
    },
    status: row.status,
    createdAt: row.created_at,
  }
  if (row.status === 'approved' || row.status === 'rejected') {
    api.approvedBy = row.approved_by_username ?? row.reviewed_by ?? null
    api.approvedAt = row.reviewed_at ?? null
  }
  return api
}

/** Legacy flat shape (for backward compatibility in create response). */
function mapSuggestionRow (row) {
  const out = {
    id: row.id,
    checkpointId: row.checkpoint_id,
    generatedClue: row.generated_clue,
    generatedKnowledgeTitle: row.generated_knowledge_title,
    generatedKnowledgeDescription: row.generated_knowledge_description,
    generatedFunFact: row.generated_fun_fact,
    generatedQuizQuestion: row.generated_quiz_question,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }
  if (row.generated_quiz_options !== undefined) out.generatedQuizOptions = parseOptions(row.generated_quiz_options)
  if (row.approved_by_username !== undefined) out.approvedByUsername = row.approved_by_username
  return out
}

/**
 * Call OpenAI to generate one checkpoint suggestion: clue, knowledgeCard, quizQuestion, options.
 * Optional context: { scene?, title? } for fantasy/context. Returns null if no API key.
 */
async function generateCheckpointSuggestionWithAI (context = {}) {
  if (!OPENAI_API_KEY) return null
  const { scene, title, routeTitle } = context
  const prompt = `You are helping create content for a quiz checkpoint in an exploration app.
Generate exactly one suggestion with:
1. clue: one short evocative sentence (riddle or hint).
2. knowledgeCard: object with title (string), description (string, 1-2 sentences), funFact (optional string).
3. quizQuestion: one multiple-choice question (string).
4. options: array of 4 objects, each { "optionText": "string", "isCorrect": boolean }. Exactly one must have isCorrect true.
${scene ? `Scene/place context: ${scene}` : ''}
${title ? `Checkpoint title: ${title}` : ''}
${routeTitle ? `Route: ${routeTitle}` : ''}
Reply with a single JSON object only, no markdown, no explanation. Keys: clue, knowledgeCard, quizQuestion, options.`
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
    const options = Array.isArray(parsed.options) ? parsed.options.map((o) => ({
      optionText: String(o?.optionText ?? o?.option_text ?? ''),
      isCorrect: Boolean(o?.isCorrect ?? o?.is_correct),
    })) : []
    return {
      clue: String(parsed.clue ?? ''),
      knowledgeCard: parsed.knowledgeCard && typeof parsed.knowledgeCard === 'object'
        ? {
            title: String(parsed.knowledgeCard.title ?? ''),
            description: String(parsed.knowledgeCard.description ?? ''),
            funFact: parsed.knowledgeCard.funFact != null ? String(parsed.knowledgeCard.funFact) : undefined,
          }
        : { title: '', description: '', funFact: undefined },
      quizQuestion: String(parsed.quizQuestion ?? parsed.quiz_question ?? ''),
      options,
    }
  } catch (err) {
    console.error('AI generate checkpoint suggestion error', err)
    throw err
  }
}

/**
 * GET /api/checkpoints/:checkpointId/ai-suggestions
 * List AI suggestions (optional ?status=pending_review|pending|approved|rejected).
 * Response: array of { aiSuggestion, status, approvedBy?, approvedAt?, id, checkpointId, createdAt }.
 */
router.get('/checkpoints/:checkpointId/ai-suggestions', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { checkpointId } = req.params
  const { status } = req.query
  try {
    const checkpoint = await getCheckpoint(pool, checkpointId)
    if (!checkpoint) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    let query = `SELECT ${SUGGESTION_SELECT} FROM ai_suggestions WHERE checkpoint_id = $1`
    const values = [checkpointId]
    if (status && ['pending', 'pending_review', 'approved', 'rejected'].includes(status)) {
      query += ' AND status = $2'
      values.push(status)
    }
    query += ' ORDER BY created_at DESC'
    const result = await pool.query(query, values)
    res.json(result.rows.map(mapSuggestionToApi))
  } catch (err) {
    if (err.code === '42P01') return res.json([])
    console.error(err)
    res.status(500).json({ message: 'Error listing AI suggestions' })
  }
})

/**
 * POST /api/checkpoints/:checkpointId/ai-suggestions/generate
 * Generate AI suggestion (one OpenAI call), save as pending_review, return full shape. Admin.
 */
router.post('/checkpoints/:checkpointId/ai-suggestions/generate', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { checkpointId } = req.params
  try {
    const checkpoint = await getCheckpoint(pool, checkpointId)
    if (!checkpoint) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    const context = {
      scene: checkpoint.scene,
      title: checkpoint.title || checkpoint.description,
      routeTitle: null,
    }
    const suggestion = await generateCheckpointSuggestionWithAI(context)
    if (!suggestion) {
      return res.status(503).json({
        message: 'AI generation not available; set OPENAI_API_KEY for generate',
        fallback: 'Create suggestion manually via POST /checkpoints/:id/ai-suggestions with body',
      })
    }
    const optsJson = JSON.stringify(suggestion.options)
    const result = await pool.query(
      `INSERT INTO ai_suggestions (checkpoint_id, generated_clue, generated_knowledge_title, generated_knowledge_description, generated_fun_fact, generated_quiz_question, generated_quiz_options, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending_review')
       RETURNING ${SUGGESTION_SELECT}`,
      [
        checkpointId,
        suggestion.clue,
        suggestion.knowledgeCard?.title ?? '',
        suggestion.knowledgeCard?.description ?? '',
        suggestion.knowledgeCard?.funFact ?? null,
        suggestion.quizQuestion,
        optsJson,
      ]
    )
    const row = result.rows[0]
    res.status(201).json({
      ...mapSuggestionToApi(row),
      status: 'pending_review',
    })
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'ai_suggestions table not found; run migrations 013, 018' })
    }
    if (err.code === '23503') {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error generating AI suggestion' })
  }
})

/**
 * POST /api/checkpoints/:checkpointId/ai-suggestions
 * Create AI suggestion manually (admin). Body: aiSuggestion?: { clue, knowledgeCard, quizQuestion, options } or flat generated_*.
 * Default status: pending_review.
 */
router.post('/checkpoints/:checkpointId/ai-suggestions', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { checkpointId } = req.params
  const body = req.body || {}
  const aiSuggestion = body.aiSuggestion
  const flat = aiSuggestion
    ? {
        generated_clue: aiSuggestion.clue,
        generated_knowledge_title: aiSuggestion.knowledgeCard?.title,
        generated_knowledge_description: aiSuggestion.knowledgeCard?.description,
        generated_fun_fact: aiSuggestion.knowledgeCard?.funFact,
        generated_quiz_question: aiSuggestion.quizQuestion,
        generated_quiz_options: aiSuggestion.options,
      }
    : {}
  const generated_clue = flat.generated_clue ?? body.generated_clue
  const generated_knowledge_title = flat.generated_knowledge_title ?? body.generated_knowledge_title
  const generated_knowledge_description = flat.generated_knowledge_description ?? body.generated_knowledge_description
  const generated_fun_fact = flat.generated_fun_fact ?? body.generated_fun_fact
  const generated_quiz_question = flat.generated_quiz_question ?? body.generated_quiz_question
  const generated_quiz_options = flat.generated_quiz_options ?? body.generated_quiz_options
  const status = body.status === 'pending_review' || body.status === 'pending' ? (body.status) : 'pending_review'
  try {
    const checkpoint = await getCheckpoint(pool, checkpointId)
    if (!checkpoint) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    const optsJson = Array.isArray(generated_quiz_options)
      ? JSON.stringify(generated_quiz_options.map((o) => ({ optionText: o?.optionText ?? o?.option_text, isCorrect: Boolean(o?.isCorrect ?? o?.is_correct) })))
      : (typeof generated_quiz_options === 'string' ? generated_quiz_options : '[]')
    const result = await pool.query(
      `INSERT INTO ai_suggestions (checkpoint_id, generated_clue, generated_knowledge_title, generated_knowledge_description, generated_fun_fact, generated_quiz_question, generated_quiz_options, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING ${SUGGESTION_SELECT}`,
      [
        checkpointId,
        generated_clue != null ? String(generated_clue).trim() : null,
        generated_knowledge_title != null ? String(generated_knowledge_title).trim() : null,
        generated_knowledge_description != null ? String(generated_knowledge_description).trim() : null,
        generated_fun_fact != null ? String(generated_fun_fact).trim() : null,
        generated_quiz_question != null ? String(generated_quiz_question).trim() : null,
        optsJson,
        status,
      ]
    )
    res.status(201).json(mapSuggestionToApi(result.rows[0]))
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'ai_suggestions table not found; run migrations 013, 018' })
    }
    if (err.code === '23503') {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error creating AI suggestion' })
  }
})

/**
 * GET /api/ai-suggestions/:id
 * Get one AI suggestion. Response: { aiSuggestion, status, approvedBy?, approvedAt?, id, checkpointId, createdAt }.
 */
router.get('/ai-suggestions/:id', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const row = await getSuggestion(pool, id)
    if (!row) {
      return res.status(404).json({ message: 'AI suggestion not found' })
    }
    res.json(mapSuggestionToApi(row))
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ message: 'AI suggestion not found' })
    console.error(err)
    res.status(500).json({ message: 'Error fetching AI suggestion' })
  }
})

/**
 * PATCH /api/ai-suggestions/:id
 * Edit: update aiSuggestion fields (or flat generated_*). Approve/Reject: status 'approved' | 'rejected'.
 * When status is approved: copy to checkpoint (clue), knowledge_cards, quizzes + quiz_options; set approvedBy, approvedAt.
 */
router.patch('/ai-suggestions/:id', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  const body = req.body || {}
  const status = body.status
  const aiSuggestion = body.aiSuggestion
  const flat = aiSuggestion
    ? {
        generated_clue: aiSuggestion.clue,
        generated_knowledge_title: aiSuggestion.knowledgeCard?.title,
        generated_knowledge_description: aiSuggestion.knowledgeCard?.description,
        generated_fun_fact: aiSuggestion.knowledgeCard?.funFact,
        generated_quiz_question: aiSuggestion.quizQuestion,
        generated_quiz_options: aiSuggestion.options,
      }
    : {}
  const generated_clue = flat.generated_clue ?? body.generated_clue
  const generated_knowledge_title = flat.generated_knowledge_title ?? body.generated_knowledge_title
  const generated_knowledge_description = flat.generated_knowledge_description ?? body.generated_knowledge_description
  const generated_fun_fact = flat.generated_fun_fact ?? body.generated_fun_fact
  const generated_quiz_question = flat.generated_quiz_question ?? body.generated_quiz_question
  const generated_quiz_options = flat.generated_quiz_options ?? body.generated_quiz_options
  try {
    const suggestion = await getSuggestion(pool, id)
    if (!suggestion) {
      return res.status(404).json({ message: 'AI suggestion not found' })
    }
    if (status === 'approved' || status === 'rejected') {
      const canReview = suggestion.status === 'pending' || suggestion.status === 'pending_review'
      if (!canReview) {
        return res.status(400).json({ message: 'Suggestion already reviewed' })
      }
      const approvedByUsername = req.session?.user?.username ?? 'admin'
      const now = new Date()
      if (status === 'approved') {
        const checkpointId = suggestion.checkpoint_id
        if (suggestion.generated_clue) {
          await pool.query('UPDATE checkpoints SET clue = $1 WHERE id = $2', [suggestion.generated_clue, checkpointId])
        }
        const kTitle = (suggestion.generated_knowledge_title && String(suggestion.generated_knowledge_title).trim()) || ''
        const kDesc = (suggestion.generated_knowledge_description && String(suggestion.generated_knowledge_description).trim()) || ''
        if (kTitle || kDesc) {
          await pool.query(
            `INSERT INTO knowledge_cards (checkpoint_id, title, description, fun_fact) VALUES ($1, $2, $3, $4)`,
            [checkpointId, kTitle, kDesc, suggestion.generated_fun_fact ? String(suggestion.generated_fun_fact).trim() : null]
          )
        }
        if (suggestion.generated_quiz_question) {
          const quizRes = await pool.query(
            'INSERT INTO quizzes (checkpoint_id, question) VALUES ($1, $2) RETURNING id',
            [checkpointId, suggestion.generated_quiz_question]
          )
          const quizId = quizRes.rows[0]?.id
          const options = parseOptions(suggestion.generated_quiz_options)
          if (quizId && options.length > 0) {
            for (const o of options) {
              await pool.query(
                'INSERT INTO quiz_options (quiz_id, option_text, is_correct) VALUES ($1, $2, $3)',
                [quizId, String(o.optionText || '').trim() || 'Option', o.isCorrect]
              )
            }
          }
        }
      }
      await pool.query(
        `UPDATE ai_suggestions SET status = $1, reviewed_at = $2, approved_by_username = $3 WHERE id = $4`,
        [status, now, approvedByUsername, id]
      )
      const updated = await getSuggestion(pool, id)
      return res.json(mapSuggestionToApi(updated))
    }
    const updates = []
    const values = []
    let p = 1
    if (generated_clue !== undefined) {
      updates.push(`generated_clue = $${p++}`)
      values.push(generated_clue != null ? String(generated_clue).trim() : null)
    }
    if (generated_knowledge_title !== undefined) {
      updates.push(`generated_knowledge_title = $${p++}`)
      values.push(generated_knowledge_title != null ? String(generated_knowledge_title).trim() : null)
    }
    if (generated_knowledge_description !== undefined) {
      updates.push(`generated_knowledge_description = $${p++}`)
      values.push(generated_knowledge_description != null ? String(generated_knowledge_description).trim() : null)
    }
    if (generated_fun_fact !== undefined) {
      updates.push(`generated_fun_fact = $${p++}`)
      values.push(generated_fun_fact != null ? String(generated_fun_fact).trim() : null)
    }
    if (generated_quiz_question !== undefined) {
      updates.push(`generated_quiz_question = $${p++}`)
      values.push(generated_quiz_question != null ? String(generated_quiz_question).trim() : null)
    }
    if (generated_quiz_options !== undefined) {
      updates.push(`generated_quiz_options = $${p++}::jsonb`)
      const opts = Array.isArray(generated_quiz_options)
        ? JSON.stringify(generated_quiz_options.map((o) => ({ optionText: o?.optionText ?? o?.option_text, isCorrect: Boolean(o?.isCorrect ?? o?.is_correct) })))
        : generated_quiz_options
      values.push(opts)
    }
    if (updates.length === 0) {
      return res.json(mapSuggestionToApi(suggestion))
    }
    values.push(id)
    const result = await pool.query(
      `UPDATE ai_suggestions SET ${updates.join(', ')} WHERE id = $${p}
       RETURNING ${SUGGESTION_SELECT}`,
      values
    )
    res.json(mapSuggestionToApi(result.rows[0]))
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'ai_suggestions or knowledge_cards table not found; run migrations 013, 018' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error updating AI suggestion' })
  }
})

/**
 * POST /api/ai-suggestions/:id/regenerate
 * Regenerate AI content for this suggestion (one OpenAI call). If suggestion is pending_review, update in place; else create new. Admin.
 */
router.post('/ai-suggestions/:id/regenerate', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const suggestion = await getSuggestion(pool, id)
    if (!suggestion) {
      return res.status(404).json({ message: 'AI suggestion not found' })
    }
    const checkpoint = await getCheckpoint(pool, suggestion.checkpoint_id)
    if (!checkpoint) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    const context = {
      scene: checkpoint.scene,
      title: checkpoint.title || checkpoint.description,
    }
    const generated = await generateCheckpointSuggestionWithAI(context)
    if (!generated) {
      return res.status(503).json({
        message: 'AI generation not available; set OPENAI_API_KEY',
      })
    }
    const optsJson = JSON.stringify(generated.options)
    if (suggestion.status === 'pending_review' || suggestion.status === 'pending') {
      await pool.query(
        `UPDATE ai_suggestions SET generated_clue = $1, generated_knowledge_title = $2, generated_knowledge_description = $3, generated_fun_fact = $4, generated_quiz_question = $5, generated_quiz_options = $6::jsonb
         WHERE id = $7`,
        [
          generated.clue,
          generated.knowledgeCard?.title ?? '',
          generated.knowledgeCard?.description ?? '',
          generated.knowledgeCard?.funFact ?? null,
          generated.quizQuestion,
          optsJson,
          id,
        ]
      )
      const updated = await getSuggestion(pool, id)
      return res.json(mapSuggestionToApi(updated))
    }
    const insertRes = await pool.query(
      `INSERT INTO ai_suggestions (checkpoint_id, generated_clue, generated_knowledge_title, generated_knowledge_description, generated_fun_fact, generated_quiz_question, generated_quiz_options, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending_review')
       RETURNING ${SUGGESTION_SELECT}`,
      [
        suggestion.checkpoint_id,
        generated.clue,
        generated.knowledgeCard?.title ?? '',
        generated.knowledgeCard?.description ?? '',
        generated.knowledgeCard?.funFact ?? null,
        generated.quizQuestion,
        optsJson,
      ]
    )
    res.status(201).json(mapSuggestionToApi(insertRes.rows[0]))
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'ai_suggestions table not found; run migrations 013, 018' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error regenerating AI suggestion' })
  }
})

/**
 * DELETE /api/ai-suggestions/:id
 * Delete AI suggestion. Admin.
 */
router.delete('/ai-suggestions/:id', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const result = await pool.query('DELETE FROM ai_suggestions WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'AI suggestion not found' })
    }
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error deleting AI suggestion' })
  }
})

module.exports = router
