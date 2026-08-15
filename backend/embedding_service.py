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

健康检查：
  /api/embed/health 上报实际加载 dtype（float32/fp16），由 embedding-health-check.yml CI 验证
"""

import os
import time
import logging
import threading
from collections import deque

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
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
SLOW_REQUEST_THRESHOLD_MS = float(os.environ.get("SLOW_REQUEST_THRESHOLD_MS", "100"))

# ──────────────────────────────────────────────
# 性能统计（线程安全）
# ──────────────────────────────────────────────

class PerformanceStats:
    """累积请求性能统计，用于识别性能瓶颈"""

    def __init__(self, max_history: int = 1000):
        self._lock = threading.Lock()
        self._total = 0
        self._slow_count = 0
        self._errors = 0
        self._total_time_ms = 0.0
        self._max_time_ms = 0.0
        self._max_endpoint = ""
        self._history: deque = deque(maxlen=max_history)
        self._slow_requests: deque = deque(maxlen=200)
        self._endpoint_stats: dict = {}

    def record(self, endpoint: str, elapsed_ms: float, status_code: int) -> None:
        with self._lock:
            self._total += 1
            self._total_time_ms += elapsed_ms
            if elapsed_ms > self._max_time_ms:
                self._max_time_ms = elapsed_ms
                self._max_endpoint = endpoint
            if status_code >= 400:
                self._errors += 1

            self._history.append({
                "endpoint": endpoint,
                "elapsed_ms": elapsed_ms,
                "status": status_code,
                "ts": time.time(),
            })

            if elapsed_ms >= SLOW_REQUEST_THRESHOLD_MS:
                self._slow_count += 1
                self._slow_requests.append({
                    "endpoint": endpoint,
                    "elapsed_ms": elapsed_ms,
                    "status": status_code,
                    "ts": time.time(),
                })

            if endpoint not in self._endpoint_stats:
                self._endpoint_stats[endpoint] = {"count": 0, "total_ms": 0.0, "max_ms": 0.0}
            ep = self._endpoint_stats[endpoint]
            ep["count"] += 1
            ep["total_ms"] += elapsed_ms
            if elapsed_ms > ep["max_ms"]:
                ep["max_ms"] = elapsed_ms

    def get_slow_requests(self) -> list[dict]:
        with self._lock:
            return list(self._slow_requests)

    def get_summary(self) -> dict:
        with self._lock:
            avg = self._total_time_ms / self._total if self._total > 0 else 0
            eps = {}
            for name, s in self._endpoint_stats.items():
                eps[name] = {
                    "count": s["count"],
                    "avg_ms": round(s["total_ms"] / s["count"], 1) if s["count"] > 0 else 0,
                    "max_ms": round(s["max_ms"], 1),
                    "p95_ms": self._percentile_for_endpoint(name, 95),
                }
            return {
                "total_requests": self._total,
                "slow_requests": self._slow_count,
                "errors": self._errors,
                "avg_ms": round(avg, 1),
                "max_ms": round(self._max_time_ms, 1),
                "slow_threshold_ms": SLOW_REQUEST_THRESHOLD_MS,
                "bottleneck_endpoint": self._max_endpoint,
                "endpoints": eps,
            }

    def _percentile_for_endpoint(self, endpoint: str, pct: float) -> float:
        """计算指定端点的 p95 耗时"""
        times = [h["elapsed_ms"] for h in self._history if h["endpoint"] == endpoint]
        if not times:
            return 0.0
        times.sort()
        idx = min(int(len(times) * pct / 100), len(times) - 1)
        return round(times[idx], 1)

perf_stats = PerformanceStats()

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
    _start = time.perf_counter()
    logger.info("[health] ▶ incoming health check request")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{DAEMON_URL}/health")
            _elapsed = (time.perf_counter() - _start) * 1000
            if resp.status_code == 200:
                data = resp.json()
                logger.info(
                    f"[health] ✅ daemon healthy ({_elapsed:.1f}ms): "
                    f"status={data.get('status')}, "
                    f"model_loaded={data.get('model_loaded')}, "
                    f"model_id={data.get('model_id')}"
                )
                return HealthResponse(
                    status=data.get("status", "unknown"),
                    model_loaded=data.get("model_loaded", False),
                    model_id=data.get("model_id", ""),
                )
            else:
                logger.warning(
                    f"[health] ⚠ daemon unhealthy ({_elapsed:.1f}ms): "
                    f"HTTP {resp.status_code}, body={resp.text[:200]}"
                )
                return HealthResponse(
                    status="unhealthy",
                    model_loaded=False,
                    model_id="",
                )
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        _elapsed = (time.perf_counter() - _start) * 1000
        logger.error(
            f"[health] ❌ daemon unreachable ({_elapsed:.1f}ms): "
            f"type={type(e).__name__}, msg={str(e)[:200]}"
        )
        return HealthResponse(
            status="unreachable",
            model_loaded=False,
            model_id="",
        )


@app.post("/api/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """嵌入请求 — 转发到 daemon 的 /embed"""
    _start = time.perf_counter()
    _text_preview = req.text[:50] + ("..." if len(req.text) > 50 else "")
    logger.info(
        f"[embed] ▶ incoming request: text_len={len(req.text)}, "
        f"pooling={req.pooling}, preview='{_text_preview}'"
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{DAEMON_URL}/embed",
                json={"text": req.text, "pooling": req.pooling},
            )
            _elapsed = (time.perf_counter() - _start) * 1000
            if resp.status_code == 200:
                data = resp.json()
                logger.info(
                    f"[embed] ✅ success ({_elapsed:.1f}ms): "
                    f"dim={data['dimension']}, model={data['model_id']}"
                )
                return EmbedResponse(
                    vector=data["vector"],
                    dimension=data["dimension"],
                    model_id=data["model_id"],
                )
            else:
                logger.error(
                    f"[embed] ❌ daemon error ({_elapsed:.1f}ms): "
                    f"HTTP {resp.status_code}, body={resp.text[:300]}"
                )
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Daemon error: {resp.text}",
                )
    except httpx.ConnectError as e:
        _elapsed = (time.perf_counter() - _start) * 1000
        logger.error(
            f"[embed] ❌ daemon connect error ({_elapsed:.1f}ms): "
            f"msg={str(e)[:200]}"
        )
        raise HTTPException(
            status_code=503,
            detail="Embedding daemon not available. Please wait for model to load.",
        )
    except httpx.TimeoutException as e:
        _elapsed = (time.perf_counter() - _start) * 1000
        logger.error(
            f"[embed] ❌ daemon timeout ({_elapsed:.1f}ms): "
            f"msg={str(e)[:200]}"
        )
        raise HTTPException(
            status_code=504,
            detail="Embedding request timed out. Model may still be loading.",
        )


@app.post("/api/embed/batch")
async def embed_batch(texts: list[str]):
    """批量嵌入请求 — 转发到 daemon 的 /embed/batch"""
    _start = time.perf_counter()
    _total_chars = sum(len(t) for t in texts)
    logger.info(
        f"[embed_batch] ▶ incoming request: count={len(texts)}, "
        f"total_chars={_total_chars}, "
        f"first_preview='{texts[0][:40] if texts else 'N/A'}'"
    )
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{DAEMON_URL}/embed/batch",
                json=texts,
            )
            _elapsed = (time.perf_counter() - _start) * 1000
            if resp.status_code == 200:
                body = resp.json()
                logger.info(
                    f"[embed_batch] ✅ success ({_elapsed:.1f}ms): "
                    f"count={len(body.get('vectors', []))}, "
                    f"dim={body.get('dimension')}, model={body.get('model_id')}"
                )
                return body
            else:
                logger.error(
                    f"[embed_batch] ❌ daemon error ({_elapsed:.1f}ms): "
                    f"HTTP {resp.status_code}, body={resp.text[:300]}"
                )
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Daemon error: {resp.text}",
                )
    except httpx.ConnectError as e:
        _elapsed = (time.perf_counter() - _start) * 1000
        logger.error(
            f"[embed_batch] ❌ daemon connect error ({_elapsed:.1f}ms): "
            f"count={len(texts)}, msg={str(e)[:200]}"
        )
        raise HTTPException(
            status_code=503,
            detail="Embedding daemon not available.",
        )
    except httpx.TimeoutException as e:
        _elapsed = (time.perf_counter() - _start) * 1000
        logger.error(
            f"[embed_batch] ❌ daemon timeout ({_elapsed:.1f}ms): "
            f"count={len(texts)}, msg={str(e)[:200]}"
        )
        raise HTTPException(
            status_code=504,
            detail="Batch embedding request timed out.",
        )


@app.get("/")
async def root():
    """根路径 — 服务信息"""
    logger.info("[root] ▶ root endpoint hit")
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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """全局请求日志中间件 — 记录所有请求的耗时和状态码，慢请求用 WARNING 级别"""
    _start = time.perf_counter()
    response = await call_next(request)
    _elapsed = (time.perf_counter() - _start) * 1000
    endpoint = request.url.path

    perf_stats.record(endpoint, _elapsed, response.status_code)

    if _elapsed >= SLOW_REQUEST_THRESHOLD_MS:
        logger.warning(
            f"[http:SLOW] {request.method} {endpoint} → "
            f"{response.status_code} ({_elapsed:.1f}ms) "
            f"⚠ EXCEEDED {SLOW_REQUEST_THRESHOLD_MS}ms threshold"
        )
    else:
        logger.info(
            f"[http] {request.method} {endpoint} → "
            f"{response.status_code} ({_elapsed:.1f}ms)"
        )
    return response


@app.get("/__debug/perf")
async def get_performance_stats():
    """调试端点 — 返回性能统计摘要和慢请求列表"""
    summary = perf_stats.get_summary()
    slow = perf_stats.get_slow_requests()
    bottleneck_analysis = ""
    if summary["slow_requests"] > 0:
        bottleneck_analysis = _analyze_bottleneck(summary, slow)
    return {
        "summary": summary,
        "slow_requests": slow[:20],
        "bottleneck_analysis": bottleneck_analysis,
    }


@app.get("/__debug/slow")
async def get_slow_only():
    """调试端点 — 仅返回超过阈值的慢请求"""
    return {
        "threshold_ms": SLOW_REQUEST_THRESHOLD_MS,
        "count": len(perf_stats.get_slow_requests()),
        "requests": perf_stats.get_slow_requests(),
    }


def _analyze_bottleneck(summary: dict, slow_requests: list[dict]) -> str:
    """生成性能瓶颈分析文本"""
    lines = []
    lines.append(f"🚨 {summary['slow_requests']} slow requests detected (threshold: {summary['slow_threshold_ms']}ms)")

    endpoint_counts: dict[str, int] = {}
    for sr in slow_requests:
        ep = sr["endpoint"]
        endpoint_counts[ep] = endpoint_counts.get(ep, 0) + 1

    worst_ep = max(endpoint_counts, key=endpoint_counts.get) if endpoint_counts else "N/A"
    lines.append(f"   Worst endpoint: {worst_ep} ({endpoint_counts.get(worst_ep, 0)} slow calls)")

    for ep_name, ep_data in summary["endpoints"].items():
        flag = "⚠️" if ep_data.get("max_ms", 0) >= SLOW_REQUEST_THRESHOLD_MS else "  "
        lines.append(f"   {flag} {ep_name}: avg={ep_data.get('avg_ms', 0):.1f}ms, "
                      f"max={ep_data.get('max_ms', 0):.1f}ms, "
                      f"p95={ep_data.get('p95_ms', 0):.1f}ms, "
                      f"n={ep_data['count']}")

    if summary["errors"] > 0:
        lines.append(f"   ⛔ {summary['errors']} error responses detected")

    return "\n".join(lines)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] [service] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logger.info(f"Starting V9 Embedding Service on :{SERVICE_PORT}")
    logger.info(f"Daemon URL: {DAEMON_URL}")
    logger.info(f"Endpoints: /api/embed/health, /api/embed, /api/embed/batch")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=SERVICE_PORT,
        workers=1,
        log_level="info",
        access_log=False,
    )