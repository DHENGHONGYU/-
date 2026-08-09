"""
V6 设计合规评分器 (Design Compliance Scorer)
=============================================
依据 V6 股票分析模型设计规范 (v4.3)，对 LLM 分析输出进行五维度加权合规评分。

五维度体系:
    1. 层覆盖度      (20%) — 11 层 (L-1 ~ L8) 是否全部有有效评分
    2. 证据充分度    (25%) — ESS (Evidence Sufficiency Score) 量化
    3. 置信度等级    (20%) — 七级置信度 (★★★★★ → N/D) 聚合
    4. V6-LLM一致性  (15%) — V6 引擎评分与 LLM 评分偏差检测
    5. 规范遵循度    (20%) — 逐层 Rubric 合规校验

评级映射:
    ≥ 4.0  → pass         (通过)
    3.0-3.9 → conditional  (条件通过，需改进)
    < 3.0  → fail          (不通过)

作者: FinSightV9 Team
版本: 1.0.0
日期: 2026-08-09
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# ===========================================================================
#  日志配置
# ===========================================================================

logger = logging.getLogger("V6.ComplianceScorer")


# ===========================================================================
#  枚举定义
# ===========================================================================

class SourceGrade(Enum):
    """数据来源可信度等级 (A-E + 无来源)"""
    A = "A"      # 极高 (0.95-1.00) — 国家统计局、交易所公告、专利局
    B = "B"      # 高   (0.85-0.95) — 经审计年报、招股书、证监会批复
    C = "C"      # 中高 (0.70-0.85) — Gartner/IDC 行业报告、券商研报
    D = "D"      # 中   (0.55-0.70) — 企业调研纪要、专家访谈
    E = "E"      # 低   (0.30-0.55) — 媒体报道、分析师推测
    NONE = "N"   # 不可信 (0.00)    — 无法追溯出处


class ConfidenceLevel(Enum):
    """七级置信度 (★★★★★ → N/D)"""
    FIVE_STAR = 5.0      # ★★★★★ 极高 — ESS ≥ 1.20
    FOUR_STAR = 4.0      # ★★★★  高   — ESS 1.00-1.19
    THREE_HALF = 3.5     # ★★★☆  中高 — ESS 0.80-0.99
    TWO_STAR = 2.0       # ★★☆☆  中   — ESS 0.60-0.79
    ONE_STAR = 1.0       # ★☆☆☆  低   — ESS 0.40-0.59
    HALF_STAR = 0.5      # ☆☆☆☆  极低 — ESS 0.20-0.39
    NOT_AVAILABLE = 0.0  # N/D   无法评分 — ESS < 0.20


class ComplianceRating(Enum):
    """合规评级"""
    PASS = "pass"                # ≥ 4.0
    CONDITIONAL = "conditional"  # 3.0 - 3.9
    FAIL = "fail"                # < 3.0


class LayerId(Enum):
    """V6 模型 11 个层级 ID"""
    L_MINUS_1 = "lMinus1"  # 行业评分估值
    L0 = "l0"              # STEEP 宏观扫描
    L1 = "l1"              # 护城河分析
    L2 = "l2"              # 市场/竞品分析
    L3F = "l3f"            # 财务健康度
    L3V = "l3v"            # 估值水平
    L4 = "l4"              # 情景推演
    L5 = "l5"              # T-M 矩阵
    L6 = "l6"              # Hype Cycle
    L7 = "l7"              # 第二曲线
    L8 = "l8"              # 技术筹码


# ===========================================================================
#  数据类定义
# ===========================================================================

@dataclass
class LayerEvidence:
    """
    单层证据输入 — 描述某一 V6 层的分析证据情况。

    Attributes:
        layer_id:       层级 ID (如 'lMinus1', 'l0', ...)
        layer_name:     层级中文名 (如 '行业评分估值')
        score:          层得分 (0-5)
        confidence:     置信度星级数值 (0-5, 对应 ConfidenceLevel)
        evidence_count: 证据条数
        source_grades:  证据来源等级列表 (如 ['A', 'B', 'C'])
        target_score:   目标评分等级 (1-5), 决定最低证据数要求
        missing_fields: 缺失字段列表
        is_blocking:    是否含缺失阻断指标 (该层是否被强制降级)
        spec_fields:    规范校验字段 (各层特定, 见 _check_layer_spec)
    """
    layer_id: str
    layer_name: str
    score: float
    confidence: float
    evidence_count: int
    source_grades: list[str]
    target_score: int = 3
    missing_fields: list[str] = field(default_factory=list)
    is_blocking: bool = False
    spec_fields: dict = field(default_factory=dict)


@dataclass
class LayerComplianceDetail:
    """逐层合规明细 — 合规评分器对每层的评价结果"""
    layer_id: str
    layer_name: str
    score: float                   # 层得分 (0-5)
    confidence: float              # 置信度星级 (0-5)
    confidence_label: str          # 置信度标签 (如 '★★★★☆')
    evidence_count: int            # 证据条数
    source_grades: list[str]       # 来源等级列表
    ess_score: float               # ESS 证据充分度
    spec_compliant: bool           # 是否符合规范
    missing_fields: list[str]      # 缺失字段
    recommendations: list[str]     # 改进建议


@dataclass
class ComplianceScoreResult:
    """合规评分最终结果"""
    # 五维度得分 (0-5 分制)
    layer_coverage_score: float        # 层覆盖度
    evidence_sufficiency_score: float  # 证据充分度
    confidence_level_score: float      # 置信度等级
    consistency_score: float           # V6-LLM 一致性
    spec_adherence_score: float        # 规范遵循度

    # 综合合规分 (加权求和, 0-5)
    overall_compliance: float

    # 合规评级
    rating: ComplianceRating

    # 逐层合规明细
    layer_compliance: list[LayerComplianceDetail]

    # 改进建议
    recommendations: list[str]

    # 元数据
    symbol: str
    timestamp: str
    v6_score: Optional[float] = None
    llm_score: Optional[float] = None
    v6_llm_deviation: Optional[float] = None

    def to_dict(self) -> dict:
        """转换为字典 (便于序列化)"""
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "dimensions": {
                "layer_coverage": round(self.layer_coverage_score, 2),
                "evidence_sufficiency": round(self.evidence_sufficiency_score, 2),
                "confidence_level": round(self.confidence_level_score, 2),
                "consistency": round(self.consistency_score, 2),
                "spec_adherence": round(self.spec_adherence_score, 2),
            },
            "overall_compliance": round(self.overall_compliance, 2),
            "rating": self.rating.value,
            "v6_score": self.v6_score,
            "llm_score": self.llm_score,
            "v6_llm_deviation": round(self.v6_llm_deviation, 3) if self.v6_llm_deviation else None,
            "layer_compliance": [
                {
                    "layer_id": lc.layer_id,
                    "layer_name": lc.layer_name,
                    "score": lc.score,
                    "confidence": lc.confidence,
                    "confidence_label": lc.confidence_label,
                    "evidence_count": lc.evidence_count,
                    "source_grades": lc.source_grades,
                    "ess_score": round(lc.ess_score, 3),
                    "spec_compliant": lc.spec_compliant,
                    "missing_fields": lc.missing_fields,
                    "recommendations": lc.recommendations,
                }
                for lc in self.layer_compliance
            ],
            "recommendations": self.recommendations,
        }


# ===========================================================================
#  核心评分器
# ===========================================================================

class DesignComplianceScorer:
    """
    V6 设计合规评分器

    对 LLM 分析输出进行五维度加权合规评分，判定分析是否满足 V6 模型设计要求。

    使用示例::

        scorer = DesignComplianceScorer()

        layers = [
            LayerEvidence(
                layer_id="lMinus1",
                layer_name="行业评分估值",
                score=4.5,
                confidence=4.0,
                evidence_count=3,
                source_grades=["C", "C", "D"],
                target_score=4,
                spec_fields={"industry_score_injected": True, "correlation": 0.9},
            ),
            # ... 其余 10 层
        ]

        result = scorer.score(
            symbol="300413",
            layers=layers,
            v6_score=3.8,
            llm_score=3.6,
            timestamp="2026-08-09T10:00:00",
        )

        print(result.rating)           # ComplianceRating.PASS
        print(result.overall_compliance) # 4.12
    """

    # --- 五维度权重 ---
    DIMENSION_WEIGHTS: dict[str, float] = {
        "layer_coverage": 0.20,        # 层覆盖度
        "evidence_sufficiency": 0.25,  # 证据充分度
        "confidence_level": 0.20,      # 置信度等级
        "consistency": 0.15,           # V6-LLM 一致性
        "spec_adherence": 0.20,        # 规范遵循度
    }

    # --- V6 层级定义 (11 层) ---
    V6_LAYERS: list[tuple[str, str]] = [
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

    # --- V6 层级权重 (用于置信度聚合, 总和=1.0) ---
    LAYER_WEIGHTS: dict[str, float] = {
        "lMinus1": 0.08,  # 行业评分估值
        "l0": 0.07,       # STEEP 宏观扫描
        "l1": 0.15,       # 护城河分析 (核心)
        "l2": 0.08,       # 市场/竞品分析
        "l3f": 0.12,      # 财务健康度 (确定性层)
        "l3v": 0.10,      # 估值水平
        "l4": 0.08,       # 情景推演
        "l5": 0.05,       # T-M 矩阵
        "l6": 0.07,       # Hype Cycle
        "l7": 0.12,       # 第二曲线 (核心)
        "l8": 0.08,       # 技术筹码
    }

    # --- 来源等级 → 量化权重 ---
    SOURCE_GRADE_WEIGHTS: dict[str, float] = {
        "A": 1.00,
        "B": 0.90,
        "C": 0.78,
        "D": 0.60,
        "E": 0.40,
        "N": 0.00,
    }

    # --- 证据数量 → 系数 ---
    EVIDENCE_COUNT_COEFFICIENTS: list[tuple[int, float]] = [
        (4, 1.20),   # n >= 4 → 1.20 (超额验证)
        (3, 1.10),   # n == 3 → 1.10 (充分)
        (2, 1.00),   # n == 2 → 1.00 (达标)
        (1, 0.60),   # n == 1 → 0.60 (不足)
        (0, 0.00),   # n == 0 → 0.00 (无证据)
    ]

    # --- 目标评分等级 → 最低证据数 ---
    MIN_EVIDENCE_BY_TARGET: dict[int, int] = {
        5: 4,  # 目标 5 分 → 最低 4 条 (至少 1A + 1B)
        4: 3,  # 目标 4 分 → 最低 3 条 (至少 1B)
        3: 2,  # 目标 3 分 → 最低 2 条 (至少 2C)
        2: 1,  # 目标 2 分 → 最低 1 条
        1: 1,  # 目标 1 分 → 最低 1 条
    }

    # --- ESS → 置信度星级映射 ---
    ESS_TO_CONFIDENCE: list[tuple[float, ConfidenceLevel]] = [
        (1.20, ConfidenceLevel.FIVE_STAR),
        (1.00, ConfidenceLevel.FOUR_STAR),
        (0.80, ConfidenceLevel.THREE_HALF),
        (0.60, ConfidenceLevel.TWO_STAR),
        (0.40, ConfidenceLevel.ONE_STAR),
        (0.20, ConfidenceLevel.HALF_STAR),
        (0.00, ConfidenceLevel.NOT_AVAILABLE),
    ]

    # --- ESS → 评分 (0-5) 映射 ---
    ESS_TO_SCORE: list[tuple[float, float]] = [
        (1.20, 5.0),
        (1.00, 4.0),
        (0.80, 3.5),
        (0.60, 2.0),
        (0.40, 1.0),
        (0.20, 0.5),
        (0.00, 0.0),
    ]

    # --- V6-LLM 偏差 → 评分映射 ---
    CONSISTENCY_MAP: list[tuple[float, float]] = [
        (0.3, 5.0),          # |dev| <= 0.3 → 5.0
        (0.5, 4.0),          # 0.3 < |dev| <= 0.5 → 4.0
        (1.0, 2.5),          # 0.5 < |dev| <= 1.0 → 2.5
        (math.inf, 1.0),     # |dev| > 1.0 → 1.0
    ]

    # --- 评级阈值 ---
    PASS_THRESHOLD: float = 4.0
    CONDITIONAL_THRESHOLD: float = 3.0

    # --- 置信度星级标签 ---
    CONFIDENCE_LABELS: dict[float, str] = {
        5.0: "★★★★★",
        4.0: "★★★★☆",
        3.5: "★★★☆☆",
        2.0: "★★☆☆☆",
        1.0: "★☆☆☆☆",
        0.5: "☆☆☆☆☆",
        0.0: "N/D",
    }

    # =======================================================================
    #  公共接口
    # =======================================================================

    def score(
        self,
        symbol: str,
        layers: list[LayerEvidence],
        v6_score: Optional[float] = None,
        llm_score: Optional[float] = None,
        timestamp: str = "",
    ) -> ComplianceScoreResult:
        """
        执行五维度合规评分。

        Args:
            symbol:    股票代码
            layers:    11 层证据列表 (LayerEvidence)
            v6_score:  V6 引擎综合评分 (0-5), None 表示无 V6 评分
            llm_score: LLM 智能评分 (0-5), None 表示无 LLM 评分
            timestamp: 评分时间戳

        Returns:
            ComplianceScoreResult: 合规评分结果
        """
        if not layers:
            raise ValueError("layers 不能为空")

        logger.info(
            "===== 合规评分开始 | symbol=%s | layers=%d | v6=%s | llm=%s =====",
            symbol, len(layers),
            v6_score if v6_score is not None else "N/A",
            llm_score if llm_score is not None else "N/A",
        )

        # 维度 1: 层覆盖度
        layer_coverage = self._score_layer_coverage(layers)

        # 维度 2: 证据充分度 (ESS)
        evidence_sufficiency, layer_ess_map = self._score_evidence_sufficiency(layers)

        # 维度 3: 置信度等级
        confidence_level = self._score_confidence_level(layers)

        # 维度 4: V6-LLM 一致性
        consistency, deviation = self._score_consistency(v6_score, llm_score)

        # 维度 5: 规范遵循度
        spec_adherence, layer_spec_map = self._score_spec_adherence(layers)

        # 综合合规分 (加权求和)
        w = self.DIMENSION_WEIGHTS
        contrib_coverage = layer_coverage * w["layer_coverage"]
        contrib_ess = evidence_sufficiency * w["evidence_sufficiency"]
        contrib_conf = confidence_level * w["confidence_level"]
        contrib_cons = consistency * w["consistency"]
        contrib_spec = spec_adherence * w["spec_adherence"]
        overall = (
            contrib_coverage
            + contrib_ess
            + contrib_conf
            + contrib_cons
            + contrib_spec
        )

        # 评级映射
        rating = self._map_rating(overall)

        logger.info(
            "===== 合规评分完成 | symbol=%s | overall=%.4f | rating=%s =====",
            symbol, overall, rating.value,
        )
        logger.info(
            "  维度明细: 覆盖度=%.2f(%.0f%%) | ESS=%.2f(%.0f%%) | 置信度=%.2f(%.0f%%) | 一致性=%.2f(%.0f%%) | 规范=%.2f(%.0f%%)",
            layer_coverage, w["layer_coverage"] * 100,
            evidence_sufficiency, w["evidence_sufficiency"] * 100,
            confidence_level, w["confidence_level"] * 100,
            consistency, w["consistency"] * 100,
            spec_adherence, w["spec_adherence"] * 100,
        )
        logger.info(
            "  加权贡献: 覆盖度=%.4f + ESS=%.4f + 置信度=%.4f + 一致性=%.4f + 规范=%.4f = %.4f",
            contrib_coverage, contrib_ess, contrib_conf,
            contrib_cons, contrib_spec, overall,
        )

        # 逐层合规明细
        layer_details = self._build_layer_details(
            layers, layer_ess_map, layer_spec_map
        )

        # 改进建议
        recommendations = self._generate_recommendations(
            layer_coverage, evidence_sufficiency, confidence_level,
            consistency, spec_adherence, layers, deviation,
        )

        return ComplianceScoreResult(
            layer_coverage_score=layer_coverage,
            evidence_sufficiency_score=evidence_sufficiency,
            confidence_level_score=confidence_level,
            consistency_score=consistency,
            spec_adherence_score=spec_adherence,
            overall_compliance=overall,
            rating=rating,
            layer_compliance=layer_details,
            recommendations=recommendations,
            symbol=symbol,
            timestamp=timestamp,
            v6_score=v6_score,
            llm_score=llm_score,
            v6_llm_deviation=deviation,
        )

    # =======================================================================
    #  维度 1: 层覆盖度
    # =======================================================================

    def _score_layer_coverage(self, layers: list[LayerEvidence]) -> float:
        """
        层覆盖度评分。

        11 层全覆盖 = 5.0 分, 每缺 1 层扣 0.5 分。

        特殊规则:
        - 含缺失阻断指标 (is_blocking=True) 的层, 若 missing_fields 非空,
          该层视为无效, 不计入覆盖。
        - 覆盖率 <= 7/11 时, 评分上限为 2.0。

        Returns:
            float: 层覆盖度评分 (0-5)
        """
        total = len(self.V6_LAYERS)  # 11
        provided_ids = {
            layer.layer_id for layer in layers
            if not (layer.is_blocking and layer.missing_fields)
        }
        all_v6_ids = {lid for lid, _ in self.V6_LAYERS}

        covered = len(provided_ids & all_v6_ids)
        missing = total - covered

        # 记录阻断层
        blocking_layers = [
            l.layer_id for l in layers if l.is_blocking and l.missing_fields
        ]
        if blocking_layers:
            logger.debug(
                "[维度1-层覆盖度] 阻断层(不计入覆盖): %s",
                ", ".join(blocking_layers),
            )

        # 记录具体缺失的层名
        missing_ids = all_v6_ids - provided_ids
        if missing_ids:
            missing_names = [
                name for lid, name in self.V6_LAYERS if lid in missing_ids
            ]
            logger.debug(
                "[维度1-层覆盖度] 缺失层: %s",
                ", ".join(missing_names) if missing_names else "无",
            )

        if missing == 0:
            score = 5.0
        elif missing == 1:
            score = 4.5
        elif missing == 2:
            score = 4.0
        elif missing == 3:
            score = 3.0
        else:
            # 缺 4+ 层, 覆盖率 <= 7/11
            score = max(0.0, 2.0 - (missing - 3) * 0.5)

        logger.debug(
            "[维度1-层覆盖度] 覆盖=%d/%d, 缺失=%d → 评分=%.2f",
            covered, total, missing, score,
        )
        return score

    # =======================================================================
    #  维度 2: 证据充分度 (ESS)
    # =======================================================================

    def _score_evidence_sufficiency(
        self, layers: list[LayerEvidence]
    ) -> tuple[float, dict[str, float]]:
        """
        证据充分度评分 — 基于 ESS (Evidence Sufficiency Score)。

        ESS 计算公式:
            ESS = (Σ source_weights) × count_coefficient / min_required

        其中:
            - source_weights:    每条证据来源等级对应的权重
            - count_coefficient: 基于证据总数的系数 (n>=4→1.2, n=3→1.1, ...)
            - min_required:      目标评分等级所需的最低证据数

        评分映射:
            ESS >= 1.20 → 5.0
            1.00-1.19   → 4.0
            0.80-0.99   → 3.5
            0.60-0.79   → 2.0
            0.40-0.59   → 1.0
            0.20-0.39   → 0.5
            < 0.20      → 0.0

        Returns:
            (平均ESS评分, 各层ESS字典)
        """
        layer_ess: dict[str, float] = {}
        scores: list[float] = []

        for layer in layers:
            ess = self._calculate_ess(layer)
            layer_ess[layer.layer_id] = ess
            score = self._map_ess_to_score(ess)
            scores.append(score)
            logger.debug(
                "[维度2-ESS] %s(%s): evidence=%d, grades=%s, target=%d → ESS=%.4f → score=%.1f",
                layer.layer_id, layer.layer_name,
                layer.evidence_count, layer.source_grades,
                layer.target_score, ess, score,
            )

        if not scores:
            logger.warning("[维度2-ESS] 无有效层, 评分=0.0")
            return 0.0, {}

        avg_score = sum(scores) / len(scores)
        logger.debug(
            "[维度2-ESS] 平均ESS评分=%.4f (共%d层, min=%.2f, max=%.2f)",
            avg_score, len(scores), min(scores), max(scores),
        )
        return avg_score, layer_ess

    def _calculate_ess(self, layer: LayerEvidence) -> float:
        """
        计算单层 ESS (Evidence Sufficiency Score)。

        Args:
            layer: 单层证据

        Returns:
            float: ESS 值
        """
        n = layer.evidence_count

        # 证据数量系数
        count_coeff = self._get_count_coefficient(n)
        if count_coeff == 0.0:
            logger.debug(
                "[维度2-ESS] %s: evidence_count=%d → count_coeff=0.0, ESS=0.0 (无证据)",
                layer.layer_id, n,
            )
            return 0.0

        # 来源权重之和
        weight_sum = sum(
            self.SOURCE_GRADE_WEIGHTS.get(g, 0.0)
            for g in layer.source_grades
        )

        # 最低证据数 (基于目标评分)
        min_required = self.MIN_EVIDENCE_BY_TARGET.get(layer.target_score, 1)
        if min_required == 0:
            min_required = 1

        # ESS = (Σ weights) × count_coeff / min_required
        ess = (weight_sum * count_coeff) / min_required
        logger.debug(
            "[维度2-ESS] %s: weight_sum=%.2f, count_coeff=%.2f, min_required=%d → ESS=%.4f",
            layer.layer_id, weight_sum, count_coeff, min_required, ess,
        )
        return ess

    def _get_count_coefficient(self, n: int) -> float:
        """获取证据数量系数"""
        for threshold, coeff in self.EVIDENCE_COUNT_COEFFICIENTS:
            if n >= threshold:
                return coeff
        return 0.0

    def _map_ess_to_score(self, ess: float) -> float:
        """ESS → 评分 (0-5) 映射"""
        for threshold, score in self.ESS_TO_SCORE:
            if ess >= threshold:
                return score
        return 0.0

    def _map_ess_to_confidence(self, ess: float) -> ConfidenceLevel:
        """ESS → 置信度星级映射"""
        for threshold, level in self.ESS_TO_CONFIDENCE:
            if ess >= threshold:
                return level
        return ConfidenceLevel.NOT_AVAILABLE

    # =======================================================================
    #  维度 3: 置信度等级
    # =======================================================================

    def _score_confidence_level(self, layers: list[LayerEvidence]) -> float:
        """
        置信度等级评分 — 按层级权重聚合各层置信度。

        聚合公式:
            综合置信度 = Σ(层级置信度 × 层级权重) / Σ(层级权重)

        特殊规则:
        - 含缺失阻断指标 (is_blocking) 的层, 置信度强制为 0 (N/D)
        - 综合置信度 >= ★★★★ (4.0) → 评分 5.0
        - 综合置信度 >= ★★★☆ (3.5) → 评分 4.0
        - 综合置信度 >= ★★☆☆ (2.0) → 评分 3.0
        - 综合置信度 >= ★☆☆☆ (1.0) → 评分 2.0
        - 综合置信度 < 1.0 → 评分 1.0

        Returns:
            float: 置信度等级评分 (0-5)
        """
        weighted_sum = 0.0
        weight_total = 0.0

        for layer in layers:
            weight = self.LAYER_WEIGHTS.get(layer.layer_id, 0.05)

            # 缺失阻断 → 置信度强制为 0
            if layer.is_blocking and layer.missing_fields:
                confidence = 0.0
                logger.debug(
                    "[维度3-置信度] %s(%s): 阻断 → 置信度强制=0.0 (原=%.1f, 权重=%.2f, 贡献=0.0)",
                    layer.layer_id, layer.layer_name,
                    layer.confidence, weight,
                )
            else:
                confidence = layer.confidence
                logger.debug(
                    "[维度3-置信度] %s(%s): 置信度=%.1f, 权重=%.2f → 贡献=%.4f",
                    layer.layer_id, layer.layer_name,
                    confidence, weight, confidence * weight,
                )

            weighted_sum += confidence * weight
            weight_total += weight

        if weight_total == 0:
            logger.warning("[维度3-置信度] 权重总和=0, 评分=0.0")
            return 0.0

        aggregate = weighted_sum / weight_total

        # 聚合置信度 → 评分映射
        if aggregate >= 4.0:
            score = 5.0
        elif aggregate >= 3.5:
            score = 4.0
        elif aggregate >= 2.0:
            score = 3.0
        elif aggregate >= 1.0:
            score = 2.0
        else:
            score = 1.0

        logger.debug(
            "[维度3-置信度] 加权和=%.4f, 权重和=%.4f → 聚合置信度=%.4f → 评分=%.1f",
            weighted_sum, weight_total, aggregate, score,
        )
        return score

    # =======================================================================
    #  维度 4: V6-LLM 一致性
    # =======================================================================

    def _score_consistency(
        self,
        v6_score: Optional[float],
        llm_score: Optional[float],
    ) -> tuple[float, Optional[float]]:
        """
        V6-LLM 一致性评分 — 检测 V6 引擎评分与 LLM 评分的偏差。

        评分映射:
            |dev| <= 0.3  → 5.0 (一致性优秀)
            0.3 < |dev| <= 0.5 → 4.0 (一致性良好)
            0.5 < |dev| <= 1.0 → 2.5 (需人工复核)
            |dev| > 1.0  → 1.0 (严重不一致)

        特殊规则:
        - 仅 V6 评分 (无 LLM): 评分 3.5 (单轨, 无法交叉验证)
        - 仅 LLM 评分 (无 V6): 评分 3.0 (单轨, 数据驱动性不足)
        - 双轨均无: 评分 0.0

        Returns:
            (一致性评分, 偏差值或None)
        """
        if v6_score is None and llm_score is None:
            logger.debug("[维度4-一致性] 双轨均无 → 评分=0.0")
            return 0.0, None

        if v6_score is not None and llm_score is None:
            # 仅 V6 — 无法交叉验证
            logger.debug("[维度4-一致性] 仅V6=%.2f, 无LLM → 评分=3.5 (单轨)", v6_score)
            return 3.5, None

        if v6_score is None and llm_score is not None:
            # 仅 LLM — 数据驱动性不足
            logger.debug("[维度4-一致性] 仅LLM=%.2f, 无V6 → 评分=3.0 (单轨)", llm_score)
            return 3.0, None

        # 双轨都有, 计算偏差
        deviation = abs(v6_score - llm_score)

        for threshold, score in self.CONSISTENCY_MAP:
            if deviation <= threshold:
                logger.debug(
                    "[维度4-一致性] V6=%.2f, LLM=%.2f → 偏差=%.4f ≤ %.1f → 评分=%.1f",
                    v6_score, llm_score, deviation, threshold, score,
                )
                return score, deviation

        logger.debug(
            "[维度4-一致性] V6=%.2f, LLM=%.2f → 偏差=%.4f > 1.0 → 评分=1.0 (严重不一致)",
            v6_score, llm_score, deviation,
        )
        return 1.0, deviation

    # =======================================================================
    #  维度 5: 规范遵循度
    # =======================================================================

    def _score_spec_adherence(
        self, layers: list[LayerEvidence]
    ) -> tuple[float, dict[str, bool]]:
        """
        规范遵循度评分 — 逐层 Rubric 合规校验。

        每层独立校验是否符合 V6 模型设计规范, 全部通过 = 5.0 分。

        评分公式:
            score = (通过层数 / 11) × 5.0

        Returns:
            (规范遵循度评分, 各层合规状态字典)
        """
        layer_spec: dict[str, bool] = {}
        passed = 0
        total = len(self.V6_LAYERS)

        for layer in layers:
            compliant = self._check_layer_spec(layer)
            layer_spec[layer.layer_id] = compliant
            if compliant:
                passed += 1
                logger.debug(
                    "[维度5-规范遵循度] %s(%s): ✓ 合规",
                    layer.layer_id, layer.layer_name,
                )
            else:
                # 判断不合规原因
                if layer.is_blocking and layer.missing_fields:
                    fail_reason = f"阻断层, 缺失字段={layer.missing_fields}"
                elif not layer.spec_fields:
                    fail_reason = "spec_fields 为空"
                else:
                    sf = layer.spec_fields
                    if layer.layer_id == "lMinus1":
                        fail_reason = f"industry_score_injected={sf.get('industry_score_injected')}, correlation={sf.get('correlation')}"
                    elif layer.layer_id == "l0":
                        missing_dims = [d for d in ["S", "T", "E_economy", "E_environment", "P"] if sf.get(d) is None]
                        fail_reason = f"STEEP 缺失维度={missing_dims}"
                    elif layer.layer_id == "l1":
                        fail_reason = f"moat_type={sf.get('moat_type')}, strength={sf.get('strength')}"
                    elif layer.layer_id == "l2":
                        fail_reason = f"segments={sf.get('segments')}, tech_gap={sf.get('tech_gap')}, market_share={sf.get('market_share')}"
                    elif layer.layer_id == "l3f":
                        missing_fin = [k for k in ["revenue", "net_profit", "operating_cashflow"] if sf.get(k) is None]
                        fail_reason = f"财务缺失字段={missing_fin}"
                    elif layer.layer_id == "l3v":
                        fail_reason = f"peg={sf.get('peg')}, industry_pe_range={sf.get('industry_pe_range')}"
                    elif layer.layer_id == "l4":
                        scenarios = sf.get("scenarios", {})
                        missing_scn = [k for k in ["bull", "base", "bear"] if k not in scenarios or scenarios[k] is None]
                        fail_reason = f"情景缺失={missing_scn}, return_ratio={sf.get('return_ratio')}"
                    elif layer.layer_id == "l5":
                        fail_reason = f"tech_maturity={sf.get('tech_maturity')}, market_maturity={sf.get('market_maturity')}"
                    elif layer.layer_id == "l6":
                        fail_reason = f"hype_stage={sf.get('hype_stage')}, investment_strategy={sf.get('investment_strategy')}"
                    elif layer.layer_id == "l7":
                        fail_reason = f"curves={sf.get('curves')}, catalyst_strength={sf.get('catalyst_strength')}"
                    elif layer.layer_id == "l8":
                        fail_reason = f"tech_indicators={'有' if sf.get('tech_indicators') else '无'}, capital_flow={'有' if sf.get('capital_flow') else '无'}, chip_analysis={'有' if sf.get('chip_analysis') else '无'}"
                    else:
                        fail_reason = f"score={layer.score} (未知层校验)"
                logger.debug(
                    "[维度5-规范遵循度] %s(%s): ✗ 不合规 — %s",
                    layer.layer_id, layer.layer_name, fail_reason,
                )

        # 未提供的层视为不合规
        provided_ids = {layer.layer_id for layer in layers}
        for lid, name in self.V6_LAYERS:
            if lid not in provided_ids:
                layer_spec[lid] = False
                logger.debug(
                    "[维度5-规范遵循度] %s(%s): 未提供 → 不合规",
                    lid, name,
                )

        score = (passed / total) * 5.0 if total > 0 else 0.0
        logger.debug(
            "[维度5-规范遵循度] 通过=%d/%d → 评分=%.2f",
            passed, total, score,
        )
        return score, layer_spec

    def _check_layer_spec(self, layer: LayerEvidence) -> bool:
        """
        逐层规范校验 — 检查该层是否符合 V6 设计规范。

        各层校验规则:
            L-1: SKILL-C/SKILL-N 评分已注入, 关联度 >= 0.5
            L0:  STEEP 五维度 (S/T/E/E/P) 全覆盖
            L1:  护城河类型已识别 + 强度评级
            L2:  至少 1 个业务板块 + 技术代差/份额/认证
            L3f: 营收/净利/现金流非空 (缺失阻断)
            L3v: PEG 计算值 + 行业 PE 区间
            L4:  三情景 (牛/基准/熊) + 收益比
            L5:  技术成熟度 + 市场成熟度双轴
            L6:  Gartner 阶段定位 + 投资策略
            L7:  至少 1 条曲线 + 催化剂评级
            L8:  技术指标 + 资金面 + 筹码分析
        """
        sf = layer.spec_fields

        # 缺失阻断层直接不合规
        if layer.is_blocking and layer.missing_fields:
            return False

        checker = self._LAYER_SPEC_CHECKERS.get(layer.layer_id)
        if checker is None:
            return layer.score > 0  # 未知层, 至少要有评分

        return checker(self, sf, layer)

    # --- 逐层规范校验器 ---

    def _check_l_minus_1(self, sf: dict, layer: LayerEvidence) -> bool:
        """L-1 行业评分估值: SKILL-C/SKILL-N 注入 + 关联度 >= 0.5"""
        injected = sf.get("industry_score_injected", False)
        correlation = sf.get("correlation", 0.0)
        return injected and correlation >= 0.5

    def _check_l0(self, sf: dict, layer: LayerEvidence) -> bool:
        """L0 STEEP 宏观: S/T/E/E/P 五维度覆盖"""
        required = ["S", "T", "E_economy", "E_environment", "P"]
        return all(sf.get(dim) is not None for dim in required)

    def _check_l1(self, sf: dict, layer: LayerEvidence) -> bool:
        """L1 护城河: 类型识别 + 强度评级"""
        moat_type = sf.get("moat_type")  # 如 '技术独占性'
        strength = sf.get("strength")    # 如 '极高'/'高'/'中'/'弱'/'无'
        return moat_type is not None and strength is not None

    def _check_l2(self, sf: dict, layer: LayerEvidence) -> bool:
        """L2 竞品: 至少 1 个板块 + 技术代差/份额/认证"""
        segments = sf.get("segments", [])
        has_segment = len(segments) >= 1
        has_comparison = any(
            sf.get(k) is not None
            for k in ("tech_gap", "market_share", "certification")
        )
        return has_segment and has_comparison

    def _check_l3f(self, sf: dict, layer: LayerEvidence) -> bool:
        """L3 财务: 营收/净利/现金流非空 (缺失阻断)"""
        required = ["revenue", "net_profit", "operating_cashflow"]
        return all(sf.get(k) is not None for k in required)

    def _check_l3v(self, sf: dict, layer: LayerEvidence) -> bool:
        """L3 估值: PEG + 行业 PE 区间"""
        peg = sf.get("peg")
        industry_pe = sf.get("industry_pe_range")
        return peg is not None and industry_pe is not None

    def _check_l4(self, sf: dict, layer: LayerEvidence) -> bool:
        """L4 情景: 三情景 (牛/基准/熊) + 收益比"""
        scenarios = sf.get("scenarios", {})
        has_three = all(
            k in scenarios and scenarios[k] is not None
            for k in ("bull", "base", "bear")
        )
        has_ratio = sf.get("return_ratio") is not None
        return has_three and has_ratio

    def _check_l5(self, sf: dict, layer: LayerEvidence) -> bool:
        """L5 T-M: 技术成熟度 + 市场成熟度双轴"""
        tech = sf.get("tech_maturity")
        market = sf.get("market_maturity")
        if tech is None or market is None:
            return False
        return 0 <= tech <= 100 and 0 <= market <= 100

    def _check_l6(self, sf: dict, layer: LayerEvidence) -> bool:
        """L6 Hype: Gartner 阶段定位 + 投资策略"""
        stage = sf.get("hype_stage")       # 如 '技术萌芽期'/'期望膨胀期'/...
        strategy = sf.get("investment_strategy")
        return stage is not None and strategy is not None

    def _check_l7(self, sf: dict, layer: LayerEvidence) -> bool:
        """L7 第二曲线: 至少 1 条曲线 + 催化剂评级"""
        curves = sf.get("curves", [])
        has_curve = len(curves) >= 1
        catalyst = sf.get("catalyst_strength")  # 如 '★' ~ '★★★★★'
        return has_curve and catalyst is not None

    def _check_l8(self, sf: dict, layer: LayerEvidence) -> bool:
        """L8 技术筹码: 技术指标 + 资金面 + 筹码分析"""
        tech_indicators = sf.get("tech_indicators")  # MACD/均线/布林带
        capital_flow = sf.get("capital_flow")        # 北向/主力/融资
        chip_analysis = sf.get("chip_analysis")      # 筹码分布
        return (
            tech_indicators is not None
            and capital_flow is not None
            and chip_analysis is not None
        )

    # 层级 → 校验器映射
    _LAYER_SPEC_CHECKERS: dict[str, any] = {
        "lMinus1": _check_l_minus_1,
        "l0": _check_l0,
        "l1": _check_l1,
        "l2": _check_l2,
        "l3f": _check_l3f,
        "l3v": _check_l3v,
        "l4": _check_l4,
        "l5": _check_l5,
        "l6": _check_l6,
        "l7": _check_l7,
        "l8": _check_l8,
    }

    # =======================================================================
    #  辅助方法
    # =======================================================================

    def _map_rating(self, overall: float) -> ComplianceRating:
        """综合合规分 → 评级映射"""
        if overall >= self.PASS_THRESHOLD:
            return ComplianceRating.PASS
        elif overall >= self.CONDITIONAL_THRESHOLD:
            return ComplianceRating.CONDITIONAL
        else:
            return ComplianceRating.FAIL

    def _build_layer_details(
        self,
        layers: list[LayerEvidence],
        layer_ess: dict[str, float],
        layer_spec: dict[str, bool],
    ) -> list[LayerComplianceDetail]:
        """构建逐层合规明细"""
        details: list[LayerComplianceDetail] = []

        for layer in layers:
            ess = layer_ess.get(layer.layer_id, 0.0)
            spec_ok = layer_spec.get(layer.layer_id, False)

            # 置信度标签
            conf_label = self.CONFIDENCE_LABELS.get(
                round(layer.confidence * 2) / 2, "N/D"
            )

            # 层级改进建议
            recs: list[str] = []
            if not spec_ok:
                recs.append(f"{layer.layer_name}: 不符合 V6 规范, 需检查必填字段")
            if ess < 0.80:
                recs.append(
                    f"{layer.layer_name}: ESS={ess:.2f}, 证据不充分, "
                    f"需补充至 {self.MIN_EVIDENCE_BY_TARGET.get(layer.target_score, 1)} 条以上"
                )
            if layer.missing_fields:
                recs.append(
                    f"{layer.layer_name}: 缺失字段 {', '.join(layer.missing_fields)}"
                )
            if layer.is_blocking:
                recs.append(f"{layer.layer_name}: 含缺失阻断指标, 该层置信度强制为 N/D")

            details.append(LayerComplianceDetail(
                layer_id=layer.layer_id,
                layer_name=layer.layer_name,
                score=layer.score,
                confidence=layer.confidence,
                confidence_label=conf_label,
                evidence_count=layer.evidence_count,
                source_grades=layer.source_grades,
                ess_score=ess,
                spec_compliant=spec_ok,
                missing_fields=layer.missing_fields,
                recommendations=recs,
            ))

        return details

    def _generate_recommendations(
        self,
        layer_coverage: float,
        evidence_sufficiency: float,
        confidence_level: float,
        consistency: float,
        spec_adherence: float,
        layers: list[LayerEvidence],
        deviation: Optional[float],
    ) -> list[str]:
        """生成改进建议"""
        recs: list[str] = []

        # 层覆盖度
        if layer_coverage < 4.0:
            missing_names = [
                name for lid, name in self.V6_LAYERS
                if lid not in {l.layer_id for l in layers}
            ]
            if missing_names:
                recs.append(
                    f"层覆盖度不足 ({layer_coverage:.1f}/5.0), "
                    f"缺失层: {', '.join(missing_names)}"
                )

        # 证据充分度
        if evidence_sufficiency < 3.5:
            weak_layers = [
                l.layer_name for l in layers
                if l.evidence_count < self.MIN_EVIDENCE_BY_TARGET.get(l.target_score, 1)
            ]
            if weak_layers:
                recs.append(
                    f"证据充分度偏低 ({evidence_sufficiency:.1f}/5.0), "
                    f"证据不足层: {', '.join(weak_layers)}"
                )

        # 置信度
        if confidence_level < 3.0:
            low_conf_layers = [
                l.layer_name for l in layers if l.confidence < 2.0
            ]
            if low_conf_layers:
                recs.append(
                    f"置信度偏低 ({confidence_level:.1f}/5.0), "
                    f"低置信层: {', '.join(low_conf_layers)}"
                )

        # 一致性
        if consistency < 3.0 and deviation is not None:
            recs.append(
                f"V6-LLM 一致性偏差过大 (deviation={deviation:.2f}), "
                f"建议检查 LLM 分析是否脱离数据基础或 V6 数据不完整"
            )
        elif consistency <= 3.5 and deviation is None:
            recs.append(
                "仅有单轨评分 (V6 或 LLM), 建议补齐双轨以进行交叉验证"
            )

        # 规范遵循度
        if spec_adherence < 4.0:
            non_compliant = [
                l.layer_name for l in layers
                if not self._check_layer_spec(l)
            ]
            if non_compliant:
                recs.append(
                    f"规范遵循度不足 ({spec_adherence:.1f}/5.0), "
                    f"不合规层: {', '.join(non_compliant)}"
                )

        # 缺失阻断
        blocking_layers = [
            l.layer_name for l in layers
            if l.is_blocking and l.missing_fields
        ]
        if blocking_layers:
            recs.append(
                f"存在缺失阻断层: {', '.join(blocking_layers)}, "
                f"该层置信度强制为 N/D, 建议优先补充数据"
            )

        if not recs:
            recs.append("所有维度均达标, 分析满足 V6 模型设计要求")

        return recs

    # =======================================================================
    #  工具方法
    # =======================================================================

    @staticmethod
    def confidence_to_stars(value: float) -> str:
        """置信度数值 → 星级标签"""
        if value >= 4.5:
            return "★★★★★"
        elif value >= 3.5:
            return "★★★★☆"
        elif value >= 2.5:
            return "★★★☆☆"
        elif value >= 1.5:
            return "★★☆☆☆"
        elif value >= 0.5:
            return "★☆☆☆☆"
        else:
            return "N/D"

    @staticmethod
    def apply_time_decay(
        source_grade: str,
        days_since_data: int,
    ) -> float:
        """
        数据时效性折损 — 计算折损后的实际可信度。

        有效天数:
            A 级: 730 天 (宏观统计类数据时效长)
            B 级: 365 天 (年报每年更新)
            C 级: 365 天
            D 级: 180 天 (调研/访谈时效短)
            E 级: 90 天  (媒体报道时效极短)

        折损规则:
            折损系数 < 0.50 → 置信度自动降一级
            折损系数 < 0.25 → 置信度自动降两级, 标注「数据过时」

        Args:
            source_grade:     来源等级 ('A'-'E')
            days_since_data:  数据距今天数

        Returns:
            float: 折损后的可信度 (0.0-1.0)
        """
        valid_days = {
            "A": 730, "B": 365, "C": 365, "D": 180, "E": 90,
        }
        base_weight = DesignComplianceScorer.SOURCE_GRADE_WEIGHTS.get(
            source_grade, 0.0
        )
        max_days = valid_days.get(source_grade, 365)

        if max_days == 0:
            return 0.0

        decay_coeff = max(0.0, 1.0 - days_since_data / max_days)
        actual_weight = base_weight * decay_coeff
        return actual_weight

    def summary(self, result: ComplianceScoreResult) -> str:
        """
        生成合规评分摘要文本。

        Args:
            result: 合规评分结果

        Returns:
            str: 摘要文本
        """
        lines = [
            f"=== V6 合规评分报告 ===",
            f"标的: {result.symbol}",
            f"时间: {result.timestamp}",
            f"",
            f"【五维度评分】",
            f"  层覆盖度:     {result.layer_coverage_score:.2f} / 5.0  (权重 20%)",
            f"  证据充分度:   {result.evidence_sufficiency_score:.2f} / 5.0  (权重 25%)",
            f"  置信度等级:   {result.confidence_level_score:.2f} / 5.0  (权重 20%)",
            f"  V6-LLM一致性: {result.consistency_score:.2f} / 5.0  (权重 15%)",
            f"  规范遵循度:   {result.spec_adherence_score:.2f} / 5.0  (权重 20%)",
            f"",
            f"【综合合规分】 {result.overall_compliance:.2f} / 5.0",
            f"【合规评级】   {result.rating.value.upper()}",
        ]

        if result.v6_score is not None:
            lines.append(f"【V6 评分】     {result.v6_score:.2f}")
        if result.llm_score is not None:
            lines.append(f"【LLM 评分】    {result.llm_score:.2f}")
        if result.v6_llm_deviation is not None:
            lines.append(f"【偏差】        {result.v6_llm_deviation:.3f}")

        lines.append("")
        lines.append("【逐层合规明细】")
        for lc in result.layer_compliance:
            status = "✓" if lc.spec_compliant else "✗"
            lines.append(
                f"  {status} {lc.layer_name:12s} "
                f"得分={lc.score:.1f} "
                f"置信={lc.confidence_label} "
                f"ESS={lc.ess_score:.2f} "
                f"证据={lc.evidence_count}条 "
                f"来源={lc.source_grades}"
            )
            if lc.missing_fields:
                lines.append(f"      缺失: {', '.join(lc.missing_fields)}")
            for rec in lc.recommendations:
                lines.append(f"      → {rec}")

        lines.append("")
        lines.append("【改进建议】")
        for i, rec in enumerate(result.recommendations, 1):
            lines.append(f"  {i}. {rec}")

        return "\n".join(lines)
