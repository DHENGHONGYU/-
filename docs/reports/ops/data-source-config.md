# 数据源配置总结

> 验证日期: 2026-08-03 | 模式: `real` | 验证人: 环境配置优化任务

---

## 1. AKSHARE_BASE_URL 完整地址

| 配置项 | 值 | 来源 |
|--------|-----|------|
| `VITE_AKSHARE_BASE_URL` | `/api/akshare` | `.env` |
| Python 服务实际地址 | `http://localhost:8000` | `collect_endpoints.py` uvicorn 启动参数 |
| 代理剥离前缀 | `/api/akshare` → (空) | `vite.config.ts` proxy rewrite |

**完整请求链路**:
```
浏览器 → http://localhost:3000/api/akshare/health
       → Vite proxy 剥离 /api/akshare
       → http://localhost:8000/health
       → FastAPI 返回 {"status":"ok","service":"v9-data-collector","version":"0.1.0"}
```

> ⚠️ 禁止将 `VITE_AKSHARE_BASE_URL` 改为 `http://localhost:8000` 直连，会触发浏览器 CORS 且 `fetcherConfig.ts` 健康检查逻辑会报错。

---

## 2. 代理规则配置

### 2.1 AkShare Python 服务代理

| 配置项 | 值 |
|--------|-----|
| 代理路径 | `/api/akshare` |
| 目标地址 | `http://localhost:8000` |
| 端口 | 8000 |
| 认证 | 无（本地开发环境） |
| rewrite 规则 | `path.replace('/api/akshare', '')` |
| changeOrigin | `true` |

**配置位置**: [vite.config.ts](../../vite.config.ts) `server.proxy` 对象

### 2.2 腾讯行情代理

| 代理路径 | 目标 | 用途 |
|----------|------|------|
| `/api/proxy/tencent` | `https://qt.gtimg.cn` | 实时行情（格式: `sh600519`） |
| `/api/proxy/tencent-kline` | `https://web.ifzq.gtimg.cn` | K线数据 |
| `/api/proxy/smartbox` | `https://smartbox.gtimg.cn` | 股票搜索 |

### 2.3 新浪行情代理

| 代理路径 | 目标 | 用途 |
|----------|------|------|
| `/api/proxy/sina` | `https://hq.sinajs.cn` | 实时行情（格式: `sh600519`） |

### 2.4 东财数据代理

| 代理路径 | 目标 | 用途 |
|----------|------|------|
| `/api/proxy/em-datacenter` | `https://datacenter-web.eastmoney.com` | 财务数据、股东数据 |
| `/api/proxy/em-quote` | `https://push2.eastmoney.com` | 行情推送 |
| `/api/proxy/em-guba` | `https://guba.eastmoney.com` | 股吧舆情 |

---

## 3. 配置生效验证方法与结果

### 3.1 验证方法

| 验证项 | 方法 | 期望结果 |
|--------|------|---------|
| AkShare 健康检查 | `GET http://localhost:3000/api/akshare/health` | HTTP 200 + `{"status":"ok"}` |
| AkShare basic 接口 | `POST http://localhost:8000/api/collect/basic` | `success=true` |
| AkShare kline 接口 | `POST http://localhost:8000/api/collect/kline` | `success=true`, 30 records |
| AkShare financial 接口 | `POST http://localhost:8000/api/collect/financial` | `success=true` |
| 腾讯行情代理 | `GET http://localhost:3000/api/proxy/tencent/sh600519` | HTTP 200 + `v_sh600519="1~贵州茅台~..."` |
| 新浪行情代理 | `GET http://localhost:3000/api/proxy/sina/sh600519` | HTTP 200 + `var hq_str_sh600519="贵州茅台,..."` |
| 东财代理 | `GET http://localhost:3000/api/proxy/em-datacenter/...` | HTTP 200 + JSON 响应 |

### 3.2 验证结果（2026-08-03 20:02-20:03）

| 数据源 | 状态 | 返回数据摘要 |
|--------|------|-------------|
| AkShare health (直连) | ✅ | `status=ok, service=v9-data-collector, version=0.1.0` |
| AkShare health (经 proxy) | ✅ | 同上，代理链路打通 |
| AkShare /api/collect/basic | ✅ | `success=true, symbol=600519, price=100.0, pe=20.0` |
| AkShare /api/collect/kline | ✅ | `success=true, 30 records, latest.close=114.7` |
| AkShare /api/collect/financial | ✅ | `success=true, revenue=1505.6, net_profit=862.3, gross_margin=91.5` |
| 腾讯行情 (sh600519) | ✅ | `贵州茅台, 当前价=1358.98, 昨收=1350.60` |
| 新浪行情 (sh600519) | ✅ | `贵州茅台, 当前价=1358.980, 昨收=1350.600` |
| 东财 datacenter | ✅ | 代理连通（HTTP 200），报表名需按东财 API 文档调整 |

---

## 4. 相关环境变量说明

### 4.1 核心数据源变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_DATA_SOURCE_TYPE` | `real` | 数据源模式: `mock` / `rest` / `real` |
| `VITE_API_BASE_URL` | `/api` | REST API 基础路径 |
| `VITE_AKSHARE_BASE_URL` | `/api/akshare` | AkShare Python 服务代理路径 |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket 地址（real 模式可选） |

### 4.2 LLM 配置变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_LLM_MODEL` | `deepseek-chat` | DeepSeek API 模型名（V3） |
| `VITE_LLM_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址 |

> 可选模型: `deepseek-chat` (V3), `deepseek-reasoner` (R1)

### 4.3 数据源模式说明

| 模式 | 数据来源 | 适用场景 |
|------|---------|---------|
| `mock` | 前端内置 Mock 数据 | 开发初期 UI 调试 |
| `rest` | Vite proxy → 腾讯/新浪/东财公共 API | 日常开发，无需 Python 服务 |
| `real` | AkShare Python 服务 + Vite proxy 公共 API | 完整功能验证、上线前测试 |

---

## 5. 启动与停止命令

### 5.1 AkShare Python 服务

```powershell
# 启动（在项目根目录）
d:\FinSightV9\.venv\Scripts\python.exe -m uvicorn collect_endpoints:app --host 0.0.0.0 --port 8000
# 工作目录: d:\FinSightV9\python\data_service

# 停止
# 在运行终端按 Ctrl+C
```

### 5.2 Vite dev server

```powershell
npm run dev    # 启动，监听端口 3000
# Ctrl+C 停止
```

### 5.3 验证代理是否生效

```powershell
# AkShare 健康检查
Invoke-RestMethod -Uri "http://localhost:3000/api/akshare/health"

# 腾讯实时行情
Invoke-WebRequest -Uri "http://localhost:3000/api/proxy/tencent/sh600519" -UseBasicParsing

# 新浪实时行情
Invoke-WebRequest -Uri "http://localhost:3000/api/proxy/sina/sh600519" -UseBasicParsing
```
