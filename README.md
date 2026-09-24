# 球搭后端 API

这是与小程序 `utils/api.js` 对接的 Node.js + Express + MySQL 后端，包含：

- `POST /v1/auth/wechat`：用 `wx.login` 的临时 code 换取业务 JWT
- `GET /v1/venues/:venueId/slots?date=YYYY-MM-DD`：查询场次
- `POST /v1/payments/wechat`：校验库存、锁定时段并创建微信 JSAPI 预支付订单
- `POST /v1/payments/wechat/notify`：验签、解密微信支付回调并完成订单
- `GET /health`：服务和数据库健康检查

项目已包含 `package-lock.json`，Docker 使用 `npm ci` 做可重复安装。如果你是从旧版本目录部署、目录中没有锁定文件，可以先执行：

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
```

## 快速部署（阿里云 Ubuntu）

```bash
cd /opt
git clone <你的代码仓库> tennis-plus
cd tennis-plus/backend
cp .env.example .env
vim .env
mkdir -p keys
chmod 700 keys
```

把微信支付商户 API 私钥保存到 `keys/apiclient_key.pem`，把微信支付平台证书保存到 `keys/wechatpay_platform.pem`，然后在 `.env` 中设置：

```env
WECHAT_PRIVATE_KEY_PATH=/app/keys/apiclient_key.pem
WECHAT_PLATFORM_CERT_PATH=/app/keys/wechatpay_platform.pem
```

生成高强度 JWT 密钥：

```bash
openssl rand -hex 32
```

编辑 `.env` 中的 `JWT_SECRET`、数据库密码、AppSecret、商户号和 API v3 密钥。`MYSQL_PASSWORD` 必须与 `DATABASE_URL` 中 `tennis:` 后面的密码完全一致；`MYSQL_ROOT_PASSWORD` 是数据库管理员密码。Docker 第一次初始化 MySQL 时才会读取这两个密码，已有数据卷不会因为修改 `.env` 自动改密码。随后启动：

```bash
docker compose up -d --build
docker compose logs -f api
curl http://127.0.0.1:3000/health
```

首次启动时 MySQL 会自动执行 `sql/001_init.sql` 和 `sql/002_seed_slots.sql`。如果之前已经创建过数据库，新增 SQL 不会自动重复执行，可进入容器手动运行。

## Nginx

复制 `deploy/nginx-api.conf` 到 `/etc/nginx/sites-available/tennis-api`，建立软链接后反向代理到 `127.0.0.1:3000`：

```bash
sudo cp deploy/nginx-api.conf /etc/nginx/sites-available/tennis-api
sudo ln -sf /etc/nginx/sites-available/tennis-api /etc/nginx/sites-enabled/tennis-api
sudo nginx -t && sudo systemctl reload nginx
```

然后用 Certbot 配置 HTTPS：

```bash
sudo certbot --nginx -d api.def00.xyz
```

微信公众平台的 request 合法域名必须填写 `https://api.def00.xyz`；微信支付回调必须填写：

```text
https://api.def00.xyz/v1/payments/wechat/notify
```

也可以直接运行：

```bash
bash deploy/deploy.sh
```

## 安全要求

- `.env`、`keys/` 永远不要提交到 Git。
- 生产环境必须设置 `WECHAT_PLATFORM_CERT_PATH`，否则支付回调验签会失败。
- 服务端始终从数据库读取场地价格，不能信任小程序传来的金额。
- 生产环境应补充订单退款、管理员场地管理、日志审计和备份策略。
