// 小程序运行时不要 require JSON 配置文件；微信开发者工具会将其解析成未注册模块。
// 合法域名的完整记录保留在 server.config.json，运行时只读取 HTTPS API 地址。
const serverDomains = {
  requestDomain: 'https://api.def00.xyz',
  socketDomain: 'wss://api.def00.xyz',
  uploadFileDomain: 'https://api.def00.xyz',
  downloadFileDomain: 'https://api.def00.xyz',
}

module.exports = {
  // 演示模式无需后端即可体验完整流程。上线前改为 false，并填写已在微信公众平台配置的 HTTPS 域名。
  demoMode: false,
  apiBaseUrl: serverDomains.requestDomain,
  serverDomains,
}
