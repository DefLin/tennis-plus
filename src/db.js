const mysql = require('mysql2/promise')
const config = require('./config')

const url = new URL(config.databaseUrl)
const pool = mysql.createPool({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ''),
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  namedPlaceholders: true,
})

async function withTransaction(work) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

module.exports = { pool, withTransaction }
