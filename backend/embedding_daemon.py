"""
V9 Embedding Daemon — Windows 跨进程模型共享方案（Phase 2 B1）

单一进程持有 1 份 BGE 模型，uvicorn 的多 workers 通过 localhost HTTP
转发请求到此处，解决 Windows spawn 无 COW 导致的 4 份模型内存浪费。

与 embedding_service.py 的关系：
  - embedding_daemon.py 只负责「推理」：加载模型 + /daemon/embed 接口
  - embedding_service.py 负责「API 契约」：LRU 缓存、指令前缀、错误处理、
    熔断器、fallback、metrics、/api/embed 兼容前端的完整接口
  - 两者通过 EMBEDDING_USE_DAEMON + EMBEDDING_DAEMON_URL 环境变量对接

设计原则（错误处理见 embedding_service.py 内的 _DaemonClient）：
  1. daemon 本身不做重试 / 降级（它是"推理终点"，失败就 5xx）；
     重试、降级、熔断器全部放在 embedding_service 侧。
  2. daemon 永远单 worker（uvicorn workers=1 硬编码），否则又回到
     多进程复制模型的老问题。
  3. daemon 启动时直接 warmup 加载模型（不像 service 可懒加载），
     以便 start-embedding-stack.ps1 可以 /daemon/health 轮询到
     status=ok 再启动 service，避免首请求雪崩。

启动（通常不直接执行，用 scripts/start-embedding-stack.ps1）：
    python backend/embedding_daemon.py
    EMBEDDING_MODEL=bge-large-zh-v1.5 python backend/embedding_daemon.py --port 8765
"""
import os
import sys
import time
import logging
from typing import Optional

# HuggingFace 国内镜像（与 embedding_service.py 保持一致）
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

# 关键：把 HF_HOME / HUGGINGFACE_HUB_CACHE 指到项目自带的 .hf_cache，
# 否则 SentenceTransformer 默认去 %USERPROFILE%\.cache\huggingface 找模型，
# 而我们实际缓存的是 d:\FinSightV9\.hf_cache。
_REPO_ROOT_DAEMON = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_HF_HOME_FALLBACK = os.path.join(_REPO_ROOT_DAEMON, ".hf_cache")
os.environ.setdefault("HF_HOME", _HF_HOME_FALLBACK)
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", os.path.join(_HF_HOME_FALLBACK, "hub"))
HF_HOME: str = os.environ["HF_HOME"]

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# ---------------------------------------------------------------------------
# 复用 embedding_service.py 内的 MODEL_REGISTRY / 模型配置常量
# （避免双份定义漂移；若导入失败则回退到内联最小定义）
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

try:
    from embedding_service import (
        MODEL_REGISTRY as _MODEL_REGISTRY,
    )
except Exception:  # pragma: no cover - 导入失败时内联最小注册表
    _MODEL_REGISTRY = {
        "all-MiniLM-L6-v2": {
            "hf_repo": "sentence-transformers/all-MiniLM-L6-v2",
            "dimension": 384,
            "max_tokens": 256,
            "size_mb": 23,
            "language": "多语言（英文优先）",
            "description": "轻量级多语言模型，推理速度快",
        },
        "bge-large-zh-v1.5": {
            "hf_repo": "BAAI/bge-large-zh-v1.5",
            "dimension": 1024,
            "max_tokens": 512,
            "size_mb": 1300,
            "language": "中文专用",
            "description": "C-MTEB Top 5 中文嵌入模型，中文检索精度高",
            "query_instruction": "为这个句子生成表示以用于检索相关文章：",
        },
    }


# ---------------------------------------------------------------------------
# 环境变量配置（EMBEDDING_ 前缀，与 embedding_service.py 对齐）
# ---------------------------------------------------------------------------

LOG_LEVEL = os.environ.get("EMBEDDING_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] daemon: %(message)s",
)
logger = logging.getLogger("embedding_daemon")
logger.setLevel(LOG_LEVEL)

# 模型 ID（默认 bge-large-zh-v1.5）
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "bge-large-zh-v1.5")
if EMBEDDING_MODEL not in _MODEL_REGISTRY:
    logger.error("未知的 EMBEDDING_MODEL=%s，可选值: %s",
                 EMBEDDING_MODEL, list(_MODEL_REGISTRY.keys()))
    raise SystemExit(f"Invalid EMBEDDING_MODEL: {EMBEDDING_MODEL}")

_MODEL_CONFIG = _MODEL_REGISTRY[EMBEDDING_MODEL]
EMBEDDING_DIMENSION: int = _MODEL_CONFIG["dimension"]
_HF_REPO: str = _MODEL_CONFIG["hf_repo"]

# 批量推理上限（与 service 侧保持一致，daemon 侧再加一道兜底）
MAX_BATCH_SIZE = int(os.environ.get("EMBEDDING_MAX_BATCH", "64"))

# FP16 精度开关（仅 CUDA / MPS 生效，CPU 会被硬件门控静默跳过）
# 本机为 CPU 推理，默认 false；GPU 场景由 start-embedding-daemon.ps1 动态探测后设 true
USE_FP16 = os.environ.get("EMBEDDING_FP16", "false").lower() == "true"

# Phase 1 叠加到 daemon：限制 torch / MKL / OMP 线程数
# 目的：bge 在 Intel CPU 上单进程推理的最优线程数通常在 4~8，
# 如果不限制，默认=逻辑核数，多 worker + daemon 叠加会导致
# CPU 过度超卖、上下文切换爆炸、P95 延迟翻倍。
try:
    import psutil as _psutil
    _phys = _psutil.cpu_count(logical=False) or 4
except Exception:
    _phys = 4
# 默认：物理核数的一半（给 uvicorn workers 留出另一半 CPU）
_DEFAULT_TORCH_THREADS = max(2, _phys // 2)
_TORCH_THREADS = int(os.environ.get("EMBEDDING_TORCH_THREADS",
                                    str(_DEFAULT_TORCH_THREADS)))
os.environ["OMP_NUM_THREADS"] = str(_TORCH_THREADS)
os.environ["MKL_NUM_THREADS"] = str(_TORCH_THREADS)
os.environ["OPENBLAS_NUM_THREADS"] = str(_TORCH_THREADS)
os.environ["VECLIB_MAXIMUM_THREADS"] = str(_TORCH_THREADS)
os.environ["NUMEXPR_NUM_THREADS"] = str(_TORCH_THREADS)

logger.info(
    "Embedding Daemon 配置: model=%s, dim=%d, repo=%s, fp16=%s, "
    "torch_threads=%d, max_batch=%d",
    EMBEDDING_MODEL, EMBEDDING_DIMENSION, _HF_REPO, USE_FP16,
    _TORCH_THREADS, MAX_BATCH_SIZE,
)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="V9 Embedding Daemon", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["127.0.0.1", "localhost"],  # daemon 只接受本机转发
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

_model = None
_model_load_error: Optional[str] = None
# 实际加载的模型精度（反映真实运行状态，而非 env 声明值）：
#   "float32" / "float16" / None（未加载）
_model_actual_dtype: Optional[str] = None


# ---------------------------------------------------------------------------
# 请求 / 响应模型（daemon 侧极简：service 侧会做完整校验）
# ---------------------------------------------------------------------------

class DaemonEmbedRequest(BaseModel):
    texts: list[str] = Field(..., description="待嵌入文本",
                             max_length=MAX_BATCH_SIZE)
    is_query: bool = Field(False, description="是否为查询（用于日志，推理路径相同）")


# ---------------------------------------------------------------------------
# 模型加载（daemon 启动时 warmup，不在请求路径里做懒加载）
# ---------------------------------------------------------------------------

def _load_model():
    """启动时加载模型；失败会记录到 _model_load_error 并返回异常。"""
    global _model, _model_load_error, _model_actual_dtype
    try:
        import torch
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        _model_load_error = f"依赖缺失: {e}"
        logger.error(_model_load_error)
        raise

    torch.set_num_threads(_TORCH_THREADS)
    # torch 2.x 以下没有 set_float32_matmul_precision，忽略即可
    try:
        torch.set_float32_matmul_precision("medium")
    except Exception:
        pass

    logger.info("开始加载嵌入模型: %s (FP16=%s, torch_threads=%d)",
                EMBEDDING_MODEL, USE_FP16, _TORCH_THREADS)
    t0 = time.time()
    try:
        # 不指定 cache_folder：SentenceTransformer 会基于 HF_HOME 自动解析
        # hub/ 下的实际缓存目录（cache_folder 直接指向 HF_HOME 会找不到
        # pytorch_model.bin，因为文件在 HF_HOME/hub/models--... 下）。
        kwargs = {
            "local_files_only": True,
        }
        # CPU 不支持 torch.float16，会触发 transformers 权重解析时匹配失败
        # （报 OSError：does not appear to have a file named pytorch_model.bin）
        _device_have_fp16 = torch.cuda.is_available() or (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        )
        _fp16_applied = False
        if USE_FP16 and _device_have_fp16:
            kwargs["model_kwargs"] = {"torch_dtype": torch.float16}
            _fp16_applied = True
        _model = SentenceTransformer(_HF_REPO, **kwargs)
    except Exception as e:
        _model_load_error = f"模型加载失败: {e}"
        _model_actual_dtype = None
        logger.error(_model_load_error, exc_info=True)
        raise

    elapsed = time.time() - t0
    _model_actual_dtype = "float16" if _fp16_applied else "float32"
    actual_dim = _model.get_sentence_embedding_dimension()
    if actual_dim != EMBEDDING_DIMENSION:
        logger.warning("模型维度不匹配: 预期=%d, 实际=%d，以实际为准",
                       EMBEDDING_DIMENSION, actual_dim)

    logger.info(
        "模型就绪: %s, 耗时 %.1fs, 维度=%d, max_seq_length=%s",
        EMBEDDING_MODEL, elapsed, actual_dim,
        getattr(_model, "max_seq_length", "unknown"),
    )


@app.on_event("startup")
async def _startup():
    """启动事件：warmup 加载模型，失败不直接抛（让 /daemon/health 能报告 error）。
    但在实践中，如果模型都加载不了，daemon 应该尽快退出，让启动脚本感知失败。
    """
    try:
        _load_model()
    except Exception:
        # 5 秒后退出进程：给日志落盘时间，同时让 start-embedding-stack.ps1
        # 能通过进程退出码感知"daemon 起不来"而不是无限轮询 health
        def _suicide():
            time.sleep(5)
            logger.critical("模型加载失败，daemon 5 秒后自毁退出")
            os._exit(2)

        import threading as _th
        _th.Thread(target=_suicide, daemon=True).start()


# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------

@app.get("/daemon/health")
def daemon_health():
    """健康检查。status: ok / loading / error。

    启动脚本会轮询此接口直到 status=ok 再启动 embedding_service，
    避免首请求全打到还在加载模型的 daemon 上超时。
    """
    if _model_load_error:
        return {
            "status": "error",
            "model_loaded": False,
            "model_id": EMBEDDING_MODEL,
            "dimension": EMBEDDING_DIMENSION,
            "torch_threads": _TORCH_THREADS,
            "fp16": USE_FP16,
            "dtype": _model_actual_dtype,
            "error": _model_load_error,
        }
    return {
        "status": "ok" if _model is not None else "loading",
        "model_loaded": _model is not None,
        "model_id": EMBEDDING_MODEL,
        "dimension": EMBEDDING_DIMENSION,
        "torch_threads": _TORCH_THREADS,
        "fp16": USE_FP16,
        "dtype": _model_actual_dtype,
        "error": None,
    }


@app.post("/daemon/embed")
def daemon_embed(req: DaemonEmbedRequest):
    """推理入口。

    注意：
      - instruction 前缀、normalize、metrics、缓存 **全部** 由
        embedding_service.py 处理；daemon 只做最薄的一层推理。
      - service 侧转发时已经加了 instruction 前缀（若是 query），
        这里不重复加；is_query 仅用于日志区分。
      - 返回 Python list[list[float]]，与 service 侧 /api/embed 契约
        下的 vectors 字段保持同结构，便于转发时不需要二次转换。
    """
    if _model is None:
        if _model_load_error:
            raise HTTPException(500, detail=f"模型不可用: {_model_load_error}")
        raise HTTPException(503, detail="模型加载中")

    if not req.texts:
        return {"vectors": [], "dimension": EMBEDDING_DIMENSION, "inference_ms": 0.0}

    if len(req.texts) > MAX_BATCH_SIZE:
        raise HTTPException(
            400,
            detail=f"批量上限 {MAX_BATCH_SIZE}，当前 {len(req.texts)} 条",
        )

    t0 = time.perf_counter()
    try:
        # normalize_embeddings=True：daemon 侧就做好归一化，
        # service 侧直接可用（余弦相似度=点积）。
        vectors = _model.encode(
            req.texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
    except Exception as e:
        logger.error("推理失败: texts=%d, is_query=%s, err=%s",
                     len(req.texts), req.is_query, e, exc_info=True)
        raise HTTPException(500, detail=f"推理失败: {e}")

    ms = (time.perf_counter() - t0) * 1000
    # 慢推理告警（>500ms），便于定位 daemon 侧瓶颈
    if ms > 500:
        logger.warning(
            "慢推理告警: %.1fms > 500ms | texts=%d, is_query=%s, "
            "total_chars=%d, max_len=%d, model=%s",
            ms, len(req.texts), req.is_query,
            sum(len(t) for t in req.texts),
            max((len(t) for t in req.texts), default=0),
            EMBEDDING_MODEL,
        )
    else:
        # INFO 级别：记录每次推理的详细信息（texts 数量、is_query、耗时、文本预览）
        # 因为 LRU 缓存在 service 侧，daemon 收到的请求都是真实推理（非缓存命中），
        # 所以 INFO 级别不会产生过多日志
        _preview = req.texts[0][:80] if req.texts else ""
        logger.info(
            "daemon推理: texts=%d, is_query=%s, %.1fms, total_chars=%d, "
            "preview='%s'",
            len(req.texts), req.is_query, ms,
            sum(len(t) for t in req.texts), _preview,
        )

    return {
        "vectors": vectors.tolist(),
        "dimension": EMBEDDING_DIMENSION,
        "inference_ms": round(ms, 2),
    }


# ---------------------------------------------------------------------------
# CLI 入口（通常由 start-embedding-stack.ps1 调用）
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="V9 Embedding Daemon")
    parser.add_argument("--host", default=os.environ.get("EMBEDDING_DAEMON_HOST",
                                                         "127.0.0.1"),
                        help="监听地址（强烈建议 127.0.0.1，daemon 不应暴露给外网）")
    parser.add_argument("--port", type=int,
                        default=int(os.environ.get("EMBEDDING_DAEMON_PORT", "8765")),
                        help="监听端口，默认 8765")
    args = parser.parse_args()

    # 关键约束：daemon 必须单 worker！否则又回到多进程复制模型。
    # 如果用户硬传 UVICORN_WORKERS > 1，我们忽略并告警。
    env_workers = os.environ.get("UVICORN_WORKERS")
    if env_workers and int(env_workers) > 1:
        logger.warning(
            "检测到 UVICORN_WORKERS=%s > 1，daemon 强制使用 workers=1，"
            "否则多份模型会抵消 daemon 方案的内存收益。",
            env_workers,
        )

    logger.info("启动 Embedding Daemon: host=%s, port=%d, workers=1 (强制单进程)",
                args.host, args.port)

    uvicorn.run(
        "embedding_daemon:app",
        host=args.host,
        port=args.port,
        workers=1,           # 硬编码单 worker
        log_level="info",
        timeout_keep_alive=30,
    )
