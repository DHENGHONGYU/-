"""
V6 设计合规评分器 — 单元测试
=============================
覆盖五维度加权评分逻辑的全部核心路径。

测试维度:
    1. 层覆盖度 — 全覆盖 / 部分缺失 / 阻断层
    2. 证据充分度 (ESS) — 充分 / 不足 / 无证据
    3. 置信度等级 — 高 / 中 / 低 / 阻断
    4. V6-LLM 一致性 — 双轨一致 / 偏差 / 单轨 / 无轨
    5. 规范遵循度 — 全合规 / 部分不合规 / 逐层校验
    6. 综合评级 — pass / conditional / fail
    7. 工具方法 — 时效折损 / 星级转换 / 摘要输出
    8. 边界条件 — 空输入 / 部分缺失
"""

import math
import pytest

from backend.compliance.design_compliance_scorer import (
    DesignComplianceScorer,
    LayerEvidence,
    ComplianceScoreResult,
    ComplianceRating,
    ConfidenceLevel,
    SourceGrade,
    LayerId,
)


# ===========================================================================
#  测试夹具
# ===========================================================================

@pytest.fixture
def scorer():
    return DesignComplianceScorer()


def _make_layer(
    layer_id: str,
    layer_name: str,
    score: float = 4.0,
    confidence: float = 4.0,
    evidence_count: int = 3,
    source_grades: list[str] | None = None,
    target_score: int = 4,
    missing_fields: list[str] | None = None,
    is_blocking: bool = False,
    spec_fields: dict | None = None,
) -> LayerEvidence:
    """快捷构造单层证据"""
    if source_grades is None:
        source_grades = ["B", "B", "C"]
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


def _make_full_compliant_layers() -> list[LayerEvidence]:
    """构造 11 层全部合规的证据列表"""
    return [
        _make_layer("lMinus1", "行业评分估值", 4.5, 4.0, 3, ["C", "C", "D"], 4,
                     spec_fields={"industry_score_injected": True, "correlation": 0.9}),
        _make_layer("l0", "STEEP宏观扫描", 4.0, 4.0, 3, ["B", "C", "C"], 4,
                     spec_fields={"S": 8, "T": 9, "E_economy": 7, "E_environment": 6, "P": 8}),
        _make_layer("l1", "护城河分析", 4.0, 4.0, 3, ["B", "B", "C"], 4,
                     spec_fields={"moat_type": "技术独占性", "strength": "高"}),
        _make_layer("l2", "市场/竞品分析", 4.0, 3.5, 3, ["B", "C", "C"], 4,
                     spec_fields={"segments": ["光模块"], "tech_gap": 1, "market_share": 0.25}),
        _make_layer("l3f", "财务健康度", 4.0, 4.0, 3, ["A", "B", "B"], 4,
                     spec_fields={"revenue": 10.5, "net_profit": 2.1, "operating_cashflow": 2.5}),
        _make_layer("l3v", "估值水平", 3.5, 4.0, 2, ["B", "C"], 3,
                     spec_fields={"peg": 0.65, "industry_pe_range": "30-50x"}),
        _make_layer("l4", "情景推演", 4.0, 3.5, 3, ["C", "C", "D"], 4,
                     spec_fields={"scenarios": {"bull": 15, "base": 10, "bear": 5}, "return_ratio": 2.5}),
        _make_layer("l5", "T-M矩阵", 3.5, 3.5, 2, ["C", "D"], 3,
                     spec_fields={"tech_maturity": 65, "market_maturity": 45}),
        _make_layer("l6", "Hype Cycle", 4.0, 3.5, 2, ["C", "D"], 4,
                     spec_fields={"hype_stage": "复苏期", "investment_strategy": "重仓龙头"}),
        _make_layer("l7", "第二曲线", 4.5, 4.0, 3, ["B", "C", "D"], 4,
                     spec_fields={"curves": ["光模块", "AI算力"], "catalyst_strength": "★★★★"}),
        _make_layer("l8", "技术筹码", 4.0, 4.0, 3, ["B", "C", "C"], 4,
                     spec_fields={"tech_indicators": {"macd": 0.5}, "capital_flow": {"north": 1.2}, "chip_analysis": {"concentration": "low"}}),
    ]


# ===========================================================================
#  维度 1: 层覆盖度
# ===========================================================================

class TestLayerCoverage:
    """层覆盖度评分测试"""

    def test_full_coverage(self, scorer):
        """11 层全覆盖 → 5.0"""
        layers = _make_full_compliant_layers()
        score = scorer._score_layer_coverage(layers)
        assert score == 5.0

    def test_missing_one_layer(self, scorer):
        """缺 1 层 → 4.5"""
        layers = _make_full_compliant_layers()
        layers = layers[1:]  # 去掉 lMinus1
        score = scorer._score_layer_coverage(layers)
        assert score == 4.5

    def test_missing_two_layers(self, scorer):
        """缺 2 层 → 4.0"""
        layers = _make_full_compliant_layers()
        layers = layers[2:]  # 去掉 lMinus1, l0
        score = scorer._score_layer_coverage(layers)
        assert score == 4.0

    def test_missing_three_layers(self, scorer):
        """缺 3 层 → 3.0"""
        layers = _make_full_compliant_layers()
        layers = layers[3:]  # 去掉 3 层
        score = scorer._score_layer_coverage(layers)
        assert score == 3.0

    def test_missing_four_layers(self, scorer):
        """缺 4 层 → 2.0 - (4-3)*0.5 = 1.5"""
        layers = _make_full_compliant_layers()
        layers = layers[4:]
        score = scorer._score_layer_coverage(layers)
        assert score == pytest.approx(1.5)

    def test_missing_five_layers(self, scorer):
        """缺 5 层 → 2.0 - (5-3)*0.5 = 1.0"""
        layers = _make_full_compliant_layers()
        layers = layers[5:]
        score = scorer._score_layer_coverage(layers)
        assert score == pytest.approx(1.0)

    def test_blocking_layer_not_counted(self, scorer):
        """含缺失阻断的层不计入覆盖"""
        layers = _make_full_compliant_layers()
        layers[0].is_blocking = True
        layers[0].missing_fields = ["industry_score"]
        score = scorer._score_layer_coverage(layers)
        assert score == 4.5  # 11 - 1 = 10 层有效


# ===========================================================================
#  维度 2: 证据充分度 (ESS)
# ===========================================================================

class TestEvidenceSufficiency:
    """证据充分度评分测试"""

    def test_high_ess_all_layers(self, scorer):
        """所有层 ESS 平均分 > 2.5"""
        layers = _make_full_compliant_layers()
        score, ess_map = scorer._score_evidence_sufficiency(layers)
        assert score > 2.5
        assert len(ess_map) == 11

    def test_no_evidence(self, scorer):
        """零证据 → ESS=0, 评分=0"""
        layer = _make_layer("l0", "STEEP", evidence_count=0, source_grades=[])
        ess = scorer._calculate_ess(layer)
        assert ess == 0.0
        assert scorer._map_ess_to_score(ess) == 0.0

    def test_single_evidence_low_grade(self, scorer):
        """单条 E 级证据 → ESS 很低"""
        layer = _make_layer("l0", "STEEP", evidence_count=1, source_grades=["E"], target_score=4)
        ess = scorer._calculate_ess(layer)
        # ESS = 0.40 * 0.60 / 3 = 0.08
        assert ess < 0.20
        assert scorer._map_ess_to_score(ess) == 0.0

    def test_four_a_grade_evidence(self, scorer):
        """4 条 A 级证据 → ESS 超额"""
        layer = _make_layer("l0", "STEEP", evidence_count=4, source_grades=["A", "A", "A", "A"], target_score=5)
        ess = scorer._calculate_ess(layer)
        # ESS = (4 * 1.0) * 1.20 / 4 = 1.20
        assert ess == pytest.approx(1.20)
        assert scorer._map_ess_to_score(ess) == 5.0

    def test_two_b_grade_evidence(self, scorer):
        """2 条 B 级证据, 目标 3 分 → ESS 适中"""
        layer = _make_layer("l0", "STEEP", evidence_count=2, source_grades=["B", "B"], target_score=3)
        ess = scorer._calculate_ess(layer)
        # ESS = (0.90 * 2) * 1.00 / 2 = 0.90
        assert ess == pytest.approx(0.90)
        assert scorer._map_ess_to_score(ess) == 3.5

    def test_three_c_grade_evidence(self, scorer):
        """3 条 C 级证据, 目标 4 分"""
        layer = _make_layer("l0", "STEEP", evidence_count=3, source_grades=["C", "C", "C"], target_score=4)
        ess = scorer._calculate_ess(layer)
        # ESS = (0.78 * 3) * 1.10 / 3 = 0.858
        assert ess == pytest.approx(0.858, abs=0.01)
        assert scorer._map_ess_to_score(ess) == 3.5

    def test_ess_to_confidence_mapping(self, scorer):
        """ESS → 置信度映射"""
        assert scorer._map_ess_to_confidence(1.20) == ConfidenceLevel.FIVE_STAR
        assert scorer._map_ess_to_confidence(1.00) == ConfidenceLevel.FOUR_STAR
        assert scorer._map_ess_to_confidence(0.80) == ConfidenceLevel.THREE_HALF
        assert scorer._map_ess_to_confidence(0.60) == ConfidenceLevel.TWO_STAR
        assert scorer._map_ess_to_confidence(0.40) == ConfidenceLevel.ONE_STAR
        assert scorer._map_ess_to_confidence(0.20) == ConfidenceLevel.HALF_STAR
        assert scorer._map_ess_to_confidence(0.10) == ConfidenceLevel.NOT_AVAILABLE


# ===========================================================================
#  维度 3: 置信度等级
# ===========================================================================

class TestConfidenceLevel:
    """置信度等级评分测试"""

    def test_high_confidence_all_layers(self, scorer):
        """所有层高置信度 → 评分 5.0"""
        layers = _make_full_compliant_layers()
        for layer in layers:
            layer.confidence = 4.5
        score = scorer._score_confidence_level(layers)
        assert score == 5.0

    def test_medium_confidence(self, scorer):
        """中等置信度 (~3.5) → 评分 4.0"""
        layers = _make_full_compliant_layers()
        for layer in layers:
            layer.confidence = 3.5
        score = scorer._score_confidence_level(layers)
        assert score == 4.0

    def test_low_confidence(self, scorer):
        """低置信度 (~2.0) → 评分 3.0"""
        layers = _make_full_compliant_layers()
        for layer in layers:
            layer.confidence = 2.0
        score = scorer._score_confidence_level(layers)
        assert score == 3.0

    def test_very_low_confidence(self, scorer):
        """极低置信度 (~1.0) → 评分 2.0"""
        layers = _make_full_compliant_layers()
        for layer in layers:
            layer.confidence = 1.0
        score = scorer._score_confidence_level(layers)
        assert score == 2.0

    def test_blocking_layer_zero_confidence(self, scorer):
        """阻断层置信度强制为 0"""
        layers = _make_full_compliant_layers()
        layers[4].is_blocking = True
        layers[4].missing_fields = ["revenue"]
        layers[4].confidence = 4.0
        score = scorer._score_confidence_level(layers)
        # l3f 权重 0.12, 原来贡献 4.0*0.12=0.48, 现在 0*0.12=0
        # 其余层置信度: lMinus1=4.0, l0=4.0, l1=4.0, l2=3.5, l3v=4.0, l4=3.5, l5=3.5, l6=3.5, l7=4.0, l8=4.0
        # 原总 = 4.0*0.08 + 4.0*0.07 + 4.0*0.15 + 3.5*0.08 + 4.0*0.12 + 4.0*0.10 + 3.5*0.08 + 3.5*0.05 + 3.5*0.07 + 4.0*0.12 + 4.0*0.08 = 3.86
        # 新总 = 3.86 - 0.48 = 3.38
        # aggregate = 3.38 / 1.0 = 3.38 → >= 2.0 → 3.0
        assert score == 3.0

    def test_weighted_aggregation(self, scorer):
        """验证权重聚合计算正确"""
        layers = [
            _make_layer("l1", "护城河", confidence=5.0),    # 权重 0.15
            _make_layer("l7", "第二曲线", confidence=5.0),   # 权重 0.15
            _make_layer("l0", "STEEP", confidence=2.0),     # 权重 0.10
            _make_layer("l8", "技术筹码", confidence=2.0),   # 权重 0.08
        ]
        score = scorer._score_confidence_level(layers)
        # weighted = 5*0.15 + 5*0.15 + 2*0.10 + 2*0.08 = 0.75+0.75+0.20+0.16 = 1.86
        # total_weight = 0.15+0.15+0.10+0.08 = 0.48
        # aggregate = 1.86 / 0.48 = 3.875 → >= 3.5 → 4.0
        assert score == 4.0


# ===========================================================================
#  维度 4: V6-LLM 一致性
# ===========================================================================

class TestConsistency:
    """V6-LLM 一致性评分测试"""

    def test_identical_scores(self, scorer):
        """V6=LLM → 偏差 0 → 5.0"""
        score, dev = scorer._score_consistency(3.8, 3.8)
        assert score == 5.0
        assert dev == 0.0

    def test_small_deviation(self, scorer):
        """偏差 0.2 → 5.0"""
        score, dev = scorer._score_consistency(3.8, 3.6)
        assert score == 5.0
        assert dev == pytest.approx(0.2)

    def test_moderate_deviation(self, scorer):
        """偏差 0.4 → 4.0"""
        score, dev = scorer._score_consistency(4.0, 3.6)
        assert score == 4.0
        assert dev == pytest.approx(0.4)

    def test_large_deviation(self, scorer):
        """偏差 0.8 → 2.5"""
        score, dev = scorer._score_consistency(4.0, 3.2)
        assert score == 2.5
        assert dev == pytest.approx(0.8)

    def test_severe_deviation(self, scorer):
        """偏差 1.5 → 1.0"""
        score, dev = scorer._score_consistency(4.5, 3.0)
        assert score == 1.0
        assert dev == pytest.approx(1.5)

    def test_v6_only(self, scorer):
        """仅有 V6 评分 → 3.5"""
        score, dev = scorer._score_consistency(3.8, None)
        assert score == 3.5
        assert dev is None

    def test_llm_only(self, scorer):
        """仅有 LLM 评分 → 3.0"""
        score, dev = scorer._score_consistency(None, 3.6)
        assert score == 3.0
        assert dev is None

    def test_no_scores(self, scorer):
        """双轨均无 → 0.0"""
        score, dev = scorer._score_consistency(None, None)
        assert score == 0.0
        assert dev is None

    def test_boundary_0_3(self, scorer):
        """边界: 偏差正好 0.3 → 5.0"""
        score, dev = scorer._score_consistency(4.0, 3.7)
        assert score == 5.0

    def test_boundary_0_5(self, scorer):
        """边界: 偏差正好 0.5 → 4.0"""
        score, dev = scorer._score_consistency(4.0, 3.5)
        assert score == 4.0

    def test_boundary_1_0(self, scorer):
        """边界: 偏差正好 1.0 → 2.5"""
        score, dev = scorer._score_consistency(4.0, 3.0)
        assert score == 2.5


# ===========================================================================
#  维度 5: 规范遵循度
# ===========================================================================

class TestSpecAdherence:
    """规范遵循度评分测试"""

    def test_all_compliant(self, scorer):
        """11 层全部合规 → 5.0"""
        layers = _make_full_compliant_layers()
        score, spec_map = scorer._score_spec_adherence(layers)
        assert score == 5.0
        assert all(spec_map.values())

    def test_one_non_compliant(self, scorer):
        """1 层不合规 → (10/11)*5 ≈ 4.55"""
        layers = _make_full_compliant_layers()
        # 让 L0 不合规 — 移除 STEEP 维度
        layers[1].spec_fields = {"S": 8}
        score, spec_map = scorer._score_spec_adherence(layers)
        assert score == pytest.approx(10 / 11 * 5, abs=0.01)
        assert not spec_map["l0"]

    def test_missing_layer_not_compliant(self, scorer):
        """缺失的层视为不合规"""
        layers = _make_full_compliant_layers()
        layers = layers[1:]  # 去掉 lMinus1
        score, spec_map = scorer._score_spec_adherence(layers)
        assert not spec_map["lMinus1"]
        assert score == pytest.approx(10 / 11 * 5, abs=0.01)

    def test_blocking_layer_not_compliant(self, scorer):
        """阻断层不合规"""
        layers = _make_full_compliant_layers()
        layers[4].is_blocking = True
        layers[4].missing_fields = ["revenue"]
        score, spec_map = scorer._score_spec_adherence(layers)
        assert not spec_map["l3f"]

    # --- 逐层校验器测试 ---

    def test_check_l_minus_1_pass(self, scorer):
        """L-1 合规: 注入 + 关联度 >= 0.5"""
        layer = _make_layer("lMinus1", "行业", spec_fields={"industry_score_injected": True, "correlation": 0.7})
        assert scorer._check_layer_spec(layer) is True

    def test_check_l_minus_1_fail_no_injection(self, scorer):
        """L-1 不合规: 未注入"""
        layer = _make_layer("lMinus1", "行业", spec_fields={"industry_score_injected": False, "correlation": 0.7})
        assert scorer._check_layer_spec(layer) is False

    def test_check_l_minus_1_fail_low_correlation(self, scorer):
        """L-1 不合规: 关联度 < 0.5"""
        layer = _make_layer("lMinus1", "行业", spec_fields={"industry_score_injected": True, "correlation": 0.3})
        assert scorer._check_layer_spec(layer) is False

    def test_check_l0_pass(self, scorer):
        """L0 合规: STEEP 五维全覆盖"""
        sf = {"S": 8, "T": 9, "E_economy": 7, "E_environment": 6, "P": 8}
        layer = _make_layer("l0", "STEEP", spec_fields=sf)
        assert scorer._check_layer_spec(layer) is True

    def test_check_l0_fail_missing_dim(self, scorer):
        """L0 不合规: 缺 P 维度"""
        sf = {"S": 8, "T": 9, "E_economy": 7, "E_environment": 6}
        layer = _make_layer("l0", "STEEP", spec_fields=sf)
        assert scorer._check_layer_spec(layer) is False

    def test_check_l1_pass(self, scorer):
        """L1 合规: 类型 + 强度"""
        layer = _make_layer("l1", "护城河", spec_fields={"moat_type": "技术独占性", "strength": "高"})
        assert scorer._check_layer_spec(layer) is True

    def test_check_l3f_fail_missing_cashflow(self, scorer):
        """L3f 不合规: 缺现金流"""
        layer = _make_layer("l3f", "财务", spec_fields={"revenue": 10, "net_profit": 2})
        assert scorer._check_layer_spec(layer) is False

    def test_check_l4_pass(self, scorer):
        """L4 合规: 三情景 + 收益比"""
        sf = {"scenarios": {"bull": 15, "base": 10, "bear": 5}, "return_ratio": 2.5}
        layer = _make_layer("l4", "情景", spec_fields=sf)
        assert scorer._check_layer_spec(layer) is True

    def test_check_l4_fail_missing_bear(self, scorer):
        """L4 不合规: 缺熊市情景"""
        sf = {"scenarios": {"bull": 15, "base": 10}, "return_ratio": 2.5}
        layer = _make_layer("l4", "情景", spec_fields=sf)
        assert scorer._check_layer_spec(layer) is False

    def test_check_l5_pass(self, scorer):
        """L5 合规: 双轴有效"""
        layer = _make_layer("l5", "T-M", spec_fields={"tech_maturity": 65, "market_maturity": 45})
        assert scorer._check_layer_spec(layer) is True

    def test_check_l5_fail_out_of_range(self, scorer):
        """L5 不合规: 成熟度越界"""
        layer = _make_layer("l5", "T-M", spec_fields={"tech_maturity": 150, "market_maturity": 45})
        assert scorer._check_layer_spec(layer) is False

    def test_check_l8_pass(self, scorer):
        """L8 合规: 技术指标 + 资金面 + 筹码"""
        sf = {
            "tech_indicators": {"macd": 0.5},
            "capital_flow": {"north": 1.2},
            "chip_analysis": {"concentration": "low"},
        }
        layer = _make_layer("l8", "技术筹码", spec_fields=sf)
        assert scorer._check_layer_spec(layer) is True

    def test_check_l8_fail_missing_chip(self, scorer):
        """L8 不合规: 缺筹码分析"""
        sf = {"tech_indicators": {"macd": 0.5}, "capital_flow": {"north": 1.2}}
        layer = _make_layer("l8", "技术筹码", spec_fields=sf)
        assert scorer._check_layer_spec(layer) is False


# ===========================================================================
#  综合评分 & 评级
# ===========================================================================

class TestOverallScoring:
    """综合评分与评级测试"""

    def test_full_pass_scenario(self, scorer):
        """全合规场景 → PASS"""
        layers = _make_full_compliant_layers()
        result = scorer.score(
            symbol="300413",
            layers=layers,
            v6_score=3.8,
            llm_score=3.6,
            timestamp="2026-08-09T10:00:00",
        )
        assert result.rating == ComplianceRating.PASS
        assert result.overall_compliance >= 4.0
        assert len(result.layer_compliance) == 11
        assert len(result.recommendations) > 0

    def test_fail_scenario_missing_layers(self, scorer):
        """大量缺失 → FAIL"""
        layers = _make_full_compliant_layers()[:4]  # 仅 4 层
        result = scorer.score(
            symbol="000001",
            layers=layers,
            v6_score=2.0,
            llm_score=4.0,  # 严重偏差
            timestamp="2026-08-09",
        )
        assert result.rating == ComplianceRating.FAIL
        assert result.overall_compliance < 3.0

    def test_conditional_scenario(self, scorer):
        """部分不合规 → CONDITIONAL"""
        layers = _make_full_compliant_layers()
        # 降低证据质量和置信度
        for layer in layers:
            layer.evidence_count = 1
            layer.source_grades = ["D"]
            layer.confidence = 2.0
        result = scorer.score(
            symbol="600000",
            layers=layers,
            v6_score=3.0,
            llm_score=None,  # 单轨
            timestamp="2026-08-09",
        )
        assert result.rating == ComplianceRating.CONDITIONAL
        assert 3.0 <= result.overall_compliance < 4.0

    def test_weighted_sum_correctness(self, scorer):
        """验证加权求和计算正确"""
        layers = _make_full_compliant_layers()
        result = scorer.score("TEST", layers, v6_score=4.0, llm_score=4.0, timestamp="")

        expected = (
            result.layer_coverage_score * 0.20
            + result.evidence_sufficiency_score * 0.25
            + result.confidence_level_score * 0.20
            + result.consistency_score * 0.15
            + result.spec_adherence_score * 0.20
        )
        assert result.overall_compliance == pytest.approx(expected, abs=0.01)

    def test_to_dict_serialization(self, scorer):
        """测试 to_dict 序列化"""
        layers = _make_full_compliant_layers()
        result = scorer.score("300413", layers, v6_score=3.8, llm_score=3.6, timestamp="2026-08-09")
        d = result.to_dict()

        assert d["symbol"] == "300413"
        assert "dimensions" in d
        assert "overall_compliance" in d
        assert "rating" in d
        assert "layer_compliance" in d
        assert len(d["layer_compliance"]) == 11
        assert d["v6_score"] == 3.8
        assert d["llm_score"] == 3.6

    def test_blocking_layer_impact(self, scorer):
        """阻断层对综合评分的影响"""
        layers = _make_full_compliant_layers()
        result_before = scorer.score("TEST", layers, v6_score=3.8, llm_score=3.6, timestamp="")

        # 设置 L3f 为阻断
        layers[4].is_blocking = True
        layers[4].missing_fields = ["revenue", "net_profit"]
        result_after = scorer.score("TEST", layers, v6_score=3.8, llm_score=3.6, timestamp="")

        assert result_after.overall_compliance < result_before.overall_compliance


# ===========================================================================
#  工具方法
# ===========================================================================

class TestUtilityMethods:
    """工具方法测试"""

    def test_confidence_to_stars(self):
        """置信度 → 星级标签"""
        assert DesignComplianceScorer.confidence_to_stars(5.0) == "★★★★★"
        assert DesignComplianceScorer.confidence_to_stars(4.5) == "★★★★★"
        assert DesignComplianceScorer.confidence_to_stars(4.0) == "★★★★☆"
        assert DesignComplianceScorer.confidence_to_stars(3.5) == "★★★★☆"
        assert DesignComplianceScorer.confidence_to_stars(3.0) == "★★★☆☆"
        assert DesignComplianceScorer.confidence_to_stars(2.0) == "★★☆☆☆"
        assert DesignComplianceScorer.confidence_to_stars(1.0) == "★☆☆☆☆"
        assert DesignComplianceScorer.confidence_to_stars(0.0) == "N/D"

    def test_time_decay_no_decay(self):
        """数据新鲜 → 无折损"""
        weight = DesignComplianceScorer.apply_time_decay("A", 0)
        assert weight == pytest.approx(1.0)

    def test_time_decay_half_life_a(self):
        """A 级数据 365 天 → 折损一半"""
        weight = DesignComplianceScorer.apply_time_decay("A", 365)
        assert weight == pytest.approx(0.5, abs=0.01)

    def test_time_decay_expired(self):
        """数据过期 → 折损为 0"""
        weight = DesignComplianceScorer.apply_time_decay("E", 200)
        assert weight == 0.0

    def test_time_decay_d_grade(self):
        """D 级数据 90 天 → 折损 50%"""
        weight = DesignComplianceScorer.apply_time_decay("D", 90)
        assert weight == pytest.approx(0.30, abs=0.01)  # 0.60 * 0.50 = 0.30

    def test_summary_output(self, scorer):
        """摘要文本生成"""
        layers = _make_full_compliant_layers()
        result = scorer.score("300413", layers, v6_score=3.8, llm_score=3.6, timestamp="2026-08-09")
        summary = scorer.summary(result)

        assert "V6 合规评分报告" in summary
        assert "300413" in summary
        assert "层覆盖度" in summary
        assert "证据充分度" in summary
        assert "置信度等级" in summary
        assert "V6-LLM一致性" in summary
        assert "规范遵循度" in summary
        assert "综合合规分" in summary
        assert "合规评级" in summary
        assert "逐层合规明细" in summary
        assert "改进建议" in summary


# ===========================================================================
#  边界条件
# ===========================================================================

class TestEdgeCases:
    """边界条件测试"""

    def test_empty_layers_raises(self, scorer):
        """空 layers → 抛出 ValueError"""
        with pytest.raises(ValueError, match="layers 不能为空"):
            scorer.score("TEST", [], v6_score=3.0, llm_score=3.0, timestamp="")

    def test_single_layer(self, scorer):
        """仅 1 层 → 评分低但不崩溃"""
        layer = _make_layer("l0", "STEEP", spec_fields={"S": 8, "T": 9, "E_economy": 7, "E_environment": 6, "P": 8})
        result = scorer.score("TEST", [layer], v6_score=3.0, llm_score=3.0, timestamp="")
        assert result.overall_compliance < 3.0
        assert result.rating == ComplianceRating.FAIL

    def test_no_v6_no_llm(self, scorer):
        """无 V6 无 LLM → 一致性 0"""
        layers = _make_full_compliant_layers()
        result = scorer.score("TEST", layers, v6_score=None, llm_score=None, timestamp="")
        assert result.consistency_score == 0.0
        assert result.v6_llm_deviation is None

    def test_unknown_layer_id(self, scorer):
        """未知层级 ID → 规范校验回退到 score > 0"""
        layer = _make_layer("unknown", "未知层", score=3.0, spec_fields={})
        compliant = scorer._check_layer_spec(layer)
        assert compliant is True

        layer.score = 0.0
        compliant = scorer._check_layer_spec(layer)
        assert compliant is False

    def test_extreme_scores(self, scorer):
        """极端评分: V6=5.0, LLM=0.0 → 偏差 5.0"""
        score, dev = DesignComplianceScorer()._score_consistency(5.0, 0.0)
        assert score == 1.0
        assert dev == 5.0

    def test_all_blocking_layers(self, scorer):
        """所有层都阻断 → 评分极低"""
        layers = _make_full_compliant_layers()
        for layer in layers:
            layer.is_blocking = True
            layer.missing_fields = ["critical_field"]
        result = scorer.score("TEST", layers, v6_score=3.0, llm_score=3.0, timestamp="")
        assert result.rating == ComplianceRating.FAIL
        assert result.layer_coverage_score < 2.0
        assert result.spec_adherence_score == 0.0

    def test_min_evidence_by_target(self, scorer):
        """目标评分 → 最低证据数映射"""
        assert scorer.MIN_EVIDENCE_BY_TARGET[5] == 4
        assert scorer.MIN_EVIDENCE_BY_TARGET[4] == 3
        assert scorer.MIN_EVIDENCE_BY_TARGET[3] == 2
        assert scorer.MIN_EVIDENCE_BY_TARGET[2] == 1
        assert scorer.MIN_EVIDENCE_BY_TARGET[1] == 1

    def test_dimension_weights_sum_to_one(self, scorer):
        """五维度权重之和 = 1.0"""
        total = sum(scorer.DIMENSION_WEIGHTS.values())
        assert total == pytest.approx(1.0)

    def test_layer_weights_sum_to_one(self, scorer):
        """层级权重之和 = 1.0"""
        total = sum(scorer.LAYER_WEIGHTS.values())
        assert total == pytest.approx(1.0)

    def test_v6_layers_count(self, scorer):
        """V6 层级数 = 11"""
        assert len(scorer.V6_LAYERS) == 11


# ===========================================================================
#  集成测试
# ===========================================================================

class TestIntegration:
    """端到端集成测试"""

    def test_realistic_scenario_pass(self, scorer):
        """真实场景: 高质量分析 → PASS"""
        layers = _make_full_compliant_layers()
        # 调整为高质量数据
        for layer in layers:
            layer.evidence_count = 4
            layer.source_grades = ["A", "B", "B", "C"]
            layer.confidence = 4.5

        result = scorer.score(
            symbol="300413",
            layers=layers,
            v6_score=4.2,
            llm_score=4.0,
            timestamp="2026-08-09T10:00:00",
        )

        assert result.rating == ComplianceRating.PASS
        assert result.overall_compliance >= 4.5
        assert result.layer_coverage_score == 5.0
        assert result.spec_adherence_score == 5.0
        # 检查是否有"达标"建议
        assert any("达标" in r for r in result.recommendations)

    def test_realistic_scenario_conditional(self, scorer):
        """真实场景: 中等质量 → CONDITIONAL"""
        layers = _make_full_compliant_layers()
        # 2 层不合规
        layers[7].spec_fields = {}  # L5 不合规
        layers[8].spec_fields = {}  # L6 不合规
        # 部分证据不足
        layers[0].evidence_count = 1
        layers[0].source_grades = ["D"]
        layers[0].confidence = 1.0

        result = scorer.score(
            symbol="600519",
            layers=layers,
            v6_score=3.5,
            llm_score=3.0,
            timestamp="2026-08-09",
        )

        assert result.rating == ComplianceRating.CONDITIONAL
        assert 3.0 <= result.overall_compliance < 4.0
        # 应有改进建议
        assert len(result.recommendations) >= 1

    def test_realistic_scenario_fail(self, scorer):
        """真实场景: 低质量 → FAIL"""
        layers = _make_full_compliant_layers()[:6]  # 仅 6 层
        for layer in layers:
            layer.evidence_count = 1
            layer.source_grades = ["E"]
            layer.confidence = 0.5
            layer.spec_fields = {}  # 全不合规

        result = scorer.score(
            symbol="000002",
            layers=layers,
            v6_score=1.5,
            llm_score=4.0,  # 严重偏差
            timestamp="2026-08-09",
        )

        assert result.rating == ComplianceRating.FAIL
        assert result.overall_compliance < 3.0
        assert result.consistency_score == 1.0

    def test_summary_contains_all_layers(self, scorer):
        """摘要包含所有层的明细"""
        layers = _make_full_compliant_layers()
        result = scorer.score("300413", layers, v6_score=3.8, llm_score=3.6, timestamp="2026-08-09")
        summary = scorer.summary(result)

        for _, name in DesignComplianceScorer.V6_LAYERS:
            assert name in summary
