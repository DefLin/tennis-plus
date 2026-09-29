App({
  globalData: {
    user: null,
    locationName: '当前位置',
    selectedCity: '',
  },

  onLaunch() {
    const user = wx.getStorageSync('tennis_user')
    if (user) this.globalData.user = user
  },

  setUser(user) {
    this.globalData.user = user
    wx.setStorageSync('tennis_user', user)
  },
})
