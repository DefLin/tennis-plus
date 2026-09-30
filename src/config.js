require('dotenv').config()

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  appId: required('WECHAT_APP_ID'),
  appSecret: required('WECHAT_APP_SECRET'),
  mchId: process.env.WECHAT_MCH_ID || '',
  mchSerialNo: process.env.WECHAT_MCH_SERIAL_NO || '',
  apiV3Key: process.env.WECHAT_API_V3_KEY || '',
  privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH || '',
  platformCertPath: process.env.WECHAT_PLATFORM_CERT_PATH || '',
  notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
  jwtSecret: required('JWT_SECRET'),
  databaseUrl: required('DATABASE_URL'),
  bookingHoldMinutes: Number(process.env.BOOKING_HOLD_MINUTES || 15),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  tencentMapKey: process.env.TENCENT_MAP_KEY || '',
  uploadDir: process.env.UPLOAD_DIR || '/app/uploads',
}
