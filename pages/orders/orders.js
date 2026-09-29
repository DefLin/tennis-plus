Page({
  data: { orders: [] },
  onShow() {
    const stored = wx.getStorageSync('tennis_orders') || []
    const sample = {
      orderNo: 'T202609230018', status: '待使用', date: '2026-09-26', time: '10:00', price: 80, total: 82,
      venue: { id: 'v1', name: 'ACE 网球公园 · 徐汇', address: '龙腾大道2600号', color: '#285b46', shortName: 'ACE' },
    }
    this.setData({ orders: stored.length ? stored : [sample] })
  },
  goVenue(e) { wx.navigateTo({ url: `/pages/court-detail/court-detail?id=${e.currentTarget.dataset.id}` }) },
  cancel(e) {
    const index = Number(e.currentTarget.dataset.index)
    wx.showModal({
      title: '取消预订', content: '开场前 4 小时可免费取消，确定继续吗？', confirmText: '确认取消', confirmColor: '#a04a4a',
      success: ({ confirm }) => {
        if (!confirm) return
        const orders = this.data.orders.map((item, i) => i === index ? { ...item, status: '已取消' } : item)
        this.setData({ orders }); wx.setStorageSync('tennis_orders', orders)
      },
    })
  },
})
