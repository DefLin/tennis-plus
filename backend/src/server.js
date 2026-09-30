const express = require('express')
const cors = require('cors')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const config = require('./config')
const { pool, withTransaction } = require('./db')
const { login, requireAuth } = require('./auth')
const { createJsapiOrder, paymentParameters, verifyNotifySignature, decryptNotify } = require('./wechat')
const { findNearbyCourts } = require('./maps')

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(item => item.trim()) }))
app.use('/v1/payments/wechat/notify', express.raw({ type: 'application/json', limit: '1mb' }))
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', immutable: false }))

app.get('/health', async (request, response) => {
  try { await pool.query('SELECT 1'); response.json({ status: 'ok', service: 'tennis-plus-api' }) }
  catch { response.status(503).json({ status: 'error', service: 'tennis-plus-api' }) }
})

app.get('/v1/venues/nearby', async (request, response, next) => {
  const latitude = Number(request.query.latitude)
  const longitude = Number(request.query.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return response.status(400).json({ message: '经纬度参数不正确' })
  }
  try {
    response.json(await findNearbyCourts(latitude, longitude, request.query.radius))
  } catch (error) {
    console.warn('Nearby venue provider unavailable, using database fallback:', error.message)
    try { response.json(await findDatabaseVenues(latitude, longitude)) }
    catch (databaseError) { next(databaseError) }
  }
})

app.post('/v1/auth/wechat', async (request, response, next) => {
  try { response.json(await login(request.body.code)) } catch (error) { next(error) }
})

app.get('/v1/users/me', requireAuth, async (request, response, next) => {
  try {
    const user = await getUser(request.auth.sub)
    if (!user) return response.status(404).json({ message: '用户不存在' })
    response.json({ user })
  } catch (error) { next(error) }
})

app.patch('/v1/users/me', requireAuth, async (request, response, next) => {
  try {
    const nickname = String(request.body.nickname || '').trim()
    if (!nickname || nickname.length > 20) return response.status(400).json({ message: '昵称长度应为 1–20 个字符' })
    await pool.query('UPDATE users SET nickname = ? WHERE id = ?', [nickname, request.auth.sub])
    response.json({ user: await getUser(request.auth.sub) })
  } catch (error) { next(error) }
})

app.put('/v1/users/me/avatar', requireAuth, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '3mb' }), async (request, response, next) => {
  try {
    if (!Buffer.isBuffer(request.body) || !request.body.length) return response.status(400).json({ message: '请选择有效的头像图片' })
    const extension = detectImageExtension(request.body)
    if (!extension) return response.status(415).json({ message: '头像仅支持 JPG、PNG 或 WebP' })
    await fs.mkdir(config.uploadDir, { recursive: true })
    const fileName = `${request.auth.sub}.${extension}`
    await fs.writeFile(path.join(config.uploadDir, fileName), request.body, { mode: 0o640 })
    const avatar = `/uploads/${fileName}?v=${Date.now()}`
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, request.auth.sub])
    response.json({ user: await getUser(request.auth.sub) })
  } catch (error) { next(error) }
})

app.get('/v1/venues/:venueId/slots', async (request, response, next) => {
  try {
    const date = request.query.date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return response.status(400).json({ message: 'date 格式应为 YYYY-MM-DD' })
    await releaseExpiredHolds()
    const [rows] = await pool.query(
      `SELECT id, DATE_FORMAT(start_time, '%H:%i') AS time, price_cents AS priceCents, status
       FROM court_slots WHERE venue_id = ? AND booking_date = ? ORDER BY start_time`,
      [request.params.venueId, date],
    )
    response.json({ date, slots: rows.map(row => ({ ...row, price: row.priceCents / 100, state: row.status === 'available' ? 'available' : 'busy' })) })
  } catch (error) { next(error) }
})

app.post('/v1/payments/wechat', requireAuth, async (request, response, next) => {
  try {
    const { venueId, bookingDate, startTime, amountFen, contactName, contactPhone } = request.body
    if (!venueId || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate || '') || !/^\d{2}:\d{2}$/.test(startTime || '') || !Number.isInteger(amountFen) || amountFen <= 0) {
      return response.status(400).json({ message: '预订参数不完整或格式错误' })
    }
    if (!String(contactName || '').trim() || !/^1\d{10}$/.test(contactPhone || '')) return response.status(400).json({ message: '联系人信息不正确' })
    const result = await withTransaction(async connection => {
      await connection.query('UPDATE court_slots SET status = \'available\', hold_expires_at = NULL, order_id = NULL WHERE status = \'held\' AND hold_expires_at < UTC_TIMESTAMP()')
      const [slots] = await connection.query(
        `SELECT s.id, s.price_cents, v.name AS venue_name FROM court_slots s JOIN venues v ON v.id = s.venue_id
         WHERE s.venue_id = ? AND s.booking_date = ? AND s.start_time = ? AND s.status = 'available' FOR UPDATE`,
        [venueId, bookingDate, `${startTime}:00`],
      )
      if (!slots[0]) throw Object.assign(new Error('该时段刚刚被预订，请选择其他时段'), { statusCode: 409 })
      const slot = slots[0]
      const totalCents = slot.price_cents + 200
      if (amountFen !== totalCents) throw Object.assign(new Error('订单金额已变化，请刷新后重试'), { statusCode: 409 })
      const orderId = crypto.randomUUID()
      const orderNo = `TP${Date.now()}${crypto.randomInt(100, 999)}`
      await connection.query(
        `INSERT INTO orders (id, order_no, user_id, venue_id, slot_id, amount_cents, contact_name, contact_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, orderNo, request.auth.sub, venueId, slot.id, totalCents, contactName.trim(), contactPhone],
      )
      await connection.query('UPDATE court_slots SET status = \'held\', hold_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), order_id = ? WHERE id = ?', [config.bookingHoldMinutes, orderId, slot.id])
      return { orderId, orderNo, venueName: slot.venue_name, amountCents: totalCents }
    })
    const [users] = await pool.query('SELECT openid FROM users WHERE id = ?', [request.auth.sub])
    if (!users[0]) return response.status(401).json({ message: '用户不存在，请重新登录' })
    const wechatOrder = await createJsapiOrder({ outTradeNo: result.orderNo, description: `${result.venueName} 场地预订`, amountCents: result.amountCents, openid: users[0].openid })
    await pool.query('UPDATE orders SET prepay_id = ? WHERE id = ?', [wechatOrder.prepay_id, result.orderId])
    response.json({ ...paymentParameters(wechatOrder.prepay_id), orderNo: result.orderNo })
  } catch (error) { next(error) }
})

app.post('/v1/payments/wechat/notify', async (request, response, next) => {
  try {
    const body = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : JSON.stringify(request.body || {})
    const timestamp = request.headers['wechatpay-timestamp']
    const nonce = request.headers['wechatpay-nonce']
    const signature = request.headers['wechatpay-signature']
    if (!timestamp || !nonce || !signature || !verifyNotifySignature({ timestamp, nonce, signature, body })) return response.status(401).json({ code: 'FAIL', message: '签名校验失败' })
    const envelope = JSON.parse(body)
    const payment = decryptNotify(envelope.resource)
    await withTransaction(async connection => {
      const [orders] = await connection.query('SELECT id, amount_cents, status, slot_id FROM orders WHERE order_no = ? FOR UPDATE', [payment.out_trade_no])
      if (!orders[0]) throw new Error('order not found')
      const order = orders[0]
      if (order.status === 'paid') return
      if (payment.trade_state !== 'SUCCESS' || Number(payment.amount && payment.amount.total) !== order.amount_cents) throw new Error('payment verification failed')
      await connection.query('UPDATE orders SET status = \'paid\', transaction_id = ?, paid_at = UTC_TIMESTAMP() WHERE id = ?', [payment.transaction_id, order.id])
      await connection.query('UPDATE court_slots SET status = \'paid\', hold_expires_at = NULL WHERE id = ?', [order.slot_id])
    })
    response.json({ code: 'SUCCESS', message: '成功' })
  } catch (error) { next(error) }
})

app.use((error, request, response, next) => {
  console.error(error)
  response.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : '服务器内部错误' })
})

async function releaseExpiredHolds() {
  await pool.query('UPDATE court_slots SET status = \'available\', hold_expires_at = NULL, order_id = NULL WHERE status = \'held\' AND hold_expires_at < UTC_TIMESTAMP()')
  await pool.query(`UPDATE orders SET status = 'expired' WHERE status = 'pending' AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${config.bookingHoldMinutes} MINUTE)`)
}

async function getUser(id) {
  const [rows] = await pool.query('SELECT id, nickname, avatar, level FROM users WHERE id = ?', [id])
  return rows[0] || null
}

async function findDatabaseVenues(latitude, longitude) {
  const [rows] = await pool.query(
    `SELECT id, name, address, price_cents, latitude, longitude,
            TIME_FORMAT(open_time, '%H:%i') AS open_time,
            TIME_FORMAT(close_time, '%H:%i') AS close_time
     FROM venues WHERE active = 1`,
  )
  const venues = rows.map((venue, index) => {
    const distanceMeters = haversine(latitude, longitude, Number(venue.latitude), Number(venue.longitude))
    return {
      id: venue.id,
      source: 'database',
      name: venue.name,
      shortName: venue.name.slice(0, 10),
      address: venue.address,
      distanceMeters,
      distance: formatDistance(distanceMeters),
      latitude: Number(venue.latitude),
      longitude: Number(venue.longitude),
      price: Number(venue.price_cents) / 100,
      rating: null,
      reviews: null,
      courts: null,
      indoor: null,
      open: `${venue.open_time}–${venue.close_time}`,
      color: ['#285b46', '#56706f', '#b35f35', '#324a67'][index % 4],
      label: '平台球场',
      tags: ['可预订'],
    }
  }).sort((a, b) => a.distanceMeters - b.distanceMeters)
  return { locationName: '当前位置附近', venues, fallback: true }
}

function haversine(lat1, lng1, lat2, lng2) {
  const toRadians = degree => degree * Math.PI / 180
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLng = toRadians(lng2 - lng1)
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)))
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`
}

function detectImageExtension(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

const server = app.listen(config.port, () => console.log(`Tennis Plus API listening on :${config.port}`))
const shutdown = async signal => { console.log(`${signal}: shutting down`); server.close(async () => { await pool.end(); process.exit(0) }) }
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
