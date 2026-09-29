const { matches } = require('../../utils/data')

Page({
  data: {
    matches,
    visibleMatches: matches,
    activeTab: '全部',
    tabs: ['全部', '今天', '周末', '新手友好'],
  },

  onPullDownRefresh() { setTimeout(() => wx.stopPullDownRefresh(), 450) },
  goCreate() { wx.navigateTo({ url: '/pages/create-match/create-match' }) },
  setTab(e) {
    const activeTab = e.currentTarget.dataset.tab
    let visibleMatches = this.data.matches
    if (activeTab === '今天') visibleMatches = visibleMatches.filter(item => item.date.includes('今天'))
    if (activeTab === '周末') visibleMatches = visibleMatches.filter(item => item.date.includes('周六') || item.date.includes('周日'))
    if (activeTab === '新手友好') visibleMatches = visibleMatches.filter(item => item.level.includes('2.5'))
    this.setData({ activeTab, visibleMatches })
  },
  join(e) {
    wx.showModal({
      title: '申请加入',
      content: `将向 ${e.currentTarget.dataset.host} 发送约球申请，通过后可在微信中联系。`,
      confirmText: '发送申请',
      confirmColor: '#154734',
      success: ({ confirm }) => confirm && wx.showToast({ title: '申请已发送', icon: 'success' }),
    })
  },
})
