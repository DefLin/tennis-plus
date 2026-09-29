const { venues, getDates } = require('../../utils/data')
const api = require('../../utils/api')

Page({
  data: {
    venues,
    dates: getDates(),
    venueIndex: 0,
    dateIndex: 0,
    time: '19:00',
    type: '单打',
    level: 'NTRP 2.5–3.0',
    title: '',
    fee: '45',
    types: ['单打', '双打'],
    levels: ['不限水平', 'NTRP 2.0–2.5', 'NTRP 2.5–3.0', 'NTRP 3.0–3.5', 'NTRP 3.5+'],
  },
  chooseType(e) { this.setData({ type: e.currentTarget.dataset.value }) },
  onVenue(e) { this.setData({ venueIndex: Number(e.detail.value) }) },
  onDate(e) { this.setData({ dateIndex: Number(e.detail.value) }) },
  onTime(e) { this.setData({ time: e.detail.value }) },
  onLevel(e) { this.setData({ level: this.data.levels[e.detail.value] }) },
  onTitle(e) { this.setData({ title: e.detail.value }) },
  onFee(e) { this.setData({ fee: e.detail.value }) },
  async publish() {
    if (!this.data.title.trim()) return wx.showToast({ title: '写一句约球说明吧', icon: 'none' })
    try {
      if (!getApp().globalData.user) {
        const result = await api.wechatLogin()
        wx.setStorageSync('token', result.token)
        getApp().setUser(result.user)
      }
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/matches/matches' }), 900)
    } catch (error) { wx.showToast({ title: '请先完成微信登录', icon: 'none' }) }
  },
})
