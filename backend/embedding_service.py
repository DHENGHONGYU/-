"""
Embedding Service — FastAPI 转发层

方案B: Electron + 本地 Python Sidecar

职责：
  - 作为 Electron 前端的 HTTP 入口（端口 8001）
  - 将 /api/embed 请求转发给 Embedding Daemon（端口 8765）
  - 提供 /api/embed/health 健康检查端点
  - 处理 CORS（允许 Electron renderer 访问）

架构：
  Electron Renderer → :8001/api/embed → :8765/embed → sentence-transformers

分离 daemon 和 service 的原因：
  1. daemon 单进程持有模型，避免重复加载
  2. service 可多 worker 处理并发请求
  3. daemon 崩溃时 service 可返回降级响应
"""

import os
import logging
import httpx

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("embedding_service")

# ──────────────────────────────────────────────
# 配置
# ──────────────────────────────────────────────

DAEMON_URL = os.environ.get(
    "EMBEDDING_DAEMON_URL", "http://127.0.0.1:8765"
)
SERVICE_PORT = int(os.environ.get("SIDECAR_EMBEDDING_PORT", "8001"))

# ──────────────────────────────────────────────
# FastAPI 应用
# ──────────────────────────────────────────────

app = FastAPI(
    title="V9 Embedding Service",
    description="嵌入服务转发层（Electron → Daemon）",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# 请求/响应模型
# ──────────────────────────────────────────────


class EmbedRequest(BaseModel):
    text: str
    pooling: str = "mean"


class EmbedResponse(BaseModel):
    vector: list[float]
    dimension: int
    model_id: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_id: str


# ──────────────────────────────────────────────
# 路由
# ──────────────────────────────────────────────


@app.get("/api/embed/health", response_model=HealthResponse)
async def health():
    """健康检查 — 转发到 daemon 的 /health"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{DAEMON_URL}/health")
            if resp.status_code == 200:
                data = resp.json()
                return HealthResponse(
                    status=data.get("status", "unknown"),
                    model_loaded=data.get("model_loaded", False),
                    model_id=data.get("model_id", ""),
                )
            else:
                return HealthResponse(
                    status="unhealthy",
                    model_loaded=False,
                    model_id="",
                )
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.warning(f"Daemon unreachable: {e}")
        return HealthResponse(
            status="unreachable",
            model_loaded=False,
            model_id="",
        )


@app.post("/api/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """嵌入请求 — 转发到 daemon 的 /embed"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{DAEMON_URL}/embed",
                json={"text": req.text, "pooling": req.pooling},
            )
            if resp.status_code == 200:
                data = resp.json()
                return EmbedResponse(
                    vector=data["vector"],
                    dimension=data["dimension"],
                    model_id=data["model_id"],
                )
            else:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Daemon error: {resp.text}",
                )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Embedding daemon not available. Please wait for model to load.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Embedding request timed out. Model may still be loading.",
        )


@app.post("/api/embed/batch")
async def embed_batch(texts: list[str]):
    """批量嵌入请求 — 转发到 daemon 的 /embed/batch"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{DAEMON_URL}/embed/batch",
                json=texts,
            )
            if resp.status_code == 200:
                return resp.json()
            else:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Daemon error: {resp.text}",
                )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Embedding daemon not available.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Batch embedding request timed out.",
        )


@app.get("/")
async def root():
    """根路径 — 服务信息"""
    return {
        "service": "V9 Embedding Service",
        "version": "1.0.0",
        "daemon_url": DAEMON_URL,
        "endpoints": [
            "GET  /api/embed/health",
            "POST /api/embed",
            "POST /api/embed/batch",
        ],
    }


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] [service] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=SERVICE_PORT,
        workers=1,
        log_level="info",
        access_log=False,
    )
