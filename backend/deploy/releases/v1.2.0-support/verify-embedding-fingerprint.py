#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify-embedding-fingerprint.py — V9 Embedding Service 向量指纹一致性验证器

4 层断言 (4-Layer Assertions):
  Layer 1: 服务元数据基线 (model_id / dim / max_batch / loaded)
  Layer 2: 向量指纹 (SHA256[:16] of head floats, big-endian packed)
  Layer 3: 批量维度 (3 vectors x 384 dim)
  Layer 4: 运行时参数 (slow_threshold_ms / uvicorn_workers) — non-blocking

支持模式:
  - 本地直连模式:  --host localhost --port 8001
  - K8s 服务模式:  --k8s-mode --k8s-service v9-embedding --k8s-namespace default
  - 离线自检模式:  --self-test (验证指纹算法本身, 不需服务)
  - 生成基线模式:  --gen-baseline (POST fixture 文本, 输出 BASELINE_SHA)

使用示例:
  # 1. 本地验证 (默认基线)
  python verify-embedding-fingerprint.py --host localhost --port 8001

  # 2. K8s 模式验证 (自动解析 v9-embedding.<ns>.svc)
  python verify-embedding-fingerprint.py --k8s-mode --k8s-namespace prod

  # 3. 生成基线指纹
  python verify-embedding-fingerprint.py --gen-baseline --host localhost --port 8001

  # 4. 离线自检算法
  python verify-embedding-fingerprint.py --self-test

  # 5. CI 门禁 (fail-fast)
  python verify-embedding-fingerprint.py --k8s-mode --fail-fast --result-json result.json

零外部依赖 (stdlib only), Python 3.8+ 兼容.
"""

import argparse
import hashlib
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request


# ---------------------------------------------------------------------------
# Color constants
# ---------------------------------------------------------------------------
GRE = "\033[32m"
RED = "\033[31m"
YLW = "\033[33m"
BLU = "\033[34m"
NC = "\033[0m"


# ---------------------------------------------------------------------------
# Print helpers
# ---------------------------------------------------------------------------
def p_ok(msg):
    print(f"{GRE}[OK]{NC} {msg}")


def p_fail(msg):
    print(f"{RED}[FAIL]{NC} {msg}")


def p_warn(msg):
    print(f"{YLW}[WARN]{NC} {msg}")


def p_info(msg):
    print(f"{BLU}[INFO]{NC} {msg}")


def p_err(msg):
    sys.stderr.write(f"{RED}[ERR]{NC} {msg}\n")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FIXTURE_TEXTS = [
    "The quick brown fox jumps over the lazy dog",
    "股票池V9研究状态流转记录",
    "金融科技 Embedding 服务数据一致性验证",
]

DEFAULT_BASELINE = {
    "model_id": "all-MiniLM-L6-v2",
    "dim": 384,
    "max_batch": 64,
    "loaded": True,
    "slow_threshold_ms": 500,
    "uvicorn_workers": 1,
}


# ---------------------------------------------------------------------------
# Fingerprint algorithm
# ---------------------------------------------------------------------------
def compute_vector_fingerprint(vectors, head=8):
    """Take first `head` floats from each vector, pack as big-endian float (>f),
    then SHA256[:16] of the concatenated bytes."""
    buf = bytearray()
    for vec in vectors:
        for i in range(min(head, len(vec))):
            buf += struct.pack(">f", float(vec[i]))
    return hashlib.sha256(bytes(buf)).hexdigest()[:16]


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------
def http_json(method, url, body=None, timeout=10):
    """Returns (status, dict). On error returns (0, {"_error": str(e)})."""
    try:
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"_raw": raw}
            return resp.status, payload
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            err_body = {"_error": str(e)}
        return e.code, err_body
    except Exception as e:
        return 0, {"_error": str(e)}


# ---------------------------------------------------------------------------
# K8s defaults
# ---------------------------------------------------------------------------
def _apply_k8s_defaults(args):
    """Apply K8s service discovery defaults and resolve baseline."""
    # Host resolution
    if args.host == "__auto__":
        if args.k8s_mode:
            args.host = f"{args.k8s_service}.{args.k8s_namespace}.svc"
        else:
            args.host = "localhost"

    # Baseline resolution in K8s mode
    if args.k8s_mode and not args.baseline:
        # 1. ENV V9_BASELINE_SHA
        env_sha = os.environ.get("V9_BASELINE_SHA", "").strip()
        if env_sha:
            args.baseline = env_sha
            p_info(f"从环境变量 V9_BASELINE_SHA 读取基线: {env_sha}")
            return
        # 2. File /etc/fingerprint/baseline.sha
        fp_file = "/etc/fingerprint/baseline.sha"
        if os.path.isfile(fp_file):
            try:
                with open(fp_file, "r", encoding="utf-8") as fh:
                    file_sha = fh.read().strip()
                if file_sha:
                    args.baseline = file_sha
                    p_info(f"从文件 {fp_file} 读取基线: {file_sha}")
                    return
            except OSError as e:
                p_warn(f"读取 {fp_file} 失败: {e}")
        # 3. ConfigMap (--baseline-cm) — informational only (no kubectl dependency)
        if args.baseline_cm:
            p_info(f"提示: 基线 ConfigMap='{args.baseline_cm}', key='{args.baseline_cm_key}' "
                   f"应由部署流程挂载到 /etc/fingerprint/baseline.sha")
        else:
            p_warn("K8s 模式下未找到基线, 将仅做元数据/维度校验")


# ---------------------------------------------------------------------------
# Result JSON dump
# ---------------------------------------------------------------------------
def _dump_result_json(args, exit_code, *, checks, duration_ms):
    """Write JSON result to --result-json path if specified.

    Note: `checks` and `duration_ms` are keyword-only arguments.
    """
    payload = {
        "exit_code": exit_code,
        "host": args.host,
        "port": args.port,
        "k8s_mode": args.k8s_mode,
        "baseline_provided": bool(args.baseline),
        "checks": checks,
        "duration_ms": duration_ms,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    if args.result_json:
        try:
            with open(args.result_json, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False, indent=2)
            p_info(f"结果已写入: {args.result_json}")
        except OSError as e:
            p_err(f"写入结果文件失败: {e}")
    return payload


# ---------------------------------------------------------------------------
# Self-test (offline algorithm verification)
# ---------------------------------------------------------------------------
def cmd_self_test():
    """Offline algorithm verification with constructed vectors."""
    p_info("=== 自检: 离线验证指纹算法 ===")

    # Construct deterministic vectors
    vec_a = [0.1 * i for i in range(16)]
    vec_b = [0.2 * i for i in range(16)]

    fp_ab = compute_vector_fingerprint([vec_a, vec_b], head=8)
    fp_ab_repeat = compute_vector_fingerprint([vec_a, vec_b], head=8)
    fp_a_only = compute_vector_fingerprint([vec_a], head=8)
    fp_empty = compute_vector_fingerprint([], head=8)

    ok = True

    # 1. Determinism check
    if fp_ab == fp_ab_repeat:
        p_ok(f"确定性验证通过: {fp_ab}")
    else:
        p_fail(f"确定性验证失败: {fp_ab} != {fp_ab_repeat}")
        ok = False

    # 2. Distinctness check
    if fp_ab != fp_a_only:
        p_ok(f"区分性验证通过: 双向量={fp_ab}, 单向量={fp_a_only}")
    else:
        p_fail("区分性验证失败: 双向量与单向量指纹相同")
        ok = False

    # 3. Empty input check
    if isinstance(fp_empty, str) and len(fp_empty) == 16:
        p_ok(f"空输入验证通过: {fp_empty}")
    else:
        p_fail(f"空输入验证失败: {fp_empty}")
        ok = False

    # 4. Length check
    if len(fp_ab) == 16:
        p_ok("指纹长度验证通过: 16 字符")
    else:
        p_fail(f"指纹长度验证失败: len={len(fp_ab)}")
        ok = False

    if ok:
        p_ok("自检全部通过 ✓")
        return 0
    else:
        p_fail("自检失败 ✗")
        return 1


# ---------------------------------------------------------------------------
# Generate baseline
# ---------------------------------------------------------------------------
def cmd_gen_baseline(args):
    """POST fixture texts, print BASELINE_SHA."""
    base = f"http://{args.host}:{args.port}"
    p_info(f"生成基线指纹: POST {base}/api/embed/embed (3 fixture texts)")

    body = {"texts": FIXTURE_TEXTS, "normalize": True}
    status, data = http_json("POST", f"{base}/api/embed/embed", body=body, timeout=args.timeout)

    if status != 200 or "_error" in data:
        p_err(f"请求 embed 端点失败: status={status}, resp={data}")
        return 1

    vectors = data.get("vectors") or data.get("data", {}).get("vectors")
    if not vectors:
        p_err(f"响应中未找到 vectors 字段: keys={list(data.keys())}")
        return 1

    sha = compute_vector_fingerprint(vectors, head=8)
    print(f"BASELINE_SHA={sha}")
    print(f"# model_id expected: {DEFAULT_BASELINE['model_id']}, dim={DEFAULT_BASELINE['dim']}")
    p_ok(f"基线指纹已生成: {sha}")
    return 0


# ---------------------------------------------------------------------------
# Main checks runner
# ---------------------------------------------------------------------------
def run_checks(args):
    """Run all 4-layer checks."""
    checks = []
    base = f"http://{args.host}:{args.port}"
    t_start = time.time()

    def add_check(name, passed, detail=""):
        checks.append({"name": name, "passed": passed, "detail": detail})

    # --- Pre-check: endpoint reachability ---
    p_info("预检: 探测 /api/embed/health, /api/embed/config, /api/embed/embed")

    h_status, h_data = http_json("GET", f"{base}/api/embed/health", timeout=args.timeout)
    if h_status == 200 and "_error" not in h_data:
        p_ok(f"/api/embed/health 可达 (status={h_status})")
    else:
        p_fail(f"/api/embed/health 不可达: status={h_status}, "
               f"err={h_data.get('_error', h_data)}")
        add_check("precheck.health", False, str(h_data))
        dt_ms = int((time.time() - t_start) * 1000)
        _dump_result_json(args, 2, checks=checks, duration_ms=dt_ms)
        return 2

    c_status, c_data = http_json("GET", f"{base}/api/embed/config", timeout=args.timeout)
    if c_status == 200 and "_error" not in c_data:
        p_ok(f"/api/embed/config 可达 (status={c_status})")
    else:
        p_fail(f"/api/embed/config 不可达: status={c_status}, "
               f"err={c_data.get('_error', c_data)}")

    # embed is typically POST-only; GET may 405, which is acceptable reachability
    e_status, e_data = http_json("GET", f"{base}/api/embed/embed", timeout=args.timeout)
    if e_status in (200, 405) and "_error" not in e_data:
        p_ok(f"/api/embed/embed 端点存在 (status={e_status})")
    else:
        p_warn(f"/api/embed/embed 探测异常: status={e_status}, "
               f"err={e_data.get('_error', e_data)}")

    # --- Check 1: metadata baseline ---
    p_info("Check 1: 服务元数据基线校验")
    meta = c_data if c_status == 200 and "_error" not in c_data else {}
    c1_ok = True
    c1_parts = []

    model_id = meta.get("model_id") or meta.get("model")
    if model_id == DEFAULT_BASELINE["model_id"]:
        c1_parts.append(f"model_id={model_id} ✓")
    else:
        c1_ok = False
        c1_parts.append(f"model_id mismatch: got={model_id}, "
                         f"expected={DEFAULT_BASELINE['model_id']}")

    dim = meta.get("dim") or meta.get("embedding_dim")
    if dim == DEFAULT_BASELINE["dim"]:
        c1_parts.append(f"dim={dim} ✓")
    else:
        c1_ok = False
        c1_parts.append(f"dim mismatch: got={dim}, "
                         f"expected={DEFAULT_BASELINE['dim']}")

    max_batch = meta.get("max_batch") or meta.get("max_batch_size")
    if max_batch == DEFAULT_BASELINE["max_batch"]:
        c1_parts.append(f"max_batch={max_batch} ✓")
    else:
        c1_ok = False
        c1_parts.append(f"max_batch mismatch: got={max_batch}, "
                         f"expected={DEFAULT_BASELINE['max_batch']}")

    loaded = meta.get("loaded")
    if loaded is None:
        loaded = meta.get("model_loaded")
    if loaded == DEFAULT_BASELINE["loaded"]:
        c1_parts.append(f"loaded={loaded} ✓")
    else:
        c1_ok = False
        c1_parts.append(f"loaded mismatch: got={loaded}, "
                         f"expected={DEFAULT_BASELINE['loaded']}")

    detail_1 = "; ".join(c1_parts)
    if c1_ok:
        p_ok(f"Check 1 通过: {detail_1}")
    else:
        p_fail(f"Check 1 失败: {detail_1}")
    add_check("check1.metadata", c1_ok, detail_1)
    if not c1_ok and args.fail_fast:
        ec = 1
        p_err(f"[fail-fast] 任一 Check 失败, 立即 exit {ec} — 适合 CI 门禁")
        dt_ms = int((time.time() - t_start) * 1000)
        _dump_result_json(args, ec, checks=checks, duration_ms=dt_ms)
        return ec

    # --- Check 2: fingerprint comparison ---
    p_info("Check 2: 向量指纹比对 (SHA256[:16])")
    body = {"texts": FIXTURE_TEXTS, "normalize": True}
    emb_status, emb_data = http_json("POST", f"{base}/api/embed/embed",
                                     body=body, timeout=args.timeout)

    current_sha = None
    vectors = []
    if emb_status != 200 or "_error" in emb_data:
        p_fail(f"Check 2 请求失败: status={emb_status}, "
               f"err={emb_data.get('_error', emb_data)}")
    else:
        vectors = emb_data.get("vectors") or emb_data.get("data", {}).get("vectors")
        if not vectors:
            p_fail(f"Check 2 响应无 vectors: keys={list(emb_data.keys())}")
        else:
            current_sha = compute_vector_fingerprint(vectors, head=8)

    c2_ok = False
    c2_detail = ""
    if current_sha is None:
        c2_detail = "请求失败或无 vectors"
        p_fail(f"Check 2 失败: {c2_detail}")
    elif args.baseline:
        if current_sha == args.baseline:
            c2_ok = True
            c2_detail = f"指纹一致 current={current_sha}"
            p_ok(f"Check 2 通过: {c2_detail}")
        else:
            c2_detail = f"指纹漂移! 当前={current_sha}, 基线={args.baseline}"
            p_fail(f"Check 2 失败: {c2_detail}")
    else:
        c2_ok = True
        c2_detail = f"无基线, 跳过比对 (当前指纹={current_sha})"
        p_warn(f"Check 2 跳过比对 (无基线): 当前指纹={current_sha}")

    add_check("check2.fingerprint", c2_ok, c2_detail)
    if not c2_ok and args.fail_fast:
        ec = 1
        p_err(f"[fail-fast] 任一 Check 失败, 立即 exit {ec} — 适合 CI 门禁")
        dt_ms = int((time.time() - t_start) * 1000)
        _dump_result_json(args, ec, checks=checks, duration_ms=dt_ms)
        return ec

    # --- Check 3: batch dimensions ---
    p_info("Check 3: 批量维度校验 (期望 3 x 384)")
    expected_count = len(FIXTURE_TEXTS)
    expected_dim = DEFAULT_BASELINE["dim"]
    c3_ok = False
    c3_detail = ""
    if vectors:
        count = len(vectors)
        first_dim = len(vectors[0]) if count > 0 else 0
        all_dim_ok = all(len(v) == expected_dim for v in vectors)
        if count == expected_count and all_dim_ok:
            c3_ok = True
            c3_detail = f"{count} x {expected_dim} 维度一致"
            p_ok(f"Check 3 通过: {c3_detail}")
        else:
            c3_detail = (f"count={count} (期望 {expected_count}), "
                         f"dim={first_dim} (期望 {expected_dim}), "
                         f"all_dim_ok={all_dim_ok}")
            p_fail(f"Check 3 失败: {c3_detail}")
    else:
        c3_detail = "无 vectors 可校验"
        p_fail(f"Check 3 失败: {c3_detail}")

    add_check("check3.dimensions", c3_ok, c3_detail)
    if not c3_ok and args.fail_fast:
        ec = 1
        p_err(f"[fail-fast] 任一 Check 失败, 立即 exit {ec} — 适合 CI 门禁")
        dt_ms = int((time.time() - t_start) * 1000)
        _dump_result_json(args, ec, checks=checks, duration_ms=dt_ms)
        return ec

    # --- Check 4: runtime params (non-blocking) ---
    p_info("Check 4: 运行时参数校验 (non-blocking)")
    rt = c_data if c_status == 200 and "_error" not in c_data else {}
    slow = rt.get("slow_threshold_ms") or rt.get("slow_ms")
    workers = rt.get("uvicorn_workers") or rt.get("workers")
    c4_parts = []
    c4_ok = True
    if slow is not None:
        if slow == DEFAULT_BASELINE["slow_threshold_ms"]:
            c4_parts.append(f"slow_threshold_ms={slow} ✓")
        else:
            c4_ok = False
            c4_parts.append(f"slow_threshold_ms mismatch: got={slow}, "
                            f"expected={DEFAULT_BASELINE['slow_threshold_ms']}")
    else:
        c4_parts.append("slow_threshold_ms 未暴露 (non-blocking)")
    if workers is not None:
        if workers == DEFAULT_BASELINE["uvicorn_workers"]:
            c4_parts.append(f"uvicorn_workers={workers} ✓")
        else:
            c4_ok = False
            c4_parts.append(f"uvicorn_workers mismatch: got={workers}, "
                            f"expected={DEFAULT_BASELINE['uvicorn_workers']}")
    else:
        c4_parts.append("uvicorn_workers 未暴露 (non-blocking)")

    detail_4 = "; ".join(c4_parts)
    if c4_ok:
        p_ok(f"Check 4: {detail_4}")
    else:
        p_warn(f"Check 4 (non-blocking): {detail_4}")
    add_check("check4.runtime", c4_ok, detail_4)

    # --- Summary ---
    dt_ms = int((time.time() - t_start) * 1000)
    passed_count = sum(1 for c in checks if c["passed"])
    total = len(checks)
    p_info(f"汇总: {passed_count}/{total} 通过, 耗时 {dt_ms}ms")

    checks_snapshot = checks
    exit_code = 0 if all(c["passed"] for c in checks_snapshot) else 1
    _dump_result_json(args, exit_code, checks=checks_snapshot, duration_ms=dt_ms)

    if exit_code == 0:
        p_ok("全部检查通过 ✓ (4 层断言: 元数据 / 指纹 / 维度 / 运行时)")
    else:
        p_fail(f"存在失败检查, exit code={exit_code}")
    return exit_code


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------
def build_parser():
    parser = argparse.ArgumentParser(
        description="V9 Embedding Service 向量指纹一致性验证器 (4 层断言, K8s 支持)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--host", default="__auto__",
                        help="服务主机名 (默认 __auto__: K8s 模式解析服务名, 否则 localhost)")
    parser.add_argument("--port", type=int, default=8001,
                        help="服务端口 (默认 8001)")
    parser.add_argument("--timeout", type=float, default=10.0,
                        help="HTTP 超时秒数 (默认 10.0)")
    parser.add_argument("--baseline", default=None,
                        help="基线指纹 SHA (16 字符 hex). 不提供则跳过指纹比对")
    parser.add_argument("--gen-baseline", action="store_true",
                        help="生成基线模式: POST fixture 文本并打印 BASELINE_SHA")
    parser.add_argument("--self-test", action="store_true",
                        help="离线自检: 验证指纹算法本身, 不需服务")
    parser.add_argument("--k8s-mode", action="store_true",
                        help="启用 K8s 模式: 自动解析服务 DNS 和基线 ConfigMap")
    parser.add_argument("--k8s-service", default="v9-embedding",
                        help="K8s Service 名称 (默认 v9-embedding)")
    parser.add_argument("--k8s-namespace", default="default",
                        help="K8s 命名空间 (默认 default)")
    parser.add_argument("--baseline-cm", default=None,
                        help="基线 ConfigMap 名称 (由部署流程挂载到 /etc/fingerprint/baseline.sha)")
    parser.add_argument("--baseline-cm-key", default="baseline.sha",
                        help="ConfigMap 中的 key (默认 baseline.sha)")
    parser.add_argument("--fail-fast", action="store_true",
                        help="任一 Check 失败立即退出, 适合 CI 门禁")
    parser.add_argument("--result-json", default=None,
                        help="结果 JSON 输出路径")
    return parser


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = build_parser()
    args = parser.parse_args()

    # 1. self-test (offline, no service needed)
    if args.self_test:
        return cmd_self_test()

    # 2. apply K8s defaults (host + baseline resolution)
    _apply_k8s_defaults(args)

    # 3. gen-baseline
    if args.gen_baseline:
        return cmd_gen_baseline(args)

    # 4. run_checks
    return run_checks(args)


if __name__ == "__main__":
    sys.exit(main())
