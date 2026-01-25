const express = require('express')
const router = express.Router()
// const passport = require("passport");
const bcrypt = require('bcrypt')

// User registration route
router.post('/register', async (req, res) => {
  console.log(req.body);
  const pool = req.app.get('pool');
  const { username, email, password, type: typeInput } = req.body;
  const resolvedType = typeInput || 'user';

  if (!username || !email || !password) {
    return res.status(403).json({ message: 'All fields are required' });
  }
  // if (confirmpassword !== password) {
  //   return res.status(403).json({ message: 'Password do not match' })
  // }

  const validTypes = ['user', 'shop', 'event', 'admin'];
  if (!validTypes.includes(resolvedType)) {
    return res.status(400).json({ message: 'Invalid type. Valid types are: user, shop, event, admin' });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rowCount !== 0) {
      return res.status(400).json({ message: 'Email already exists!' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(5);
    const hashedPassword = await bcrypt.hash(password, salt);
    const timestamp = new Date();

    pool.query(
      'INSERT INTO users (username, email, password, created_on, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username, email, hashedPassword, timestamp, resolvedType],
      (error, results) => {
        if (error) {
          throw error;
        }

        return res.json({
          username: results.rows[0].username,
          id: results.rows[0].user_id,
          type: results.rows[0].type,
          active: results.rows[0].active,
        });
      }
    );
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  const pool = req.app.get('pool')
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(403).json({ message: 'All Fields are required' })
  }

  try {
    // Check if user exists
    const potentialLoginUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (potentialLoginUser.rowCount > 0) {
      // Check if password is correct
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

      // Update last_login to current timestamp
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
        [user.id]
      )

      req.session.user = user
      return res.json(user)
    } else {
      return res.status(400).json({ message: 'Wrong email or password OR user does not exist' })
    }
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

router.get('/logout', async (req, res) => {
  if (req.session && req.session.user) {
    const userId = req.session.user.id;

    // Update last_login to the current timestamp when logging out
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    )
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' })
    }
    res.redirect('/login')
  })
})

module.exports = router
