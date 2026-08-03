# 生产环境部署指南

> FinSightV9 | 版本: v2.1.0 | 更新日期: 2026-08-03

---

## 目录

1. [架构概览](#1-架构概览)
2. [Nginx 反向代理配置](#2-nginx-反向代理配置)
3. [环境变量设置](#3-环境变量设置)
4. [AkShare 服务部署](#4-akshare-服务部署)
5. [前端构建与优化](#5-前端构建与优化)
6. [服务器安全配置](#6-服务器安全配置)
7. [监控与日志](#7-监控与日志)
8. [常见问题排查](#8-常见问题排查)

---

## 1. 架构概览

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  :80 / :443 │
                   /└──────┬──────┘\
                  /        │        \
         静态资源    API 代理    WebSocket
              │        │        │
              ▼        ▼        ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │  dist/  │ │ FastAPI │ │  WS     │
        │ (SPA)   │ │  :8000  │ │ :8080   │
        └─────────┘ └─────────┘ └─────────┘
                         │
                    ┌────┴────┐
                    │ AkShare │
                    │ Python  │
                    └─────────┘
```

### 生产环境组件

| 组件 | 端口 | 说明 |
|------|------|------|
| Nginx | 80/443 | 反向代理 + 静态资源 + SSL 终止 |
| FastAPI (uvicorn) | 8000 | AkShare Python 数据采集服务 |
| 前端 SPA (dist/) | - | Vite 构建的静态资源 |
| WebSocket (可选) | 8080 | 实时推送服务 |

---

## 2. Nginx 反向代理配置

### 2.1 完整配置示例

```nginx
# /etc/nginx/conf.d/finsight.conf

upstream akshare_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

upstream websocket_backend {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name your-domain.com;

    # HTTP → HTTPS 重定向
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # --- SSL 配置 ---
    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    # --- 安全头 ---
    add_header X-Frame-Options       "SAMEORIGIN"           always;
    add_header X-Content-Type-Options "nosniff"             always;
    add_header X-XSS-Protection      "1; mode=block"        always;
    add_header Referrer-Policy       "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # --- 前端静态资源 ---
    root /var/www/finsight/dist;
    index index.html;

    # SPA 路由回退（所有非文件请求返回 index.html）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存（Vite 构建产物带 hash，可长期缓存）
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # --- AkShare Python 服务代理 ---
    location /api/akshare/ {
        proxy_pass http://akshare_backend/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout    30s;
        proxy_send_timeout    10s;
    }

    # --- 腾讯行情代理 ---
    location /api/proxy/tencent/ {
        proxy_pass https://qt.gtimg.cn/;
        proxy_set_header Host       qt.gtimg.cn;
        proxy_set_header Referer    https://gu.qq.com/;
        proxy_ssl_server_name       on;
        proxy_connect_timeout 5s;
        proxy_read_timeout    10s;
    }

    # --- 新浪行情代理 ---
    location /api/proxy/sina/ {
        proxy_pass https://hq.sinajs.cn/;
        proxy_set_header Host       hq.sinajs.cn;
        proxy_set_header Referer    https://finance.sina.com.cn/;
        proxy_ssl_server_name       on;
        proxy_connect_timeout 5s;
        proxy_read_timeout    10s;
    }

    # --- 东财数据代理 ---
    location /api/proxy/em-datacenter/ {
        proxy_pass https://datacenter-web.eastmoney.com/;
        proxy_set_header Host       datacenter-web.eastmoney.com;
        proxy_set_header Referer    https://data.eastmoney.com/;
        proxy_ssl_server_name       on;
        proxy_connect_timeout 5s;
        proxy_read_timeout    15s;
    }

    # --- WebSocket 代理（可选）---
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 86400s;
    }

    # --- 健康检查端点 ---
    location /health {
        proxy_pass http://akshare_backend/health;
        access_log off;
    }

    # --- Gzip 压缩 ---
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_comp_level 6;

    # --- 请求体大小限制 ---
    client_max_body_size 10m;
}
```

### 2.2 关键配置说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `proxy_pass http://akshare_backend/` | 末尾 `/` | 剥离 `/api/akshare` 前缀，等价于 Vite 的 rewrite |
| `proxy_ssl_server_name on` | 必须开启 | SNI 支持，否则 HTTPS 上游连接失败 |
| `try_files ... /index.html` | SPA 回退 | React Router 的 BrowserRouter 需要 |
| `expires 1y` + `immutable` | 静态资源 | Vite 产物带 content hash，可安全长期缓存 |

### 2.3 验证方法

```bash
# 测试 Nginx 配置语法
sudo nginx -t

# 重新加载配置
sudo nginx -s reload

# 验证代理链路
curl -s https://your-domain.com/api/akshare/health
# 期望: {"status":"ok","service":"v9-data-collector","version":"0.1.0"}

curl -s https://your-domain.com/api/proxy/sina/sh600519
# 期望: var hq_str_sh600519="贵州茅台,..."
```

---

## 3. 环境变量设置

### 3.1 环境对比

| 变量 | 开发 (dev) | 测试 (staging) | 生产 (prod) |
|------|-----------|---------------|------------|
| `VITE_DATA_SOURCE_TYPE` | `mock` / `rest` / `real` | `real` | `real` |
| `VITE_API_BASE_URL` | `/api` | `/api` | `/api` |
| `VITE_AKSHARE_BASE_URL` | `/api/akshare` | `/api/akshare` | `/api/akshare` |
| `VITE_LLM_MODEL` | `deepseek-chat` | `deepseek-chat` | `deepseek-chat` |
| `VITE_LLM_BASE_URL` | `https://api.deepseek.com` | `https://api.deepseek.com` | `https://api.deepseek.com` |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | `wss://staging.example.com/ws` | `wss://example.com/ws` |

### 3.2 生产环境 .env.production

在项目根目录创建 `.env.production`（Vite 构建时自动读取）：

```bash
# .env.production
VITE_DATA_SOURCE_TYPE=real
VITE_API_BASE_URL=/api
VITE_AKSHARE_BASE_URL=/api/akshare
VITE_LLM_MODEL=deepseek-chat
VITE_LLM_BASE_URL=https://api.deepseek.com
VITE_WS_URL=wss://your-domain.com/ws
```

### 3.3 敏感密钥处理

| 密钥 | 存储方式 | 说明 |
|------|---------|------|
| `TUSHARE_TOKEN` | UI 配置页 / 环境变量 | 不加 `VITE_` 前缀，不暴露到前端 |
| `QWEN_API_KEY` | UI 配置页 / 环境变量 | 同上 |
| `DEEPSEEK_API_KEY` | UI 配置页 / 环境变量 | 同上 |

生产环境推荐通过应用内 UI 配置页输入密钥（AES-GCM 加密存储在 IndexedDB），或通过服务器环境变量注入 Python 服务端。

---

## 4. AkShare 服务部署

### 4.1 系统依赖安装

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y python3.12 python3.12-venv python3-pip

# CentOS/RHEL
sudo dnf install -y python3.12 python3-pip
```

### 4.2 部署目录结构

```
/opt/finsight/
├── python/
│   └── data_service/
│       ├── collect_endpoints.py
│       ├── requirements.txt
│       └── .venv/          # Python 虚拟环境
├── dist/                   # 前端构建产物
└── logs/                   # 日志目录
```

### 4.3 安装与启动

```bash
# 1. 创建部署目录
sudo mkdir -p /opt/finsight
sudo chown $USER:$USER /opt/finsight

# 2. 复制代码
cp -r python/data_service /opt/finsight/python/

# 3. 创建虚拟环境并安装依赖
cd /opt/finsight/python/data_service
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 4. 测试启动
uvicorn collect_endpoints:app --host 127.0.0.1 --port 8000
# 验证: curl http://127.0.0.1:8000/health
```

### 4.4 Systemd 服务配置

```ini
# /etc/systemd/system/finsight-akshare.service

[Unit]
Description=FinSightV9 AkShare Data Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/finsight/python/data_service
Environment=PATH=/opt/finsight/python/data_service/.venv/bin:/usr/bin
ExecStart=/opt/finsight/python/data_service/.venv/bin/uvicorn \
    collect_endpoints:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --access-log
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# 安全限制
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/finsight/logs
ReadOnlyPaths=/opt/finsight/python

[Install]
WantedBy=multi-user.target
```

### 4.5 启动与管理

```bash
# 启动
sudo systemctl daemon-reload
sudo systemctl enable finsight-akshare
sudo systemctl start finsight-akshare

# 状态检查
sudo systemctl status finsight-akshare

# 查看日志
sudo journalctl -u finsight-akshare -f --since "10 min ago"
```

---

## 5. 前端构建与优化

### 5.1 构建命令

```bash
# 安装依赖
npm ci

# 生产构建（自动读取 .env.production）
npm run build

# 构建产物在 dist/ 目录
ls -la dist/
```

### 5.2 构建优化检查清单

| 优化项 | 状态 | 验证方法 |
|--------|------|---------|
| 代码分割 (Code Splitting) | ✅ Vite 默认 | `dist/assets/` 下有多个 chunk |
| Tree Shaking | ✅ Vite 默认 | 构建产物无未使用代码 |
| 静态资源 hash | ✅ Vite 默认 | 文件名含 `.[hash].js` |
| Gzip 压缩 | Nginx 层 | `gzip on;` 已配置 |
| 静态资源 CDN | 可选 | 配置 `base: 'https://cdn.example.com/'` |

### 5.3 构建产物部署

```bash
# 1. 本地构建
npm run build

# 2. 上传到服务器
rsync -avz --delete dist/ user@server:/var/www/finsight/dist/

# 3. 或使用 CI/CD 自动部署（推荐）
# GitHub Actions / Jenkins 构建后自动 rsync
```

### 5.4 构建体积分析

```bash
# 分析构建产物体积
npm run build -- --mode analyze
# 或
npx vite-bundle-visualizer
```

---

## 6. 服务器安全配置

### 6.1 防火墙规则

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 80/tcp          # HTTP
sudo ufw allow 443/tcp         # HTTPS
sudo ufw deny 8000/tcp         # 禁止外部直连 AkShare
sudo ufw deny 8080/tcp         # 禁止外部直连 WebSocket
sudo ufw enable
```

### 6.2 SSL/TLS 证书

```bash
# 使用 Let's Encrypt 免费证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 自动续期（已内置 cron）
sudo certbot renew --dry-run
```

### 6.3 安全检查清单

| 检查项 | 说明 |
|--------|------|
| 端口 8000/8080 不对外暴露 | 仅通过 Nginx 代理访问 |
| SSL 证书有效 | `curl -vI https://your-domain.com` |
| HSTS 启用 | Nginx `Strict-Transport-Security` 头 |
| 密钥不在代码中 | `.env` 文件在 `.gitignore` |
| Python 服务以非 root 运行 | systemd `User=www-data` |
| Nginx 隐藏版本号 | `server_tokens off;` |

---

## 7. 监控与日志

### 7.1 日志收集

| 日志源 | 位置 | 格式 |
|--------|------|------|
| Nginx 访问日志 | `/var/log/nginx/access.log` | combined |
| Nginx 错误日志 | `/var/log/nginx/error.log` | default |
| AkShare 服务日志 | `journalctl -u finsight-akshare` | json |
| 前端错误日志 | 浏览器 Console / Sentry | - |

### 7.2 Nginx 日志配置

```nginx
# 在 http {} 块中配置
log_format finsight '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    'rt=$request_time uct=$upstream_connect_time '
                    'urt=$upstream_response_time';

access_log /var/log/nginx/finsight.access.log finsight;
error_log  /var/log/nginx/finsight.error.log warn;
```

### 7.3 健康检查脚本

```bash
#!/bin/bash
# /opt/finsight/health-check.sh

CHECKS=(
    "AkShare|http://127.0.0.1:8000/health|status.*ok"
    "Nginx|http://127.0.0.1/health|status.*ok"
)

ALERT_EMAIL="ops@your-domain.com"

for check in "${CHECKS[@]}"; do
    IFS='|' read -r name url pattern <<< "$check"
    response=$(curl -s --max-time 5 "$url" 2>&1)
    if ! echo "$response" | grep -q "$pattern"; then
        echo "[$(date)] ALERT: $name 健康检查失败 - $response"
        # 可集成钉钉/企业微信/邮件通知
    fi
done
```

```bash
# Cron 定时执行（每 5 分钟）
*/5 * * * * /opt/finsight/health-check.sh >> /opt/finsight/logs/health-check.log 2>&1
```

### 7.4 进程监控

```bash
# 使用 systemd 自动重启（已配置 Restart=always）
sudo systemctl status finsight-akshare

# 或使用 PM2（替代方案）
pm2 start uvicorn --name finsight-akshare -- collect_endpoints:app --host 127.0.0.1 --port 8000
pm2 save
pm2 startup
```

---

## 8. 常见问题排查

### 8.1 AkShare 服务无法连接

| 症状 | 排查步骤 |
|------|---------|
| 前端 500 错误 | `curl http://127.0.0.1:8000/health` 检查 Python 服务 |
| `Connection refused` | `systemctl status finsight-akshare` 检查服务状态 |
| 502 Bad Gateway | Nginx upstream 配置错误，检查 `proxy_pass` 地址 |
| 超时 | 检查 `proxy_read_timeout` 是否足够 |

### 8.2 行情代理 404/空数据

| 症状 | 排查步骤 |
|------|---------|
| 腾讯返回 `v_pv_none_match` | 股票代码需加 `sh`/`sz` 前缀，如 `sh600519` |
| 新浪返回空 | 检查 `Referer` 头是否正确设置 |
| 东财返回 `success:false` | 报表名 `reportName` 需按东财 API 文档调整 |
| 504 Gateway Timeout | 上游 API 限流，增加 `proxy_read_timeout` |

### 8.3 SSL 证书问题

```bash
# 检查证书有效期
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# 手动续期
sudo certbot renew
sudo nginx -s reload
```

### 8.4 前端白屏

| 排查步骤 | 命令 |
|---------|------|
| 检查 index.html | `curl https://your-domain.com/` |
| 检查 JS 资源加载 | 浏览器 DevTools → Network |
| 检查 Console 错误 | 浏览器 DevTools → Console |
| 检查 SPA 回退 | `curl https://your-domain.com/some/route` 应返回 index.html |

### 8.5 性能优化

| 指标 | 目标 | 优化方法 |
|------|------|---------|
| 首屏加载 (FCP) | < 1.5s | 静态资源 CDN + Gzip |
| API 响应 | < 200ms | AkShare 服务 `--workers 4` |
| K线图渲染 | < 500ms | lightweight-charts 虚拟滚动 |
| Nginx 并发 | 1000+ | `worker_connections 4096` |
