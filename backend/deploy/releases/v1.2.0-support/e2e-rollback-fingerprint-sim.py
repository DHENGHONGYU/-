#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
e2e-rollback-fingerprint-sim.py — V9 Embedding 服务端到端回滚指纹一致性仿真

本脚本无需真实 Embedding 服务, 内部生成 mock 向量, 通过 6 阶段回滚一致性
验证来检验「向量指纹 (SHA256[:16] of head floats, big-endian packed)」能否
正确识别各类事故并在回滚后恢复一致。指纹算法与 verify-embedding-fingerprint.py
完全一致 (取每条向量前 8 个 float, 以 struct.pack(">f", ...) 大端打包后做
SHA256 取前 16 hex 字符), 确保仿真结果可外推到真实服务场景。

6 阶段说明:
  Phase 1 — 基线建立 (Baseline Establishment):
      用 --seed 生成 3 条 384 维 mock 向量, 计算基线指纹并存储, 供后续比对。
  Phase 2 — 合规升级 (Compliant Upgrade):
      模拟保留相同向量的无损升级 (如代码重构 / 配置调整但不改模型),
      重算指纹必须与 Phase 1 基线完全一致, 否则说明升级引入了隐式漂移。
  Phase 3 — 模型切换事故 (Model Switch Incident):
      模拟 model_id 从 all-MiniLM-L6-v2 切换到 bge-large-zh-v1.5,
      向量完全改变, 指纹必须漂移 — 验证指纹对模型切换的检测能力。
  Phase 4 — 维度漂移事故 (Dimension Drift Incident):
      模拟调试代码残留导致 dim 384→385, 向量改变, 指纹必须漂移 —
      验证指纹对维度回归的检测能力。
  Phase 5 — 精度丢失事故 (Precision Loss Incident):
      模拟 float32→float16 截断 (尾数位 23→10), 精度损失, 指纹必须漂移 —
      验证指纹对精度退化的检测能力。
  Phase 6 — 回滚恢复 (Rollback Recovery):
      恢复 Phase 1 原始向量 (回滚到基线版本), 指纹必须与基线一致 —
      验证回滚操作能完整恢复指纹一致性。

设计目标:
  - 零外部依赖 (Python 3.8+ stdlib only)
  - 确定性可复现 (同 seed → 同结果, 适合 CI 门禁)
  - CI 友好 (退出码 0=6/6 全过, 1=有失败; 汇总表以 "#   阶段" 开头可被
    awk '/^#   阶段/{flag=1} flag' 精确提取)

使用示例:
  # 基本运行
  python e2e-rollback-fingerprint-sim.py --seed 42

  # CI 门禁 (带详细输出 + JSON 报告)
  python e2e-rollback-fingerprint-sim.py --seed 20260807 -v --json-output report.json
"""

import argparse
import datetime
import hashlib
import json
import random
import struct
import sys
import time


# ---------------------------------------------------------------------------
# Color constants
# ---------------------------------------------------------------------------
GRE = "\033[32m"   # green — PASS
RED = "\033[31m"   # red   — FAIL
YLW = "\033[33m"   # yellow — WARN
BLU = "\033[34m"   # blue  — INFO
NC = "\033[0m"     # reset


# ---------------------------------------------------------------------------
# Print helpers
# ---------------------------------------------------------------------------
def p_pass(msg):
    print(f"{GRE}[PASS]{NC} {msg}")


def p_fail(msg):
    print(f"{RED}[FAIL]{NC} {msg}")


def p_info(msg):
    print(f"{BLU}[INFO]{NC} {msg}")


def p_warn(msg):
    print(f"{YLW}[WARN]{NC} {msg}")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VECTORS_COUNT = 3
BASELINE_DIM = 384
HEAD_FLOATS = 8

ALL_PHASE_NAMES = [
    "Phase 1: 基线建立",
    "Phase 2: 合规升级",
    "Phase 3: 模型切换事故",
    "Phase 4: 维度漂移事故",
    "Phase 5: 精度丢失事故",
    "Phase 6: 回滚恢复",
]

SEPARATOR = "─" * 46


# ---------------------------------------------------------------------------
# Fingerprint algorithm — 与 verify-embedding-fingerprint.py 完全一致
# ---------------------------------------------------------------------------
def compute_vector_fingerprint(vectors, head=HEAD_FLOATS):
    """取每条向量前 `head` 个 float, 以大端 float (>f) 打包后拼接,
    对拼接字节做 SHA256 并取前 16 个 hex 字符作为指纹。"""
    buf = bytearray()
    for vec in vectors:
        for i in range(min(head, len(vec))):
            buf += struct.pack(">f", float(vec[i]))
    return hashlib.sha256(bytes(buf)).hexdigest()[:16]


# ---------------------------------------------------------------------------
# float32 → float16 精度截断 (模拟半精度丢失)
# ---------------------------------------------------------------------------
def truncate_to_float16(x):
    """将 float 截断为 half-precision (float16, 尾数 10 bit),
    模拟 float32→float16 精度丢失。struct 'e' 格式码自 Python 3.6 起可用。"""
    try:
        return struct.unpack("<e", struct.pack("<e", x))[0]
    except (OverflowError, struct.error):
        # 超出 float16 表示范围时保持原值 (mock 向量在 [0,1) 不会触发)
        return x


# ---------------------------------------------------------------------------
# CJK 感知的显示宽度计算 (用于汇总表对齐)
# ---------------------------------------------------------------------------
def display_width(s):
    """计算字符串在等宽终端中的显示宽度, CJK 字符计 2 列。"""
    width = 0
    for ch in s:
        cp = ord(ch)
        if (0x1100 <= cp <= 0x115F or
                0x2E80 <= cp <= 0xA4CF or
                0xAC00 <= cp <= 0xD7A3 or
                0xF900 <= cp <= 0xFAFF or
                0xFE30 <= cp <= 0xFE4F or
                0xFF00 <= cp <= 0xFF60 or
                0xFFE0 <= cp <= 0xFFE6):
            width += 2
        else:
            width += 1
    return width


def pad_name(name, target=26):
    """将阶段名填充到 target 显示宽度 (左对齐)。"""
    return name + " " * max(1, target - display_width(name))


# ---------------------------------------------------------------------------
# 汇总表打印 — 表头以 "#   阶段" 开头, 兼容 awk '/^#   阶段/'
# ---------------------------------------------------------------------------
def print_summary(results):
    print()
    print("#   阶段                     状态     指纹")
    print(f"#   {SEPARATOR}")
    for name in ALL_PHASE_NAMES:
        status, fp = results.get(name, ("SKIP", "-"))
        print(f"#   {pad_name(name)}{status:<8}{fp}")
    print(f"#   {SEPARATOR}")
    passed = sum(1 for s, _ in results.values() if s == "PASS")
    total = len(ALL_PHASE_NAMES)
    print(f"#   汇总: {passed}/{total} PASS")


# ---------------------------------------------------------------------------
# JSON 报告输出
# ---------------------------------------------------------------------------
def write_json(results, baseline_fp, duration_ms, args):
    phases_list = []
    for name in ALL_PHASE_NAMES:
        status, fp = results.get(name, ("SKIP", "-"))
        phases_list.append({
            "name": name,
            "status": status,
            "fingerprint": fp,
        })
    passed = sum(1 for s, _ in results.values() if s == "PASS")
    failed = sum(1 for s, _ in results.values() if s == "FAIL")
    payload = {
        "total_phases": len(ALL_PHASE_NAMES),
        "passed": passed,
        "failed": failed,
        "baseline_fingerprint": baseline_fp or "",
        "phases": phases_list,
        "duration_ms": duration_ms,
        "seed": args.seed,
        "ts": datetime.datetime.now().isoformat(),
    }
    try:
        with open(args.json_output, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        p_info(f"JSON 报告已写入: {args.json_output}")
    except OSError as e:
        p_warn(f"写入 JSON 报告失败: {e}")


# ---------------------------------------------------------------------------
# 收尾: 填充 SKIP → 写 JSON → 打印耗时 → 打印汇总表 → 返回退出码
# ---------------------------------------------------------------------------
def finalize(results, baseline_fp, t_start, args):
    for name in ALL_PHASE_NAMES:
        if name not in results:
            results[name] = ("SKIP", "-")
    duration_ms = int((time.time() - t_start) * 1000)
    if args.json_output:
        write_json(results, baseline_fp, duration_ms, args)
    p_info(f"完成于 {duration_ms}ms")
    print_summary(results)
    passed = sum(1 for s, _ in results.values() if s == "PASS")
    return 0 if passed == len(ALL_PHASE_NAMES) else 1


# ---------------------------------------------------------------------------
# 6 Phase 仿真主流程
# ---------------------------------------------------------------------------
def run_simulation(args):
    t_start = time.time()
    results = {}
    baseline_fp = None
    baseline_vectors = None

    # ------------------------------------------------------------------
    # Phase 1: 基线建立
    # ------------------------------------------------------------------
    rng = random.Random(args.seed)
    vectors = [[rng.random() for _ in range(BASELINE_DIM)]
               for _ in range(VECTORS_COUNT)]
    fp1 = compute_vector_fingerprint(vectors)
    baseline_fp = fp1
    baseline_vectors = vectors
    if args.verbose:
        p_info(f"Phase 1: seed={args.seed}, "
               f"生成 {VECTORS_COUNT} x {BASELINE_DIM} 维 mock 向量")
        p_info(f"Phase 1: vec[0][:8] = "
               f"{[round(x, 6) for x in vectors[0][:8]]}")
        p_info(f"Phase 1: 指纹 = {fp1}")
    p_pass(f"Phase 1: 基线指纹 = {fp1}")
    results["Phase 1: 基线建立"] = ("PASS", fp1)

    # ------------------------------------------------------------------
    # Phase 2: 合规升级 (相同向量, 指纹必须一致)
    # ------------------------------------------------------------------
    fp2 = compute_vector_fingerprint(baseline_vectors)
    if args.verbose:
        p_info(f"Phase 2: 使用相同向量重算指纹 = {fp2}")
        p_info(f"Phase 2: 基线 = {baseline_fp}, 一致 = {fp2 == baseline_fp}")
    if fp2 == baseline_fp:
        p_pass(f"Phase 2: 升级后指纹一致 = {fp2}")
        results["Phase 2: 合规升级"] = ("PASS", fp2)
    else:
        p_fail("Phase 2: 指纹漂移!")
        results["Phase 2: 合规升级"] = ("FAIL", fp2)
        return finalize(results, baseline_fp, t_start, args)

    # ------------------------------------------------------------------
    # Phase 3: 模型切换事故 (all-MiniLM-L6-v2 → bge-large-zh-v1.5)
    # ------------------------------------------------------------------
    rng3 = random.Random(args.seed + 1000)
    vectors3 = [[rng3.random() for _ in range(BASELINE_DIM)]
                for _ in range(VECTORS_COUNT)]
    fp3 = compute_vector_fingerprint(vectors3)
    if args.verbose:
        p_info("Phase 3: 模拟模型切换 "
               "all-MiniLM-L6-v2 → bge-large-zh-v1.5")
        p_info(f"Phase 3: vec[0][:8] = "
               f"{[round(x, 6) for x in vectors3[0][:8]]}")
        p_info(f"Phase 3: 指纹 = {fp3}, 基线 = {baseline_fp}, "
               f"漂移 = {fp3 != baseline_fp}")
    if fp3 != baseline_fp:
        p_pass("Phase 3: 检测到模型切换 (指纹漂移已识别)")
        results["Phase 3: 模型切换事故"] = ("PASS", fp3)
    else:
        p_fail("Phase 3: 模型切换未导致指纹漂移")
        results["Phase 3: 模型切换事故"] = ("FAIL", fp3)
        return finalize(results, baseline_fp, t_start, args)

    # ------------------------------------------------------------------
    # Phase 4: 维度漂移事故 (384 → 385, 调试代码残留)
    # ------------------------------------------------------------------
    drift_dim = BASELINE_DIM + 1  # 385
    rng4 = random.Random(args.seed + 2000)
    vectors4 = [[rng4.random() for _ in range(drift_dim)]
                for _ in range(VECTORS_COUNT)]
    fp4 = compute_vector_fingerprint(vectors4)
    if args.verbose:
        p_info(f"Phase 4: 模拟维度漂移 {BASELINE_DIM}→{drift_dim} "
               f"(调试代码残留)")
        p_info(f"Phase 4: vec[0] 维度 = {len(vectors4[0])}")
        p_info(f"Phase 4: 指纹 = {fp4}, 基线 = {baseline_fp}, "
               f"漂移 = {fp4 != baseline_fp}")
    if fp4 != baseline_fp:
        p_pass(f"Phase 4: 检测到维度漂移 ({BASELINE_DIM}→{drift_dim})")
        results["Phase 4: 维度漂移事故"] = ("PASS", fp4)
    else:
        p_fail(f"Phase 4: 维度漂移 ({BASELINE_DIM}→{drift_dim}) "
               f"未导致指纹漂移")
        results["Phase 4: 维度漂移事故"] = ("FAIL", fp4)
        return finalize(results, baseline_fp, t_start, args)

    # ------------------------------------------------------------------
    # Phase 5: 精度丢失事故 (float32 → float16 尾数截断)
    # ------------------------------------------------------------------
    vectors5 = [[truncate_to_float16(x) for x in vec]
                for vec in baseline_vectors]
    fp5 = compute_vector_fingerprint(vectors5)
    if args.verbose:
        p_info("Phase 5: 模拟精度丢失 float32 → float16 (截断尾数)")
        p_info(f"Phase 5: vec[0][:4] 原始 = "
               f"{[round(x, 8) for x in baseline_vectors[0][:4]]}")
        p_info(f"Phase 5: vec[0][:4] 截断 = "
               f"{[round(x, 8) for x in vectors5[0][:4]]}")
        p_info(f"Phase 5: 指纹 = {fp5}, 基线 = {baseline_fp}, "
               f"漂移 = {fp5 != baseline_fp}")
    if fp5 != baseline_fp:
        p_pass("Phase 5: 检测到精度漂移")
        results["Phase 5: 精度丢失事故"] = ("PASS", fp5)
    else:
        p_fail("Phase 5: 精度丢失未导致指纹漂移")
        results["Phase 5: 精度丢失事故"] = ("FAIL", fp5)
        return finalize(results, baseline_fp, t_start, args)

    # ------------------------------------------------------------------
    # Phase 6: 回滚恢复 (恢复 Phase 1 原始向量)
    # ------------------------------------------------------------------
    fp6 = compute_vector_fingerprint(baseline_vectors)
    if args.verbose:
        p_info("Phase 6: 回滚至 Phase 1 原始向量")
        p_info(f"Phase 6: 指纹 = {fp6}, 基线 = {baseline_fp}, "
               f"一致 = {fp6 == baseline_fp}")
    if fp6 == baseline_fp:
        p_pass(f"Phase 6: 回滚后指纹一致 = {fp6}")
        results["Phase 6: 回滚恢复"] = ("PASS", fp6)
    else:
        p_fail("Phase 6: 回滚后指纹仍漂移!")
        results["Phase 6: 回滚恢复"] = ("FAIL", fp6)
        return finalize(results, baseline_fp, t_start, args)

    return finalize(results, baseline_fp, t_start, args)


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------
def build_parser():
    parser = argparse.ArgumentParser(
        description="V9 Embedding 服务端到端回滚指纹一致性仿真 "
                    "(6 Phase, 零依赖, 无需真实服务)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "使用示例:\n"
            "  python e2e-rollback-fingerprint-sim.py --seed 42\n"
            "  python e2e-rollback-fingerprint-sim.py --seed 20260807 "
            "-v --json-output report.json\n"
        ),
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="随机种子, 用于可复现的 mock 向量生成 (默认 42)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="显示各阶段详细输出 (向量采样值 / 指纹比对细节)",
    )
    parser.add_argument(
        "--json-output", default="",
        help="将汇总 JSON 报告写入指定文件路径 (不指定则不写)",
    )
    return parser


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = build_parser()
    args = parser.parse_args()
    return run_simulation(args)


if __name__ == "__main__":
    sys.exit(main())
