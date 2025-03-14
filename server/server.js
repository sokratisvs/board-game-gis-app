const express = require('express')
const path = require('path')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const { Pool } = require('pg')
const dotenv = require('dotenv')
const session = require('express-session')

dotenv.config({ path: '../.env' })
const authRoutes = require('./routes/auth')
const usersRoutes = require('./routes/users')
const locationRoutes = require('./routes/location')

//middleware
app.use(cors())
app.use(express.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)
app.use(
  session({
    secret: process.env.COOKIE_SECRET,
    credencials: true,
    name: 'sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.ENVIRONMENT === 'production',
      httpOnly: true,
      sameSite: process.env.ENVIRONMENT === 'production' ? 'none' : 'lax',
    },
  })
)

const PORT = process.env.SERVER_PORT || 5000

let pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: `${process.env.DB_NAME}`,
  user: `${process.env.DB_USER}`,
  password: `${process.env.DB_PASSWORD}`,
})

app.set('pool', pool)
app.use('/', authRoutes)
app.use('/', usersRoutes)
app.use('/', locationRoutes)

app.listen(PORT, () => {
  console.log('server is running on port 5000')
})
