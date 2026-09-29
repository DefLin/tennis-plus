const api = require('../../utils/api')

const loggedInStats = [
  { value: '0', label: '打球次数' },
  { value: '0', label: '本月约球' },
  { value: '0', label: '收藏球场' },
]
const guestStats = loggedInStats.map(item => ({ ...item, value: '--' }))

Page({
  data: {
    user: null,
    restoringSession: true,
    loggingIn: false,
    savingProfile: false,
    editingProfile: false,
    draftNickname: '',
    stats: guestStats,
    menu: [
      { icon: '▦', title: '我的订单', sub: '查看预订与退款', action: 'orders' },
      { icon: '♧', title: '我的约球', sub: '管理发起和加入的球局', action: 'matches' },
      { icon: '♡', title: '收藏球场', sub: '常去球场快速预订', action: 'courts' },
      { icon: '⚙', title: '设置与帮助', sub: '通知、隐私和联系客服', action: 'settings' },
    ],
  },

  onShow() {
    const cachedUser = api.normalizeUser(getApp().globalData.user)
    this.setUser(cachedUser)
    this.restoreSession()
  },

  async restoreSession() {
    const token = wx.getStorageSync('token')
    if (!token) return this.setData({ restoringSession: false })
    this.setData({ restoringSession: true })
    try {
      this.setUser(await api.getCurrentUser())
    } catch (error) {
      if (error.statusCode === 401 || error.statusCode === 404) this.clearSession()
    } finally {
      this.setData({ restoringSession: false })
    }
  },

  async login() {
    if (this.data.loggingIn) return
    this.setData({ loggingIn: true })
    try {
      const result = await api.wechatLogin()
      wx.setStorageSync('token', result.token)
      this.setUser(result.user)
      wx.showToast({ title: '微信登录成功', icon: 'success' })
    } catch (error) {
      wx.showModal({
        title: '微信登录失败',
        content: error.message || '请检查网络后重试',
        showCancel: false,
        confirmColor: '#154734',
      })
    } finally {
      this.setData({ loggingIn: false, restoringSession: false })
    }
  },

  async onChooseAvatar(e) {
    if (!this.data.user || !e.detail.avatarUrl) return
    this.setData({ savingProfile: true })
    wx.showLoading({ title: '正在更新头像', mask: true })
    try {
      this.setUser(await api.uploadAvatar(e.detail.avatarUrl))
      wx.showToast({ title: '头像已更新', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '头像更新失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ savingProfile: false })
    }
  },

  startEditProfile() {
    if (!this.data.user) return
    this.setData({ editingProfile: true, draftNickname: this.data.user.nickname })
  },

  cancelEditProfile() {
    this.setData({ editingProfile: false, draftNickname: '' })
  },

  onNicknameInput(e) {
    this.setData({ draftNickname: e.detail.value })
  },

  async saveProfile() {
    const nickname = this.data.draftNickname.trim()
    if (!nickname || nickname.length > 20) return wx.showToast({ title: '昵称应为1–20个字符', icon: 'none' })
    if (this.data.savingProfile) return
    this.setData({ savingProfile: true })
    try {
      this.setUser(await api.updateProfile({ nickname }))
      this.setData({ editingProfile: false })
      wx.showToast({ title: '资料已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ savingProfile: false })
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后仍可浏览球场，预订和约球时需要重新登录。',
      confirmColor: '#154734',
      success: ({ confirm }) => confirm && this.clearSession(),
    })
  },

  setUser(user) {
    const normalized = api.normalizeUser(user)
    getApp().globalData.user = normalized
    if (normalized) wx.setStorageSync('tennis_user', normalized)
    this.setData({ user: normalized, stats: normalized ? loggedInStats : guestStats })
  },

  clearSession() {
    wx.removeStorageSync('tennis_user')
    wx.removeStorageSync('token')
    getApp().globalData.user = null
    this.setData({ user: null, stats: guestStats, editingProfile: false })
  },

  menuTap(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'orders') return this.requireLogin(() => wx.navigateTo({ url: '/pages/orders/orders' }))
    if (action === 'matches') return wx.switchTab({ url: '/pages/matches/matches' })
    if (action === 'courts') return wx.switchTab({ url: '/pages/courts/courts' })
    wx.showActionSheet({ itemList: ['联系客服', '隐私政策', '意见反馈'] })
  },

  requireLogin(next) {
    if (this.data.user) return next()
    wx.showModal({
      title: '请先登录',
      content: '使用微信账号登录后可以查看订单。',
      confirmText: '微信登录',
      confirmColor: '#154734',
      success: ({ confirm }) => confirm && this.login(),
    })
  },
})
