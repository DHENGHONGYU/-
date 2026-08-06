---
title: "V9 Embedding Service 生产环境部署操作指南（SOP）"
type: guide
domain: ops
phase: deployment
tier: important
status: verified
maintainer: V9 DevOps
summary: "基于 v9-embedding.service 实际配置和 Docker 容器验证结果，提供从零到生产的完整部署操作流程。"
tags: [embedding, systemd, deployment, ops, guide, sop, production]
version: v1.2.0
last_updated: 2026-08-06
doc_id: V9-DOC-OPS-001
referenced_by: []
date: 2026-08-06
release_tag: v1.2.0
---

# V9 Embedding Service 生产环境部署操作指南

> **适用对象**: 运维工程师、DevOps
> **前置条件**: Ubuntu 20.04+ / CentOS 8+，root 或 sudo 权限
> **预计耗时**: 30-45 分钟（含模型下载）
> **验证状态**: ✅ 已通过 Docker 容器实测验证（2026-08-06）
> **发布版本**: v1.2.0

---

## 1. 部署前检查清单

### 1.1 硬件要求

| 项目 | 最低要求 | 推荐配置 | 检查命令 |
|------|---------|---------|---------|
| CPU | 4 核 | 8 核+ | `nproc` |
| 内存 | 8GB | 16GB+ | `free -h` |
| 磁盘 | 10GB | 50GB+ | `df -h /opt` |
| 网络 | 可访问 hf-mirror.com | 同左 | `curl -sI https://hf-mirror.com` |

### 1.2 软件要求

| 软件 | 版本 | 检查命令 |
|------|------|---------|
| Python | 3.11+ | `python3 --version` |
| pip | 23+ | `pip3 --version` |
| systemd | 230+ | `systemctl --version` |
| curl | 任意 | `curl --version` |

### 1.3 执行预检

```bash
#!/bin/bash
# 预检脚本 — 在部署前执行

echo "===== V9 Embedding Service 部署预检 ====="

# 1. CPU
CPU_CORES=$(nproc)
echo "[1] CPU 核心数: $CPU_CORES"
[ "$CPU_CORES" -ge 4 ] && echo "    ✅ 满足要求" || echo "    ❌ 需要 4 核以上"

# 2. 内存
MEM_GB=$(free -g | awk '/^Mem:/ {print $2}')
echo "[2] 内存: ${MEM_GB}GB"
[ "$MEM_GB" -ge 8 ] && echo "    ✅ 满足要求" || echo "    ❌ 需要 8GB 以上"

# 3. 磁盘
DISK_GB=$(df -BG /opt 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G')
echo "[3] /opt 可用磁盘: ${DISK_GB}GB"
[ "$DISK_GB" -ge 10 ] && echo "    ✅ 满足要求" || echo "    ❌ 需要 10GB 以上"

# 4. Python
PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
echo "[4] Python: $PY_VER"
python3 -c "import sys; exit(0 if sys.version_info >= (3,11) else 1)" && echo "    ✅ 满足要求" || echo "    ❌ 需要 3.11+"

# 5. 网络
echo "[5] HuggingFace 镜像连通性..."
if curl -sf --max-time 5 https://hf-mirror.com > /dev/null 2>&1; then
    echo "    ✅ 可访问"
else
    echo "    ❌ 无法访问 hf-mirror.com"
fi

# 6. 端口 8001
echo "[6] 端口 8001 占用检查..."
if ss -tlnp | grep -q ":8001 "; then
    echo "    ⚠️ 端口已被占用"
    ss -tlnp | grep ":8001 "
else
    echo "    ✅ 端口可用"
fi

echo "===== 预检完成 ====="
```

---

## 2. 部署步骤

### Step 1: 创建运行用户和目录

```bash
# 创建专用运行用户（无登录权限，提高安全性）
sudo useradd -r -s /usr/sbin/nologin embedding

# 创建目录结构
sudo mkdir -p /opt/finsight-v9/{backend,data/hf_cache,logs/v9-embedding}

# 设置所有权
sudo chown -R embedding:embedding /opt/finsight-v9

echo "✅ Step 1 完成: 用户和目录已创建"
```

### Step 2: 安装 Python 依赖

```bash
# 安装系统编译依赖
sudo apt-get update
sudo apt-get install -y build-essential python3-dev

# 安装 Python 依赖
cd /opt/finsight-v9/backend
sudo -u embedding pip3 install --user -r requirements.txt

echo "✅ Step 2 完成: Python 依赖已安装"
```

### Step 3: 部署应用代码

```bash
# 从 Docker 镜像提取代码（推荐方式）
docker create --name deploy-helper finsightv9/embedding-service:prod
docker cp deploy-helper:/app/embedding_service.py /opt/finsight-v9/backend/
docker cp deploy-helper:/app/start-embedding.sh /opt/finsight-v9/backend/
docker cp deploy-helper:/app/deploy.sh /opt/finsight-v9/backend/
docker cp deploy-helper:/app/deploy/ /opt/finsight-v9/backend/
docker rm deploy-helper

# 或从源码复制
# scp backend/embedding_service.py user@server:/opt/finsight-v9/backend/
# scp backend/start-embedding.sh user@server:/opt/finsight-v9/backend/

# 设置权限
sudo chmod +x /opt/finsight-v9/backend/start-embedding.sh
sudo chmod +x /opt/finsight-v9/backend/deploy.sh
sudo chown -R embedding:embedding /opt/finsight-v9

echo "✅ Step 3 完成: 应用代码已部署"
```

### Step 4: 安装 systemd 服务

```bash
# 复制服务文件
sudo cp /opt/finsight-v9/backend/deploy/v9-embedding.service /etc/systemd/system/

# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 设置开机自启
sudo systemctl enable v9-embedding

echo "✅ Step 4 完成: systemd 服务已安装"
```

### Step 5: 启动服务

```bash
# 启动服务
sudo systemctl start v9-embedding

# 等待模型加载（预热约 6-10 秒）
echo "等待模型预热..."
sleep 15

# 检查服务状态
sudo systemctl status v9-embedding --no-pager

echo "✅ Step 5 完成: 服务已启动"
```

### Step 6: 部署后验证

```bash
# 执行 5 项自动化测试
./deploy.sh test

# 或手动验证
curl -s http://localhost:8001/api/embed/health | python3 -m json.tool
```

---

## 3. systemd 配置详解

### 3.1 服务文件完整结构

基于 [v9-embedding.service](file:///d:/FinSightV9/backend/deploy/v9-embedding.service)：

```
/etc/systemd/system/v9-embedding.service
├── [Unit]          — 服务描述与依赖
├── [Service]       — 运行配置
│   ├── 用户/目录    — User, Group, WorkingDirectory
│   ├── 环境变量     — Environment (12 个变量)
│   ├── 重启策略     — Restart, RestartSec, TimeoutStartSec
│   ├── 资源限制     — LimitNOFILE, LimitNPROC, MemoryMax
│   ├── 日志配置     — StandardOutput, SyslogIdentifier
│   └── 安全加固     — NoNewPrivileges, ProtectKernel*
└── [Install]       — 安装目标
```

### 3.2 环境变量速查表

| 环境变量 | 默认值 | 说明 | 修改场景 |
|---------|--------|------|---------|
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | 模型 ID | 切换到 bge-large-zh-v1.5 |
| `EMBEDDING_LOG_LEVEL` | `INFO` | 日志级别 | 排查问题时改为 `DEBUG` |
| `EMBEDDING_WARMUP` | `true` | 启动预热 | 生产环境保持 `true` |
| `EMBEDDING_MAX_BATCH` | `64` | 批量上限 | 根据 OOM 情况调低 |
| `EMBEDDING_SLOW_THRESHOLD_MS` | `500` | 慢请求阈值 | 根据延迟要求调整 |
| `UVICORN_WORKERS` | `1` | Worker 数 | **CPU 场景强制 1**，GPU 可改 2-4 |
| `UVICORN_HOST` | `0.0.0.0` | 监听地址 | 内网可改为内网 IP |
| `UVICORN_PORT` | `8001` | 监听端口 | 多实例时按 8001/8002/8003 递增 |
| `HF_HOME` | `/opt/finsight-v9/data/hf_cache` | 模型缓存路径 | 确保目录可写 |
| `HF_ENDPOINT` | `https://hf-mirror.com` | HF 镜像 | 海外可改为 `https://huggingface.co` |
| `PYTHONUNBUFFERED` | `1` | Python 无缓冲 | 保持 `1` 确保日志实时输出 |
| `TZ` | `Asia/Shanghai` | 时区 | 按服务器所在时区设置 |

### 3.3 重启策略说明

| 参数 | 值 | 说明 |
|------|------|------|
| `Restart` | `on-failure` | 仅异常退出时重启，正常停止不重启 |
| `RestartSec` | `5` | 重启前等待 5 秒，避免频繁重启 |
| `TimeoutStartSec` | `120` | 启动超时 120 秒（模型预热可能较慢） |
| `TimeoutStopSec` | `30` | 优雅关闭超时 30 秒（等待进行中请求完成） |
| `WatchdogSec` | `180` | 看门狗 180 秒无心跳则判定为挂死 |

---

## 4. 日常运维操作

### 4.1 服务管理

```bash
# 启动服务
sudo systemctl start v9-embedding

# 停止服务
sudo systemctl stop v9-embedding

# 重启服务（有短暂中断）
sudo systemctl restart v9-embedding

# 重新加载配置（修改 service 文件后）
sudo systemctl daemon-reload
sudo systemctl restart v9-embedding

# 查看服务状态
sudo systemctl status v9-embedding

# 设置/取消开机自启
sudo systemctl enable v9-embedding
sudo systemctl disable v9-embedding
```

### 4.2 日志查看

```bash
# 实时查看日志（最常用）
sudo journalctl -u v9-embedding -f

# 查看最近 100 行
sudo journalctl -u v9-embedding -n 100 --no-pager

# 查看今天的日志
sudo journalctl -u v9-embedding --since today --no-pager

# 查看错误日志
sudo journalctl -u v9-embedding -p err -n 50 --no-pager

# 查看慢请求告警
sudo journalctl -u v9-embedding | grep "WARNING"

# 查看特定 request_id 的日志
sudo journalctl -u v9-embedding | grep "req:9840ff75"
```

### 4.3 健康检查

```bash
# 基础健康检查
curl -s http://localhost:8001/api/embed/health | python3 -m json.tool

# 性能指标
curl -s http://localhost:8001/api/embed/metrics | python3 -m json.tool

# 模型配置
curl -s http://localhost:8001/api/embed/config | python3 -m json.tool
```

**健康检查正常响应**（已实测验证）:

```json
{
    "status": "ok",
    "model_loaded": true,
    "model_loading": false,
    "model_id": "all-MiniLM-L6-v2",
    "dimension": 384,
    "error": null
}
```

### 4.4 日志级别切换

```bash
# 临时切换到 DEBUG（排查延迟问题）
sudo systemctl stop v9-embedding
sudo sed -i 's/EMBEDDING_LOG_LEVEL=INFO/EMBEDDING_LOG_LEVEL=DEBUG/' /etc/systemd/system/v9-embedding.service
sudo systemctl daemon-reload
sudo systemctl start v9-embedding

# 恢复到 INFO
sudo sed -i 's/EMBEDDING_LOG_LEVEL=DEBUG/EMBEDDING_LOG_LEVEL=INFO/' /etc/systemd/system/v9-embedding.service
sudo systemctl daemon-reload
sudo systemctl restart v9-embedding
```

---

## 5. 验证测试套件

### 5.1 五项自动化测试

以下测试已在 Docker 容器 `v9-embedding-prod` 上验证通过（2026-08-06）:

| 测试项 | 验证内容 | 预期结果 | 实测结果 |
|--------|---------|---------|---------|
| Test 1 | 健康检查 | status=ok | ✅ PASS - model=all-MiniLM-L6-v2, dim=384 |
| Test 2 | 单文本嵌入 | success=true | ✅ PASS - elapsed=413.7ms, dim=384 |
| Test 3 | 批量嵌入 (5 条) | 5 vectors | ✅ PASS - 5 vectors, elapsed=237.6ms |
| Test 4 | 性能指标 | 返回 metrics | ✅ PASS - QPS=0.0, P95=413.72ms, total=2 |
| Test 5 | 配置端点 | 返回 config | ✅ PASS - model=all-MiniLM-L6-v2, dim=384, max_batch=64 |

### 5.2 测试脚本

```bash
#!/bin/bash
# 在生产服务器上执行

PORT=8001
ALL_PASS=true

echo ""
echo "============================================="
echo "  V9 Embedding Service Test (port $PORT)"
echo "============================================="
echo ""

# Test 1: 健康检查
echo -n "[Test 1] Health Check ... "
HEALTH=$(curl -sf http://localhost:${PORT}/api/embed/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    MODEL=$(echo "$HEALTH" | python3 -c 'import sys,json; print(json.load(sys.stdin)["model_id"])')
    DIM=$(echo "$HEALTH" | python3 -c 'import sys,json; print(json.load(sys.stdin)["dimension"])')
    echo "PASS - model=$MODEL, dim=$DIM"
else
    echo "FAIL"
    ALL_PASS=false
fi

# Test 2: 单文本嵌入
echo -n "[Test 2] Single Text Embedding ... "
RESULT=$(curl -sf -X POST http://localhost:${PORT}/api/embed \
    -H "Content-Type: application/json" \
    -d '{"texts": ["Hello, world!"]}' 2>/dev/null)
if echo "$RESULT" | grep -q '"success":true'; then
    ELAPSED=$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["elapsed_ms"])')
    echo "PASS - elapsed=${ELAPSED}ms"
else
    echo "FAIL"
    ALL_PASS=false
fi

# Test 3: 批量嵌入
echo -n "[Test 3] Batch Embedding (5 texts) ... "
BATCH=$(curl -sf -X POST http://localhost:${PORT}/api/embed \
    -H "Content-Type: application/json" \
    -d '{"texts": ["A", "B", "C", "D", "E"]}' 2>/dev/null)
COUNT=$(echo "$BATCH" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("vectors",[])))' 2>/dev/null)
if [ "$COUNT" = "5" ]; then
    echo "PASS - 5 vectors"
else
    echo "FAIL - got $COUNT"
    ALL_PASS=false
fi

# Test 4: 性能指标
echo -n "[Test 4] Performance Metrics ... "
METRICS=$(curl -sf http://localhost:${PORT}/api/embed/metrics 2>/dev/null)
if [ -n "$METRICS" ]; then
    QPS=$(echo "$METRICS" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("throughput_req_per_s","N/A"))' 2>/dev/null)
    P95=$(echo "$METRICS" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("recent_p95_ms","N/A"))' 2>/dev/null)
    echo "PASS - QPS=$QPS, P95=${P95}ms"
else
    echo "FAIL"
    ALL_PASS=false
fi

# Test 5: 配置端点
echo -n "[Test 5] Config Endpoint ... "
CONFIG=$(curl -sf http://localhost:${PORT}/api/embed/config 2>/dev/null)
DIM=$(echo "$CONFIG" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("dimension","?"))' 2>/dev/null)
if [ "$DIM" != "?" ]; then
    echo "PASS - dim=$DIM"
else
    echo "FAIL"
    ALL_PASS=false
fi

echo ""
if [ "$ALL_PASS" = "true" ]; then
    echo "✅ All 5 tests PASSED"
else
    echo "❌ Some tests FAILED"
    exit 1
fi
```

### 5.3 日志验证要点

验证日志配置是否生效，检查以下关键日志格式：

```bash
# 查看最近 10 条关键日志
sudo journalctl -u v9-embedding -n 10 --no-pager
```

**预期日志格式**（已实测验证）:

```
# 服务启动日志
[INFO] embedding_service: Embedding Service 配置: model=all-MiniLM-L6-v2, dim=384, ...
[INFO] embedding_service: 启动预热: 正在加载模型 all-MiniLM-L6-v2 ...
[INFO] embedding_service: 模型加载完成: all-MiniLM-L6-v2 (6.7s), 维度=384, max_seq_length=256
[INFO] embedding_service: 预热完成，模型已就绪

# 请求处理日志（含 request_id + 耗时分解）
[INFO] embedding_service: [req:9840ff75] 嵌入完成: 1 条, 413.7ms (model=0.0, encode=413.7, serialize=0.0), dim=384
[INFO] embedding_service: [req:46b46c35] 嵌入完成: 5 条, 237.6ms (model=0.0, encode=237.6, serialize=0.0), dim=384

# 慢请求告警（>500ms 时触发）
[WARNING] embedding_service: [req:xxxx] 慢请求告警: 1333.0ms > 阈值 500ms | 分解: model=0.0ms, encode=1333.0ms, ...
```

---

## 6. 配置变更操作

### 6.1 切换模型

```bash
# 切换到 bge-large-zh-v1.5（中文优化模型）
sudo sed -i 's/EMBEDDING_MODEL=all-MiniLM-L6-v2/EMBEDDING_MODEL=bge-large-zh-v1.5/' \
    /etc/systemd/system/v9-embedding.service

# 重载并重启
sudo systemctl daemon-reload
sudo systemctl restart v9-embedding

# 验证模型切换
sleep 15
curl -s http://localhost:8001/api/embed/health | python3 -m json.tool
# 预期: model_id=bge-large-zh-v1.5, dimension=1024
```

### 6.2 启用 GPU 模式

```bash
# 编辑服务文件
sudo nano /etc/systemd/system/v9-embedding.service

# 取消注释 GPU 配置块，修改为:
#   Environment="UVICORN_WORKERS=4"
#   Environment="CUDA_VISIBLE_DEVICES=0"
#   Environment="OMP_NUM_THREADS=4"

# 重载并重启
sudo systemctl daemon-reload
sudo systemctl restart v9-embedding
```

### 6.3 多实例部署（横向扩展）

当单 Worker 无法满足 >30 并发时，部署多个单 Worker 实例 + Nginx 负载均衡：

```bash
# 实例 1: 端口 8001
sudo cp /etc/systemd/system/v9-embedding.service /etc/systemd/system/v9-embedding-1.service
sudo sed -i 's/UVICORN_PORT=8001/UVICORN_PORT=8001/' /etc/systemd/system/v9-embedding-1.service

# 实例 2: 端口 8002
sudo cp /etc/systemd/system/v9-embedding.service /etc/systemd/system/v9-embedding-2.service
sudo sed -i 's/UVICORN_PORT=8001/UVICORN_PORT=8002/' /etc/systemd/system/v9-embedding-2.service

# 实例 3: 端口 8003
sudo cp /etc/systemd/system/v9-embedding.service /etc/systemd/system/v9-embedding-3.service
sudo sed -i 's/UVICORN_PORT=8001/UVICORN_PORT=8003/' /etc/systemd/system/v9-embedding-3.service

# 重载并启动所有实例
sudo systemctl daemon-reload
sudo systemctl enable --now v9-embedding-1 v9-embedding-2 v9-embedding-3

# 安装 Nginx 负载均衡
sudo cp /opt/finsight-v9/backend/deploy/nginx-embedding.conf /etc/nginx/conf.d/
sudo systemctl reload nginx
```

---

## 7. 故障排查

### 7.1 常见问题速查表

| 问题 | 症状 | 排查命令 | 解决方案 |
|------|------|---------|---------|
| 服务启动失败 | `systemctl status` 显示 failed | `journalctl -u v9-embedding -n 50` | 检查 Python 依赖、端口占用 |
| 模型加载失败 | health 返回 `model_loaded: false` | `journalctl -u v9-embedding \| grep "加载失败"` | 检查 HF_HOME 权限、网络连通 |
| 首次请求慢 | 前几秒延迟 > 5s | `curl .../metrics` 查看 avg_inference | 确认 `EMBEDDING_WARMUP=true` |
| CPU 占用过高 | 持续 > 90% | `top -p $(pgrep -f uvicorn)` | 降低并发或增加实例 |
| 内存持续增长 | `free -m` 持续上升 | `systemctl status` 查看内存 | 取消注释 `MemoryMax=8G` |
| 慢请求频繁 | WARN 日志多 | `journalctl -u v9-embedding \| grep WARNING` | 分析请求特征，降低 batch size |
| 端口冲突 | 启动失败 | `ss -tlnp \| grep 8001` | 修改 `UVICORN_PORT` 或释放端口 |

### 7.2 诊断脚本

```bash
#!/bin/bash
# 快速诊断 — 一键检查服务健康度

echo "===== V9 Embedding Service 诊断 ====="
echo ""

# 1. 服务状态
echo "[1] 服务状态"
systemctl status v9-embedding --no-pager 2>/dev/null | head -5
echo ""

# 2. 健康检查
echo "[2] 健康检查"
HEALTH=$(curl -sf http://localhost:8001/api/embed/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo "  ❌ 服务不可达"
fi
echo ""

# 3. 性能指标
echo "[3] 性能指标"
METRICS=$(curl -sf http://localhost:8001/api/embed/metrics 2>/dev/null)
if [ -n "$METRICS" ]; then
    echo "$METRICS" | python3 -m json.tool 2>/dev/null || echo "$METRICS"
else
    echo "  ❌ 无法获取指标"
fi
echo ""

# 4. 系统资源
echo "[4] 系统资源"
echo "  CPU: $(top -bn1 | grep 'Cpu(s)' | awk '{print $2}')%"
echo "  内存: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "  磁盘: $(df -h /opt | awk 'NR==2 {print $4 "/" $2}')"
echo ""

# 5. 最近错误
echo "[5] 最近 5 条错误日志"
journalctl -u v9-embedding -p err -n 5 --no-pager 2>/dev/null || echo "  无错误日志"
echo ""

# 6. 慢请求统计
echo "[6] 最近慢请求告警"
SLOW_COUNT=$(journalctl -u v9-embedding --since "1 hour ago" --no-pager 2>/dev/null | grep -c "WARNING" || echo "0")
echo "  最近 1 小时慢请求: $SLOW_COUNT 条"
echo ""

echo "===== 诊断完成 ====="
```

---

## 8. 回滚与卸载

### 8.1 回滚到旧版本

```bash
# 停止新版本
sudo systemctl stop v9-embedding

# 替换为旧版本代码
sudo cp /opt/finsight-v9/backup/embedding_service.py.bak /opt/finsight-v9/backend/

# 重启
sudo systemctl start v9-embedding

# 验证
curl -s http://localhost:8001/api/embed/health
```

### 8.2 完全卸载

```bash
# 停止并禁用服务
sudo systemctl stop v9-embedding
sudo systemctl disable v9-embedding

# 删除服务文件
sudo rm /etc/systemd/system/v9-embedding.service
sudo systemctl daemon-reload

# 删除应用（保留模型缓存）
sudo rm -rf /opt/finsight-v9/backend

# 删除模型缓存（可选）
# sudo rm -rf /opt/finsight-v9/data/hf_cache

# 删除用户（可选）
# sudo userdel embedding
```

---

## 9. 附录

### 9.1 文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| 服务文件 | `/etc/systemd/system/v9-embedding.service` | systemd 配置 |
| 应用代码 | `/opt/finsight-v9/backend/embedding_service.py` | Embedding 服务 |
| 启动脚本 | `/opt/finsight-v9/backend/start-embedding.sh` | uvicorn 启动 |
| 部署脚本 | `/opt/finsight-v9/backend/deploy.sh` | 一键部署工具 |
| 模型缓存 | `/opt/finsight-v9/data/hf_cache/` | HuggingFace 模型 |
| Nginx 配置 | `/etc/nginx/conf.d/nginx-embedding.conf` | 负载均衡（多实例） |

### 9.2 相关文档

| 文档 | 链接 |
|------|------|
| ADR-014 决策文档 | [adr-014-vector-search-over-tfidf.md](file:///d:/FinSightV9/docs/reference/adr-014-vector-search-over-tfidf.md) |
| 性能对比报告 | [1w-vs-4w-performance-analysis.md](file:///d:/FinSightV9/docs/reports/1w-vs-4w-performance-analysis.md) |
| systemd 服务文件 | [v9-embedding.service](file:///d:/FinSightV9/backend/deploy/v9-embedding.service) |
| Docker Compose 模板 | [docker-compose.embedding.yml](file:///d:/FinSightV9/backend/docker-compose.embedding.yml) |
| 生产镜像 Dockerfile | [Dockerfile.production](file:///d:/FinSightV9/backend/Dockerfile.production) |

### 9.3 性能基准参考

基于 ADR-014 实测数据（2026-08-06）:

| 并发用户 | QPS | P50 | P95 | P99 | 错误率 |
|---------|-----|-----|-----|-----|--------|
| 5 | 38.28 | 113ms | 224ms | 300ms | 0% |
| 10 | 27.63 | 325ms | 580ms | 2212ms | 0% |
| 20 | 28.73 | 668ms | 1008ms | 2766ms | 0% |
| 50 | 26.04 | 1747ms | 3282ms | 4038ms | 0% |

> **结论**: 单 Worker 在 ≤20 并发时表现良好（P95 < 1s），>30 并发建议横向扩展。

---

**文档版本**: v1.2.0
**Git 标签**: v1.2.0
**最后更新**: 2026-08-06
**验证状态**: ✅ 已通过 Docker 容器 `v9-embedding-prod` 实测验证
**实测日期**: 2026-08-06
**发布包**: v9-embedding-deploy-v1.2.0.tar.gz
