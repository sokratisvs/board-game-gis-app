const express = require('express')
const router = express.Router()
const { requireAuth, requireAdmin } = require('../middleware/requireAdmin')

async function getCheckpoint (pool, checkpointId) {
  const r = await pool.query('SELECT id FROM checkpoints WHERE id = $1', [checkpointId])
  return r.rows[0] || null
}

async function getQuiz (pool, quizId) {
  const r = await pool.query('SELECT id, checkpoint_id, question, created_at FROM quizzes WHERE id = $1', [quizId])
  return r.rows[0] || null
}

function mapQuizRow (row) {
  return {
    id: row.id,
    checkpointId: row.checkpoint_id,
    question: row.question,
    createdAt: row.created_at,
  }
}

function mapOptionRow (row) {
  return {
    id: row.id,
    quizId: row.quiz_id,
    optionText: row.option_text,
    isCorrect: row.is_correct === true,
  }
}

/**
 * GET /api/checkpoints/:checkpointId/quizzes
 * List quizzes for a checkpoint.
 */
router.get('/checkpoints/:checkpointId/quizzes', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { checkpointId } = req.params
  try {
    const checkpoint = await getCheckpoint(pool, checkpointId)
    if (!checkpoint) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    const result = await pool.query(
      'SELECT id, checkpoint_id, question, created_at FROM quizzes WHERE checkpoint_id = $1 ORDER BY created_at',
      [checkpointId]
    )
    res.json(result.rows.map(mapQuizRow))
  } catch (err) {
    if (err.code === '42P01') return res.json([])
    console.error(err)
    res.status(500).json({ message: 'Error listing quizzes' })
  }
})

/**
 * POST /api/checkpoints/:checkpointId/quizzes
 * Create quiz. Admin.
 */
router.post('/checkpoints/:checkpointId/quizzes', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { checkpointId } = req.params
  const { question } = req.body || {}
  if (question == null || String(question).trim() === '') {
    return res.status(400).json({ message: 'question is required' })
  }
  try {
    const checkpoint = await getCheckpoint(pool, checkpointId)
    if (!checkpoint) {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    const result = await pool.query(
      `INSERT INTO quizzes (checkpoint_id, question) VALUES ($1, $2)
       RETURNING id, checkpoint_id, question, created_at`,
      [checkpointId, String(question).trim()]
    )
    res.status(201).json(mapQuizRow(result.rows[0]))
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'quizzes table not found; run migration 012' })
    }
    if (err.code === '23503') {
      return res.status(404).json({ message: 'Checkpoint not found' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error creating quiz' })
  }
})

/**
 * GET /api/quizzes/:id
 * Get quiz with options.
 */
router.get('/quizzes/:id', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const quiz = await getQuiz(pool, id)
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' })
    }
    const options = await pool.query(
      'SELECT id, quiz_id, option_text, is_correct FROM quiz_options WHERE quiz_id = $1 ORDER BY id',
      [id]
    )
    res.json({
      ...mapQuizRow(quiz),
      options: options.rows.map(mapOptionRow),
    })
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ message: 'Quiz not found' })
    console.error(err)
    res.status(500).json({ message: 'Error fetching quiz' })
  }
})

/**
 * PATCH /api/quizzes/:id
 * Update quiz question. Admin.
 */
router.patch('/quizzes/:id', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  const { question } = req.body || {}
  if (question == null || String(question).trim() === '') {
    return res.status(400).json({ message: 'question is required' })
  }
  try {
    const result = await pool.query(
      `UPDATE quizzes SET question = $1 WHERE id = $2
       RETURNING id, checkpoint_id, question, created_at`,
      [String(question).trim(), id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' })
    }
    res.json(mapQuizRow(result.rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error updating quiz' })
  }
})

/**
 * DELETE /api/quizzes/:id
 * Delete quiz (and options via CASCADE). Admin.
 */
router.delete('/quizzes/:id', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const result = await pool.query('DELETE FROM quizzes WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' })
    }
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error deleting quiz' })
  }
})

/**
 * GET /api/quizzes/:id/options
 * List options for a quiz.
 */
router.get('/quizzes/:id/options', requireAuth, async (req, res) => {
  const pool = req.app.get('pool')
  const { id } = req.params
  try {
    const quiz = await getQuiz(pool, id)
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' })
    }
    const result = await pool.query(
      'SELECT id, quiz_id, option_text, is_correct FROM quiz_options WHERE quiz_id = $1 ORDER BY id',
      [id]
    )
    res.json(result.rows.map(mapOptionRow))
  } catch (err) {
    if (err.code === '42P01') return res.json([])
    console.error(err)
    res.status(500).json({ message: 'Error listing options' })
  }
})

/**
 * POST /api/quizzes/:id/options
 * Create quiz option. Admin.
 */
router.post('/quizzes/:id/options', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: quizId } = req.params
  const { option_text, is_correct } = req.body || {}
  if (option_text == null || String(option_text).trim() === '') {
    return res.status(400).json({ message: 'option_text is required' })
  }
  try {
    const quiz = await getQuiz(pool, quizId)
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' })
    }
    const result = await pool.query(
      `INSERT INTO quiz_options (quiz_id, option_text, is_correct) VALUES ($1, $2, $3)
       RETURNING id, quiz_id, option_text, is_correct`,
      [quizId, String(option_text).trim(), is_correct === true]
    )
    res.status(201).json(mapOptionRow(result.rows[0]))
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ message: 'quiz_options table not found; run migration 012' })
    }
    if (err.code === '23503') {
      return res.status(404).json({ message: 'Quiz not found' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error creating option' })
  }
})

/**
 * PATCH /api/quizzes/:id/options/:optionId
 * Update quiz option. Admin.
 */
router.patch('/quizzes/:id/options/:optionId', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: quizId, optionId } = req.params
  const { option_text, is_correct } = req.body || {}
  try {
    const quiz = await getQuiz(pool, quizId)
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' })
    }
    const updates = []
    const values = []
    let p = 1
    if (option_text !== undefined) {
      updates.push(`option_text = $${p++}`)
      values.push(String(option_text).trim())
    }
    if (is_correct !== undefined) {
      updates.push(`is_correct = $${p++}`)
      values.push(is_correct === true)
    }
    if (updates.length === 0) {
      const row = await pool.query(
        'SELECT id, quiz_id, option_text, is_correct FROM quiz_options WHERE id = $1 AND quiz_id = $2',
        [optionId, quizId]
      )
      if (row.rows.length === 0) return res.status(404).json({ message: 'Option not found' })
      return res.json(mapOptionRow(row.rows[0]))
    }
    values.push(optionId, quizId)
    const result = await pool.query(
      `UPDATE quiz_options SET ${updates.join(', ')} WHERE id = $${p} AND quiz_id = $${p + 1}
       RETURNING id, quiz_id, option_text, is_correct`,
      values
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Option not found' })
    }
    res.json(mapOptionRow(result.rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error updating option' })
  }
})

/**
 * DELETE /api/quizzes/:id/options/:optionId
 * Delete quiz option. Admin.
 */
router.delete('/quizzes/:id/options/:optionId', requireAuth, requireAdmin, async (req, res) => {
  const pool = req.app.get('pool')
  const { id: quizId, optionId } = req.params
  try {
    const result = await pool.query(
      'DELETE FROM quiz_options WHERE id = $1 AND quiz_id = $2 RETURNING id',
      [optionId, quizId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Option not found' })
    }
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error deleting option' })
  }
})

module.exports = router
