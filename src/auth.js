const jwt = require('jsonwebtoken')
const crypto = require('node:crypto')
const config = require('./config')
const { pool } = require('./db')
const { codeToSession } = require('./wechat')

async function login(code) {
  if (!code || typeof code !== 'string') throw Object.assign(new Error('缺少微信登录 code'), { statusCode: 400 })
  const session = await codeToSession(code)
  const openid = session.openid
  const [existing] = await pool.query('SELECT id, nickname, avatar, level FROM users WHERE openid = ?', [openid])
  const id = (existing[0] && existing[0].id) || crypto.randomUUID()
  if (existing[0]) await pool.query('UPDATE users SET updated_at = UTC_TIMESTAMP() WHERE id = ?', [id])
  else await pool.query('INSERT INTO users (id, openid) VALUES (?, ?)', [id, openid])
  const user = existing[0] || { id, nickname: '微信球友', avatar: 'WX', level: 'NTRP 2.5' }
  const token = jwt.sign({ sub: id, openid }, config.jwtSecret, { expiresIn: '30d' })
  return { token, user }
}

function requireAuth(request, response, next) {
  const header = request.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    if (!token) throw new Error('missing token')
    request.auth = jwt.verify(token, config.jwtSecret)
    next()
  } catch { response.status(401).json({ message: '登录已失效，请重新登录' }) }
}

module.exports = { login, requireAuth }
