# 球搭 TENNIS+

一个原生微信小程序示例，面向网球爱好者提供场地预订、附近球场、约球、微信登录和微信支付。

## 已实现

- 首页：快捷订场、热门场馆、近期约球
- 球场：关键词搜索、条件筛选、列表/地图切换、微信定位
- 预订：场馆详情、未来 7 天、实时场次、订单确认
- 约球：分类筛选、申请加入、发起单打/双打球局
- 账号：`wx.login` 登录、个人中心、订单管理
- 支付：统一下单后调用 `wx.requestPayment`，带可直接体验的演示模式

## 本地运行

1. 打开微信开发者工具，选择“导入项目”。
2. 项目目录选择本文件夹。
3. 当前 `appid` 为 `touristappid`，浏览页面无需额外配置。
4. 体验支付：选择球场和可用时段，在确认页填写姓名及 11 位手机号。演示模式不会真实扣款。

## 接入真实微信能力

项目配置已写入：

- `project.config.json`：AppID 为 `wx325e1bb54285c3ff`
- `server.config.json`：按截图记录 `api.def00.xyz` 的 request、socket、上传、下载、UDP、TCP、DNS 预解析和预连接域名

其中微信开发者工具实际校验的 request/socket/upload/download 合法域名，仍需在微信公众平台后台保存；JSON 文件用于项目侧统一记录，不能替代平台配置。

编辑 `config.js` 可以切换演示/真实接口：

```js
module.exports = {
  demoMode: false,
  apiBaseUrl: 'https://你的已备案业务域名',
}
```

同时将 `project.config.json` 中的 `appid` 替换为已认证小程序 AppID，并在微信公众平台配置 request 合法域名。

服务端需要实现：

### `POST /v1/auth/wechat`

请求：

```json
{ "code": "wx.login 返回的临时 code" }
```

响应：

```json
{
  "token": "业务登录令牌",
  "user": { "id": "u_1", "nickname": "微信球友", "avatar": "WX", "level": "NTRP 2.5" }
}
```

服务端使用 `code2Session` 换取 openid；AppSecret 只保存在服务端，禁止写入小程序。

### `POST /v1/payments/wechat`

请求为场地、日期、开始时间、金额（`amountFen`，单位为分）及联系人信息。服务端校验库存和金额，调用微信支付 JSAPI 下单，返回：

```json
{
  "timeStamp": "时间戳",
  "nonceStr": "随机字符串",
  "package": "prepay_id=...",
  "signType": "RSA",
  "paySign": "签名"
}
```

生产环境还需在服务端实现支付回调验签、订单幂等、时段锁定与超时释放。前端展示的价格不能作为结算依据。

## 目录

```text
pages/home          首页
pages/courts        附近球场
pages/court-detail  场馆与场次
pages/booking       确认与支付
pages/matches       约球列表
pages/create-match  发起约球
pages/profile       微信登录与个人中心
pages/orders        订单列表
utils/api.js        登录、业务请求、微信支付封装
utils/data.js       演示数据
backend/            Node.js + MySQL 后端（登录、订场锁定、微信支付）
```

后端部署说明见 [backend/README.md](D:\Studio\小程序\backend\README.md)。
