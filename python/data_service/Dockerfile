# V9 数据采集服务 — Docker 镜像
#
# 用途：容器化运行 Python AkShare 采集后端（collect_endpoints.py）
# 暴露 /api/collect/* 与 /health 接口，供前端 Vite 代理或 Electron Sidecar 调用
#
# 使用方式（配合项目根目录 docker-compose.yml）：
#   docker compose up -d data-collector        # 仅启动采集服务
#   docker compose up -d                       # 启动采集 + 前端
#   docker compose logs -f data-collector      # 查看采集日志
#   curl http://localhost:8000/health          # 健康检查
#
# 单独构建：
#   docker build -t v9-data-collector python/data_service
#   docker run --rm -p 8000:8000 v9-data-collector

# ══════════════════════════════════════════════════════════════════════════════
# 基础镜像：Python 3.11 slim（体积小，满足 FastAPI + AkShare 依赖）
# ══════════════════════════════════════════════════════════════════════════════
FROM python:3.11-slim

# 设置 Python 运行时环境变量
# - PYTHONDONTWRITEBYTECODE: 不生成 .pyc，减少镜像体积
# - PYTHONUNBUFFERED: 日志实时输出，便于 docker logs 排查
# - PIP_NO_CACHE_DIR: 不缓存 pip 下载，减少镜像体积
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 设置工作目录
WORKDIR /app

# 安装系统依赖（AkShare 部分 HTTP 接口需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 先复制依赖清单，利用 Docker 缓存层
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用源码（collect_endpoints.py + lib/ 工具模块）
COPY collect_endpoints.py ./
COPY lib ./lib

# 创建采集输出目录（与前端 outputs/collected-data 对应，便于挂载持久化）
RUN mkdir -p /app/outputs/collected-data

# 暴露 FastAPI 服务端口（与 vite.config.ts 代理目标一致）
EXPOSE 8000

# 健康检查：每 30 秒探测一次 /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=3).read()" || exit 1

# 启动命令：uvicorn 加载 collect_endpoints:app
# --host 0.0.0.0 允许容器外访问（前端 Vite 代理 / 同宿主机 curl）
# --port 8000 与 vite.config.ts proxy target 一致
CMD ["uvicorn", "collect_endpoints:app", "--host", "0.0.0.0", "--port", "8000"]
