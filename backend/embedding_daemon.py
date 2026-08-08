"""
Embedding Daemon — 单进程持有 sentence-transformers 模型

方案B: Electron + 本地 Python Sidecar

职责：
  - 加载 sentence-transformers 模型（all-MiniLM-L6-v2）
  - 提供 /embed 端点接收文本，返回嵌入向量
  - 提供 /health 端点供 Electron 健康检查

运行端口：由环境变量 SIDECAR_DAEMON_PORT 指定（默认 8765）

由 embedding_service.py 通过 HTTP 转发调用，
避免每个请求重复加载模型。
"""

import os
import logging
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("embedding_daemon")

# ──────────────────────────────────────────────
# 配置
# ──────────────────────────────────────────────

EMBEDDING_MODEL_ID = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
DAEMON_PORT = int(os.environ.get("SIDECAR_DAEMON_PORT", "8765"))

# ──────────────────────────────────────────────
# FastAPI 应用
# ──────────────────────────────────────────────

app = FastAPI(
    title="V9 Embedding Daemon",
    description="本地嵌入模型守护进程（单进程持有模型）",
    version="1.0.0",
)

# 允许本地跨域（Electron renderer → daemon）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# 模型管理（懒加载）
# ──────────────────────────────────────────────

_model = None
_model_loading = False
_model_load_error: Optional[str] = None


def _load_model():
    """加载 sentence-transformers 模型（线程安全懒加载）"""
    global _model, _model_loading, _model_load_error

    if _model is not None:
        return _model

    if _model_loading:
        # 等待其他线程加载完成
        import time
        while _model_loading and _model is None:
            time.sleep(0.5)
        if _model is not None:
            return _model
        if _model_load_error:
            raise RuntimeError(_model_load_error)

    _model_loading = True
    try:
        from sentence_transformers import SentenceTransformer

        logger.info(f"Loading embedding model: {EMBEDDING_MODEL_ID}")
        _model = SentenceTransformer(EMBEDDING_MODEL_ID)
        logger.info(
            f"Model loaded successfully: {EMBEDDING_MODEL_ID}, "
            f"dimension={_model.get_sentence_embedding_dimension()}"
        )
    except Exception as e:
        _model_load_error = str(e)
        logger.error(f"Failed to load model: {e}")
        raise
    finally:
        _model_loading = False

    return _model


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


@app.get("/health", response_model=HealthResponse)
async def health():
    """健康检查端点"""
    return HealthResponse(
        status="ok" if _model is not None else "loading",
        model_loaded=_model is not None,
        model_id=EMBEDDING_MODEL_ID,
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """生成文本嵌入向量"""
    try:
        model = _load_model()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model not available: {e}")

    try:
        # sentence-transformers encode
        embedding = model.encode(req.text, convert_to_numpy=True)
        vector = embedding.tolist()

        return EmbedResponse(
            vector=vector,
            dimension=len(vector),
            model_id=EMBEDDING_MODEL_ID,
        )
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed/batch")
async def embed_batch(texts: list[str]):
    """批量生成嵌入向量"""
    try:
        model = _load_model()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model not available: {e}")

    try:
        embeddings = model.encode(texts, convert_to_numpy=True, batch_size=32)
        return {
            "vectors": [e.tolist() for e in embeddings],
            "dimension": embeddings.shape[1],
            "model_id": EMBEDDING_MODEL_ID,
        }
    except Exception as e:
        logger.error(f"Batch embedding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────
# 启动事件
# ──────────────────────────────────────────────


@app.on_event("startup")
async def startup_event():
    """启动时预加载模型"""
    logger.info("Daemon starting, pre-loading model...")
    try:
        _load_model()
        logger.info("Model pre-loaded successfully")
    except Exception as e:
        logger.warning(f"Model pre-load failed (will retry on first request): {e}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] [daemon] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=DAEMON_PORT,
        workers=1,
        log_level="info",
    )
