"""
V9 Python Sidecar 统一入口

方案B: Electron + 本地 Python Sidecar

职责：
  统一启动三个 Python 服务，由 Electron 主进程 spawn 管理：
  1. Embedding Daemon (port 8765) — 单进程持有模型
  2. Embedding Service (port 8001) — FastAPI 转发层
  3. AKShare Collector  (port 8000) — 数据采集服务（可选）

启动方式：
  # 开发模式（Electron sidecar.ts 自动调用）
  python backend/sidecar_entry.py --daemon-port 8765 --embedding-port 8001 --collector-port 8000

  # 生产模式（PyInstaller 打包后）
  v9-python-sidecar.exe --daemon-port 8765 --embedding-port 8001 --collector-port 8000

信号处理：
  - SIGINT / SIGTERM → 优雅关闭所有服务
  - 子进程异常退出 → 主进程退出（由 Electron 检测并重启）

环境变量：
  - SIDECAR_DAEMON_PORT / SIDECAR_EMBEDDING_PORT / SIDECAR_COLLECTOR_PORT
    （CLI 参数优先级高于环境变量）
  - EMBEDDING_MODEL — 模型 ID（默认 all-MiniLM-L6-v2）
  - HF_HOME — HuggingFace 缓存目录
"""

import os
import sys
import signal
import threading
import time
import logging
import argparse
from multiprocessing import Process

# ──────────────────────────────────────────────
# 日志配置
# ──────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [sidecar] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("sidecar_entry")

# HuggingFace 国内镜像
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

# HF 缓存目录
# - 开发模式：项目根目录下的 .hf_cache
# - 打包模式：用户数据目录下的 hf_cache（可写，用于模型按需下载）
if getattr(sys, "frozen", False):
    # PyInstaller 打包模式 — 使用用户可写目录
    _BASE_DIR = os.path.dirname(sys.executable)
    _APP_NAME = "FinSightV9"
    if sys.platform == "win32":
        _USER_DATA = os.environ.get("APPDATA", os.path.expanduser("~"))
    elif sys.platform == "darwin":
        _USER_DATA = os.path.expanduser("~/Library/Application Support")
    else:
        _USER_DATA = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
    _HF_HOME = os.path.join(_USER_DATA, _APP_NAME, "hf_cache")
else:
    _BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _HF_HOME = os.path.join(_BASE_DIR, ".hf_cache")
os.environ.setdefault("HF_HOME", _HF_HOME)
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", os.path.join(_HF_HOME, "hub"))

# 确保 backend 目录在 sys.path 中
_BACKEND_DIR = os.path.join(_BASE_DIR, "backend") if not getattr(sys, "frozen", False) else _BASE_DIR
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


# ──────────────────────────────────────────────
# 服务启动函数
# ──────────────────────────────────────────────

def start_embedding_daemon(port: int) -> None:
    """启动 Embedding Daemon（单进程持有模型）"""
    logger.info(f"Starting Embedding Daemon on port {port}...")

    # 设置环境变量
    os.environ["EMBEDDING_USE_DAEMON"] = "true"
    os.environ["EMBEDDING_DAEMON_URL"] = f"http://127.0.0.1:{port}"

    try:
        # 延迟导入，确保环境变量先生效
        import uvicorn
        from embedding_daemon import app as daemon_app

        uvicorn.run(
            daemon_app,
            host="127.0.0.1",
            port=port,
            workers=1,  # daemon 必须单 worker
            log_level="info",
            access_log=False,
        )
    except Exception as e:
        logger.error(f"Embedding Daemon failed: {e}")
        raise


def start_embedding_service(daemon_port: int, service_port: int) -> None:
    """启动 Embedding Service（FastAPI 转发层）"""
    logger.info(f"Starting Embedding Service on port {service_port} (daemon={daemon_port})...")

    # 配置 service 连接 daemon
    os.environ["EMBEDDING_USE_DAEMON"] = "true"
    os.environ["EMBEDDING_DAEMON_URL"] = f"http://127.0.0.1:{daemon_port}"

    try:
        import uvicorn
        from embedding_service import app as service_app

        uvicorn.run(
            service_app,
            host="127.0.0.1",
            port=service_port,
            workers=1,
            log_level="info",
            access_log=False,
        )
    except Exception as e:
        logger.error(f"Embedding Service failed: {e}")
        raise


def start_akshare_collector(port: int) -> None:
    """启动 AKShare 数据采集服务（如果存在）"""
    logger.info(f"Starting AKShare Collector on port {port}...")

    try:
        # 检查是否存在 collector 服务
        collector_path = os.path.join(_BACKEND_DIR, "akshare_collector.py")
        if not os.path.exists(collector_path):
            logger.warning(
                f"AKShare collector not found at {collector_path}, "
                "skipping. Data collection will use frontend direct API calls."
            )
            # 保持进程存活，Electron 会检测端口
            while True:
                time.sleep(60)
            return

        import uvicorn
        from akshare_collector import app as collector_app

        uvicorn.run(
            collector_app,
            host="127.0.0.1",
            port=port,
            workers=1,
            log_level="info",
        )
    except Exception as e:
        logger.error(f"AKShare Collector failed: {e}")
        raise


# ──────────────────────────────────────────────
# 信号处理
# ──────────────────────────────────────────────

_processes: list[Process] = []
_shutdown_event = threading.Event()


def _signal_handler(signum, frame):
    """处理 SIGINT / SIGTERM 信号，优雅关闭所有子进程"""
    sig_name = signal.Signals(signum).name
    logger.info(f"Received {sig_name}, shutting down...")

    _shutdown_event.set()

    for proc in _processes:
        if proc.is_alive():
            logger.info(f"Terminating process: {proc.name}")
            proc.terminate()

    # 等待子进程退出
    for proc in _processes:
        if proc.is_alive():
            proc.join(timeout=5)
            if proc.is_alive():
                logger.warning(f"Force killing: {proc.name}")
                proc.kill()

    logger.info("All services stopped. Exiting.")
    sys.exit(0)


def _monitor_processes():
    """监控子进程，任一退出则主进程退出"""
    while not _shutdown_event.is_set():
        for proc in _processes:
            if not proc.is_alive() and not _shutdown_event.is_set():
                logger.error(
                    f"Process {proc.name} exited unexpectedly "
                    f"(exitcode={proc.exitcode}). Shutting down sidecar."
                )
                # 触发关闭
                os.kill(os.getpid(), signal.SIGTERM)
                return
        time.sleep(2)


# ──────────────────────────────────────────────
# 主函数
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="V9 Python Sidecar — 统一启动嵌入服务和数据采集服务"
    )
    parser.add_argument(
        "--daemon-port", type=int,
        default=int(os.environ.get("SIDECAR_DAEMON_PORT", "8765")),
        help="Embedding Daemon 端口（默认 8765）",
    )
    parser.add_argument(
        "--embedding-port", type=int,
        default=int(os.environ.get("SIDECAR_EMBEDDING_PORT", "8001")),
        help="Embedding Service 端口（默认 8001）",
    )
    parser.add_argument(
        "--collector-port", type=int,
        default=int(os.environ.get("SIDECAR_COLLECTOR_PORT", "8000")),
        help="AKShare Collector 端口（默认 8000）",
    )
    parser.add_argument(
        "--no-collector", action="store_true",
        help="不启动 AKShare Collector（仅嵌入服务）",
    )
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("V9 Python Sidecar Starting")
    logger.info(f"  Daemon Port:   {args.daemon_port}")
    logger.info(f"  Service Port:  {args.embedding_port}")
    logger.info(f"  Collector Port: {args.collector_port}")
    logger.info(f"  No Collector:  {args.no_collector}")
    logger.info(f"  HF_HOME:       {_HF_HOME}")
    logger.info(f"  Frozen:        {getattr(sys, 'frozen', False)}")
    logger.info("=" * 60)

    # 注册信号处理
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # 启动 Embedding Daemon
    daemon_proc = Process(
        target=start_embedding_daemon,
        args=(args.daemon_port,),
        name="embedding-daemon",
        daemon=False,
    )
    daemon_proc.start()
    _processes.append(daemon_proc)
    logger.info(f"Embedding Daemon started (PID={daemon_proc.pid})")

    # 等待 daemon 启动（给模型加载一些时间）
    time.sleep(2)

    # 启动 Embedding Service
    service_proc = Process(
        target=start_embedding_service,
        args=(args.daemon_port, args.embedding_port),
        name="embedding-service",
        daemon=False,
    )
    service_proc.start()
    _processes.append(service_proc)
    logger.info(f"Embedding Service started (PID={service_proc.pid})")

    # 启动 AKShare Collector（可选）
    if not args.no_collector:
        collector_proc = Process(
            target=start_akshare_collector,
            args=(args.collector_port,),
            name="akshare-collector",
            daemon=False,
        )
        collector_proc.start()
        _processes.append(collector_proc)
        logger.info(f"AKShare Collector started (PID={collector_proc.pid})")

    # 启动进程监控线程
    monitor_thread = threading.Thread(
        target=_monitor_processes,
        name="process-monitor",
        daemon=True,
    )
    monitor_thread.start()

    logger.info("All services started. Sidecar is running.")

    # 主循环 — 等待信号
    try:
        while not _shutdown_event.is_set():
            time.sleep(1)
    except KeyboardInterrupt:
        _signal_handler(signal.SIGINT, None)


if __name__ == "__main__":
    main()
