---
title: how-to-deploy-docker-network
code_version: "2.0.0-rc.2"
tier: important
status: active
version: v1.0.0
last_updated: 2026-08-16
doc_id: V9-DOC-HOW-905
change_log:
  - version: v1.0.0
    changes: "初版：整理 Docker 部署 IPv6/端口映射/容器网络/镜像构建四类问题的标准修复与快速复现流程（2026-08-16 实战验证）"
    date: 2026-08-16
---

# 如何部署 Docker 环境（IPv6 / 端口映射 / 容器网络 / 镜像构建排障）

> **目标**：15 分钟内从零启动 V9 全链路容器（frontend 5199 + data-collector 8000 + embedding 8001），并规避四类高频环境坑。

---

## 架构总览

```
浏览器 ──▶ http://localhost:5199 ──▶ v9-frontend (Vite dev, 容器内 3000)
                                        │  /health /api/collect /api/akshare 代理
                                        │  COLLECTOR_TARGET=http://data-collector:8000
                                        │  EMBEDDING_TARGET=http://v9-embedding-service:8001
                                        ▼ (v9-net bridge, 容器名 DNS)
                              v9-data-collector (8000)   v9-embedding-service (8001)
```

| 服务 | 宿主机端口 | 容器端口 | 说明 |
|---|---|---|---|
| v9-frontend | **5199** | 3000 | 宿主机 3000 已被 chip-flow-grafana 占用 |
| v9-data-collector | 8000 | 8000 | FastAPI + AkShare 采集 |
| v9-embedding-service | 8001 | 8001 | 向量嵌入 sidecar（独立容器，同 v9-net 网络） |

---

## 坑 1：IPv6 解析失败（localhost → ::1）

**现象**：Vite 代理报 `connect ECONNREFUSED ::1:8000` 或 `fetch failed`。Windows 上 `localhost` 优先解析为 IPv6 `::1`，而部分服务只监听 IPv4。

**修复**：所有代理 target 一律用 `127.0.0.1`，禁止 `localhost`。

```typescript
// vite.config.ts（4 处 proxy 默认值）
target: env.COLLECTOR_TARGET ?? 'http://127.0.0.1:8000',
target: env.EMBEDDING_TARGET ?? 'http://127.0.0.1:8001',
```

**验证**：

```powershell
docker exec v9-frontend node -e "fetch('http://127.0.0.1:8000/health').then(r=>r.json()).then(console.log)"
```

---

## 坑 2：宿主机端口冲突（3000 被占用）

**现象**：`docker compose up` 报 `bind: address already in use`。

**修复**：[docker-compose.yml](../../../docker-compose.yml) 中前端映射改为 `5199:3000`（与 vite.config.ts 本机 dev 端口一致，容器内仍监听 3000）：

```yaml
  frontend:
    ports:
      - "5199:3000"
```

**启动前清残留**：[scripts/dev-prestart-check.ps1](../../../scripts/dev-prestart-check.ps1) 自动检测并清理 5199/8000/8001 上的项目残留进程：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-prestart-check.ps1
```

---

## 坑 3：容器内无法访问宿主机服务（host.docker.internal 不可达）

**现象**：frontend 容器内 `host.docker.internal` DNS 解析失败，embedding 代理超时。

**修复**：同网络服务一律走**容器名 DNS**。compose 通过环境变量覆盖 vite.config.ts 的默认值：

```yaml
  frontend:
    environment:
      - COLLECTOR_TARGET=http://data-collector:8000        # 容器名:端口
      - EMBEDDING_TARGET=http://v9-embedding-service:8001  # 独立容器也加入 v9-net
```

> embedding 容器不在本 compose 服务清单中，需手动接入同一网络：
> `docker network connect finsightv9_v9-net v9-embedding-service`

---

## 坑 4：镜像构建失败 / 运行时 ImportError

两类问题（均已实战踩坑）：

1. **依赖版本不存在**：`py_mini_racer>=0.6.1` 在 PyPI 无此版本（最高 0.6.0），pip install 卡死。已修正为 `>=0.6.0`（见 [requirements.txt](../../../python/data_service/requirements.txt)）。
2. **Dockerfile 漏 COPY 本地模块**：`collect_endpoints.py` 运行时才 import `_sector_fund_flow` 等本地模块，漏 COPY 会在调用 `/api/collect/sectors` 时报 `No module named '_sector_fund_flow'`。已补全（见 [Dockerfile](../../../python/data_service/Dockerfile)）：

```dockerfile
COPY collect_endpoints.py ./
COPY lib ./lib
# 本地模块（缺一会导致运行时 ImportError：板块资金流 L1→L2→L3 降级链）
COPY _sector_cache_db.py ./
COPY _sector_fund_flow.py ./
COPY _sector_fund_flow_db.py ./
COPY _ths_hexinv.py ./
```

> **规则**：新增 `import _xxx` 本地模块时，必须同步在 Dockerfile 补 COPY 行——启动健康检查探测不到这种延迟导入失败。

---

## 坑 5：PowerShell 脚本中文乱码（.ps1 必须 UTF-8 with BOM）

**现象**：`powershell -File xxx.ps1` 报 `The string is missing the terminator` / `Missing expression after ','`，且报错行内容显示乱码。

**根因**：Windows PowerShell 5.1 对无 BOM 的 UTF-8 文件按 ANSI/GBK 解码，中文字节破坏字符串边界。

**修复**：所有含中文的 `.ps1` 必须保存为 **UTF-8 with BOM**。补 BOM 命令：

```powershell
$f = 'D:\FinSightV9\scripts\xxx.ps1'
$text = [System.IO.File]::ReadAllText($f, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($f, $text, [System.Text.UTF8Encoding]::new($true))
```

---

## 快速复现（完整流程）

```powershell
# 1. 清理端口残留（5199/8000/8001）
powershell -ExecutionPolicy Bypass -File scripts/dev-prestart-check.ps1

# 2. 启动全部服务（首次含镜像构建）
docker compose up -d

# 3. embedding 容器接入网络（首次部署时执行一次）
docker network connect finsightv9_v9-net v9-embedding-service

# 4. 重启回归测试（重启三容器 + 8 项 API 全链路验证，真实数据）
powershell -ExecutionPolicy Bypass -File scripts/api-restart-regression.ps1 -Restart
```

**预期输出**（2026-08-16 实测，健康恢复 24s，总耗时 21.2s）：

```
健康就绪，耗时 24s
[PASS] collector /health (direct 8000)               56ms
[PASS] embedding /health (direct 8001)               44ms
[PASS] frontend / (vite, 5199)                     1071ms
[PASS] frontend /health (vite proxy)                362ms
[PASS] POST /api/collect/basic (real quote)        2439ms
[PASS] POST /api/collect/kline (real kline)         710ms
[PASS] POST /api/collect/sectors (SW industries)  15948ms
[PASS] POST /api/embed (vector 384d)               617ms
通过 8 / 8，失败 0，总耗时 21,247ms
全部通过 - 重启回归 OK
```

退出码：`0`=全部通过；`1`=存在失败项；`2`=健康等待超时。可选参数：`-IncludeSlow`（追加财报 PDF 慢接口）、`-Symbol 600519`（自定义测试标的）。

---

## 网络超时排查（日志增强）

采集模块关键网络节点已输出结构化 `logger.info`（请求 URL/超时/HTTP 状态/耗时/响应长度），超时单独捕获并标记"疑似网络波动"：

```powershell
docker logs v9-data-collector --tail 100 2>&1 | Select-String 'tencent_quote|industry_fallback|疑似网络波动'
```

日志样例：

```
[tencent_quote] 请求腾讯行情API: symbol=000001 url=https://qt.gtimg.cn/q=sz000001 timeout=8s
[tencent_quote] HTTP响应: symbol=000001 status=200 elapsed=312.5ms body_len=4399 encoding=GBK
[fund_flow] 最终来源=L2_hexinv 行业数=50
[sectors] 请求大盘基准（沪深300）: url=https://web.ifzq.gtimg.cn/... timeout=8s window=20
```

覆盖节点（[collect_endpoints.py](../../../python/data_service/collect_endpoints.py)）：`fetch_tencent_quote`、`fetch_industry_fallback`（雪球→腾讯双源）、大盘基准 K 线、`_sector_fund_flow` L1→L2→L3 降级链、`_ths_hexinv` 验证码引擎。

---

## 常用运维命令

```powershell
docker compose ps                                    # 状态总览
docker compose logs -f data-collector                # 跟踪采集日志
docker compose up -d --build data-collector          # 改代码后重建采集镜像
docker compose restart data-collector frontend       # 重启（不动 embedding）
docker compose down                                  # 停止并清理（保留数据卷）
```

采集结果持久化：`outputs/collected-data` 通过 volume 挂载，容器销毁后宿主机保留。

---

## 相关文档

- [docker-compose.yml](../../../docker-compose.yml) — 编排源文件（注释含常用命令）
- [how-to-troubleshooting.md](how-to-troubleshooting.md) — 通用排障手册
- [pathtrace-deployment-guide.md](pathtrace-deployment-guide.md) — PathTrace 部署
