#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_ci_gate_interception.py — CI/CD 门禁指纹漂移拦截能力测试

本测试用例模拟生产环境中三类指纹漂移事故, 验证:
  1. 指纹算法能正确检测到漂移 (指纹值发生变化)
  2. E2E 仿真脚本的退出码符合门禁预期 (漂移 → exit 1, 正常 → exit 0)
  3. CI/CD 门禁逻辑能根据退出码正确放行/阻断发布
  4. 回滚后指纹能恢复一致性

测试场景:
  Scenario A: 模型切换事故 (model_id: all-MiniLM-L6-v2 → bge-large-zh-v1.5)
  Scenario B: 维度漂移事故 (dim 384 → 385, 调试代码残留)
  Scenario C: 精度丢失事故 (float32 → float16 截断)
  Scenario D: 合规升级 (相同向量, 指纹不变 → 门禁放行)
  Scenario E: 回滚恢复 (恢复基线向量, 指纹恢复一致)

运行方式:
  python3 test_ci_gate_interception.py -v
  python3 -m pytest test_ci_gate_interception.py -v

零外部依赖 (stdlib only), Python 3.8+ 兼容.
"""

import hashlib
import json
import os
import random
import struct
import subprocess
import sys
import tempfile
import unittest

# ---------------------------------------------------------------------------
# 被测模块: 从 e2e-rollback-fingerprint-sim.py 导入指纹算法
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SIM_SCRIPT = os.path.join(SCRIPT_DIR, "e2e-rollback-fingerprint-sim.py")

# 通过 import 导入仿真脚本的指纹计算函数
sys.path.insert(0, SCRIPT_DIR)
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "e2e_sim", os.path.join(SCRIPT_DIR, "e2e-rollback-fingerprint-sim.py")
)
_e2e_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_e2e_mod)
compute_fingerprint = _e2e_mod.compute_vector_fingerprint
truncate_to_float16 = _e2e_mod.truncate_to_float16


# ---------------------------------------------------------------------------
# 测试常量
# ---------------------------------------------------------------------------
BASELINE_DIM = 384
VECTORS_COUNT = 3
HEAD_FLOATS = 8
TEST_SEED = 20260807


# ---------------------------------------------------------------------------
# Mock 生产环境: 生成模拟向量
# ---------------------------------------------------------------------------
def generate_baseline_vectors(seed=TEST_SEED):
    """生成 v1.1.0 基线向量 (模拟 all-MiniLM-L6-v2 正常输出)."""
    rng = random.Random(seed)
    return [[rng.random() for _ in range(BASELINE_DIM)]
            for _ in range(VECTORS_COUNT)]


def generate_model_switch_vectors(seed=TEST_SEED):
    """模拟模型切换: all-MiniLM-L6-v2 → bge-large-zh-v1.5 (完全不同的向量)."""
    rng = random.Random(seed + 1000)
    return [[rng.random() for _ in range(BASELINE_DIM)]
            for _ in range(VECTORS_COUNT)]


def generate_dimension_drift_vectors(seed=TEST_SEED):
    """模拟维度漂移: dim 384 → 385 (调试代码残留, 末尾追加 metadata float)."""
    rng = random.Random(seed + 2000)
    return [[rng.random() for _ in range(BASELINE_DIM + 1)]
            for _ in range(VECTORS_COUNT)]


def generate_precision_loss_vectors(baseline_vectors):
    """模拟精度丢失: float32 → float16 (尾数截断)."""
    return [[truncate_to_float16(x) for x in vec]
            for vec in baseline_vectors]


# ---------------------------------------------------------------------------
# CI/CD 门禁逻辑模拟
# ---------------------------------------------------------------------------
def ci_gate_check(current_fingerprint, baseline_fingerprint):
    """模拟 CI/CD gate-summary Job 的门禁判定逻辑.

    Returns:
        (passed: bool, reason: str)
    """
    if current_fingerprint == baseline_fingerprint:
        return True, "GATE PASSED: 指纹一致, 允许发布"
    else:
        return False, (f"GATE BLOCKED: 指纹漂移! "
                       f"当前={current_fingerprint}, 基线={baseline_fingerprint}")


def run_e2e_simulation(seed=TEST_SEED):
    """运行 E2E 仿真脚本, 返回 (exit_code, stdout)."""
    result = subprocess.run(
        [sys.executable, SIM_SCRIPT, "--seed", str(seed)],
        capture_output=True, text=True, timeout=30,
    )
    return result.returncode, result.stdout


# ---------------------------------------------------------------------------
# 测试用例
# ---------------------------------------------------------------------------
class TestFingerprintAlgorithm(unittest.TestCase):
    """测试指纹算法本身的正确性."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)

    def test_fingerprint_is_16_hex(self):
        """指纹应为 16 个十六进制字符."""
        self.assertEqual(len(self.baseline_fp), 16)
        int(self.baseline_fp, 16)  # 能转为 hex 整数说明格式合法

    def test_determinism(self):
        """相同输入必须产生相同指纹 (确定性)."""
        fp1 = compute_fingerprint(self.baseline_vectors)
        fp2 = compute_fingerprint(self.baseline_vectors)
        self.assertEqual(fp1, fp2)

    def test_empty_vectors(self):
        """空向量列表应返回有效指纹 (不崩溃)."""
        fp = compute_fingerprint([])
        self.assertEqual(len(fp), 16)


class TestScenarioA_ModelSwitch(unittest.TestCase):
    """场景 A: 模型切换事故 — 验证门禁拦截."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)
        self.drift_vectors = generate_model_switch_vectors()
        self.drift_fp = compute_fingerprint(self.drift_vectors)

    def test_fingerprint_changed(self):
        """模型切换后指纹必须发生变化."""
        self.assertNotEqual(
            self.baseline_fp, self.drift_fp,
            "模型切换后指纹未变化, 指纹算法无法检测模型切换!"
        )

    def test_ci_gate_blocks_release(self):
        """CI/CD 门禁应阻断模型切换后的发布."""
        passed, reason = ci_gate_check(self.drift_fp, self.baseline_fp)
        self.assertFalse(passed, f"门禁未阻断模型切换发布: {reason}")
        self.assertIn("GATE BLOCKED", reason)

    def test_vectors_actually_different(self):
        """验证模拟向量确实不同 (非算法假阳性)."""
        self.assertNotEqual(
            self.baseline_vectors[0][:4],
            self.drift_vectors[0][:4],
            "向量前 4 个 float 相同, 模拟数据有误"
        )


class TestScenarioB_DimensionDrift(unittest.TestCase):
    """场景 B: 维度漂移事故 — 验证门禁拦截."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)
        self.drift_vectors = generate_dimension_drift_vectors()
        self.drift_fp = compute_fingerprint(self.drift_vectors)

    def test_fingerprint_changed(self):
        """维度漂移后指纹必须发生变化."""
        self.assertNotEqual(
            self.baseline_fp, self.drift_fp,
            "维度漂移后指纹未变化, 指纹算法无法检测维度漂移!"
        )

    def test_ci_gate_blocks_release(self):
        """CI/CD 门禁应阻断维度漂移后的发布."""
        passed, reason = ci_gate_check(self.drift_fp, self.baseline_fp)
        self.assertFalse(passed, f"门禁未阻断维度漂移发布: {reason}")

    def test_dimension_is_385(self):
        """验证漂移向量维度确实为 385."""
        self.assertEqual(len(self.drift_vectors[0]), BASELINE_DIM + 1)


class TestScenarioC_PrecisionLoss(unittest.TestCase):
    """场景 C: 精度丢失事故 — 验证门禁拦截 (最隐蔽的漂移)."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)
        self.drift_vectors = generate_precision_loss_vectors(self.baseline_vectors)
        self.drift_fp = compute_fingerprint(self.drift_vectors)

    def test_fingerprint_changed(self):
        """精度丢失后指纹必须发生变化 (这是最关键的测试)."""
        self.assertNotEqual(
            self.baseline_fp, self.drift_fp,
            "精度丢失后指纹未变化, 指纹算法无法检测精度退化!"
        )

    def test_ci_gate_blocks_release(self):
        """CI/CD 门禁应阻断精度丢失后的发布."""
        passed, reason = ci_gate_check(self.drift_fp, self.baseline_fp)
        self.assertFalse(passed, f"门禁未阻断精度丢失发布: {reason}")

    def test_precision_loss_is_subtle(self):
        """验证精度丢失是微妙的: 向量值接近但不完全相同."""
        orig = self.baseline_vectors[0][0]
        trunc = self.drift_vectors[0][0]
        # 值应该非常接近但不相等
        self.assertAlmostEqual(orig, trunc, places=2)
        self.assertNotEqual(orig, trunc, "float16 截断后值未变化")

    def test_dimension_unchanged(self):
        """精度丢失不改变维度 (这是与场景 B 的区别)."""
        self.assertEqual(len(self.drift_vectors[0]), BASELINE_DIM)


class TestScenarioD_CompliantUpgrade(unittest.TestCase):
    """场景 D: 合规升级 — 验证门禁放行."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)

    def test_same_vectors_same_fingerprint(self):
        """相同向量重算指纹必须一致 (合规升级场景)."""
        fp_after_upgrade = compute_fingerprint(self.baseline_vectors)
        self.assertEqual(self.baseline_fp, fp_after_upgrade)

    def test_ci_gate_allows_release(self):
        """CI/CD 门禁应放行合规升级."""
        fp_after_upgrade = compute_fingerprint(self.baseline_vectors)
        passed, reason = ci_gate_check(fp_after_upgrade, self.baseline_fp)
        self.assertTrue(passed, f"门禁错误阻断了合规升级: {reason}")
        self.assertIn("GATE PASSED", reason)


class TestScenarioE_RollbackRecovery(unittest.TestCase):
    """场景 E: 回滚恢复 — 验证回滚后指纹恢复一致."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)

    def test_rollback_restores_fingerprint(self):
        """回滚到基线向量后, 指纹必须恢复一致."""
        # 模拟事故
        drift_vectors = generate_model_switch_vectors()
        drift_fp = compute_fingerprint(drift_vectors)
        self.assertNotEqual(drift_fp, self.baseline_fp)

        # 模拟回滚: 恢复基线向量
        rollback_fp = compute_fingerprint(self.baseline_vectors)
        self.assertEqual(rollback_fp, self.baseline_fp,
                         "回滚后指纹未恢复一致!")

    def test_ci_gate_passes_after_rollback(self):
        """回滚后 CI/CD 门禁应放行."""
        rollback_fp = compute_fingerprint(self.baseline_vectors)
        passed, reason = ci_gate_check(rollback_fp, self.baseline_fp)
        self.assertTrue(passed, f"回滚后门禁未放行: {reason}")


class TestE2ESimulationScript(unittest.TestCase):
    """测试 E2E 仿真脚本的实际执行与退出码."""

    def test_simulation_passes_with_correct_seed(self):
        """正常 seed 下仿真应全部通过 (exit 0)."""
        exit_code, stdout = run_e2e_simulation(TEST_SEED)
        self.assertEqual(exit_code, 0,
                         f"仿真未通过, exit={exit_code}\n{stdout[-500:]}")
        self.assertIn("6/6 PASS", stdout)

    def test_simulation_summary_table_format(self):
        """仿真汇总表格式应可被 CI/CD awk 提取."""
        exit_code, stdout = run_e2e_simulation(TEST_SEED)
        # 验证 awk 提取模式: 以 "#   阶段" 开头
        lines = stdout.split("\n")
        summary_lines = []
        capture = False
        for line in lines:
            if line.startswith("#   阶段"):
                capture = True
            if capture:
                summary_lines.append(line)
        self.assertGreater(len(summary_lines), 3,
                           "无法提取汇总表, CI/CD awk 解析会失败")
        self.assertIn("汇总:", "".join(summary_lines))

    def test_simulation_json_output(self):
        """仿真 JSON 报告应包含完整的 6 阶段结果."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, dir=SCRIPT_DIR
        ) as f:
            json_path = f.name

        try:
            result = subprocess.run(
                [sys.executable, SIM_SCRIPT,
                 "--seed", str(TEST_SEED),
                 "--json-output", json_path],
                capture_output=True, text=True, timeout=30,
            )
            self.assertEqual(result.returncode, 0)

            with open(json_path, "r", encoding="utf-8") as f:
                report = json.load(f)

            self.assertEqual(report["total_phases"], 6)
            self.assertEqual(report["passed"], 6)
            self.assertEqual(report["failed"], 0)
            self.assertEqual(len(report["phases"]), 6)
            self.assertEqual(report["phases"][0]["status"], "PASS")
            self.assertEqual(report["phases"][5]["status"], "PASS")

            # Phase 6 指纹应与基线一致 (回滚恢复)
            baseline_fp = report["baseline_fingerprint"]
            phase6_fp = report["phases"][5]["fingerprint"]
            self.assertEqual(baseline_fp, phase6_fp,
                             "Phase 6 回滚后指纹与基线不一致")

            # Phase 3/4/5 指纹应与基线不同 (检测到漂移)
            for i in [2, 3, 4]:  # Phase 3, 4, 5
                phase_fp = report["phases"][i]["fingerprint"]
                self.assertNotEqual(phase_fp, baseline_fp,
                                    f"Phase {i+1} 指纹与基线相同, 未检测到漂移")
        finally:
            if os.path.exists(json_path):
                os.unlink(json_path)


class TestCIGateLogic(unittest.TestCase):
    """测试 CI/CD 门禁聚合逻辑 (模拟 gate-summary Job)."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)

    def test_gate_blocks_on_any_drift(self):
        """任一漂移场景都应被门禁阻断."""
        scenarios = [
            ("模型切换", generate_model_switch_vectors()),
            ("维度漂移", generate_dimension_drift_vectors()),
            ("精度丢失", generate_precision_loss_vectors(self.baseline_vectors)),
        ]
        for name, drift_vectors in scenarios:
            with self.subTest(scenario=name):
                drift_fp = compute_fingerprint(drift_vectors)
                passed, _ = ci_gate_check(drift_fp, self.baseline_fp)
                self.assertFalse(passed, f"门禁未阻断 {name}")

    def test_gate_passes_only_on_consistency(self):
        """只有指纹完全一致时门禁才放行."""
        same_fp = compute_fingerprint(self.baseline_vectors)
        passed, _ = ci_gate_check(same_fp, self.baseline_fp)
        self.assertTrue(passed)

    def test_gate_summary_aggregation(self):
        """模拟 gate-summary Job: 多个检查项全部通过才放行."""
        # 模拟 5 个 Job 的结果 (对应 CI/CD pipeline)
        checks = {
            "static-test-suite": "success",
            "e2e-simulation": "success",
            "linux-preflight": "success",
            "k8s-helm-verify": "success",
        }

        # 模拟门禁汇总逻辑
        all_passed = all(v == "success" for v in checks.values())
        self.assertTrue(all_passed, "全部通过时门禁应放行")

        # 模拟 e2e-simulation 失败
        checks["e2e-simulation"] = "failure"
        all_passed = all(v == "success" for v in checks.values())
        self.assertFalse(all_passed, "e2e-simulation 失败时门禁应阻断")

    def test_gate_exit_code_mapping(self):
        """验证退出码到门禁动作的映射."""
        # exit 0 → 放行
        passed, _ = ci_gate_check(self.baseline_fp, self.baseline_fp)
        self.assertTrue(passed)

        # exit 1 (漂移) → 阻断
        drift_fp = compute_fingerprint(generate_model_switch_vectors())
        passed, _ = ci_gate_check(drift_fp, self.baseline_fp)
        self.assertFalse(passed)


class TestDriftDetectionCoverage(unittest.TestCase):
    """测试三类漂移的检测覆盖矩阵 (对应培训 Slide 4.3)."""

    def setUp(self):
        self.baseline_vectors = generate_baseline_vectors()
        self.baseline_fp = compute_fingerprint(self.baseline_vectors)

    def test_type1_model_switch_detected(self):
        """Type 1: 模型切换 — Check 2 (指纹) 应检测到."""
        drift_fp = compute_fingerprint(generate_model_switch_vectors())
        self.assertNotEqual(drift_fp, self.baseline_fp)

    def test_type2_dimension_drift_detected(self):
        """Type 2: 维度漂移 — Check 2 (指纹) 应检测到."""
        drift_fp = compute_fingerprint(generate_dimension_drift_vectors())
        self.assertNotEqual(drift_fp, self.baseline_fp)

    def test_type3_precision_loss_detected(self):
        """Type 3: 精度丢失 — Check 2 (指纹) 应检测到."""
        drift_fp = compute_fingerprint(
            generate_precision_loss_vectors(self.baseline_vectors)
        )
        self.assertNotEqual(drift_fp, self.baseline_fp)

    def test_all_three_types_produce_different_fingerprints(self):
        """三类漂移应产生各自不同的指纹 (区分度)."""
        fp_a = compute_fingerprint(generate_model_switch_vectors())
        fp_b = compute_fingerprint(generate_dimension_drift_vectors())
        fp_c = compute_fingerprint(
            generate_precision_loss_vectors(self.baseline_vectors)
        )
        fingerprints = {fp_a, fp_b, fp_c, self.baseline_fp}
        self.assertEqual(len(fingerprints), 4,
                         "四组向量应产生四个不同的指纹")


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    unittest.main(verbosity=2)
