const express = require('express')
const cors = require('cors')
const crypto = require('node:crypto')
const config = require('./config')
const { pool, withTransaction } = require('./db')
const { login, requireAuth } = require('./auth')
const { createJsapiOrder, paymentParameters, verifyNotifySignature, decryptNotify } = require('./wechat')

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(item => item.trim()) }))
app.use('/v1/payments/wechat/notify', express.raw({ type: 'application/json', limit: '1mb' }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', async (request, response) => {
  try { await pool.query('SELECT 1'); response.json({ status: 'ok', service: 'tennis-plus-api' }) }
  catch { response.status(503).json({ status: 'error', service: 'tennis-plus-api' }) }
})

app.post('/v1/auth/wechat', async (request, response, next) => {
  try { response.json(await login(request.body.code)) } catch (error) { next(error) }
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
      if (payment.trade_state !== 'SUCCESS' || Number(payment.amount?.total) !== order.amount_cents) throw new Error('payment verification failed')
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

const server = app.listen(config.port, () => console.log(`Tennis Plus API listening on :${config.port}`))
const shutdown = async signal => { console.log(`${signal}: shutting down`); server.close(async () => { await pool.end(); process.exit(0) }) }
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
