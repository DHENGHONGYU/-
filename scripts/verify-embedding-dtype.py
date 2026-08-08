#!/usr/bin/env python
"""
verify-embedding-dtype.py — 验证 embedding_service health 接口在 CPU 模式下如实上报 dtype。

测试流程：
  1. 以子进程启动 uvicorn embedding_service:app（本地模式，无 daemon）
  2. 轮询 /api/embed/health 直到服务响应
  3. 发送 /api/embed 请求触发模型懒加载
  4. 查询 /api/embed/health，断言 dtype == "float32"（而非假报 "float16"）
  5. 清理子进程

用法：
  python scripts/verify-embedding-dtype.py
退出码：
  0 = PASS（dtype 如实上报 float32）
  1 = FAIL（断言失败或服务异常）
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

# ---------- 配置 ----------
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
PORT = 8077  # 避开常用端口 8001/8765
BASE_URL = f"http://127.0.0.1:{PORT}"
HEALTH_URL = f"{BASE_URL}/api/embed/health"
EMBED_URL = f"{BASE_URL}/api/embed"

# Auto-detect Python: prefer .venv (Windows/Linux), fall back to sys.executable (CI)
_VENV_WIN = os.path.join(REPO_ROOT, ".venv", "Scripts", "python.exe")
_VENV_LINUX = os.path.join(REPO_ROOT, ".venv", "bin", "python")
if os.path.isfile(_VENV_WIN):
    PYTHON = _VENV_WIN
elif os.path.isfile(_VENV_LINUX):
    PYTHON = _VENV_LINUX
else:
    PYTHON = sys.executable

# 服务启动超时（秒）：torch 导入 + 模型首次加载
SERVICE_READY_TIMEOUT = 60
# 模型加载超时（秒）：首次 /embed 触发懒加载
MODEL_LOAD_TIMEOUT = 120


def build_env():
    """构建 CPU 本地模式环境变量。"""
    env = os.environ.copy()
    env.update({
        "HF_HOME": os.path.join(REPO_ROOT, ".hf_cache"),
        "HUGGINGFACE_HUB_CACHE": os.path.join(REPO_ROOT, ".hf_cache", "hub"),
        "HF_HUB_OFFLINE": "1",
        "EMBEDDING_MODEL": "bge-large-zh-v1.5",
        "EMBEDDING_FP16": "false",        # CPU 场景：FP16 无效
        "EMBEDDING_USE_DAEMON": "false",   # 本地模式，不走 daemon
        "EMBEDDING_USE_LRU": "false",      # 简化测试，关 LRU
        "EMBEDDING_WARMUP": "false",       # 手动触发加载
        "EMBEDDING_LOG_LEVEL": "WARNING",  # 减少日志噪音
    })
    return env


def get_json(url, timeout=5):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def post_json(url, payload, timeout=120):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def wait_for_service(proc, timeout):
    """轮询 health 接口直到服务响应，返回首次 health 响应或 None。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            return None  # 进程已退出
        try:
            return get_json(HEALTH_URL, timeout=2)
        except (urllib.error.URLError, ConnectionRefusedError, OSError):
            time.sleep(1)
    return None


def main():
    if not os.path.isfile(PYTHON):
        print(f"FAIL: Python 解释器不存在: {PYTHON}")
        return 1

    print(f"[1/5] 启动 embedding_service (port={PORT}, CPU 本地模式)...")
    proc = subprocess.Popen(
        [
            PYTHON, "-m", "uvicorn", "embedding_service:app",
            "--host", "127.0.0.1", "--port", str(PORT),
        ],
        cwd=BACKEND_DIR,
        env=build_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    try:
        # 2. 等待服务就绪
        print(f"[2/5] 等待服务就绪 (最长 {SERVICE_READY_TIMEOUT}s)...")
        first_health = wait_for_service(proc, SERVICE_READY_TIMEOUT)
        if first_health is None:
            out = ""
            if proc.stdout:
                try:
                    out = proc.stdout.read(4000).decode(errors="replace")
                except Exception:
                    pass
            print(f"FAIL: 服务未就绪 (exit_code={proc.poll()})")
            if out:
                print("服务日志:\n", out[:2000])
            return 1
        print(f"      服务就绪: status={first_health.get('status')} "
              f"model_loaded={first_health.get('model_loaded')}")

        # 3. 触发模型加载（首次 /embed 调用会懒加载模型）
        print(f"[3/5] 发送 /embed 请求触发模型加载 (最长 {MODEL_LOAD_TIMEOUT}s)...")
        t0 = time.time()
        result = post_json(EMBED_URL, {"texts": ["测试中文嵌入"], "is_query": False},
                           timeout=MODEL_LOAD_TIMEOUT)
        elapsed = time.time() - t0
        if not result.get("success"):
            print(f"FAIL: /embed 返回 success=false: {result}")
            return 1
        dim = result.get("dimension")
        print(f"      embed 成功: dimension={dim} elapsed={elapsed:.1f}s")

        # 4. 查询 health，验证 dtype 如实上报
        print("[4/5] 验证 health 接口 dtype 上报...")
        h = get_json(HEALTH_URL, timeout=5)
        dtype = h.get("dtype")
        use_fp16 = h.get("use_fp16")
        model_loaded = h.get("model_loaded")
        status = h.get("status")
        print(f"      status={status}  model_loaded={model_loaded}  "
              f"use_fp16={use_fp16}  dtype={dtype}")

        # 断言
        errors = []
        if model_loaded is not True:
            errors.append(f"model_loaded 应为 True，实际为 {model_loaded}")
        if dtype != "float32":
            errors.append(f"dtype 应为 'float32'，实际为 '{dtype}'（CPU 场景不应假报 float16）")
        if use_fp16 is not False:
            errors.append(f"use_fp16 应为 False，实际为 {use_fp16}")

        if errors:
            print("[5/5] FAIL:")
            for e in errors:
                print(f"  - {e}")
            return 1

        print("[5/5] PASS: CPU 模式下 health 接口如实上报 dtype=float32")
        return 0

    finally:
        print("\n[cleanup] 终止子进程...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
            print("[cleanup] 已正常退出")
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
            print("[cleanup] 已强制终止")


if __name__ == "__main__":
    sys.exit(main())
