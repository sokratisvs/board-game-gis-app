const express = require('express')
const router = express.Router()
// const passport = require("passport");
const bcrypt = require('bcrypt')

// User registration route
router.post('/register', async (req, res) => {
  console.log(req.body)
  const pool = req.app.get('pool')
  const { username, email, password } = req.body
  if (!username && !email && !password) {
    return res.status(403).json({ message: 'All Fields are required' })
  }
  // if (confirmpassword !== password) {
  //   return res.status(403).json({ message: 'Password do not match' })
  // }
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (existingUser.rowCount !== 0) {
      return res.status(400).json({ message: 'Email exists!' })
    }
    // register
    const salt = await bcrypt.genSalt(5)
    const hashedPassWord = await bcrypt.hash(password, salt)
    const timestamp = new Date(new Date().toISOString())

    pool.query(
      'INSERT INTO users (username, email, password, created_on) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, email, hashedPassWord, timestamp],
      (error, results) => {
        if (error) {
          throw error
        }

        return res.json({
          username: results.rows[0].username,
          id: results.rows[0].user_id,
        })
      }
    )
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.post('/login', async (req, res) => {
  const pool = req.app.get('pool')
  const { email, password } = req.body

  if (!email && !password) {
    return res.status(403).json({ message: 'All Fields are required' })
  }

  try {
    // Check if user already exists
    const potentialLoginUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (potentialLoginUser.rowCount > 0) {
      // check if password is correct
      const isSamePassword = await bcrypt.compare(
        password,
        potentialLoginUser.rows[0].password
      )

      if (!isSamePassword) {
        return res.status(400).json({ message: 'Wrong password!' })
      }
      const user = {
        username: potentialLoginUser.rows[0].username,
        id: potentialLoginUser.rows[0].user_id,
      }
      // save user to session
      req.session.user = user
      // req.session.save()
      return res.json(user)
    } else {
      return res.status(400).json({ message: 'Wrong email or password!' })
    }
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.get('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/login')
})

module.exports = router
