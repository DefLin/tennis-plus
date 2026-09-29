const venues = [
  {
    id: 'v1',
    name: 'ACE 网球公园 · 徐汇',
    shortName: 'ACE',
    distance: '1.2km',
    address: '龙腾大道2600号',
    price: 80,
    rating: '4.9',
    reviews: 328,
    courts: 8,
    indoor: 4,
    open: '07:00–23:00',
    color: '#285b46',
    accent: '#dff36a',
    label: '人气推荐',
    tags: ['室内场', '淋浴', '停车'],
    latitude: 31.1788,
    longitude: 121.4592,
  },
  {
    id: 'v2',
    name: '洛克公园网球馆',
    shortName: 'ROCKER',
    distance: '2.8km',
    address: '凯旋路2088号',
    price: 68,
    rating: '4.8',
    reviews: 196,
    courts: 6,
    indoor: 6,
    open: '08:00–22:00',
    color: '#56706f',
    accent: '#f2c85b',
    label: '雨天无忧',
    tags: ['全室内', '器材租赁', '更衣室'],
    latitude: 31.1982,
    longitude: 121.4247,
  },
  {
    id: 'v3',
    name: '西岸活力谷网球场',
    shortName: 'WEST BUND',
    distance: '3.5km',
    address: '瑞宁路99号',
    price: 50,
    rating: '4.7',
    reviews: 143,
    courts: 5,
    indoor: 0,
    open: '06:30–22:30',
    color: '#b35f35',
    accent: '#f1e4c4',
    label: '江景球场',
    tags: ['室外场', '夜间灯光', '停车'],
    latitude: 31.1916,
    longitude: 121.4658,
  },
  {
    id: 'v4',
    name: '衡山网球中心',
    shortName: 'HENGSHAN',
    distance: '4.1km',
    address: '衡山路516号',
    price: 100,
    rating: '4.9',
    reviews: 411,
    courts: 10,
    indoor: 2,
    open: '07:00–22:00',
    color: '#324a67',
    accent: '#d7e7f7',
    label: '专业场馆',
    tags: ['专业赛事', '教练', '餐饮'],
    latitude: 31.2056,
    longitude: 121.4445,
  },
]

const matches = [
  {
    id: 'm1',
    host: '林川',
    avatar: 'LC',
    level: 'NTRP 3.0',
    title: '下班轻松拉球，快乐网球',
    date: '今天 19:30',
    venue: 'ACE 网球公园',
    distance: '1.2km',
    players: 1,
    total: 2,
    price: 45,
    type: '单打',
  },
  {
    id: 'm2',
    host: 'Mia',
    avatar: 'MI',
    level: 'NTRP 2.5',
    title: '新手友好，练习底线对拉',
    date: '周六 10:00',
    venue: '西岸活力谷',
    distance: '3.5km',
    players: 2,
    total: 4,
    price: 30,
    type: '双打',
  },
  {
    id: 'm3',
    host: '周启',
    avatar: 'ZQ',
    level: 'NTRP 3.5',
    title: '来一场认真但友好的比赛',
    date: '周日 15:00',
    venue: '衡山网球中心',
    distance: '4.1km',
    players: 3,
    total: 4,
    price: 55,
    type: '双打',
  },
]

function getDates() {
  const labels = ['今天', '明天', '后天', '周六', '周日', '周一', '周二']
  const base = new Date()
  return labels.map((label, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() + index)
    return { label, day: date.getDate(), value: formatDate(date), active: index === 0 }
  })
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function getSlots() {
  return [
    { time: '08:00', price: 80, state: 'available' },
    { time: '09:00', price: 80, state: 'busy' },
    { time: '10:00', price: 80, state: 'available' },
    { time: '11:00', price: 80, state: 'available' },
    { time: '14:00', price: 100, state: 'available' },
    { time: '15:00', price: 100, state: 'busy' },
    { time: '16:00', price: 100, state: 'available' },
    { time: '17:00', price: 120, state: 'available' },
    { time: '18:00', price: 120, state: 'busy' },
    { time: '19:00', price: 120, state: 'available' },
  ]
}

module.exports = { venues, matches, getDates, getSlots }
