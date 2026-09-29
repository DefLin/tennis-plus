const serverDomains = require('./server.config.json')

module.exports = {
  // 演示模式无需后端即可体验完整流程。上线前改为 false，并填写已在微信公众平台配置的 HTTPS 域名。
  demoMode: false,
  apiBaseUrl: serverDomains['request合法域名'][0],
  serverDomains,
}
