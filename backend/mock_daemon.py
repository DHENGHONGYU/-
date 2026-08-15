"""
Mock Embedding Daemon —用于本地链路验证

不加载真实 sentence-transformers 模型，
用随机向量模拟嵌入响应，验证完整链路通畅。

仅用于开发调试，生产环境请使用 embedding_daemon.py
"""

import time
import logging
from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [mock-daemon] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mock_daemon")

app = FastAPI(title="Mock Embedding Daemon", version="0.1.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

MODEL_DIM = 384
MODEL_ID = "mock-all-MiniLM-L6-v2"
MODEL_LOADED = True


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


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok" if MODEL_LOADED else "loading",
        model_loaded=MODEL_LOADED,
        model_id=MODEL_ID,
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    _start = time.perf_counter()
    logger.info(f"[embed] text_len={len(req.text)}, pooling={req.pooling}")

    np.random.seed(hash(req.text) % (2**31))
    vector = (np.random.randn(MODEL_DIM) * 0.1).tolist()
    norm = np.sqrt(sum(x * x for x in vector))
    vector = [x / norm for x in vector]

    _elapsed = (time.perf_counter() - _start) * 1000
    logger.info(f"[embed] ✅ dim={MODEL_DIM} ({_elapsed:.1f}ms)")

    return EmbedResponse(
        vector=vector,
        dimension=MODEL_DIM,
        model_id=MODEL_ID,
    )


@app.post("/embed/batch")
async def embed_batch(texts: list[str]):
    _start = time.perf_counter()
    logger.info(f"[embed_batch] count={len(texts)}")

    vectors = []
    for text in texts:
        np.random.seed(hash(text) % (2**31))
        vec = (np.random.randn(MODEL_DIM) * 0.1).tolist()
        norm = np.sqrt(sum(x * x for x in vec))
        vectors.append([x / norm for x in vec])

    _elapsed = (time.perf_counter() - _start) * 1000
    logger.info(f"[embed_batch] ✅ {len(vectors)} vectors ({_elapsed:.1f}ms)")

    return {
        "vectors": vectors,
        "dimension": MODEL_DIM,
        "model_id": MODEL_ID,
    }


if __name__ == "__main__":
    logger.info(f"Starting Mock Daemon on :8765 (dim={MODEL_DIM})")
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")