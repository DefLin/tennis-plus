const { venues, getDates, getSlots } = require('../../utils/data')

Page({
  data: {
    venue: venues[0],
    dates: getDates(),
    slots: getSlots(),
    selectedDate: getDates()[0].value,
    selectedSlot: null,
    favorite: false,
  },

  onLoad(options) {
    const venue = venues.find(item => item.id === options.id) || venues[0]
    this.setData({ venue })
  },

  selectDate(e) {
    const selectedDate = e.currentTarget.dataset.value
    this.setData({
      selectedDate,
      selectedSlot: null,
      dates: this.data.dates.map(item => ({ ...item, active: item.value === selectedDate })),
    })
  },

  selectSlot(e) {
    if (e.currentTarget.dataset.state === 'busy') return
    this.setData({ selectedSlot: e.currentTarget.dataset.time })
  },

  toggleFavorite() {
    this.setData({ favorite: !this.data.favorite })
    wx.showToast({ title: this.data.favorite ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  callVenue() { wx.makePhoneCall({ phoneNumber: '021-58881234' }) },

  openLocation() {
    const { latitude, longitude, name, address } = this.data.venue
    wx.openLocation({ latitude, longitude, name, address, scale: 17 })
  },

  submitBooking() {
    if (!this.data.selectedSlot) return wx.showToast({ title: '请先选择可用时段', icon: 'none' })
    const { venue, selectedDate, selectedSlot } = this.data
    const slot = this.data.slots.find(item => item.time === selectedSlot)
    wx.navigateTo({
      url: `/pages/booking/booking?venueId=${venue.id}&date=${selectedDate}&time=${selectedSlot}&price=${slot.price}`,
    })
  },
})
