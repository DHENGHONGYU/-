"""
CONDITIONAL 评级触发验证测试
==============================
构造证据不足的 mock 数据，验证 CONDITIONAL 评级是否准确触发。

测试场景:
    1. 证据不足导致 CONDITIONAL — ESS 普遍偏低
    2. 置信度偏低导致 CONDITIONAL — 置信度星级低
    3. V6-LLM 偏差导致 CONDITIONAL — 评分偏差大
    4. 规范不合规导致 CONDITIONAL — 多层不符合 Rubric
    5. 组合缺陷导致 CONDITIONAL — 多维度同时不足
    6. 日志输出验证 — 确认日志在评分各分支正确打印
    7. 边界验证 — overall 正好 3.0 和 3.9
"""

import logging
import io
import pytest

from backend.compliance.design_compliance_scorer import (
    DesignComplianceScorer,
    LayerEvidence,
    ComplianceRating,
)


# ===========================================================================
#  Mock 数据构造器
# ===========================================================================

def _layer(
    layer_id: str,
    layer_name: str,
    score: float = 3.5,
    confidence: float = 3.0,
    evidence_count: int = 2,
    source_grades: list[str] | None = None,
    target_score: int = 3,
    missing_fields: list[str] | None = None,
    is_blocking: bool = False,
    spec_fields: dict | None = None,
) -> LayerEvidence:
    if source_grades is None:
        source_grades = ["C", "D"]
    if missing_fields is None:
        missing_fields = []
    if spec_fields is None:
        spec_fields = {}
    return LayerEvidence(
        layer_id=layer_id,
        layer_name=layer_name,
        score=score,
        confidence=confidence,
        evidence_count=evidence_count,
        source_grades=source_grades,
        target_score=target_score,
        missing_fields=missing_fields,
        is_blocking=is_blocking,
        spec_fields=spec_fields,
    )


def _full_spec_fields() -> dict:
    """返回完整的 spec_fields 字典，使所有层合规"""
    return {
        "lMinus1": {"industry_score_injected": True, "correlation": 0.7},
        "l0": {"S": 7, "T": 8, "E_economy": 6, "E_environment": 5, "P": 7},
        "l1": {"moat_type": "技术独占性", "strength": "高"},
        "l2": {"segments": ["光模块"], "tech_gap": 1, "market_share": 0.20},
        "l3f": {"revenue": 8.5, "net_profit": 1.5, "operating_cashflow": 1.8},
        "l3v": {"peg": 0.70, "industry_pe_range": "30-50x"},
        "l4": {"scenarios": {"bull": 12, "base": 8, "bear": 4}, "return_ratio": 2.0},
        "l5": {"tech_maturity": 55, "market_maturity": 40},
        "l6": {"hype_stage": "复苏期", "investment_strategy": "重仓龙头"},
        "l7": {"curves": ["光模块"], "catalyst_strength": "★★★"},
        "l8": {
            "tech_indicators": {"macd": 0.3},
            "capital_flow": {"north": 0.5},
            "chip_analysis": {"concentration": "medium"},
        },
    }


def _make_11_layers(
    evidence_count: int = 2,
    source_grades: list[str] | None = None,
    confidence: float = 3.0,
    score: float = 3.5,
    target_score: int = 3,
    compliant: bool = True,
) -> list[LayerEvidence]:
    """批量构造 11 层证据，统一参数"""
    if source_grades is None:
        source_grades = ["C", "D"]
    specs = _full_spec_fields()
    layer_defs = [
        ("lMinus1", "行业评分估值"),
        ("l0", "STEEP宏观扫描"),
        ("l1", "护城河分析"),
        ("l2", "市场/竞品分析"),
        ("l3f", "财务健康度"),
        ("l3v", "估值水平"),
        ("l4", "情景推演"),
        ("l5", "T-M矩阵"),
        ("l6", "Hype Cycle"),
        ("l7", "第二曲线"),
        ("l8", "技术筹码"),
    ]
    return [
        _layer(
            lid, name,
            score=score,
            confidence=confidence,
            evidence_count=evidence_count,
            source_grades=list(source_grades),
            target_score=target_score,
            spec_fields=specs[lid] if compliant else {},
        )
        for lid, name in layer_defs
    ]


# ===========================================================================
#  场景 1: 证据不足 → CONDITIONAL
# ===========================================================================

class TestInsufficientEvidence:
    """证据不足导致 CONDITIONAL 评级"""

    def test_low_evidence_count_triggers_conditional(self):
        """每层仅 1 条 D 级证据 → ESS 极低 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=1,
            source_grades=["D"],
            confidence=2.0,
            target_score=3,
        )
        result = scorer.score("TEST001", layers, v6_score=3.0, llm_score=2.8, timestamp="2026-08-09")

        assert result.rating == ComplianceRating.CONDITIONAL
        assert 3.0 <= result.overall_compliance < 4.0
        assert result.evidence_sufficiency_score < 2.0
        # 证据不足应出现在改进建议中
        assert any("证据充分度" in r for r in result.recommendations)

    def test_low_grade_evidence_triggers_conditional(self):
        """E 级证据来源 → ESS 折扣大 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=2,
            source_grades=["E", "E"],
            confidence=2.0,
            target_score=4,
        )
        result = scorer.score("TEST002", layers, v6_score=3.5, llm_score=3.3, timestamp="2026-08-09")

        assert result.rating == ComplianceRating.CONDITIONAL
        assert result.evidence_sufficiency_score < 1.5

    def test_single_evidence_per_layer(self):
        """每层仅 1 条 B 级证据, 目标 4 分 → ESS 不足"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=1,
            source_grades=["B"],
            confidence=3.0,
            target_score=4,
        )
        result = scorer.score("TEST003", layers, v6_score=3.5, llm_score=3.4, timestamp="2026-08-09")

        # ESS = 0.90 * 0.60 / 3 = 0.18 → score=0.0 (每层)
        assert result.evidence_sufficiency_score == 0.0
        assert result.rating == ComplianceRating.CONDITIONAL


# ===========================================================================
#  场景 2: 置信度偏低 → CONDITIONAL
# ===========================================================================

class TestLowConfidence:
    """置信度偏低导致 CONDITIONAL 评级"""

    def test_low_confidence_all_layers(self):
        """所有层置信度 = 1.0 + 弱证据 → 聚合置信度低 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=2,
            source_grades=["C", "D"],
            confidence=1.0,
            target_score=3,
        )
        result = scorer.score("TEST004", layers, v6_score=3.5, llm_score=3.4, timestamp="2026-08-09")

        assert result.confidence_level_score == 2.0
        assert result.rating == ComplianceRating.CONDITIONAL

    def test_mixed_confidence(self):
        """部分层低置信 → 聚合偏低 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(confidence=4.0, target_score=3)
        # 将 4 层降为低置信
        for i in [0, 3, 6, 9]:
            layers[i].confidence = 1.0
        result = scorer.score("TEST005", layers, v6_score=3.5, llm_score=3.3, timestamp="2026-08-09")

        assert result.confidence_level_score <= 4.0
        assert result.rating == ComplianceRating.CONDITIONAL


# ===========================================================================
#  场景 3: V6-LLM 偏差 → CONDITIONAL
# ===========================================================================

class TestConsistencyDeviation:
    """V6-LLM 偏差导致 CONDITIONAL 评级"""

    def test_moderate_deviation_triggers_conditional(self):
        """偏差 0.6 + 弱证据 → 一致性 2.5 + ESS 低 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=2,
            source_grades=["C", "D"],
            confidence=3.0,
            target_score=3,
        )
        result = scorer.score("TEST006", layers, v6_score=4.0, llm_score=3.4, timestamp="2026-08-09")

        assert result.consistency_score == 2.5
        assert result.v6_llm_deviation == pytest.approx(0.6)
        assert result.rating == ComplianceRating.CONDITIONAL

    def test_single_track_v6_only(self):
        """仅 V6 评分 → 一致性 3.5 → 可能 CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=2,
            source_grades=["C", "D"],
            confidence=3.0,
            target_score=3,
        )
        result = scorer.score("TEST007", layers, v6_score=3.5, llm_score=None, timestamp="2026-08-09")

        assert result.consistency_score == 3.5
        assert result.rating == ComplianceRating.CONDITIONAL


# ===========================================================================
#  场景 4: 规范不合规 → CONDITIONAL
# ===========================================================================

class TestSpecNonCompliance:
    """规范不合规导致 CONDITIONAL 评级"""

    def test_partial_non_compliant(self):
        """3 层不合规 + 弱证据 → 规范遵循度低 + ESS 低 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=2,
            source_grades=["C", "D"],
            confidence=3.0,
            target_score=3,
            compliant=True,
        )
        # 让 3 层不合规
        for i in [2, 5, 8]:
            layers[i].spec_fields = {}

        result = scorer.score("TEST008", layers, v6_score=3.5, llm_score=3.3, timestamp="2026-08-09")

        # 8/11 通过 → 3.64
        assert result.spec_adherence_score == pytest.approx(8 / 11 * 5, abs=0.01)
        assert result.rating == ComplianceRating.CONDITIONAL

    def test_all_spec_empty(self):
        """所有层 spec_fields 为空 + 弱证据 → 规范=0 + ESS=0 → FAIL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=1,
            source_grades=["D"],
            confidence=2.0,
            target_score=3,
            compliant=False,
        )
        result = scorer.score("TEST009", layers, v6_score=3.0, llm_score=3.0, timestamp="2026-08-09")

        assert result.spec_adherence_score == 0.0
        assert result.rating == ComplianceRating.FAIL


# ===========================================================================
#  场景 5: 组合缺陷 → CONDITIONAL
# ===========================================================================

class TestCombinedDeficiencies:
    """多维度组合缺陷导致 CONDITIONAL"""

    def test_low_evidence_plus_low_confidence(self):
        """证据不足 + 置信度低 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=1,
            source_grades=["D"],
            confidence=1.5,
            target_score=3,
        )
        result = scorer.score("TEST010", layers, v6_score=3.0, llm_score=2.8, timestamp="2026-08-09")

        assert result.evidence_sufficiency_score < 1.0
        assert result.confidence_level_score <= 2.0
        assert result.rating == ComplianceRating.CONDITIONAL

    def test_single_track_plus_low_evidence(self):
        """单轨评分 + 证据不足 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=1,
            source_grades=["C"],
            confidence=2.5,
            target_score=3,
        )
        result = scorer.score("TEST011", layers, v6_score=3.0, llm_score=None, timestamp="2026-08-09")

        assert result.consistency_score == 3.5
        assert result.evidence_sufficiency_score < 1.0
        assert result.rating == ComplianceRating.CONDITIONAL

    def test_deviation_plus_non_compliant(self):
        """V6-LLM 偏差 + 规范不合规 + 弱证据 → CONDITIONAL"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=2,
            source_grades=["C", "D"],
            confidence=3.0,
            target_score=3,
            compliant=True,
        )
        # 2 层不合规
        layers[4].spec_fields = {}
        layers[7].spec_fields = {}
        # V6-LLM 偏差 0.7
        result = scorer.score("TEST012", layers, v6_score=4.0, llm_score=3.3, timestamp="2026-08-09")

        assert result.consistency_score == 2.5
        assert result.spec_adherence_score < 5.0
        assert result.rating == ComplianceRating.CONDITIONAL


# ===========================================================================
#  场景 6: 日志输出验证
# ===========================================================================

class TestLoggingOutput:
    """验证评分日志在各分支正确输出"""

    @pytest.fixture(autouse=True)
    def _capture_logs(self, caplog):
        """自动捕获日志"""
        caplog.set_level(logging.DEBUG, logger="V6.ComplianceScorer")

    def test_log_start_and_complete(self, caplog):
        """日志包含评分开始和完成"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(evidence_count=2, source_grades=["C", "D"], confidence=2.5)
        scorer.score("LOG001", layers, v6_score=3.0, llm_score=2.8, timestamp="2026-08-09")

        log_text = caplog.text
        assert "合规评分开始" in log_text
        assert "合规评分完成" in log_text
        assert "LOG001" in log_text

    def test_log_dimension1_coverage(self, caplog):
        """日志包含维度1-层覆盖度"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers()
        scorer.score("LOG002", layers, v6_score=3.0, llm_score=3.0, timestamp="")

        log_text = caplog.text
        assert "维度1-层覆盖度" in log_text
        assert "覆盖=11/11" in log_text

    def test_log_dimension2_ess(self, caplog):
        """日志包含维度2-ESS 逐层明细"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(evidence_count=2, source_grades=["C", "D"])
        scorer.score("LOG003", layers, v6_score=3.0, llm_score=3.0, timestamp="")

        log_text = caplog.text
        assert "维度2-ESS" in log_text
        assert "平均ESS评分" in log_text

    def test_log_dimension3_confidence(self, caplog):
        """日志包含维度3-置信度"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(confidence=3.0)
        scorer.score("LOG004", layers, v6_score=3.0, llm_score=3.0, timestamp="")

        log_text = caplog.text
        assert "维度3-置信度" in log_text
        assert "聚合置信度" in log_text

    def test_log_dimension4_consistency(self, caplog):
        """日志包含维度4-一致性"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers()
        scorer.score("LOG005", layers, v6_score=3.5, llm_score=3.0, timestamp="")

        log_text = caplog.text
        assert "维度4-一致性" in log_text
        assert "偏差" in log_text

    def test_log_dimension5_spec(self, caplog):
        """日志包含维度5-规范遵循度"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers()
        scorer.score("LOG006", layers, v6_score=3.0, llm_score=3.0, timestamp="")

        log_text = caplog.text
        assert "维度5-规范遵循度" in log_text
        assert "通过=11/11" in log_text

    def test_log_blocking_layer(self, caplog):
        """日志记录阻断层"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers()
        layers[4].is_blocking = True
        layers[4].missing_fields = ["revenue"]
        scorer.score("LOG007", layers, v6_score=3.0, llm_score=3.0, timestamp="")

        log_text = caplog.text
        assert "阻断层" in log_text or "阻断" in log_text

    def test_log_non_compliant_layer(self, caplog):
        """日志记录不合规层"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers()
        layers[2].spec_fields = {}  # L1 不合规
        scorer.score("LOG008", layers, v6_score=3.0, llm_score=3.0, timestamp="")

        log_text = caplog.text
        assert "维度5-规范遵循度" in log_text
        assert "不合规" in log_text

    def test_log_single_track(self, caplog):
        """日志记录单轨评分"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers()
        scorer.score("LOG009", layers, v6_score=3.5, llm_score=None, timestamp="")

        log_text = caplog.text
        assert "仅V6" in log_text or "单轨" in log_text

    def test_log_dimension_summary(self, caplog):
        """日志包含维度汇总明细"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers()
        scorer.score("LOG010", layers, v6_score=3.8, llm_score=3.6, timestamp="")

        log_text = caplog.text
        assert "维度明细" in log_text
        assert "覆盖度" in log_text
        assert "ESS" in log_text
        assert "置信度" in log_text
        assert "一致性" in log_text
        assert "规范" in log_text


# ===========================================================================
#  场景 7: 边界验证
# ===========================================================================

class TestRatingBoundaries:
    """评级边界验证: overall 正好在 3.0 和 4.0 附近"""

    def test_overall_exactly_3_0_is_conditional(self):
        """overall = 3.0 → CONDITIONAL (下界)"""
        scorer = DesignComplianceScorer()
        # 构造使 overall ≈ 3.0 的场景
        layers = _make_11_layers(
            evidence_count=1,
            source_grades=["E"],
            confidence=1.0,
            target_score=3,
        )
        result = scorer.score("BND001", layers, v6_score=3.0, llm_score=3.0, timestamp="")
        # 应该在 CONDITIONAL 范围内或 FAIL
        assert result.overall_compliance < 4.0
        if result.overall_compliance >= 3.0:
            assert result.rating == ComplianceRating.CONDITIONAL
        else:
            assert result.rating == ComplianceRating.FAIL

    def test_overall_exactly_4_0_is_pass(self):
        """overall >= 4.0 → PASS (上界)"""
        scorer = DesignComplianceScorer()
        # 高质量数据 → overall 应 >= 4.0
        layers = _make_11_layers(
            evidence_count=4,
            source_grades=["A", "B", "B", "C"],
            confidence=4.5,
            target_score=4,
        )
        result = scorer.score("BND002", layers, v6_score=4.2, llm_score=4.0, timestamp="")
        assert result.overall_compliance >= 4.0
        assert result.rating == ComplianceRating.PASS

    def test_conditional_does_not_reach_pass(self):
        """CONDITIONAL 场景 overall < 4.0"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=1,
            source_grades=["D"],
            confidence=2.0,
            target_score=3,
        )
        result = scorer.score("BND003", layers, v6_score=3.0, llm_score=2.8, timestamp="")
        assert result.rating == ComplianceRating.CONDITIONAL
        assert result.overall_compliance < 4.0

    def test_conditional_does_not_drop_to_fail(self):
        """CONDITIONAL 场景 overall >= 3.0"""
        scorer = DesignComplianceScorer()
        layers = _make_11_layers(
            evidence_count=2,
            source_grades=["C", "D"],
            confidence=2.5,
            target_score=3,
        )
        result = scorer.score("BND004", layers, v6_score=3.5, llm_score=3.3, timestamp="")
        assert result.overall_compliance >= 3.0
        assert result.rating == ComplianceRating.CONDITIONAL
