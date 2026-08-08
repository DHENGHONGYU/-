"""
V9 Embedding Service — 云端 Embedding API（v2.0.0 Week 2 升级）

基于 sentence-transformers 提供文本嵌入服务，
替代前端 @xenova/transformers 本地推理（108 MB → 0 MB bundle）。

支持通过环境变量 EMBEDDING_MODEL 动态切换模型：
  - all-MiniLM-L6-v2 (384维, 默认, 英文优化)
  - bge-large-zh-v1.5 (1024维, 中文优化)

启动：
  # 默认模型 (all-MiniLM-L6-v2)
  uvicorn embedding_service:app --host 0.0.0.0 --port 8001

  # 切换到 bge-large-zh-v1.5
  EMBEDDING_MODEL=bge-large-zh-v1.5 uvicorn embedding_service:app --host 0.0.0.0 --port 8002

  # 多 worker 模式（生产环境推荐）
  uvicorn embedding_service:app --host 0.0.0.0 --port 8001 --workers 4

  # 启用 uvloop + httptools（v2.0.0 性能优化，Linux/macOS）
  uvicorn embedding_service:app --host 0.0.0.0 --port 8001 --workers 4 \
    --loop uvloop --http httptools

接口契约（与前端 cloudEmbeddingService.ts 保持兼容）：
  POST /api/embed         — 批量文本嵌入（同步路由，线程池执行）
  GET  /api/embed/health  — 健康检查 + 模型状态
  GET  /api/embed/config  — 模型配置信息（v2.0.0 新增）
  GET  /api/embed/metrics — 运行时性能指标（v2.0.0 新增）
"""

import os
import sys
import time
import uuid
import logging
import threading
from typing import Optional
from functools import lru_cache

# HuggingFace 国内镜像（避免 huggingface.co 被墙导致模型下载失败）
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

# 关键：把 HF_HOME / HUGGINGFACE_HUB_CACHE 指到项目自带的 .hf_cache，
# 否则 SentenceTransformer 默认去 %USERPROFILE%\.cache\huggingface 找模型，
# 而我们实际缓存的是 d:\FinSightV9\.hf_cache。
_HF_HOME_FALLBACK_SVC = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".hf_cache",
)
os.environ.setdefault("HF_HOME", _HF_HOME_FALLBACK_SVC)
os.environ.setdefault(
    "HUGGINGFACE_HUB_CACHE", os.path.join(_HF_HOME_FALLBACK_SVC, "hub")
)
HF_HOME: str = os.environ["HF_HOME"]

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Phase 2 新增依赖（可选导入，失败时 daemon 模式会被禁用）
# requests：转发到 embedding_daemon
# psutil：自动推导每个 worker 的 torch 线程数，避免 CPU 过载
try:
    import requests as _requests  # noqa: F401
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False

try:
    import psutil as _psutil  # noqa: F401
    _HAS_PSUTIL = True
except ImportError:
    _HAS_PSUTIL = False

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------

# 日志级别可通过环境变量控制（默认 INFO，排查延迟问题时可设为 DEBUG）
# DEBUG 级别会输出请求进入、编码前后、缓存命中等详细诊断日志
LOG_LEVEL = os.environ.get("EMBEDDING_LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=logging.INFO,  # root logger 保持 INFO，避免 httpx 等第三方库 DEBUG 刷屏
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("embedding_service")
logger.setLevel(LOG_LEVEL)  # embedding_service logger 单独控制级别

app = FastAPI(title="V9 Embedding Service", version="2.0.0")

# ---------------------------------------------------------------------------
# CORS — 允许前端开发服务器访问
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 模型注册表 — 支持多模型切换
# ---------------------------------------------------------------------------

MODEL_REGISTRY = {
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
        # bge 模型查询时建议添加 instruction（提升检索效果）
        "query_instruction": "为这个句子生成表示以用于检索相关文章：",
    },
}

# ---------------------------------------------------------------------------
# 环境变量配置（命名规范：EMBEDDING_ 前缀）
# ---------------------------------------------------------------------------

# 模型 ID（默认 bge-large-zh-v1.5，中文财经文本检索精度高）
# 如需切回轻量模型：EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "bge-large-zh-v1.5")

# 是否启用「跨进程模型共享 Daemon」模式
# 设置后，所有 worker 不再各自加载模型，而是转发到 embedding_daemon.py。
# 示例： EMBEDDING_DAEMON_URL=http://127.0.0.1:8099
# 为空字符串 = 关闭（默认，保持原有每进程加载模型的行为）
EMBEDDING_DAEMON_URL = os.environ.get("EMBEDDING_DAEMON_URL", "").strip().rstrip("/")

# 批量推理上限（避免单次请求过大导致 OOM）
MAX_BATCH_SIZE = int(os.environ.get("EMBEDDING_MAX_BATCH", "64"))

# 是否启用预热（启动时立即加载模型，避免首次请求慢）
WARMUP_ON_START = os.environ.get("EMBEDDING_WARMUP", "false").lower() == "true"

# 慢请求阈值（毫秒）：超过此值会打印 WARN 日志，便于排查延迟问题
SLOW_REQUEST_THRESHOLD_MS = float(os.environ.get("EMBEDDING_SLOW_THRESHOLD_MS", "500"))

# ---------------------------------------------------------------------------
# Phase 1 新增：FP16 精度 + Torch 线程数限制
#   FP16：仅 CUDA / MPS 可用；CPU 不支持 float16，配置会被硬件门控静默跳过
#         - 权重文件 1.3 GB（bge-large-zh-v1.5, BERT-large ~335M 参数, FP32 .bin）
#         - CPU 走 mmap 加载，实际 USS 仅 ~390 MB（OS 按需分页，非全量进 RAM）
#         - GPU FP16 内存 ~620 MB（torch_dtype cast，磁盘权重文件不变）
#   线程数：4 workers × 默认逻辑核数 → CPU 过度超卖，限制到物理核/worker
# ---------------------------------------------------------------------------

USE_FP16 = os.environ.get("EMBEDDING_FP16", "false").lower() == "true"

if _HAS_PSUTIL:
    _phys = _psutil.cpu_count(logical=False) or 4
    _workers = max(1, int(os.environ.get("UVICORN_WORKERS", "1")))
    # daemon 模式下，推理全在 daemon 侧做，service  workers 不用跑 torch，
    # 每个 worker 只留 1 线程保底即可
    if os.environ.get("EMBEDDING_USE_DAEMON", "false").lower() == "true":
        _DEFAULT_TORCH_THREADS = 1
    else:
        # 本地模式：物理核数 // workers，每个 worker 均分
        _DEFAULT_TORCH_THREADS = max(1, _phys // _workers)
else:
    _DEFAULT_TORCH_THREADS = 2

_TORCH_THREADS = int(os.environ.get("EMBEDDING_TORCH_THREADS",
                                    str(_DEFAULT_TORCH_THREADS)))
# 提前设环境变量，避免 torch 导入后才设不生效
os.environ["OMP_NUM_THREADS"] = str(_TORCH_THREADS)
os.environ["MKL_NUM_THREADS"] = str(_TORCH_THREADS)
os.environ["OPENBLAS_NUM_THREADS"] = str(_TORCH_THREADS)
os.environ["VECLIB_MAXIMUM_THREADS"] = str(_TORCH_THREADS)
os.environ["NUMEXPR_NUM_THREADS"] = str(_TORCH_THREADS)

# ---------------------------------------------------------------------------
# Phase 2 新增：Daemon 模式 + LRU 缓存 + Fallback / 熔断器
# ---------------------------------------------------------------------------

USE_DAEMON = os.environ.get("EMBEDDING_USE_DAEMON", "false").lower() == "true"
# 依赖缺失时自动降级（给友好日志，而不是启动崩溃）
if USE_DAEMON and not _HAS_REQUESTS:
    logger_fallback = logging.getLogger("embedding_service")
    logger_fallback.warning(
        "EMBEDDING_USE_DAEMON=true 但 requests 未安装，自动降级为本地模式。"
        "请执行: pip install requests"
    )
    USE_DAEMON = False

DAEMON_URL = os.environ.get("EMBEDDING_DAEMON_URL", "http://127.0.0.1:8765").rstrip("/")
# 连接超时 1s（daemon 死了端口不通时快速失败） + 读取超时 5s（推理本身 bge 单文本<100ms，
# 5s 足够覆盖 64 条大 batch 推理 + Windows 调度抖动）
DAEMON_TIMEOUT_CONNECT = float(os.environ.get("EMBEDDING_DAEMON_TIMEOUT_CONNECT", "1.0"))
DAEMON_TIMEOUT_READ = float(os.environ.get("EMBEDDING_DAEMON_TIMEOUT_READ", "5.0"))
DAEMON_TIMEOUT = (DAEMON_TIMEOUT_CONNECT, DAEMON_TIMEOUT_READ)

# Fallback：daemon 不可用时，是否自动降级为「本地懒加载模型」。
#   true = 可用性优先（内存会增加）
#   false = 宁愿 503 也不爆内存（硬内存约束场景）
DAEMON_FALLBACK_LOCAL = os.environ.get(
    "EMBEDDING_DAEMON_FALLBACK_LOCAL", "true"
).lower() == "true"

# 熔断器参数：
#   FAIL_THRESHOLD = 连续失败次数 → 打开熔断器（30s 内不再访问 daemon）
#   COOL_DOWN_SEC = 冷却时间，过后放 1 个探活请求
_CIRCUIT_FAIL_THRESHOLD = int(os.environ.get("EMBEDDING_CIRCUIT_FAIL_THRESHOLD", "2"))
_CIRCUIT_COOL_DOWN_SEC = int(os.environ.get("EMBEDDING_CIRCUIT_COOL_DOWN_SEC", "30"))

# LRU 缓存容量（B4 方案）：
#   key = (tuple(sorted_texts), is_query)，value = vector_list_tuple
#   bge-large-zh 1024 维 × 4 字节 ≈ 4KB / 条，1024 条约 = 4 MB
LRU_CACHE_SIZE = int(os.environ.get("EMBEDDING_LRU_SIZE", "1024"))

# 是否启用 LRU 缓存（默认开，可关用于对比测试）
USE_LRU = os.environ.get("EMBEDDING_USE_LRU", "true").lower() == "true"

# 验证模型 ID 有效性
if EMBEDDING_MODEL not in MODEL_REGISTRY:
    logger.error(
        "未知的 EMBEDDING_MODEL=%s，可选值: %s",
        EMBEDDING_MODEL,
        list(MODEL_REGISTRY.keys()),
    )
    raise SystemExit(f"Invalid EMBEDDING_MODEL: {EMBEDDING_MODEL}")

# 从注册表获取模型配置
_MODEL_CONFIG = MODEL_REGISTRY[EMBEDDING_MODEL]
EMBEDDING_MODEL_ID = EMBEDDING_MODEL
EMBEDDING_DIMENSION = _MODEL_CONFIG["dimension"]
_HF_REPO = _MODEL_CONFIG["hf_repo"]
_QUERY_INSTRUCTION = _MODEL_CONFIG.get("query_instruction")

# ---------------------------------------------------------------------------
# 运行时性能指标收集（v2.0.0 新增）
# ---------------------------------------------------------------------------

class _Metrics:
    """线程安全的运行时指标收集器"""

    def __init__(self):
        self._lock = threading.Lock()
        self._start_time = time.time()
        self._total_requests = 0
        self._total_texts = 0
        self._total_inference_ms = 0.0
        self._latencies_ms: list[float] = []  # 仅保留最近 100 个用于 P50/P95/P99

    def record(self, inference_ms: float, num_texts: int) -> None:
        with self._lock:
            self._total_requests += 1
            self._total_texts += num_texts
            self._total_inference_ms += inference_ms
            self._latencies_ms.append(inference_ms)
            # 仅保留最近 100 个样本，避免内存增长
            if len(self._latencies_ms) > 100:
                self._latencies_ms = self._latencies_ms[-100:]

    def snapshot(self) -> dict:
        with self._lock:
            n = len(self._latencies_ms)
            if n == 0:
                p50 = p95 = p99 = 0.0
            else:
                sorted_l = sorted(self._latencies_ms)
                p50 = sorted_l[n // 2]
                p95 = sorted_l[int(n * 0.95)]
                p99 = sorted_l[int(n * 0.99)] if n > 1 else sorted_l[0]
            uptime_s = time.time() - self._start_time
            return {
                "uptime_seconds": round(uptime_s, 1),
                "total_requests": self._total_requests,
                "total_texts_embedded": self._total_texts,
                "avg_inference_ms": round(self._total_inference_ms / self._total_requests, 2)
                if self._total_requests > 0
                else 0.0,
                "recent_p50_ms": round(p50, 2),
                "recent_p95_ms": round(p95, 2),
                "recent_p99_ms": round(p99, 2),
                "recent_samples": n,
                "throughput_req_per_s": round(self._total_requests / uptime_s, 3)
                if uptime_s > 0
                else 0.0,
                "throughput_texts_per_s": round(self._total_texts / uptime_s, 3)
                if uptime_s > 0
                else 0.0,
            }


_metrics = _Metrics()

# 扩展 _Metrics：增加 Phase 2 专属计数器（LRU 命中、daemon 请求/失败、fallback 次数）
# 这里通过 monkey patch 而非改类定义，避免破坏原有结构
_metrics._cache_hits = 0
_metrics._cache_misses = 0
_metrics._daemon_requests = 0
_metrics._daemon_failures = 0
_metrics._local_fallbacks = 0
_original_record = _metrics.record


def _extended_record(inference_ms: float, num_texts: int,
                     cache_hit: bool = False, daemon_ok: Optional[bool] = None,
                     fallback_local: bool = False):
    with _metrics._lock:
        if cache_hit:
            _metrics._cache_hits += 1
        else:
            _metrics._cache_misses += 1
        if daemon_ok is True:
            _metrics._daemon_requests += 1
        elif daemon_ok is False:
            _metrics._daemon_requests += 1
            _metrics._daemon_failures += 1
        if fallback_local:
            _metrics._local_fallbacks += 1
    _original_record(inference_ms, num_texts)


_metrics.record = _extended_record  # type: ignore[assignment]

_original_snapshot = _metrics.snapshot


def _extended_snapshot() -> dict:
    snap = _original_snapshot()
    lru_info = _lru.info()
    with _metrics._lock:
        # LRU 命中率优先采用 SimpleLRU 自身的计数（更准确，与业务请求一一对应）
        snap["lru_hit_rate"] = lru_info["hit_rate"]
        snap["lru_hits"] = lru_info["hits"]
        snap["lru_misses"] = lru_info["misses"]
        snap["lru_size_current"] = lru_info["size"]
        snap["lru_size_max"] = lru_info["capacity"]
        snap["daemon_enabled"] = USE_DAEMON
        snap["daemon_requests"] = _metrics._daemon_requests
        snap["daemon_failures"] = _metrics._daemon_failures
        snap["local_fallbacks"] = _metrics._local_fallbacks
        snap["daemon_failure_rate"] = (
            round(_metrics._daemon_failures / _metrics._daemon_requests, 4)
            if _metrics._daemon_requests > 0 else 0.0
        )
    return snap


_metrics.snapshot = _extended_snapshot  # type: ignore[assignment]


logger.info(
    "Embedding Service 配置: model=%s, dim=%d, repo=%s, max_batch=%d, warmup=%s, slow_threshold=%dms",
    EMBEDDING_MODEL_ID,
    EMBEDDING_DIMENSION,
    _HF_REPO,
    MAX_BATCH_SIZE,
    WARMUP_ON_START,
    SLOW_REQUEST_THRESHOLD_MS,
)
logger.info(
    "Phase 1/2 扩展配置: fp16=%s, torch_threads=%d, use_daemon=%s, daemon_url=%s, "
    "daemon_timeout=(%.1fs,%.1fs), fallback_local=%s, use_lru=%s, lru_size=%d, "
    "circuit_fail=%d, circuit_cool=%ds",
    USE_FP16, _TORCH_THREADS, USE_DAEMON, DAEMON_URL if USE_DAEMON else "N/A",
    DAEMON_TIMEOUT_CONNECT, DAEMON_TIMEOUT_READ,
    DAEMON_FALLBACK_LOCAL if USE_DAEMON else False,
    USE_LRU, LRU_CACHE_SIZE,
    _CIRCUIT_FAIL_THRESHOLD, _CIRCUIT_COOL_DOWN_SEC,
)
if USE_DAEMON:
    logger.info(
        "Daemon 模式：模型推理转发到 %s，本进程不加载模型。"
        "LRU 缓存命中时 P50 ≈ 0.1ms；daemon 崩溃时%s。",
        DAEMON_URL,
        "自动降级为本地加载（内存会增加约 3.1 GB）" if DAEMON_FALLBACK_LOCAL
        else "返回 503（严格内存模式，不爆内存）",
    )

# ---------------------------------------------------------------------------
# Phase 2：_DaemonClient —— 带熔断器的 daemon HTTP 转发器
#   熔断器状态：CLOSED（正常） → OPEN（连续失败，冷却中） → HALF_OPEN（探活）
#   探活：30s 冷却后放 1 个请求去打 /daemon/health，成功则切回 CLOSED
# ---------------------------------------------------------------------------


class _CircuitBreaker:
    """无外部依赖的极简熔断器实现（闭-开-半开三态）。"""

    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

    def __init__(self, fail_threshold: int, cool_down_sec: int):
        self._lock = threading.Lock()
        self._fail_threshold = fail_threshold
        self._cool_down_sec = cool_down_sec
        self._state = self.CLOSED
        self._consecutive_failures = 0
        self._open_at = 0.0

    def allow(self) -> bool:
        """是否允许访问 daemon。HALF_OPEN 时只允许 1 个探活请求。"""
        with self._lock:
            if self._state == self.CLOSED:
                return True
            if self._state == self.OPEN:
                elapsed = time.time() - self._open_at
                if elapsed >= self._cool_down_sec:
                    self._state = self.HALF_OPEN
                    logger.info(
                        "熔断器状态切换: OPEN → HALF_OPEN (冷却 %d秒已过, 实际等待 %.1f秒)。"
                        "放行 1 个探活请求测试 daemon 是否恢复。",
                        self._cool_down_sec, elapsed,
                    )
                    return True  # 放一个探活请求
                logger.debug(
                    "熔断器 OPEN: 冷却中 (%.1f/%d秒)，快速拒绝 daemon 请求",
                    elapsed, self._cool_down_sec,
                )
                return False  # 仍在冷却，快速失败
            # HALF_OPEN：只有第一个允许，后续继续拦
            logger.debug("熔断器 HALF_OPEN: 等待探活结果，当前请求继续拦截（走 fallback）")
            return False  # 保守：HALF_OPEN 只让探活线程去打 health，真实请求继续拦

    def on_success(self):
        with self._lock:
            prev_state = self._state
            self._consecutive_failures = 0
            if self._state in (self.OPEN, self.HALF_OPEN):
                logger.info(
                    "熔断器状态切换: %s → CLOSED (daemon 请求/探活成功，恢复正常转发)",
                    prev_state,
                )
            self._state = self.CLOSED

    def on_failure(self):
        with self._lock:
            self._consecutive_failures += 1
            prev_state = self._state
            if (self._state in (self.CLOSED, self.HALF_OPEN)
                    and self._consecutive_failures >= self._fail_threshold):
                self._state = self.OPEN
                self._open_at = time.time()
                logger.warning(
                    "熔断器状态切换: %s → OPEN (daemon 连续失败 %d/%d 次, 触发阈值)。"
                    "冷却 %d 秒内所有 daemon 请求快速失败→%s。"
                    "将在冷却结束后放 1 个探活请求尝试恢复。",
                    prev_state, self._consecutive_failures, self._fail_threshold,
                    self._cool_down_sec,
                    "降级本地模型" if DAEMON_FALLBACK_LOCAL else "返回 503",
                )
            elif self._consecutive_failures < self._fail_threshold:
                logger.debug(
                    "熔断器 %s: daemon 失败 %d/%d (未达阈值 %d，暂不打开)",
                    self._state, self._consecutive_failures,
                    self._fail_threshold, self._fail_threshold,
                )

    @property
    def state(self) -> str:
        with self._lock:
            return self._state


_circuit = _CircuitBreaker(_CIRCUIT_FAIL_THRESHOLD, _CIRCUIT_COOL_DOWN_SEC)

# HTTP Session（requests 连接池，复用 keep-alive，避免每次 3 次握手）
_daemon_session: Optional["_requests.Session"] = None  # type: ignore[valid-type]
_daemon_session_lock = threading.Lock()


def _get_daemon_session():
    global _daemon_session
    if not USE_DAEMON:
        return None
    if _daemon_session is not None:
        return _daemon_session
    with _daemon_session_lock:
        if _daemon_session is None:
            _daemon_session = _requests.Session()
            # 稍微增大连接池，4 workers 各并发 16 也够用
            adapter = _requests.adapters.HTTPAdapter(
                pool_connections=32, pool_maxsize=64
            )
            _daemon_session.mount("http://", adapter)
    return _daemon_session


def _daemon_probe_health() -> bool:
    """后台线程调用：打 /daemon/health 探活，用于熔断器 HALF_OPEN → CLOSED。"""
    return _daemon_probe_detail(timeout_sec=(0.5, 1.0)) is not None


def _daemon_probe_detail(timeout_sec=(0.5, 1.0)):
    """
    返回 daemon /daemon/health 的 JSON dict（含 status, model_loaded, dimension, fp16 等），
    如果 daemon 不通则返回 None。

    timeout_sec: 同 requests timeout —— float 表示总秒数，或 (connect_timeout, read_timeout) 二元组。
    """
    s = _get_daemon_session()
    if s is None:
        return None
    try:
        r = s.get(f"{DAEMON_URL}/daemon/health", timeout=timeout_sec)
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "ok":
                return data
    except Exception:
        pass
    return None


def _daemon_background_prober():
    """每 5 秒检查一次：如果熔断器是 OPEN/HALF_OPEN，尝试探活并恢复。"""
    while True:
        try:
            if _circuit.state != _CircuitBreaker.CLOSED:
                # 熔断器非 CLOSED — 主动探活尝试恢复
                logger.debug("后台探活: 熔断器=%s, 尝试 /daemon/health...", _circuit.state)
                if _daemon_probe_health():
                    _circuit.on_success()  # on_success 内部会打印状态切换日志
                    logger.info("daemon 后台探活成功，熔断器恢复 CLOSED")
            else:
                # CLOSED 状态也偶尔探活，提前发现 daemon 静默死亡（没走请求路径）
                if not _daemon_probe_health():
                    # 不直接改熔断器状态（可能只是瞬时抖动），下次请求失败才会触发打开
                    logger.warning(
                        "daemon 心跳检测失败（CLOSED 状态），可能 daemon 静默死亡。"
                        "等待用户请求侧验证是否触发熔断。",
                    )
        except Exception as e:
            logger.debug("daemon 探活线程异常: %s", e)
        time.sleep(5)


if USE_DAEMON:
    _probe_th = threading.Thread(target=_daemon_background_prober,
                                 name="emb-daemon-probe", daemon=True)
    _probe_th.start()
    logger.info("daemon 探活线程已启动（每 5 秒探测一次）")


def _daemon_embed(texts: list[str], is_query: bool) -> Optional[list[list[float]]]:
    """
    转发推理到 embedding_daemon。

    返回：
      - 成功：list[list[float]] 向量
      - 失败（熔断 / 超时 / 5xx / 依赖缺失）：None
        由上层决定 fallback 本地 or 抛 503。
    """
    if not USE_DAEMON:
        return None
    if not _circuit.allow():
        logger.debug("熔断器 OPEN，跳过 daemon 请求（快速失败→fallback）")
        return None

    s = _get_daemon_session()
    if s is None:
        return None

    _fwd_start = time.perf_counter()
    try:
        r = s.post(
            f"{DAEMON_URL}/daemon/embed",
            json={"texts": texts, "is_query": is_query},
            timeout=DAEMON_TIMEOUT,
        )
    except Exception as e:
        # 连接错误 / 超时 / 任何网络层异常
        _fwd_ms = (time.perf_counter() - _fwd_start) * 1000
        logger.warning(
            "daemon 转发异常 (网络层): %s, texts=%d, fwd=%.1fms, circuit_fail=%d/%d",
            type(e).__name__, len(texts), _fwd_ms,
            _circuit._consecutive_failures + 1, _circuit._fail_threshold,
        )
        _circuit.on_failure()
        return None

    _fwd_ms = (time.perf_counter() - _fwd_start) * 1000

    if 200 <= r.status_code < 300:
        try:
            data = r.json()
        except Exception as e:
            logger.warning("daemon 返回非 JSON: %s, fwd=%.1fms", e, _fwd_ms)
            _circuit.on_failure()
            return None
        vectors = data.get("vectors")
        if not isinstance(vectors, list):
            logger.warning("daemon 返回 vectors 格式非法: %s, fwd=%.1fms", type(vectors).__name__, _fwd_ms)
            _circuit.on_failure()
            return None
        _inference_ms = data.get("inference_ms", 0)
        logger.info(
            "daemon 转发成功: texts=%d, inference=%.1fms, fwd_total=%.1fms, circuit=CLOSED",
            len(texts), _inference_ms, _fwd_ms,
        )
        _circuit.on_success()
        return vectors  # type: ignore[return-value]

    # 4xx / 5xx
    logger.warning(
        "daemon 转发失败: HTTP %d, texts=%d, fwd=%.1fms, body[:200]=%s",
        r.status_code, len(texts), _fwd_ms, r.text[:200],
    )
    _circuit.on_failure()
    return None


# ---------------------------------------------------------------------------
# Phase 2：LRU 请求级缓存（B4 方案）
#   自实现简单 OrderedDict LRU（~10 行），避免 functools.lru_cache 的陷阱：
#     1. 推理失败/异常不会被缓存；
#     2. fallback 逻辑在缓存外部做，由业务代码控制「成功才 put」；
#     3. 可精确统计 hits/misses，与业务请求一一对应。
#   key = tuple(actual_texts)（instruction 已经编码进 actual_texts 字符串，
#       所以同样原始文本 + is_query=True 和 + is_query=False 天然是不同 key）
#   value = tuple(tuple(float))  — 向量的嵌套 tuple（不可变/hashable）
# ---------------------------------------------------------------------------

from collections import OrderedDict


class _SimpleLRU:
    """线程安全的 OrderedDict LRU。默认容量 1024 条。"""

    def __init__(self, capacity: int):
        self._cap = max(0, int(capacity))
        self._data: "OrderedDict" = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key):
        if self._cap <= 0:
            return None
        with self._lock:
            if key not in self._data:
                self.misses += 1
                # 追踪日志：LRU miss — 记录 key 预览和缓存当前大小，便于定位"为何没命中"
                _preview = ""
                if isinstance(key, tuple) and key:
                    _preview = str(key[0])[:80]
                logger.debug(
                    "LRU MISS  key_hash=%d preview='%s' size=%d/%d hits=%d misses=%d",
                    hash(key), _preview, len(self._data), self._cap,
                    self.hits, self.misses,
                )
                return None
            # 命中：移到末尾表示最近使用
            self._data.move_to_end(key)
            self.hits += 1
            logger.debug(
                "LRU HIT   key_hash=%d size=%d/%d hits=%d misses=%d",
                hash(key), len(self._data), self._cap, self.hits, self.misses,
            )
            return self._data[key]

    def put(self, key, value) -> None:
        if self._cap <= 0:
            return
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            else:
                # 超容量：先淘汰最久未使用
                if len(self._data) >= self._cap:
                    self._data.popitem(last=False)
                    logger.debug(
                        "LRU EVICT key_hash=%d (容量满，淘汰最久未用), size=%d/%d",
                        hash(key), len(self._data), self._cap,
                    )
                self._data[key] = value
            logger.debug(
                "LRU PUT   key_hash=%d size=%d/%d",
                hash(key), len(self._data), self._cap,
            )

    def info(self) -> dict:
        with self._lock:
            n = self.hits + self.misses
            return {
                "size": len(self._data),
                "capacity": self._cap,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": round(self.hits / n, 4) if n > 0 else 0.0,
            }


_lru = _SimpleLRU(LRU_CACHE_SIZE if USE_LRU else 0)
logger.info("LRU 缓存初始化: capacity=%d, enabled=%s", LRU_CACHE_SIZE, USE_LRU)


# ---------------------------------------------------------------------------
# 模型懒加载（首次请求时加载，避免启动慢）
#   * daemon 模式 + fallback=false：此分支永远不会触发
#   * daemon 模式 + fallback=true：daemon 失败后会触发
#   * 非 daemon 模式：原行为
# ---------------------------------------------------------------------------

_model = None
_model_loading = False
_model_load_error: Optional[str] = None
# 实际加载的模型精度（反映真实运行状态，而非 env 声明值）：
#   "float32" / "float16" / None（未加载）
# 用于 health 接口如实上报，避免 CPU 场景下因 USE_FP16=true 而"假报 float16"
_model_actual_dtype: Optional[str] = None


def get_model():
    """获取 SentenceTransformer 模型实例（懒加载 + 单例）"""
    global _model, _model_loading, _model_load_error, _model_actual_dtype

    if _model is not None:
        # 缓存命中 — 模型已加载，直接返回（高频路径，仅 DEBUG 级别）
        logger.debug("模型缓存命中: %s", EMBEDDING_MODEL_ID)
        return _model

    if _model_loading:
        # 并发请求时，首个请求正在加载模型，后续请求需等待
        logger.warning("模型正在加载中，并发请求被拒绝（503）")
        raise HTTPException(status_code=503, detail="模型加载中，请稍后重试")

    if _model_load_error:
        logger.error("模型此前加载失败，拒绝请求: %s", _model_load_error)
        raise HTTPException(
            status_code=500,
            detail=f"模型加载失败（需重启服务重试）: {_model_load_error}",
        )

    _model_loading = True
    try:
        import torch
        from sentence_transformers import SentenceTransformer

        # Phase 1：限制 torch 线程数，避免多个 workers 抢 CPU
        torch.set_num_threads(_TORCH_THREADS)
        try:
            torch.set_float32_matmul_precision("medium")
        except Exception:
            pass

        logger.info(
            "开始加载嵌入模型: %s (repo=%s, dim=%d, fp16_config=%s, torch_threads=%d)",
            EMBEDDING_MODEL_ID, _HF_REPO, EMBEDDING_DIMENSION, USE_FP16, _TORCH_THREADS,
        )
        start = time.time()

        # Phase 1 A1：FP16 精度（仅 CUDA / MPS），避免 CPU 半精度触发权重解析失败
        # 不指定 cache_folder：依赖 HF_HOME 环境变量（项目内 .hf_cache）自动解析 hub/ 目录
        _model_kwargs = {
            "local_files_only": True,  # 强制本地缓存，避免联网下载超时卡死
        }
        # CPU 不支持 torch.float16：一旦注入会导致 transformers 权重解析时匹配失败
        # （报错：does not appear to have a file named pytorch_model.bin or model.safetensors
        _device_have_fp16 = torch.cuda.is_available() or (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        )
        _fp16_applied = False
        if USE_FP16 and _device_have_fp16:
            _model_kwargs["model_kwargs"] = {"torch_dtype": torch.float16}
            _fp16_applied = True
        _model = SentenceTransformer(_HF_REPO, **_model_kwargs)
        elapsed = time.time() - start

        # 记录实际加载精度（用于 health 接口如实上报，避免 CPU 场景假报 float16）
        _model_actual_dtype = "float16" if _fp16_applied else "float32"

        # 验证模型维度
        actual_dim = _model.get_sentence_embedding_dimension()
        if actual_dim != EMBEDDING_DIMENSION:
            logger.warning(
                "模型维度不匹配: 预期=%d, 实际=%d，以实际为准",
                EMBEDDING_DIMENSION, actual_dim,
            )

        logger.info(
            "模型加载完成: %s (%.1fs), 维度=%d, dtype=%s, max_seq_length=%s",
            EMBEDDING_MODEL_ID, elapsed, actual_dim, _model_actual_dtype,
            getattr(_model, "max_seq_length", "unknown"),
        )
    except Exception as e:
        _model_load_error = str(e)
        _model_actual_dtype = None
        logger.error("模型加载失败: %s — %s", EMBEDDING_MODEL_ID, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"模型加载失败: {e}")
    finally:
        _model_loading = False

    return _model


def _encode_with_instruction(texts: list[str], is_query: bool = False, request_id: str = "") -> list[list[float]]:
    """
    编码文本，自动处理 bge 模型的 query instruction。

    统一顺序（无论 daemon / 本地 / LRU）：
      1. service 侧先处理好 instruction 前缀 → actual_texts（要真正编码的文本）
      2. 查 LRU 缓存（key = tuple(actual_texts)）
      3. 未命中 → 走 daemon 转发（优先）
      4. daemon 失败 + fallback=true → 走本地懒加载模型
      5. fallback=false → 抛 503（严格内存模式）

    instruction 逻辑只在此函数里做一次，daemon / get_model() 内部不再重复处理。
    """
    # Step 1: 统一处理 instruction 前缀（只在 service 做一次）
    if is_query and _QUERY_INSTRUCTION:
        actual_texts = [f"{_QUERY_INSTRUCTION}{t}" for t in texts]
        instruction_applied = True
    else:
        actual_texts = list(texts)
        instruction_applied = False

    # Debug 日志：只写"实际编码文本"的统计，避免重复
    total_chars = sum(len(t) for t in texts)
    max_len = max((len(t) for t in texts), default=0)
    logger.debug(
        "编码输入: texts=%d, is_query=%s, total_chars=%d, max_len=%d, "
        "instruction_applied=%s, use_lru=%s, use_daemon=%s",
        len(texts), is_query, total_chars, max_len,
        instruction_applied, USE_LRU, USE_DAEMON,
    )

    encode_start = time.perf_counter()
    cache_hit = False
    daemon_ok: Optional[bool] = None
    fallback_local = False
    vectors_nested: Optional[tuple] = None

    # Step 2: LRU 缓存（SimpleLRU，线程安全，命中即返回嵌套 tuple 向量）
    if USE_LRU and LRU_CACHE_SIZE > 0:
        cache_key = tuple(actual_texts)
        cached_val = _lru.get(cache_key)  # None = 未命中
        if cached_val is not None:
            vectors_nested = cached_val
            cache_hit = True

    # Step 3: 缓存未命中 → 走「daemon 优先 → fallback 本地」
    if vectors_nested is None:
        daemon_result = None
        if USE_DAEMON:
            # 熔断器判断在 _daemon_embed 内部做
            daemon_result = _daemon_embed(actual_texts, is_query)
            if daemon_result is not None:
                vectors_nested = tuple(tuple(v) for v in daemon_result)
                daemon_ok = True
            else:
                daemon_ok = False
                # 熔断器 OPEN 或 网络失败 → 继续看 fallback_local

        # daemon 没走通 → fallback 本地（或本来就非 daemon 模式）
        if vectors_nested is None:
            use_local = (not USE_DAEMON) or (USE_DAEMON and DAEMON_FALLBACK_LOCAL)
            if not use_local:
                # 严格内存模式：返回 503
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "embedding daemon 不可用（熔断器打开或请求失败），"
                        "且 EMBEDDING_DAEMON_FALLBACK_LOCAL=false 已禁用本地加载，"
                        "请稍后重试或检查 daemon 状态。"
                    ),
                )
            fallback_local = USE_DAEMON  # 只有 USE_DAEMON=true 走到这才算 fallback
            # 本地推理：instruction 已经加好了，直接编码 actual_texts
            model = get_model()
            logger.warning(
                "daemon 不可用，已降级为本地加载模型 (torch_threads=%d, fp16=%s)。"
                "fallback_local=true 模式：可用性优先，内存会增加 ~3.1 GB。",
                _TORCH_THREADS, USE_FP16,
            ) if fallback_local else None
            vectors = model.encode(actual_texts, normalize_embeddings=True)
            vectors_nested = tuple(tuple(v) for v in vectors.tolist())

        # Step 3.5: LRU 写入（只有「真正做了推理且成功」的结果才写入缓存）
        #   满足：LRU 启用 + 当前是缓存未命中（cache_hit=False）+ 推理结果非空
        if USE_LRU and LRU_CACHE_SIZE > 0 and not cache_hit and vectors_nested is not None:
            _lru.put(tuple(actual_texts), vectors_nested)

    encode_elapsed_ms = (time.perf_counter() - encode_start) * 1000

    # Step 4: 记录扩展 metrics（LRU 命中率 / daemon 成功率 / fallback 次数）
    #   注意：我们把「cache_hit=True」的请求也计入 record（因为它们也是请求的一部分）
    _metrics.record(
        encode_elapsed_ms, len(texts),
        cache_hit=cache_hit,
        daemon_ok=daemon_ok,
        fallback_local=fallback_local,
    )

    # 调试日志：结果形状
    result_vectors: list[list[float]] = [list(v) for v in vectors_nested]
    shape = (len(result_vectors), len(result_vectors[0]) if result_vectors else 0)

    # ── 关键节点追踪日志（INFO 级别）──
    # 记录每个请求的完整决策路径：LRU 命中/未命中原因 → daemon 转发结果 → fallback 触发
    # 便于从日志中重建请求链路，排查"为何走了 fallback"或"为何 LRU 没命中"
    _req_tag = f"[req:{request_id}] " if request_id else ""
    if cache_hit:
        _decision = "LRU_HIT(缓存命中, 跳过推理)"
    elif not USE_LRU or LRU_CACHE_SIZE <= 0:
        _decision = "LRU_DISABLED(缓存未启用) → "
    else:
        _decision = "LRU_MISS(缓存未命中) → "

    if not cache_hit:
        if daemon_ok is True:
            _decision += "DAEMON_OK(daemon 转发成功)"
        elif daemon_ok is False:
            _circuit_st = _circuit.state if USE_DAEMON else "N/A"
            _decision += f"DAEMON_FAIL(转发失败, circuit={_circuit_st})"
            if fallback_local:
                _decision += " → FALLBACK_LOCAL(降级本地模型)"
        elif not USE_DAEMON:
            _decision += "LOCAL_DIRECT(非 daemon 模式, 本地推理)"
        # daemon_ok is None 且 USE_DAEMON=True 且 not cache_hit 且 not fallback_local → 不应该到这里

    logger.info(
        "%s编码完成: %s | texts=%d, dim=%d, elapsed=%.2fms, "
        "cache_hit=%s, daemon_ok=%s, fallback=%s, circuit=%s, lru=%d/%d",
        _req_tag, _decision,
        len(texts), shape[1], encode_elapsed_ms,
        cache_hit, daemon_ok, fallback_local,
        _circuit.state if USE_DAEMON else "N/A",
        _lru.info()["size"], _lru.info()["capacity"],
    )

    return result_vectors


# ---------------------------------------------------------------------------
# 请求/响应模型
# ---------------------------------------------------------------------------


class EmbedRequest(BaseModel):
    """嵌入请求"""

    texts: list[str] = Field(..., description="待嵌入的文本列表", max_length=MAX_BATCH_SIZE)
    is_query: bool = Field(
        False,
        description="是否为查询文本（bge 模型会自动添加 instruction 前缀）",
    )


class EmbeddingResponse(BaseModel):
    """嵌入响应（与前端 EmbeddingResponse 接口兼容）"""

    success: bool
    vectors: list[list[float]]
    dimension: int
    modelId: str
    elapsed_ms: float


class HealthResponse(BaseModel):
    """健康检查响应"""

    status: str
    model_loaded: bool
    model_loading: bool
    model_id: str
    dimension: int
    error: Optional[str] = None
    # v2.1 Phase 1/2 新增字段（全部可选，前端/调用方不强制依赖）
    backend: Optional[str] = None   # "direct" | "daemon-shared"
    daemon_url: Optional[str] = None
    daemon_enabled: Optional[bool] = None
    daemon_alive: Optional[bool] = None
    circuit_state: Optional[str] = None   # CLOSED / OPEN / HALF_OPEN
    use_fp16: Optional[bool] = None
    torch_threads: Optional[int] = None
    use_lru: Optional[bool] = None
    lru_size_max: Optional[int] = None
    lru_hit_rate: Optional[float] = None
    daemon_failure_rate: Optional[float] = None
    local_fallbacks: Optional[int] = None
    fallback_local_enabled: Optional[bool] = None
    device: Optional[str] = None
    dtype: Optional[str] = None


class ConfigResponse(BaseModel):
    """模型配置信息（v2.0.0 新增）"""

    model_id: str
    dimension: int
    max_tokens: int
    language: str
    description: str
    has_query_instruction: bool
    max_batch_size: int


# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------


@app.get("/api/embed/health")
async def health() -> HealthResponse:
    """
    健康检查 — 统一返回本 worker + daemon 状态。

    语义（daemon 模式 vs 本地模式的 status 判定）：
      * 本地模式：status = 本 worker 模型状态（ok / loading / error）
      * daemon 模式：
        - 熔断器 CLOSED + daemon status=ok → status="ok"
        - 熔断器 CLOSED + daemon status=loading → status="loading"
        - 熔断器 CLOSED + daemon 不通 → status="loading"（首次抖动，等熔断器打开）
        - 熔断器 OPEN → status="degraded"（需要用户注意）
          - fallback=true：仍可用，但内存会增加
          - fallback=false：会直接 503
    """
    snap = _metrics.snapshot()
    base = dict(
        model_id=EMBEDDING_MODEL_ID,
        dimension=EMBEDDING_DIMENSION,
        backend="daemon-shared" if USE_DAEMON else "direct",
        daemon_url=DAEMON_URL if USE_DAEMON else None,
        daemon_enabled=USE_DAEMON,
        circuit_state=_circuit.state if USE_DAEMON else None,
        use_fp16=USE_FP16,
        torch_threads=_TORCH_THREADS,
        use_lru=USE_LRU,
        lru_size_max=LRU_CACHE_SIZE if USE_LRU else 0,
        lru_hit_rate=snap.get("lru_hit_rate"),
        daemon_failure_rate=snap.get("daemon_failure_rate"),
        local_fallbacks=snap.get("local_fallbacks"),
        fallback_local_enabled=DAEMON_FALLBACK_LOCAL if USE_DAEMON else None,
    )

    # Daemon 模式：查 daemon 健康状态
    if USE_DAEMON:
        daemon_alive = _daemon_probe_health()
        base["daemon_alive"] = daemon_alive
        circuit_st = _circuit.state

        # 熔断器 OPEN → degraded（降级状态，需要关注）
        if circuit_st == _CircuitBreaker.OPEN:
            if DAEMON_FALLBACK_LOCAL:
                return HealthResponse(
                    status="degraded",
                    model_loaded=(_model is not None),
                    model_loading=_model_loading,
                    error=(
                        "熔断器打开：daemon 连续失败，已降级为本地加载模型。"
                        "30 秒冷却后会自动尝试恢复。"
                    ),
                    **base,  # type: ignore[arg-type]
                )
            else:
                return HealthResponse(
                    status="error",
                    model_loaded=False,
                    model_loading=False,
                    error=(
                        "熔断器打开：daemon 连续失败且 EMBEDDING_DAEMON_FALLBACK_LOCAL=false，"
                        "当前请求会直接返回 503。请检查 daemon 是否存活。"
                    ),
                    **base,  # type: ignore[arg-type]
                )

        # 熔断器 HALF_OPEN / CLOSED，尝试查 daemon
        if daemon_alive:
            return HealthResponse(
                status="ok",
                model_loaded=True,
                model_loading=False,
                error=None,
                dtype="float16" if USE_FP16 else "float32",
                **base,  # type: ignore[arg-type]
            )
        # daemon 活着但 status != ok 或 健康检查失败（首次加载模型中）
        return HealthResponse(
            status="loading",
            model_loaded=False,
            model_loading=True,
            error=(
                f"daemon 未就绪 ({DAEMON_URL})，可能正在加载模型（~10-30 秒），"
                "请稍后重试。"
            ),
            **base,  # type: ignore[arg-type]
        )

    # --- 本地模式：以本 worker 自己的模型状态为准 ---
    if _model_load_error:
        return HealthResponse(
            status="error",
            model_loaded=False,
            model_loading=_model_loading,
            error=_model_load_error,
            dtype="float16" if USE_FP16 else "float32",
            **base,  # type: ignore[arg-type]
        )
    return HealthResponse(
        status="ok" if _model is not None else "loading",
        model_loaded=_model is not None,
        model_loading=_model_loading,
        error=None,
        dtype=_model_actual_dtype,
        **base,  # type: ignore[arg-type]
    )


@app.get("/api/embed/config")
async def config() -> ConfigResponse:
    """模型配置信息 — 前端可用于动态获取维度（v2.0.0 新增）"""
    return ConfigResponse(
        model_id=EMBEDDING_MODEL_ID,
        dimension=EMBEDDING_DIMENSION,
        max_tokens=_MODEL_CONFIG["max_tokens"],
        language=_MODEL_CONFIG["language"],
        description=_MODEL_CONFIG["description"],
        has_query_instruction=_QUERY_INSTRUCTION is not None,
        max_batch_size=MAX_BATCH_SIZE,
    )


@app.get("/api/embed/metrics")
async def metrics() -> dict:
    """
    运行时性能指标（v2.0.0 新增）

    返回：总请求数、平均推理时间、最近 100 个请求的 P50/P95/P99 延迟、吞吐量。
    用于性能监控和 Week 2 多 worker 优化效果验证。
    daemon 模式下会额外合并 daemon 端的指标。
    """
    out = {"service": _metrics.snapshot()}
    if EMBEDDING_DAEMON_URL:
        c = _get_daemon_client()
        try:
            r = c.get("/metrics", timeout=2.0)
            if r.status_code == 200:
                out["daemon"] = r.json()
        except Exception as e:
            out["daemon_error"] = str(e)
    return out


@app.get("/api/embed/mode")
async def runtime_mode() -> dict:
    """返回当前推理后端模式（前端/运维排障用）。"""
    info = {
        "backend": "daemon-shared" if USE_DAEMON else "direct-local",
        "daemon_url": DAEMON_URL if USE_DAEMON else None,
        "daemon_fallback_local": DAEMON_FALLBACK_LOCAL,
        "fp16": USE_FP16,
        "torch_threads": _TORCH_THREADS,
        "lru": {"enabled": USE_LRU, "capacity": LRU_CACHE_SIZE},
        "embedding_model": EMBEDDING_MODEL_ID,
        "dimension": EMBEDDING_DIMENSION,
        "max_batch_size": MAX_BATCH_SIZE,
        "slow_threshold_ms": SLOW_REQUEST_THRESHOLD_MS,
        "warmup_on_start": WARMUP_ON_START,
        "pid": os.getpid(),
    }
    if USE_DAEMON:
        dh = _daemon_probe_detail(timeout_sec=(1.0, 2.0))
        if dh is not None:
            info["daemon_status"] = {k: v for k, v in dh.items() if k in
                                     ("status", "model_loaded", "dimension", "fp16", "torch_threads", "model_id")}
        info["circuit_state"] = _circuit.state
    return info


# /health 别名路由：部分运维脚本默认打根路径的 /health，保持兼容。
@app.get("/health")
async def health_root():
    return await health()


@app.post("/api/embed", response_model=EmbeddingResponse)
def embed(req: EmbedRequest) -> EmbeddingResponse:
    """
    批量文本嵌入 — 返回归一化向量

    注意：使用同步 def（非 async def），uvicorn 会自动将同步路由放到线程池执行，
    避免阻塞事件循环。这是 Week 2 性能优化的关键改动。
    """
    # 生成 request_id 用于全链路追踪（8 位 hex，唯一且简短）
    request_id = uuid.uuid4().hex[:8]
    t_start = time.perf_counter()

    # 请求进入日志（DEBUG 级别，记录请求特征便于排查）
    text_lengths = [len(t) for t in req.texts] if req.texts else []
    logger.debug(
        "[req:%s] 收到嵌入请求: texts=%d, is_query=%s, max_len=%d, total_chars=%d",
        request_id, len(req.texts), req.is_query,
        max(text_lengths) if text_lengths else 0,
        sum(text_lengths),
    )

    if not req.texts:
        logger.debug("[req:%s] 空文本列表，直接返回", request_id)
        return EmbeddingResponse(
            success=True,
            vectors=[],
            dimension=EMBEDDING_DIMENSION,
            modelId=EMBEDDING_MODEL_ID,
            elapsed_ms=0,
        )

    if len(req.texts) > MAX_BATCH_SIZE:
        logger.warning(
            "[req:%s] 批量超限: %d > %d（拒绝请求）",
            request_id, len(req.texts), MAX_BATCH_SIZE,
        )
        raise HTTPException(
            status_code=400,
            detail=f"批量上限 {MAX_BATCH_SIZE}，当前 {len(req.texts)} 条，请分批请求",
        )

    # 注意：模型加载 / client 初始化都在 _encode_with_instruction 内部按需懒加载，
    #   严格内存模式（DAEMON_FALLBACK_LOCAL=false）下即使 daemon 挂了，也绝不会
    #   在主进程加载本地模型。
    t_model_ms = 0.0

    # 编码阶段（含 LRU 缓存命中判定、daemon 转发、熔断器、fallback 本地）
    #   也会在内部调用 _metrics.record（因此此处不再重复 record，避免计数翻倍）
    t_encode_start = time.perf_counter()
    vectors = _encode_with_instruction(req.texts, is_query=req.is_query, request_id=request_id)
    t_encode_ms = (time.perf_counter() - t_encode_start) * 1000

    # 总耗时（编码 + 向量序列化）
    elapsed_ms = (time.perf_counter() - t_start) * 1000
    serialize_ms = max(0.0, elapsed_ms - t_model_ms - t_encode_ms)

    # 慢请求告警（超过阈值时 WARN 级别，含耗时分解便于定位瓶颈）
    if elapsed_ms > SLOW_REQUEST_THRESHOLD_MS:
        logger.warning(
            "[req:%s] 慢请求告警: %.1fms > 阈值 %.0fms | 分解: model=%.1fms, encode=%.1fms, "
            "serialize=%.1fms | texts=%d, is_query=%s, model_id=%s",
            request_id, elapsed_ms, SLOW_REQUEST_THRESHOLD_MS,
            t_model_ms, t_encode_ms, serialize_ms,
            len(req.texts), req.is_query, EMBEDDING_MODEL_ID,
        )
    else:
        # 正常请求（INFO 级别，含耗时分解）
        logger.info(
            "[req:%s] 嵌入完成: %d 条, %.1fms (model=%.1f, encode=%.1f, serialize=%.1f), "
            "dim=%d, is_query=%s",
            request_id, len(req.texts), elapsed_ms,
            t_model_ms, t_encode_ms, serialize_ms,
            EMBEDDING_DIMENSION, req.is_query,
        )

    return EmbeddingResponse(
        success=True,
        vectors=vectors,
        dimension=EMBEDDING_DIMENSION,
        modelId=EMBEDDING_MODEL_ID,
        elapsed_ms=round(elapsed_ms, 1),
    )


# ---------------------------------------------------------------------------
# 启动事件 — 可选预热
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    """启动事件 — 可选预热。
    direct 模式：加载模型。
    daemon 共享模式：探测 daemon 健康 + 发送预热请求（避免首请求慢）。
    """
    if WARMUP_ON_START:
        if EMBEDDING_DAEMON_URL:
            logger.info("启动预热 (daemon 共享模式): 等待 %s 就绪", EMBEDDING_DAEMON_URL)
            t0 = time.time()
            timeout = 300  # 5 分钟
            last_err = None
            while time.time() - t0 < timeout:
                dh = _probe_daemon_health(timeout=3.0)
                if dh and dh.get("status") == "ok" and dh.get("model_loaded"):
                    logger.info(
                        "daemon 已就绪 device=%s dtype=%s (等待 %.1fs)",
                        dh.get("device"), dh.get("dtype"), time.time() - t0,
                    )
                    # 发送一条预热请求，触发 daemon 端首次推理预热
                    try:
                        c = _get_daemon_client()
                        assert c is not None
                        warmup_texts = [
                            "FinSight V9 智能投研系统向量检索服务启动预热",
                            "人工智能赋能金融行业投资研究分析",
                        ]
                        r = c.post("/encode", json={
                            "texts": warmup_texts, "is_query": False,
                            "normalize": True,
                        }, timeout=120.0)
                        if r.status_code == 200:
                            d = r.json()
                            logger.info(
                                "daemon 预热推理完成: n=%s dim=%s remote_ms=%s",
                                d.get("n"), d.get("dimension"), d.get("compute_ms"),
                            )
                    except Exception as e:
                        logger.warning("daemon 预热请求失败: %s (不影响服务)", e)
                    return
                last_err = (dh or {}).get("error") or "daemon status != ok"
                await __import__("asyncio").sleep(5)
            logger.error("daemon 预热超时 (%.0fs): %s", timeout, last_err)
        else:
            logger.info("启动预热 (direct 模式): 正在加载模型 %s ...", EMBEDDING_MODEL_ID)
            try:
                get_model()
                logger.info("预热完成，模型已就绪")
            except Exception as e:
                logger.error("预热失败: %s", e)
    else:
        if EMBEDDING_DAEMON_URL:
            logger.info("daemon 共享模式 (URL=%s)，模型仅在首次请求时由 daemon 加载",
                        EMBEDDING_DAEMON_URL)
        else:
            logger.info("预热未启用 (EMBEDDING_WARMUP=false)，模型将在首次请求时加载")


# ---------------------------------------------------------------------------
# 启动入口（支持 python embedding_service.py 直接运行）
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    # Worker 数量（生产环境推荐 2-4，开发环境默认 1）
    workers = int(os.environ.get("UVICORN_WORKERS", "1"))

    # 自动检测 uvloop/httptools（v2.0.0 性能优化）
    # uvloop: 基于 libuv 的事件循环，比 asyncio 默认快 2-4 倍（仅 Linux/macOS）
    # httptools: C 扩展 HTTP 解析器，比 h11 快 3-5 倍（跨平台）
    loop = "auto"
    http = "auto"
    try:
        import uvloop  # noqa: F401
        loop = "uvloop"
        logger.info("检测到 uvloop，将使用其作为事件循环（性能提升 2-4 倍）")
    except ImportError:
        logger.info("uvloop 未安装（Windows 不支持），使用默认 asyncio 事件循环")

    try:
        import httptools  # noqa: F401
        http = "httptools"
        logger.info("检测到 httptools，将使用其作为 HTTP 解析器（性能提升 3-5 倍）")
    except ImportError:
        logger.info("httptools 未安装，使用默认 h11 HTTP 解析器")

    # 启动参数（可被命令行参数覆盖）
    host = os.environ.get("UVICORN_HOST", "0.0.0.0")
    port = int(os.environ.get("UVICORN_PORT", "8001"))

    logger.info(
        "启动 uvicorn: host=%s, port=%d, workers=%d, loop=%s, http=%s",
        host, port, workers, loop, http,
    )

    uvicorn.run(
        "embedding_service:app",
        host=host,
        port=port,
        workers=workers,
        loop=loop,
        http=http,
        log_level="info",
    )
