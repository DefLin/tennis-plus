const { venues } = require('../../utils/data')
const api = require('../../utils/api')

Page({
  data: {
    venue: venues[0],
    date: '',
    time: '',
    price: 0,
    serviceFee: 2,
    total: 0,
    contactName: '',
    contactPhone: '',
    agreement: true,
    paying: false,
    demoMode: api.demoMode,
  },

  onLoad(options) {
    const venue = venues.find(item => item.id === options.venueId) || venues[0]
    const price = Number(options.price || venue.price)
    const [hour, minute] = (options.time || '08:00').split(':').map(Number)
    const endTime = `${String((hour + 1) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    this.setData({ venue, date: options.date, time: options.time, endTime, price, total: price + 2 })
  },

  onName(e) { this.setData({ contactName: e.detail.value }) },
  onPhone(e) { this.setData({ contactPhone: e.detail.value }) },
  toggleAgreement() { this.setData({ agreement: !this.data.agreement }) },

  async ensureLogin() {
    const app = getApp()
    if (app.globalData.user) return app.globalData.user
    const result = await api.wechatLogin()
    wx.setStorageSync('token', result.token)
    app.setUser(result.user)
    return result.user
  },

  async pay() {
    if (!this.data.agreement) return wx.showToast({ title: '请先同意预订规则', icon: 'none' })
    if (!this.data.contactName.trim()) return wx.showToast({ title: '请填写联系人', icon: 'none' })
    if (!/^1\d{10}$/.test(this.data.contactPhone)) return wx.showToast({ title: '请输入正确手机号', icon: 'none' })
    if (this.data.paying) return
    this.setData({ paying: true })
    wx.showLoading({ title: '正在唤起微信支付', mask: true })
    try {
      const user = await this.ensureLogin()
      const payment = await api.createPayment({
        userId: user.id,
        venueId: this.data.venue.id,
        bookingDate: this.data.date,
        startTime: this.data.time,
        amountFen: this.data.total * 100,
        contactName: this.data.contactName,
        contactPhone: this.data.contactPhone,
      })
      await api.invokeWechatPay(payment)
      const order = { ...this.data, orderNo: payment.orderNo || `T${Date.now()}`, status: '已支付' }
      const orders = wx.getStorageSync('tennis_orders') || []
      wx.setStorageSync('tennis_orders', [order, ...orders])
      wx.hideLoading()
      wx.showModal({
        title: this.data.demoMode ? '模拟支付成功' : '支付成功',
        content: '场地已为你保留，记得准时到场。',
        showCancel: false,
        confirmText: '查看订单',
        confirmColor: '#154734',
        success: () => wx.redirectTo({ url: '/pages/orders/orders' }),
      })
    } catch (error) {
      wx.hideLoading()
      if (!String(error.errMsg || '').includes('cancel')) wx.showToast({ title: error.message || '支付未完成', icon: 'none' })
    } finally { this.setData({ paying: false }) }
  },
})
