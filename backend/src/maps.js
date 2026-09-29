const config = require('./config')

async function tencentMapRequest(path, params) {
  if (!config.tencentMapKey) {
    throw Object.assign(new Error('服务器尚未配置腾讯位置服务 Key'), { statusCode: 503 })
  }

  const url = new URL(`https://apis.map.qq.com${path}`)
  Object.entries({ ...params, key: config.tencentMapKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw Object.assign(new Error(`腾讯位置服务请求失败：HTTP ${response.status}`), { statusCode: 502 })
  const result = await response.json()
  if (result.status !== 0) {
    throw Object.assign(new Error(`腾讯位置服务请求失败：${result.message || result.status}`), { statusCode: 502 })
  }
  return result
}

async function findNearbyCourts(latitude, longitude, radius = 15000) {
  const safeRadius = Math.min(Math.max(Number(radius) || 15000, 1000), 30000)
  const [places, geocode] = await Promise.all([
    tencentMapRequest('/ws/place/v1/search', {
      keyword: '网球场',
      boundary: `nearby(${latitude},${longitude},${safeRadius},1)`,
      orderby: '_distance',
      page_size: 20,
      page_index: 1,
    }),
    tencentMapRequest('/ws/geocoder/v1/', { location: `${latitude},${longitude}` }),
  ])

  const component = geocode.result?.address_component || {}
  const locationName = [component.city || component.province, component.district]
    .filter(Boolean)
    .filter((item, index, array) => index === 0 || item !== array[index - 1])
    .join(' · ') || '当前位置附近'

  const venues = (places.data || []).map((place, index) => ({
    id: `map_${place.id || index}`,
    source: 'tencent-map',
    name: place.title,
    shortName: place.title.slice(0, 10),
    address: place.address || component.district || '地址待确认',
    distanceMeters: Number(place._distance || place.distance || 0),
    distance: formatDistance(Number(place._distance || place.distance || 0)),
    latitude: Number(place.location.lat),
    longitude: Number(place.location.lng),
    tel: place.tel || '',
    category: place.category || '运动健身:网球场',
    price: null,
    rating: null,
    reviews: null,
    courts: null,
    indoor: null,
    open: '营业时间请咨询场馆',
    color: ['#285b46', '#56706f', '#b35f35', '#324a67'][index % 4],
    label: index < 3 ? '离你最近' : '附近球场',
    tags: ['网球场', component.district].filter(Boolean),
  }))

  return { locationName, venues }
}

function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return '附近'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`
}

module.exports = { findNearbyCourts }
