const express = require('express')
const path = require('path')
const app = express()
const cors = require('cors')
const { Client, Pool } = require('pg')
const dotenv = require('dotenv')
dotenv.config({ path: '../.env' })
console.log()
//middleware
app.use(cors())
app.use(express.json())

const PORT = process.env.SERVER_PORT || 5000

let pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: `${process.env.DB_NAME}`,
  user: `${process.env.DB_USER}`,
  password: `${process.env.DB_PASSWORD}`,
})

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

// const connectDB = async () => {
//   try {
//     console.log('Connect to Postgres ...')
//     client.connect()
//     let query
//     await new Promise(async (resol, rej) => {
//       query = await client.query(textQuery)
//     })
//     console.log('Execution Completed ...', query)
//   } catch (err) {
//     console.log('Error while Connecting DB !', err)
//   }
//   await client.end()
// }

// connectToDB()

app.listen(PORT, () => {
  console.log('server is running on port 5000')
})
