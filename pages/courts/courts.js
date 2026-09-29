const { venues: fallbackVenues } = require('../../utils/data')
const api = require('../../utils/api')

const DEFAULT_LOCATION = { latitude: 31.192, longitude: 121.451 }

Page({
  data: {
    venues: fallbackVenues,
    filteredVenues: fallbackVenues,
    query: '',
    viewMode: 'list',
    activeFilter: '距离优先',
    filters: ['距离优先', '室内', '低于¥80', '今日有位'],
    locationName: '正在获取位置…',
    locating: true,
    nearbyLoading: false,
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    markers: [],
    includePoints: [],
  },

  onLoad() {
    this.refreshVenueView(fallbackVenues)
    this.locateUser(false)
  },

  onPullDownRefresh() {
    this.locateUser(false).finally(() => wx.stopPullDownRefresh())
  },

  locateUser(showToast = true) {
    this.setData({ locating: true, locationName: '正在获取位置…' })
    return new Promise(resolve => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 5000,
        success: async ({ latitude, longitude }) => {
          this.setData({ latitude, longitude, locating: false, locationName: '当前位置附近' })
          getApp().globalData.locationName = '当前位置附近'
          await this.loadNearbyVenues(latitude, longitude, showToast)
          resolve()
        },
        fail: error => {
          this.setData({ locating: false, locationName: '定位未授权' })
          if (showToast) this.handleLocationFailure(error)
          resolve()
        },
      })
    })
  },

  async loadNearbyVenues(latitude, longitude, showToast) {
    this.setData({ nearbyLoading: true })
    try {
      const result = await api.request('/v1/venues/nearby', 'GET', { latitude, longitude, radius: 15000 })
      const venues = Array.isArray(result.venues) ? result.venues : []
      const locationName = result.locationName || '当前位置附近'
      this.setData({ venues, locationName })
      getApp().globalData.locationName = locationName
      this.applyFilters()
      if (showToast) wx.showToast({ title: venues.length ? `找到${venues.length}个附近球场` : '附近暂无球场', icon: 'none' })
    } catch (error) {
      const venues = fallbackVenues
        .map(venue => withDistance(venue, latitude, longitude))
        .filter(venue => venue.distanceMeters <= 30000)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
      this.setData({ venues, locationName: '当前位置附近' })
      this.applyFilters()
      if (showToast) wx.showToast({ title: error.message || '附近球场加载失败', icon: 'none' })
    } finally {
      this.setData({ nearbyLoading: false })
    }
  },

  handleLocationFailure(error) {
    const message = String(error.errMsg || '')
    const denied = message.includes('auth deny') || message.includes('authorize')
    if (!denied) return wx.showToast({ title: '定位失败，请稍后重试', icon: 'none' })
    wx.showModal({
      title: '需要位置权限',
      content: '开启位置权限后才能查询你附近的网球场。',
      confirmText: '去设置',
      confirmColor: '#154734',
      success: ({ confirm }) => confirm && wx.openSetting(),
    })
  },

  onSearch(e) {
    this.setData({ query: e.detail.value.trim().toLowerCase() })
    this.applyFilters()
  },

  chooseFilter(e) {
    this.setData({ activeFilter: e.currentTarget.dataset.value })
    this.applyFilters()
  },

  applyFilters() {
    const { query, activeFilter } = this.data
    let filteredVenues = this.data.venues.filter(item => {
      const text = `${item.name || ''}${item.address || ''}${(item.tags || []).join('')}`.toLowerCase()
      return !query || text.includes(query)
    })
    if (activeFilter === '室内') filteredVenues = filteredVenues.filter(item => Number(item.indoor) > 0 || (item.tags || []).some(tag => tag.includes('室内')))
    if (activeFilter === '低于¥80') filteredVenues = filteredVenues.filter(item => Number.isFinite(Number(item.price)) && Number(item.price) < 80)
    if (activeFilter === '距离优先') filteredVenues.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    this.refreshVenueView(filteredVenues)
  },

  refreshVenueView(filteredVenues) {
    this.markerVenues = filteredVenues
    const markers = filteredVenues.map((venue, index) => ({
      id: index + 1,
      latitude: Number(venue.latitude),
      longitude: Number(venue.longitude),
      iconPath: '/assets/court-marker.png',
      width: 30,
      height: 38,
      callout: {
        content: venue.price ? `¥${venue.price}  ${venue.shortName}` : venue.shortName,
        display: 'ALWAYS',
        padding: 7,
        borderRadius: 12,
        color: '#154734',
        bgColor: '#dff36a',
        fontSize: 11,
      },
    })).filter(marker => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude))
    const includePoints = [
      { latitude: this.data.latitude, longitude: this.data.longitude },
      ...markers.map(marker => ({ latitude: marker.latitude, longitude: marker.longitude })),
    ]
    this.setData({ filteredVenues, markers, includePoints })
  },

  toggleView() {
    this.setData({ viewMode: this.data.viewMode === 'list' ? 'map' : 'list' })
  },

  goVenue(e) {
    const venue = this.data.venues.find(item => item.id === e.currentTarget.dataset.id)
    if (!venue) return
    if (venue.source === 'tencent-map') return this.showMapVenue(venue)
    wx.navigateTo({ url: `/pages/court-detail/court-detail?id=${venue.id}` })
  },

  markerTap(e) {
    const venue = this.markerVenues?.[Number(e.detail.markerId) - 1]
    if (!venue) return
    if (venue.source === 'tencent-map') return this.showMapVenue(venue)
    wx.navigateTo({ url: `/pages/court-detail/court-detail?id=${venue.id}` })
  },

  showMapVenue(venue) {
    wx.showModal({
      title: venue.name,
      content: `${venue.distance || '附近'} · ${venue.address || '地址待确认'}`,
      confirmText: '导航前往',
      confirmColor: '#154734',
      success: ({ confirm }) => confirm && wx.openLocation({
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        name: venue.name,
        address: venue.address || '',
        scale: 17,
      }),
    })
  },
})

function withDistance(venue, latitude, longitude) {
  const distanceMeters = haversine(latitude, longitude, venue.latitude, venue.longitude)
  return { ...venue, distanceMeters, distance: formatDistance(distanceMeters) }
}

function haversine(lat1, lng1, lat2, lng2) {
  const toRadians = degree => degree * Math.PI / 180
  const earthRadius = 6371000
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLng = toRadians(lng2 - lng1)
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)))
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`
}
