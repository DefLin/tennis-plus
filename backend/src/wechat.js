const https = require('node:https')
const crypto = require('node:crypto')
const fs = require('node:fs')
const config = require('./config')

function httpsJson(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }, response => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { text += chunk })
      response.on('end', () => {
        let data
        try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(data)
        else reject(Object.assign(new Error(data.message || `WeChat HTTP ${response.statusCode}`), { statusCode: response.statusCode, response: data }))
      })
    })
    request.on('error', reject)
    request.setTimeout(15000, () => request.destroy(new Error('WeChat request timeout')))
    if (body) request.write(typeof body === 'string' ? body : JSON.stringify(body))
    request.end()
  })
}

async function codeToSession(code) {
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', config.appId)
  url.searchParams.set('secret', config.appSecret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')
  const result = await httpsJson(url, { method: 'GET', headers: {} })
  if (result.errcode) throw new Error(`微信登录失败：${result.errmsg || result.errcode}`)
  return result
}

function payAuthorization(method, path, body) {
  if (!config.privateKeyPath || !config.mchId || !config.mchSerialNo || !config.notifyUrl) throw new Error('微信支付环境变量未配置完整')
  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(fs.readFileSync(config.privateKeyPath), 'base64')
  return { nonce, timestamp, authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.mchSerialNo}"` }
}

async function createJsapiOrder({ outTradeNo, description, amountCents, openid }) {
  const body = JSON.stringify({
    appid: config.appId,
    mchid: config.mchId,
    description,
    out_trade_no: outTradeNo,
    notify_url: config.notifyUrl,
    amount: { total: amountCents, currency: 'CNY' },
    payer: { openid },
  })
  const path = '/v3/pay/transactions/jsapi'
  const auth = payAuthorization('POST', path, body)
  return httpsJson(`https://api.mch.weixin.qq.com${path}`, { method: 'POST', headers: { Authorization: auth.authorization } }, body)
}

function paymentParameters(prepayId) {
  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = crypto.randomBytes(16).toString('hex')
  const packageValue = `prepay_id=${prepayId}`
  const message = `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`
  const paySign = crypto.createSign('RSA-SHA256').update(message).sign(fs.readFileSync(config.privateKeyPath), 'base64')
  return { timeStamp, nonceStr, package: packageValue, signType: 'RSA', paySign }
}

function verifyNotifySignature({ timestamp, nonce, signature, body }) {
  if (!config.platformCertPath || !timestamp || !nonce || !signature) return false
  const message = `${timestamp}\n${nonce}\n${body}\n`
  return crypto.createVerify('RSA-SHA256').update(message).verify(fs.readFileSync(config.platformCertPath), signature, 'base64')
}

function decryptNotify({ associatedData, nonce, ciphertext }) {
  const buffer = Buffer.from(ciphertext, 'base64')
  const authTag = buffer.subarray(buffer.length - 16)
  const encrypted = buffer.subarray(0, buffer.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config.apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'))
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  decipher.setAuthTag(authTag)
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'))
}

module.exports = { codeToSession, createJsapiOrder, paymentParameters, verifyNotifySignature, decryptNotify }
