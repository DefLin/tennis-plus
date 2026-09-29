const { venues, matches, getDates } = require('../../utils/data')

Page({
  data: {
    locationName: '当前位置',
    venues: venues.slice(0, 3),
    matches: matches.slice(0, 2),
    dates: getDates().slice(0, 5),
  },

  onShow() {
    this.setData({ locationName: getApp().globalData.locationName })
  },

  onPullDownRefresh() {
    setTimeout(() => wx.stopPullDownRefresh(), 450)
  },

  goCourts() { wx.switchTab({ url: '/pages/courts/courts' }) },
  goMatches() { wx.switchTab({ url: '/pages/matches/matches' }) },
  goCreateMatch() { wx.navigateTo({ url: '/pages/create-match/create-match' }) },
  goOrders() { wx.navigateTo({ url: '/pages/orders/orders' }) },
  goVenue(e) { wx.navigateTo({ url: `/pages/court-detail/court-detail?id=${e.currentTarget.dataset.id}` }) },
  goProfile() { wx.switchTab({ url: '/pages/profile/profile' }) },

  selectDate(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ dates: this.data.dates.map((item, i) => ({ ...item, active: i === index })) })
  },

  joinMatch(e) {
    wx.showModal({
      title: '申请加入约球',
      content: `确认申请加入「${e.currentTarget.dataset.title}」吗？`,
      confirmText: '申请加入',
      confirmColor: '#154734',
      success: ({ confirm }) => confirm && wx.showToast({ title: '申请已发送', icon: 'success' }),
    })
  },
})
