const config = require('../config')

function request(path, method = 'GET', data = {}) {
  const token = wx.getStorageSync('token') || ''
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method,
      data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        Authorization: authorizationHeader(token),
      },
      success: ({ statusCode, data: response }) => {
        if (statusCode >= 200 && statusCode < 300) resolve(response)
        else reject(Object.assign(new Error(response?.message || `请求失败（${statusCode}）`), { statusCode }))
      },
      fail: error => reject(new Error(error.errMsg || '网络连接失败')),
    })
  })
}

function wechatLogin() {
  return new Promise((resolve, reject) => {
    const demoResult = code => ({
      token: `demo_${code || Date.now()}`,
      user: normalizeUser({ id: 'demo-user', nickname: '微信球友', avatar: 'WX', level: 'NTRP 2.5' }),
    })
    wx.login({
      success: async ({ code }) => {
        if (config.demoMode) return setTimeout(() => resolve(demoResult(code)), 500)
        if (!code) return reject(new Error('未获取到微信登录凭证'))
        try {
          const result = await request('/v1/auth/wechat', 'POST', { code })
          resolve({ ...result, user: normalizeUser(result.user) })
        } catch (error) { reject(error) }
      },
      // 游客 AppID 可能不返回登录 code，演示模式仍允许体验其余流程。
      fail: error => config.demoMode ? resolve(demoResult()) : reject(error),
    })
  })
}

async function getCurrentUser() {
  const result = await request('/v1/users/me')
  return normalizeUser(result.user)
}

async function updateProfile(profile) {
  const result = await request('/v1/users/me', 'PATCH', profile)
  return normalizeUser(result.user)
}

function uploadAvatar(filePath) {
  const contentType = avatarContentType(filePath)
  const token = wx.getStorageSync('token') || ''
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success: ({ data }) => {
        wx.request({
          url: `${config.apiBaseUrl}/v1/users/me/avatar`,
          method: 'PUT',
          data,
          timeout: 20000,
          header: { 'Content-Type': contentType, Authorization: authorizationHeader(token) },
          success: ({ statusCode, data: response }) => {
            if (statusCode >= 200 && statusCode < 300) resolve(normalizeUser(response.user))
            else reject(Object.assign(new Error(response?.message || `头像上传失败（${statusCode}）`), { statusCode }))
          },
          fail: error => reject(new Error(error.errMsg || '头像上传失败')),
        })
      },
      fail: error => reject(new Error(error.errMsg || '头像读取失败')),
    })
  })
}

function normalizeUser(user) {
  if (!user) return null
  const avatar = user.avatar || ''
  const avatarUrl = avatar.startsWith('/')
    ? `${config.apiBaseUrl}${avatar}`
    : (/^https:\/\//.test(avatar) || /^wxfile:\/\//.test(avatar) ? avatar : '')
  const nickname = user.nickname || '微信球友'
  return {
    ...user,
    nickname,
    avatarUrl,
    avatarText: avatarUrl ? '' : (avatar || nickname.slice(0, 2) || 'WX'),
  }
}

function authorizationHeader(token) {
  return token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : ''
}

function avatarContentType(filePath) {
  const path = String(filePath).toLowerCase()
  if (path.includes('.png')) return 'image/png'
  if (path.includes('.webp')) return 'image/webp'
  return 'image/jpeg'
}

async function createPayment(order) {
  if (config.demoMode) return { demo: true, orderNo: `T${Date.now()}` }
  return request('/v1/payments/wechat', 'POST', order)
}

function invokeWechatPay(payment) {
  if (payment.demo) {
    return new Promise(resolve => setTimeout(() => resolve({ errMsg: 'requestPayment:ok' }), 650))
  }
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: payment.timeStamp,
      nonceStr: payment.nonceStr,
      package: payment.package,
      signType: payment.signType || 'RSA',
      paySign: payment.paySign,
      success: resolve,
      fail: reject,
    })
  })
}

module.exports = {
  request,
  wechatLogin,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  normalizeUser,
  createPayment,
  invokeWechatPay,
  demoMode: config.demoMode,
}
