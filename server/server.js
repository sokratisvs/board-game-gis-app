const express = require('express')
const path = require('path')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const { Pool } = require('pg')
const dotenv = require('dotenv')
dotenv.config({ path: '../.env' })
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

const PORT = process.env.SERVER_PORT || 5000

let pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: `${process.env.DB_NAME}`,
  user: `${process.env.DB_USER}`,
  password: `${process.env.DB_PASSWORD}`,
})

app.set('pool', pool)
app.use('/', usersRoutes)
app.use('/', locationRoutes)

const textQuery =
  'SELECT ST_AsGeoJSON(geom) FROM geomtable ORDER BY gid DESC LIMIT 1'
//Selecting the geometry in a geojson format
app.get('/geom', async (req, res) => {
  try {
    // client.connect()
    const geom = await pool.query(textQuery)
    res.json(geom.rows)
  } catch (err) {
    console.error(err.message)
  }
  //   await client.end()
})

app.get('/', (request, response) => {
  response.json({ info: 'Node.js, Express, and Postgres API' })
})

app.listen(PORT, () => {
  console.log('server is running on port 5000')
})
