"""
V9 数据采集服务单元测试

覆盖 collect_endpoints.py 的全部 FastAPI 端点与核心辅助函数。
运行方式：
    cd python/data_service
    pytest test_collect_endpoints.py -v
"""

from datetime import datetime
import time

import pytest
from fastapi.testclient import TestClient

from collect_endpoints import (
    app,
    fetch_real_financial_data,
    fetch_individual_info,
    fetch_sector_rotation_scores,
    fetch_tencent_quote,
    fetch_tencent_kline,
    _get_sw_industry_map,
    _normalize_sw_name,
    _normalize_to_100,
    _safe_float,
    _to_tencent_code,
    resolve_sw_industry_code,
    CollectResponse,
    FinancialCollectData,
)


@pytest.fixture
def client() -> TestClient:
    """FastAPI 测试客户端（无需启动真实 HTTP 服务）"""
    return TestClient(app)


# ============================================================
# 健康检查
# ============================================================


class TestHealthCheck:
    """GET /health 端点测试"""

    def test_health_returns_ok(self, client: TestClient) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "v9-data-collector"
        assert "version" in body

    def test_health_response_model_fields(self, client: TestClient) -> None:
        """验证健康检查响应包含所有契约字段"""
        body = client.get("/health").json()
        assert {"status", "service", "version"}.issubset(body.keys())


# ============================================================
# 基础信息采集
# ============================================================


class TestCollectBasic:
    """POST /api/collect/basic 端点测试"""

    def test_basic_success(self, client: TestClient) -> None:
        resp = client.post("/api/collect/basic", json={"symbol": "600519"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["symbol"] == "600519"
        assert body["dimension"] == "basic"
        assert body["records"] == 1
        assert "data" in body
        assert "name" in body["data"]
        assert "price" in body["data"]

    def test_basic_data_fields_complete(self, client: TestClient) -> None:
        """验证 BasicCollectData 字段完整性"""
        body = client.post("/api/collect/basic", json={"symbol": "000001"}).json()
        data = body["data"]
        for field in ("name", "price", "pe", "pb", "roe", "market_cap"):
            assert field in data, f"缺少字段: {field}"

    def test_basic_missing_symbol_field(self, client: TestClient) -> None:
        """缺少 symbol 字段时 FastAPI 应返回 422"""
        resp = client.post("/api/collect/basic", json={})
        assert resp.status_code == 422

    def test_basic_fetched_at_is_isoformat(self, client: TestClient) -> None:
        """验证 fetched_at 是合法 ISO 时间字符串"""
        body = client.post("/api/collect/basic", json={"symbol": "600519"}).json()
        datetime.fromisoformat(body["fetched_at"])


# ============================================================
# K线数据采集
# ============================================================


class TestCollectKline:
    """POST /api/collect/kline 端点测试"""

    def test_kline_default_params(self, client: TestClient) -> None:
        """使用默认参数请求 K线（返回 60 根日K线：1 月 + 1 月历史）"""
        resp = client.post("/api/collect/kline", json={"symbol": "600519"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["dimension"] == "kline"
        assert body["records"] == 60
        assert "history" in body["data"]
        assert len(body["data"]["history"]) == 60

    def test_kline_bar_fields(self, client: TestClient) -> None:
        """验证每根 K线 bar 包含 OHLCV + amount"""
        body = client.post("/api/collect/kline", json={"symbol": "600519"}).json()
        bar = body["data"]["history"][0]
        for field in ("date", "open", "high", "low", "close", "volume", "amount"):
            assert field in bar, f"K线 bar 缺少字段: {field}"

    def test_kline_latest_matches_last_history(self, client: TestClient) -> None:
        """latest 应等于 history 最后一根"""
        body = client.post("/api/collect/kline", json={"symbol": "600519"}).json()
        assert body["data"]["latest"]["date"] == body["data"]["history"][-1]["date"]

    def test_kline_custom_period(self, client: TestClient) -> None:
        """指定 period=weekly 也能正常返回"""
        body = client.post(
            "/api/collect/kline",
            json={"symbol": "600519", "period": "weekly", "adjust": "hfq"},
        ).json()
        assert body["success"] is True
        assert body["records"] == 60

    def test_kline_missing_symbol(self, client: TestClient) -> None:
        """缺少 symbol 应返回 422"""
        resp = client.post("/api/collect/kline", json={"period": "daily"})
        assert resp.status_code == 422


# ============================================================
# 财务数据采集（mock fetch_real_financial_data，不触发真实 AKShare 调用）
# ============================================================


# 测试用 mock 财务数据（不依赖真实 AKShare）
MOCK_FINANCIAL: dict[str, dict] = {
    "600519": {
        "report_date": "2024-12-31",
        "revenue": 1505.6,
        "revenue_yoy": 16.3,
        "net_profit": 862.3,
        "net_profit_yoy": 19.2,
        "gross_margin": 91.5,
        "net_margin": 57.3,
        "operating_cf": 920.5,
        "rd_ratio": 2.1,
        "receivables": 12.8,
        "inventory_turnover_days": 480,
        "interest_bearing_debt": 0,
        "goodwill": 0,
        "net_assets": 1520.3,
        "shareholder_pledge": 0,
    },
    "300750": {
        "report_date": "2024-12-31",
        "revenue": 4009.2,
        "revenue_yoy": 22.8,
        "net_profit": 467.5,
        "gross_margin": 22.8,
        "net_margin": 11.7,
        "interest_bearing_debt": 320.5,
    },
}


class TestCollectFinancial:
    """POST /api/collect/financial 端点测试（mock AKShare）"""

    def test_financial_success(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """mock 成功返回贵州茅台财务数据"""
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "fetch_real_financial_data", lambda sym: MOCK_FINANCIAL.get(sym.split(".")[0].upper())
        )

        body = client.post("/api/collect/financial", json={"symbol": "600519"}).json()
        assert body["success"] is True
        data = body["data"]
        assert data["report_date"] == "2024-12-31"
        assert data["revenue"] == 1505.6
        assert data["gross_margin"] == 91.5
        assert data["interest_bearing_debt"] == 0

    def test_financial_symbol_with_suffix(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """带后缀的股票代码（.SH）也能被内部去后缀逻辑处理"""
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "fetch_real_financial_data", lambda sym: MOCK_FINANCIAL.get(sym.split(".")[0].upper())
        )

        body = client.post("/api/collect/financial", json={"symbol": "600519.SH"}).json()
        assert body["success"] is True
        assert body["data"]["revenue"] == 1505.6

    def test_financial_real_returns_none(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """fetch_real_financial_data 返回 None 时，端点应返回 success=False"""
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "fetch_real_financial_data", lambda sym: None)

        body = client.post("/api/collect/financial", json={"symbol": "UNKNOWN"}).json()
        assert body["success"] is False
        assert "error" in body

    def test_financial_valid_fields_filtered(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """端点应只保留 FinancialCollectData 允许的字段，多余字段过滤"""
        import collect_endpoints as ce

        def _return_extra_fields(sym):
            base = dict(MOCK_FINANCIAL["600519"])
            base["_internal_debug"] = "SHOULD_BE_FILTERED"
            base["invalid_column_xyz"] = 12345
            return base

        monkeypatch.setattr(ce, "fetch_real_financial_data", _return_extra_fields)

        body = client.post("/api/collect/financial", json={"symbol": "600519"}).json()
        assert body["success"] is True
        # 无效字段不应出现在响应中
        assert "_internal_debug" not in body["data"]
        assert "invalid_column_xyz" not in body["data"]

    def test_financial_missing_symbol(self, client: TestClient) -> None:
        """缺少 symbol 应返回 422"""
        resp = client.post("/api/collect/financial", json={})
        assert resp.status_code == 422


# ============================================================
# 验证 P0 修复：_collect_financial_llm 异常捕获
# ============================================================


class TestCollectFinancialLlmException:
    """
    验证 use_llm=True 路径下 extract_one 异常不会导致 500 错误。

    修复前：_collect_financial_llm 直接调用 extract_one(symbol)，无 try/catch，
    异常会导致 FastAPI 返回 500 Internal Server Error。
    修复后：try/catch 捕获异常，返回结构化错误响应（success=False）。
    """

    def test_llm_extract_raises_runtime_error(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """extract_one 抛 RuntimeError 时应返回 success=False（非 500）"""
        import collect_endpoints as ce

        # 模拟 extract_one 抛异常
        def _raise_extract_one(symbol):
            raise RuntimeError("LLM API 超时")

        # mock sys.modules 中的 llm_financial_extractor 模块
        import types
        mock_module = types.ModuleType("llm_financial_extractor")
        mock_module.extract_one = _raise_extract_one
        monkeypatch.setitem(__import__("sys").modules, "llm_financial_extractor", mock_module)

        body = client.post(
            "/api/collect/financial", json={"symbol": "600519", "use_llm": True}
        ).json()

        assert body["success"] is False
        assert body["symbol"] == "600519"
        assert "LLM 解析异常" in body["error"]
        assert body["records"] == 0

    def test_llm_extract_raises_connection_error(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """extract_one 抛 ConnectionError 时应返回 success=False（非 500）"""
        import collect_endpoints as ce
        import types

        def _raise_connection_error(symbol):
            raise ConnectionError("PDF 下载失败")

        mock_module = types.ModuleType("llm_financial_extractor")
        mock_module.extract_one = _raise_connection_error
        monkeypatch.setitem(__import__("sys").modules, "llm_financial_extractor", mock_module)

        resp = client.post(
            "/api/collect/financial", json={"symbol": "000001", "use_llm": True}
        )
        # 不应返回 500
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert "PDF 下载失败" in body["error"]

    def test_llm_extract_returns_failed(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """extract_one 返回 source=failed 时应返回 success=False（非异常路径）"""
        import types

        def _return_failed(symbol):
            return {"source": "failed", "error": "PDF 文件不存在", "financial_data": {}}

        mock_module = types.ModuleType("llm_financial_extractor")
        mock_module.extract_one = _return_failed
        monkeypatch.setitem(__import__("sys").modules, "llm_financial_extractor", mock_module)

        body = client.post(
            "/api/collect/financial", json={"symbol": "600519", "use_llm": True}
        ).json()

        assert body["success"] is False
        assert body["error"] == "PDF 文件不存在"

    def test_llm_extract_returns_success(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """extract_one 返回正常数据时应返回 success=True"""
        import types

        def _return_success(symbol):
            return {
                "source": "pdf",
                "financial_data": {
                    "report_date": "2024-12-31",
                    "revenue": 1505.6,
                    "net_profit": 862.3,
                    "gross_margin": 91.5,
                },
            }

        mock_module = types.ModuleType("llm_financial_extractor")
        mock_module.extract_one = _return_success
        monkeypatch.setitem(__import__("sys").modules, "llm_financial_extractor", mock_module)

        body = client.post(
            "/api/collect/financial", json={"symbol": "600519", "use_llm": True}
        ).json()

        assert body["success"] is True
        assert body["data"]["revenue"] == 1505.6
        assert body["data"]["gross_margin"] == 91.5


# ============================================================
# 验证 P0 Bug #2 修复：CollectResponse.fetched_at 使用 default_factory
# ============================================================


class TestFetchedAtDefaultFactory:
    """
    验证 fetched_at 在每次响应时独立求值（使用 Field(default_factory=...)），
    而非类定义时的冻结时间戳。
    """

    def test_two_responses_have_different_fetched_at(self, client: TestClient) -> None:
        """间隔 10ms 发起两次请求，响应时间戳应不同"""
        body1 = client.post("/api/collect/basic", json={"symbol": "600519"}).json()
        time.sleep(0.015)
        body2 = client.post("/api/collect/basic", json={"symbol": "000001"}).json()
        assert body1["fetched_at"] != body2["fetched_at"], (
            "fetched_at 时间戳被冻结，应为每次请求独立生成"
        )

    def test_collect_response_direct_construction(self) -> None:
        """直接构造 CollectResponse 实例验证 fetched_at 不冻结"""
        resp1 = CollectResponse(success=True, symbol="A", dimension="basic", records=0)
        time.sleep(0.015)
        resp2 = CollectResponse(success=True, symbol="B", dimension="basic", records=0)
        assert resp1.fetched_at != resp2.fetched_at, (
            "直接构造时 fetched_at 也应每次独立求值"
        )

    def test_collect_response_explicit_fetched_at_preserved(self) -> None:
        """显式传入 fetched_at 时不被 default_factory 覆盖"""
        explicit = "2024-01-01T00:00:00"
        resp = CollectResponse(
            success=True, symbol="X", dimension="basic", records=0, fetched_at=explicit
        )
        assert resp.fetched_at == explicit


# ============================================================
# 辅助函数：_normalize_to_100
# ============================================================


class TestNormalizeTo100:
    """_normalize_to_100 归一化函数测试"""

    def test_empty_dict_returns_empty(self) -> None:
        assert _normalize_to_100({}) == {}

    def test_single_value_gets_zero(self) -> None:
        """单个值归一化为 0（排名首位 i=0, max(n-1,1)=1, 0/1*100=0）"""
        result = _normalize_to_100({"a": 50.0})
        assert result["a"] == 0.0

    def test_two_values_ranked(self) -> None:
        """两个值：低值=0，高值=100"""
        result = _normalize_to_100({"a": 10.0, "b": 90.0})
        assert result["a"] == 0.0
        assert result["b"] == 100.0

    def test_three_values_evenly_distributed(self) -> None:
        """三个值应均匀分布在 0/50/100"""
        result = _normalize_to_100({"a": 1.0, "b": 5.0, "c": 10.0})
        assert result["a"] == 0.0
        assert result["b"] == 50.0
        assert result["c"] == 100.0

    def test_preserves_all_keys(self) -> None:
        """归一化后所有 key 都应保留"""
        values = {"a": 1.0, "b": 2.0, "c": 3.0, "d": 4.0}
        result = _normalize_to_100(values)
        assert set(result.keys()) == set(values.keys())

    def test_negative_values(self) -> None:
        """负值也能正确归一化"""
        result = _normalize_to_100({"a": -10.0, "b": -50.0})
        assert result["a"] == 100.0
        assert result["b"] == 0.0


# ============================================================
# 板块轮动评分采集（mock fetch_sector_rotation_scores，不触发真实 AKShare 网络调用）
# ============================================================


class TestCollectSectors:
    """POST /api/collect/sectors 端点测试"""

    def test_sectors_success(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """mock 返回板块数据时，端点应返回 success=True"""
        import collect_endpoints as ce

        score_date = "2026-08-09"
        created_at = "2026-08-09T10:00:00"
        mock_items = [
            ce.SectorScoreItem(
                id="801120.SI__2026-08-09", sectorCode="801120.SI", sectorName="煤炭",
                swLevel1="采掘", swLevel2="煤炭", swLevel3=None,
                scoreDate=score_date,
                f1Jingqi=80.0, f2Zijin=60.0, f3Guzhi=90.0, f4Beta=0.0, f5Nengliang=70.0,
                total=75.0, resonance=7.5,
                signal="强势上攻", alertLevel="正常", declineType="",
                poolStocks=[], modelUsed="akshare-sw-v1", createdAt=created_at,
            ),
            ce.SectorScoreItem(
                id="801150.SI__2026-08-09", sectorCode="801150.SI", sectorName="医药生物",
                swLevel1="医药", swLevel2="医药生物", swLevel3=None,
                scoreDate=score_date,
                f1Jingqi=30.0, f2Zijin=40.0, f3Guzhi=20.0, f4Beta=0.0, f5Nengliang=35.0,
                total=32.0, resonance=3.2,
                signal="弱势", alertLevel="预警", declineType="",
                poolStocks=[], modelUsed="akshare-sw-v1", createdAt=created_at,
            ),
        ]
        monkeypatch.setattr(ce, "fetch_sector_rotation_scores", lambda topN=20: mock_items)

        body = client.post("/api/collect/sectors", json={"topN": 2}).json()
        assert body["success"] is True
        assert body["dimension"] == "sectors"
        assert body["records"] == 2
        assert "sectors" in body["data"]
        assert len(body["data"]["sectors"]) == 2
        assert body["data"]["sectors"][0]["sectorName"] == "煤炭"
        assert body["data"]["scoreDate"] == score_date

    def test_sectors_empty_result(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """mock 返回空列表时，端点应返回 success=True 但 records=0"""
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "fetch_sector_rotation_scores", lambda topN=20: [])

        body = client.post("/api/collect/sectors", json={"topN": 10}).json()
        assert body["success"] is True
        assert body["records"] == 0
        assert body["data"]["sectors"] == []

    def test_sectors_exception_returns_error(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """fetch 函数抛异常时，端点应捕获并返回 success=False"""
        import collect_endpoints as ce

        def _raise(topN=20):
            raise RuntimeError("网络连接失败")

        monkeypatch.setattr(ce, "fetch_sector_rotation_scores", _raise)

        body = client.post("/api/collect/sectors", json={"topN": 5}).json()
        assert body["success"] is False
        assert "error" in body
        assert "网络连接失败" in body["error"]

    def test_sectors_default_topn(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """不传 topN 时应使用默认值，端点正常响应"""
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "fetch_sector_rotation_scores", lambda topN=20: [])

        body = client.post("/api/collect/sectors", json={}).json()
        assert body["success"] is True

    def test_sectors_response_includes_score_date(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """验证返回数据包含 scoreDate 字段"""
        import collect_endpoints as ce

        score_date = "2026-08-09"
        mock_items = [
            ce.SectorScoreItem(
                id="801120.SI__2026-08-09", sectorCode="801120.SI", sectorName="煤炭",
                swLevel1=None, swLevel2="煤炭", swLevel3=None,
                scoreDate=score_date,
                f1Jingqi=50.0, f2Zijin=50.0, f3Guzhi=50.0, f4Beta=0.0, f5Nengliang=50.0,
                total=50.0, resonance=5.0,
                signal="震荡上行", alertLevel="关注", declineType="",
                poolStocks=[], modelUsed="akshare-sw-v1", createdAt="2026-08-09T10:00:00",
            ),
        ]
        monkeypatch.setattr(ce, "fetch_sector_rotation_scores", lambda topN=20: mock_items)

        body = client.post("/api/collect/sectors", json={"topN": 1}).json()
        assert body["data"]["scoreDate"] == score_date


# ============================================================
# 腾讯行情辅助函数：_to_tencent_code（覆盖 L181-190 全部分支）
# ============================================================


class TestToTencentCode:
    """_to_tencent_code 股票代码转腾讯格式：sh / sz / bj / 默认回退"""

    def test_sh_prefix(self) -> None:
        """6 开头（沪市主板）→ sh"""
        assert _to_tencent_code("600519") == "sh600519"

    def test_sh_with_uppercase_suffix(self) -> None:
        assert _to_tencent_code("600519.SH") == "sh600519"

    def test_sh_with_lowercase_suffix(self) -> None:
        assert _to_tencent_code("600519.sh") == "sh600519"

    def test_sz_prefix_0(self) -> None:
        """0 开头（深市主板）→ sz"""
        assert _to_tencent_code("000001") == "sz000001"

    def test_sz_prefix_3(self) -> None:
        """3 开头（创业板）→ sz"""
        assert _to_tencent_code("300750") == "sz300750"

    def test_sz_prefix_2(self) -> None:
        """2 开头（B 股）→ sz"""
        assert _to_tencent_code("200002") == "sz200002"

    def test_bj_prefix_8(self) -> None:
        """8 开头（北交所）→ bj"""
        assert _to_tencent_code("832000") == "bj832000"

    def test_bj_prefix_4(self) -> None:
        """4 开头（老三板/北交所）→ bj"""
        assert _to_tencent_code("430047") == "bj430047"

    def test_bj_prefix_9(self) -> None:
        """9 开头 → bj"""
        assert _to_tencent_code("920002") == "bj920002"

    def test_default_fallback(self) -> None:
        """不匹配任何前缀（如 1 开头）→ 默认回退 sh"""
        assert _to_tencent_code("100000") == "sh100000"


# ============================================================
# 腾讯行情辅助函数：_safe_float（覆盖 L171-178 边界）
# ============================================================


class TestSafeFloat:
    """_safe_float 安全转 float：空值/非数字返回 None"""

    def test_none_returns_none(self) -> None:
        assert _safe_float(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert _safe_float("") is None

    def test_whitespace_only_returns_none(self) -> None:
        assert _safe_float("   ") is None

    def test_valid_string_number(self) -> None:
        assert _safe_float("3.14") == 3.14

    def test_valid_int(self) -> None:
        assert _safe_float(42) == 42.0

    def test_valid_float(self) -> None:
        assert _safe_float(3.14) == 3.14

    def test_zero(self) -> None:
        assert _safe_float(0) == 0.0
        assert _safe_float("0") == 0.0

    def test_invalid_string_returns_none(self) -> None:
        assert _safe_float("abc") is None

    def test_string_none_returns_none(self) -> None:
        """字符串 'None' 经 float() 解析失败 → None"""
        assert _safe_float("None") is None

    def test_negative_string(self) -> None:
        assert _safe_float("-5.5") == -5.5


# ============================================================
# 申万行业名称归一化：_normalize_sw_name（覆盖 L88-94）
# ============================================================


class TestNormalizeSwName:
    """_normalize_sw_name 去除尾部罗马数字后缀及首尾空白"""

    def test_strip_whitespace(self) -> None:
        assert _normalize_sw_name("  白酒  ") == "白酒"

    def test_remove_ii_suffix(self) -> None:
        assert _normalize_sw_name("白酒II") == "白酒"

    def test_remove_roman_2_suffix(self) -> None:
        assert _normalize_sw_name("证券Ⅱ") == "证券"

    def test_remove_roman_3_suffix(self) -> None:
        assert _normalize_sw_name("化学制品Ⅲ") == "化学制品"

    def test_no_suffix_unchanged(self) -> None:
        assert _normalize_sw_name("银行") == "银行"

    def test_non_string_input(self) -> None:
        """非字符串输入经 str() 转换后处理"""
        assert _normalize_sw_name(123) == "123"


# ============================================================
# 申万行业映射：_get_sw_industry_map（覆盖 L97-134 缓存/成功/异常）
# ============================================================


@pytest.fixture
def reset_sw_cache():
    """每个测试前后重置 _SW_MAP_CACHE，避免缓存污染"""
    import collect_endpoints as ce

    orig_data, orig_ts = ce._SW_MAP_CACHE["data"], ce._SW_MAP_CACHE["ts"]
    ce._SW_MAP_CACHE["data"] = None
    ce._SW_MAP_CACHE["ts"] = 0.0
    yield
    ce._SW_MAP_CACHE["data"] = orig_data
    ce._SW_MAP_CACHE["ts"] = orig_ts


class TestGetSwIndustryMap:
    """_get_sw_industry_map 申万行业映射表加载（含 24h 缓存）"""

    def test_cache_hit_no_network(self, monkeypatch: pytest.MonkeyPatch, reset_sw_cache) -> None:
        """缓存有效时直接返回，不触发 akshare 调用"""
        import collect_endpoints as ce

        cached = {"second": {"白酒": "801120.SI"}, "first": {"食品饮料": "801010.SI"}}
        ce._SW_MAP_CACHE["data"] = cached
        ce._SW_MAP_CACHE["ts"] = time.time()

        # 即便 akshare 不可用也应命中缓存
        monkeypatch.setitem(__import__("sys").modules, "akshare", None)
        assert ce._get_sw_industry_map() == cached

    def test_success_path(self, monkeypatch: pytest.MonkeyPatch, reset_sw_cache) -> None:
        """成功加载二级 + 一级行业映射，并写入归一化键"""
        import collect_endpoints as ce
        import types
        import pandas as pd

        second_df = pd.DataFrame({
            "行业代码": ["801120.SI"],
            "行业名称": ["白酒II"],
        })
        first_df = pd.DataFrame({
            "行业代码": ["801010.SI"],
            "行业名称": ["食品饮料"],
        })
        mock_ak = types.ModuleType("akshare")
        mock_ak.sw_index_second_info = lambda: second_df
        mock_ak.sw_index_first_info = lambda: first_df
        monkeypatch.setitem(__import__("sys").modules, "akshare", mock_ak)

        mapping = ce._get_sw_industry_map()
        assert mapping is not None
        assert mapping["second"]["白酒II"] == "801120.SI"
        assert mapping["second"]["白酒"] == "801120.SI"  # 归一化键
        assert mapping["first"]["食品饮料"] == "801010.SI"
        # 缓存被写入
        assert ce._SW_MAP_CACHE["data"] is mapping

    def test_exception_returns_none(self, monkeypatch: pytest.MonkeyPatch, reset_sw_cache) -> None:
        """akshare 调用异常时返回 None"""
        import collect_endpoints as ce
        import types

        mock_ak = types.ModuleType("akshare")

        def _raise():
            raise RuntimeError("网络错误")

        mock_ak.sw_index_second_info = _raise
        monkeypatch.setitem(__import__("sys").modules, "akshare", mock_ak)

        assert ce._get_sw_industry_map() is None

    def test_expired_cache_reloads(self, monkeypatch: pytest.MonkeyPatch, reset_sw_cache) -> None:
        """缓存过期后重新加载"""
        import collect_endpoints as ce
        import types
        import pandas as pd

        # 写入过期缓存
        ce._SW_MAP_CACHE["data"] = {"second": {"old": "X"}, "first": {}}
        ce._SW_MAP_CACHE["ts"] = time.time() - ce._SW_MAP_TTL - 1

        second_df = pd.DataFrame({"行业代码": ["801120.SI"], "行业名称": ["白酒II"]})
        first_df = pd.DataFrame({"行业代码": [], "行业名称": []})
        mock_ak = types.ModuleType("akshare")
        mock_ak.sw_index_second_info = lambda: second_df
        mock_ak.sw_index_first_info = lambda: first_df
        monkeypatch.setitem(__import__("sys").modules, "akshare", mock_ak)

        mapping = ce._get_sw_industry_map()
        assert mapping is not None
        assert "白酒" in mapping["second"]
        assert "old" not in mapping["second"]


# ============================================================
# 行业代码解析：resolve_sw_industry_code（覆盖 L137-163）
# ============================================================


class TestResolveSwIndustryCode:
    """resolve_sw_industry_code 行业名称 → 申万二级代码"""

    def test_none_name_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        assert resolve_sw_industry_code(None) is None
        assert resolve_sw_industry_code("") is None

    def test_no_mapping_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "_get_sw_industry_map", lambda: None)
        assert ce.resolve_sw_industry_code("白酒") is None

    def test_exact_match(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "_get_sw_industry_map",
            lambda: {"second": {"白酒II": "801120.SI"}, "first": {}},
        )
        assert ce.resolve_sw_industry_code("白酒II") == "801120.SI"

    def test_normalized_match(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """输入带后缀名称但映射表仅含归一化键 → norm != name 且 norm in second 命中"""
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "_get_sw_industry_map",
            lambda: {"second": {"白酒": "801120.SI"}, "first": {}},
        )
        assert ce.resolve_sw_industry_code("白酒II") == "801120.SI"

    def test_input_no_suffix_matches_normalized_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """输入无后缀名称，映射表含归一化键 → name in second 直接命中"""
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "_get_sw_industry_map",
            lambda: {"second": {"白酒": "801120.SI"}, "first": {}},
        )
        assert ce.resolve_sw_industry_code("白酒") == "801120.SI"

    def test_no_match_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "_get_sw_industry_map",
            lambda: {"second": {"白酒II": "801120.SI"}, "first": {}},
        )
        assert ce.resolve_sw_industry_code("不存在的行业") is None

    def test_whitespace_name_stripped(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "_get_sw_industry_map",
            lambda: {"second": {"白酒II": "801120.SI"}, "first": {}},
        )
        assert ce.resolve_sw_industry_code("  白酒II  ") == "801120.SI"


# ============================================================
# 腾讯实时行情：fetch_tencent_quote（覆盖 L193-221，mock requests）
# ============================================================


def _mock_requests_get(monkeypatch: pytest.MonkeyPatch, text: str) -> None:
    """注入返回固定 text 的 mock requests 模块到 sys.modules"""
    import types

    class _FakeResp:
        def __init__(self, body: str) -> None:
            self.text = body

    mock_req = types.ModuleType("requests")
    mock_req.get = lambda url, timeout=8, headers=None: _FakeResp(text)
    monkeypatch.setitem(__import__("sys").modules, "requests", mock_req)


class TestFetchTencentQuote:
    """fetch_tencent_quote 腾讯实时行情：price / pe / pb / 市值"""

    def test_success_full_fields(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """正常返回 50+ 字段，正确解析 price/pe/pb/market_cap"""
        fields = ["0"] * 51
        fields[3] = "1800.50"   # price
        fields[39] = "25.6"     # pe
        fields[46] = "20000"    # 总市值(亿)
        fields[47] = "8.9"      # pb
        text = 'v_sh600519="' + "~".join(fields) + '";'
        _mock_requests_get(monkeypatch, text)

        result = fetch_tencent_quote("600519")
        assert result is not None
        assert result["price"] == 1800.50
        assert result["pe"] == 25.6
        assert result["pb"] == 8.9
        assert result["market_cap"] == 20000 * 1e8

    def test_market_cap_empty_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """市值字段为空时 market_cap=None，其它字段仍解析"""
        fields = ["0"] * 51
        fields[3] = "100.0"
        fields[39] = "10.0"
        fields[46] = ""   # 空市值
        fields[47] = "5.0"
        text = 'v_sh="' + "~".join(fields) + '";'
        _mock_requests_get(monkeypatch, text)

        result = fetch_tencent_quote("600519")
        assert result is not None
        assert result["market_cap"] is None
        assert result["price"] == 100.0

    def test_no_separator_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """响应无 =" 分隔符 → parts < 2 → None"""
        _mock_requests_get(monkeypatch, "no separator here")
        assert fetch_tencent_quote("600519") is None

    def test_too_few_fields_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """字段数 < 50 → None"""
        text = 'v_sh="~a~b~c";'
        _mock_requests_get(monkeypatch, text)
        assert fetch_tencent_quote("600519") is None

    def test_exception_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """requests.get 抛异常 → 捕获返回 None"""
        import types

        mock_req = types.ModuleType("requests")

        def _raise(url, timeout=8, headers=None):
            raise RuntimeError("连接失败")

        mock_req.get = _raise
        monkeypatch.setitem(__import__("sys").modules, "requests", mock_req)
        assert fetch_tencent_quote("600519") is None


# ============================================================
# 腾讯 K 线：fetch_tencent_kline（覆盖 L224-257，mock requests）
# ============================================================


def _mock_requests_json(monkeypatch: pytest.MonkeyPatch, json_data) -> None:
    """注入返回固定 json 的 mock requests 模块"""
    import types

    class _FakeResp:
        def __init__(self, data) -> None:
            self._data = data

        def json(self):
            return self._data

    mock_req = types.ModuleType("requests")
    mock_req.get = lambda url, timeout=10: _FakeResp(json_data)
    monkeypatch.setitem(__import__("sys").modules, "requests", mock_req)


class TestFetchTencentKline:
    """fetch_tencent_kline 腾讯前复权日线"""

    def test_success_day_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """day 键返回 K 线，含 amount 字段"""
        day_list = [
            ["2024-01-01", "10.0", "10.5", "11.0", "9.5", "1000", "10500"],
            ["2024-01-02", "10.5", "11.0", "11.5", "10.0", "2000", "22000"],
        ]
        data = {"data": {"sh600519": {"day": day_list}}}
        _mock_requests_json(monkeypatch, data)

        bars = fetch_tencent_kline("600519")
        assert bars is not None
        assert len(bars) == 2
        assert bars[0]["date"] == "2024-01-01"
        assert bars[0]["open"] == 10.0
        assert bars[0]["amount"] == 10500.0

    def test_success_qfqday_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """qfqday 键作为 day 的回退"""
        day_list = [["2024-01-01", "10.0", "10.5", "11.0", "9.5", "1000"]]
        data = {"data": {"sh600519": {"qfqday": day_list}}}
        _mock_requests_json(monkeypatch, data)

        bars = fetch_tencent_kline("600519")
        assert bars is not None
        assert len(bars) == 1
        assert bars[0]["amount"] == 0.0  # 无 amount → 0.0

    def test_empty_day_list_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """day_list 为空 → None（覆盖 L241）"""
        data = {"data": {"sh600519": {"day": []}}}
        _mock_requests_json(monkeypatch, data)
        assert fetch_tencent_kline("600519") is None

    def test_missing_day_key_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """无 day/qfqday 键 → None"""
        data = {"data": {"sh600519": {}}}
        _mock_requests_json(monkeypatch, data)
        assert fetch_tencent_kline("600519") is None

    def test_short_item_skipped(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """长度 < 6 的条目被跳过；全部跳过后返回 None"""
        day_list = [["2024-01-01", "10.0"]]  # len < 6
        data = {"data": {"sh600519": {"day": day_list}}}
        _mock_requests_json(monkeypatch, data)
        assert fetch_tencent_kline("600519") is None

    def test_exception_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """requests 异常 → None（覆盖 L255-257）"""
        import types

        mock_req = types.ModuleType("requests")

        def _raise(url, timeout=10):
            raise RuntimeError("网络异常")

        mock_req.get = _raise
        monkeypatch.setitem(__import__("sys").modules, "requests", mock_req)
        assert fetch_tencent_kline("600519") is None


# ============================================================
# 个股基础信息：fetch_individual_info（覆盖 L260-315，mock akshare）
# ============================================================


def _make_mock_akshare(monkeypatch: pytest.MonkeyPatch, **attrs):
    """注入 mock akshare 模块（含指定属性）到 sys.modules"""
    import types

    mod = types.ModuleType("akshare")
    for k, v in attrs.items():
        setattr(mod, k, v)
    monkeypatch.setitem(__import__("sys").modules, "akshare", mod)
    return mod


class TestFetchIndividualInfo:
    """fetch_individual_info AKShare stock_individual_info_em 真实路径"""

    @pytest.fixture(autouse=True)
    def _mock_adata_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """mock adata 回退返回 None，避免触发真实百度股市通网络调用。

        AKShare 成功路径不触发 adata；AKShare 失败路径走 adata 回退，
        此 fixture 让 adata 也"失败"，使失败路径测试可复现地返回 None。
        """
        import collect_endpoints as ce
        monkeypatch.setattr(ce, "_fetch_individual_info_adata", lambda symbol: None)

    def test_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import collect_endpoints as ce
        import pandas as pd

        df = pd.DataFrame({
            "item": ["股票简称", "行业", "总市值"],
            "value": ["贵州茅台", "白酒", "2.0e12"],
        })
        _make_mock_akshare(monkeypatch, stock_individual_info_em=lambda symbol: df)
        monkeypatch.setattr(ce, "resolve_sw_industry_code", lambda name: "801120.SI")

        info = fetch_individual_info("600519")
        assert info is not None
        assert info["name"] == "贵州茅台"
        assert info["industry_name"] == "白酒"
        assert info["market_cap"] == 2.0e12
        assert info["industry_code"] == "801120.SI"

    def test_akshare_not_installed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """import akshare 抛 ImportError → 回退 None（覆盖 L274-276）"""
        monkeypatch.setitem(__import__("sys").modules, "akshare", None)
        assert fetch_individual_info("600519") is None

    def test_akshare_call_exception(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """stock_individual_info_em 抛异常 → None"""

        def _raise(symbol):
            raise RuntimeError("接口报错")

        _make_mock_akshare(monkeypatch, stock_individual_info_em=_raise)
        assert fetch_individual_info("600519") is None

    def test_none_df(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """接口返回 None → None"""
        _make_mock_akshare(monkeypatch, stock_individual_info_em=lambda symbol: None)
        assert fetch_individual_info("600519") is None

    def test_empty_df(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """空 DataFrame → None"""
        import pandas as pd

        _make_mock_akshare(monkeypatch, stock_individual_info_em=lambda symbol: pd.DataFrame())
        assert fetch_individual_info("600519") is None

    def test_missing_columns(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """缺少 item/value 列 → None"""
        import pandas as pd

        df = pd.DataFrame({"a": [1], "b": [2]})
        _make_mock_akshare(monkeypatch, stock_individual_info_em=lambda symbol: df)
        assert fetch_individual_info("600519") is None

    def test_market_cap_invalid_ignored(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """总市值为非数字时被忽略，不影响其它字段"""
        import collect_endpoints as ce
        import pandas as pd

        df = pd.DataFrame({
            "item": ["股票简称", "总市值"],
            "value": ["茅台", "abc"],
        })
        _make_mock_akshare(monkeypatch, stock_individual_info_em=lambda symbol: df)
        monkeypatch.setattr(ce, "resolve_sw_industry_code", lambda name: None)

        info = fetch_individual_info("600519")
        assert info is not None
        assert info["name"] == "茅台"
        assert "market_cap" not in info
        assert info["industry_code"] is None

    def test_symbol_with_suffix(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """带 .SH 后缀的代码被正确去后缀"""
        import collect_endpoints as ce
        import pandas as pd

        captured = {}

        def _emu(symbol):
            captured["symbol"] = symbol
            return pd.DataFrame({"item": ["股票简称"], "value": ["茅台"]})

        _make_mock_akshare(monkeypatch, stock_individual_info_em=_emu)
        monkeypatch.setattr(ce, "resolve_sw_industry_code", lambda name: None)
        fetch_individual_info("600519.SH")
        assert captured["symbol"] == "600519"


# ============================================================
# 基础信息端点真实路径：collect_basic（覆盖 L318-346 合并逻辑）
# ============================================================


class TestCollectBasicRealPath:
    """collect_basic 内部合并 fetch_individual_info + fetch_tencent_quote 的各路径"""

    def test_both_none(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        """两个数据源都返回 None → data 全为 None"""
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "fetch_individual_info", lambda s: None)
        monkeypatch.setattr(ce, "fetch_tencent_quote", lambda s: None)

        body = client.post("/api/collect/basic", json={"symbol": "600519"}).json()
        assert body["success"] is True
        assert body["data"]["name"] is None
        assert body["data"]["price"] is None
        assert body["data"]["market_cap"] is None

    def test_info_only(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        """仅 fetch_individual_info 返回数据"""
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "fetch_individual_info",
            lambda s: {"name": "贵州茅台", "industry_code": "801120", "market_cap": 1e12},
        )
        monkeypatch.setattr(ce, "fetch_tencent_quote", lambda s: None)

        body = client.post("/api/collect/basic", json={"symbol": "600519"}).json()
        assert body["data"]["name"] == "贵州茅台"
        assert body["data"]["market_cap"] == 1e12
        assert body["data"]["price"] is None

    def test_tq_only(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        """仅 fetch_tencent_quote 返回数据"""
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "fetch_individual_info", lambda s: None)
        monkeypatch.setattr(
            ce, "fetch_tencent_quote",
            lambda s: {"price": 1800.0, "pe": 25.0, "pb": 8.0, "market_cap": 2e12},
        )

        body = client.post("/api/collect/basic", json={"symbol": "600519"}).json()
        assert body["data"]["price"] == 1800.0
        assert body["data"]["pe"] == 25.0
        assert body["data"]["name"] is None

    def test_market_cap_fallback_to_tq(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """info.market_cap 为 None 时回退到 tq.market_cap"""
        import collect_endpoints as ce

        monkeypatch.setattr(
            ce, "fetch_individual_info",
            lambda s: {"name": "茅台", "market_cap": None},
        )
        monkeypatch.setattr(
            ce, "fetch_tencent_quote",
            lambda s: {"price": 1800.0, "pe": 25.0, "pb": 8.0, "market_cap": 2e12},
        )

        body = client.post("/api/collect/basic", json={"symbol": "600519"}).json()
        assert body["data"]["market_cap"] == 2e12


# ============================================================
# K 线端点真实路径：collect_kline（覆盖 L386-416 空数据 success=False）
# ============================================================


class TestCollectKlineRealPath:
    """collect_kline 空数据 / 异常 / 正常路径"""

    def test_none_bars_returns_failure(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """fetch_tencent_kline 返回 None → success=False"""
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "fetch_tencent_kline", lambda s, count=60: None)
        body = client.post("/api/collect/kline", json={"symbol": "600519"}).json()
        assert body["success"] is False
        assert "腾讯K线API" in body["error"]
        assert body["records"] == 0

    def test_empty_list_returns_failure(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """fetch_tencent_kline 返回空列表 → success=False"""
        import collect_endpoints as ce

        monkeypatch.setattr(ce, "fetch_tencent_kline", lambda s, count=60: [])
        body = client.post("/api/collect/kline", json={"symbol": "600519"}).json()
        assert body["success"] is False

    def test_success_with_bars(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """正常返回 bars → success=True，latest 为最后一根"""
        import collect_endpoints as ce

        bars = [
            {
                "date": "2024-01-01", "open": 10.0, "high": 11.0, "low": 9.5,
                "close": 10.5, "volume": 1000, "amount": 10500,
            },
            {
                "date": "2024-01-02", "open": 10.5, "high": 11.5, "low": 10.0,
                "close": 11.0, "volume": 2000, "amount": 22000,
            },
        ]
        monkeypatch.setattr(ce, "fetch_tencent_kline", lambda s, count=60: bars)

        body = client.post("/api/collect/kline", json={"symbol": "600519"}).json()
        assert body["success"] is True
        assert body["records"] == 2
        assert body["data"]["latest"]["date"] == "2024-01-02"
        assert body["data"]["history"][0]["open"] == 10.0

    def test_bars_with_none_values(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """bar 字段为 None 时回退 0.0"""
        import collect_endpoints as ce

        bars = [
            {
                "date": "2024-01-01", "open": None, "high": None, "low": None,
                "close": None, "volume": None, "amount": None,
            },
        ]
        monkeypatch.setattr(ce, "fetch_tencent_kline", lambda s, count=60: bars)

        body = client.post("/api/collect/kline", json={"symbol": "600519"}).json()
        assert body["success"] is True
        assert body["data"]["history"][0]["open"] == 0.0
        assert body["data"]["history"][0]["amount"] == 0.0


# ============================================================
# 真实财务数据：fetch_real_financial_data（覆盖 L447-515，mock akshare）
# ============================================================


class TestFetchRealFinancialDataReal:
    """fetch_real_financial_data AKShare 财务指标真实路径"""

    def test_success_both_sources(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """indicator + abstract 双源成功"""
        import pandas as pd

        indicator_df = pd.DataFrame({
            "日期": ["2024-12-31"],
            "销售毛利率(%)": [91.5],
            "销售净利率(%)": [57.3],
            "主营业务收入增长率(%)": [16.3],
            "净利润增长率(%)": [19.2],
            "存货周转天数(天)": [480],
            "总资产(元)": [2.0e12],
            "资产负债率(%)": [25.0],
        })
        abstract_df = pd.DataFrame({
            "指标": [
                "营业总收入", "归母净利润", "经营活动现金流量净额", "应收账款",
                "股东权益合计", "商誉", "负债合计", "研发费用",
            ],
            "选项": [""] * 8,
            "2024-12-31": [1505.6, 862.3, 920.5, 12.8, 1520.3, 0.0, 500.0, 30.0],
        })
        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=lambda symbol, start_year: indicator_df,
            stock_financial_abstract=lambda symbol: abstract_df,
        )

        result = fetch_real_financial_data("600519")
        assert result is not None
        assert result["report_date"] == "2024-12-31"
        assert result["gross_margin"] == 91.5
        assert result["net_margin"] == 57.3
        assert result["revenue_yoy"] == 16.3
        assert result["net_profit_yoy"] == 19.2
        assert result["inventory_turnover_days"] == 480
        assert result["net_assets"] == 2.0e12 * (1 - 25.0 / 100)
        assert result["interest_bearing_debt"] == 2.0e12 * 25.0 / 100
        assert result["revenue"] == 1505.6
        assert result["net_profit"] == 862.3
        assert result["operating_cf"] == 920.5
        assert result["receivables"] == 12.8
        assert result["goodwill"] == 0.0
        assert result["rd_ratio"] == round(30.0 / 1505.6 * 100, 2)

    def test_indicator_exception_abstract_ok(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """indicator 抛异常，abstract 成功 → 返回 abstract 部分数据"""
        import pandas as pd

        abstract_df = pd.DataFrame({
            "指标": ["营业总收入"],
            "选项": [""],
            "2024-12-31": [1505.6],
        })

        def _raise_indicator(symbol, start_year):
            raise RuntimeError("indicator 接口失败")

        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=_raise_indicator,
            stock_financial_abstract=lambda symbol: abstract_df,
        )

        result = fetch_real_financial_data("600519")
        assert result is not None
        assert result["revenue"] == 1505.6
        assert "gross_margin" not in result

    def test_indicator_ok_abstract_exception(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """indicator 成功，abstract 抛异常 → 返回 indicator 部分数据"""
        import pandas as pd

        indicator_df = pd.DataFrame({
            "日期": ["2024-12-31"],
            "销售毛利率(%)": [91.5],
        })

        def _raise_abstract(symbol):
            raise RuntimeError("abstract 接口失败")

        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=lambda symbol, start_year: indicator_df,
            stock_financial_abstract=_raise_abstract,
        )

        result = fetch_real_financial_data("600519")
        assert result is not None
        assert result["gross_margin"] == 91.5
        assert "revenue" not in result

    def test_both_empty_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """两个源都返回空 DataFrame → None"""
        import pandas as pd

        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=lambda symbol, start_year: pd.DataFrame(),
            stock_financial_abstract=lambda symbol: pd.DataFrame(),
        )
        assert fetch_real_financial_data("600519") is None

    def test_both_exception_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """两个源都抛异常 → None"""

        def _raise1(symbol, start_year):
            raise RuntimeError("e1")

        def _raise2(symbol):
            raise RuntimeError("e2")

        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=_raise1,
            stock_financial_abstract=_raise2,
        )
        assert fetch_real_financial_data("600519") is None

    def test_symbol_with_suffix(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """带后缀的代码被正确去后缀传给 akshare"""
        import pandas as pd

        captured = {}

        def _indicator(symbol, start_year):
            captured["symbol"] = symbol
            return pd.DataFrame({"日期": ["2024-12-31"], "销售毛利率(%)": [50.0]})

        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=_indicator,
            stock_financial_abstract=lambda symbol: pd.DataFrame(),
        )
        fetch_real_financial_data("600519.SH")
        assert captured["symbol"] == "600519"

    def test_rd_ratio_no_revenue_skipped(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """有研发费用但无营收时不计算 rd_ratio"""
        import pandas as pd

        indicator_df = pd.DataFrame({"日期": ["2024-12-31"]})
        abstract_df = pd.DataFrame({
            "指标": ["研发费用"],
            "选项": [""],
            "2024-12-31": [30.0],
        })
        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=lambda symbol, start_year: indicator_df,
            stock_financial_abstract=lambda symbol: abstract_df,
        )
        result = fetch_real_financial_data("600519")
        assert result is not None
        assert "rd_ratio" not in result

    def test_net_profit_fallback_and_invalid_value(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """覆盖 '净利润' 回退分支（无归母净利润时）与非数字值 continue 分支"""
        import pandas as pd

        indicator_df = pd.DataFrame({"日期": ["2024-12-31"]})
        abstract_df = pd.DataFrame({
            "指标": ["净利润", "营业总收入", "无效指标"],
            "选项": ["", "", ""],
            "2024-12-31": [500.0, 1200.0, "N/A"],
        })
        _make_mock_akshare(
            monkeypatch,
            stock_financial_analysis_indicator=lambda symbol, start_year: indicator_df,
            stock_financial_abstract=lambda symbol: abstract_df,
        )
        result = fetch_real_financial_data("600519")
        assert result is not None
        # '净利润' 回退分支命中（无 '归母净利润' 时）
        assert result["net_profit"] == 500.0
        assert result["revenue"] == 1200.0
        # '无效指标' 值非数字 → continue，不出现在结果中
        assert "无效指标" not in result


# ============================================================
# 板块轮动评分：fetch_sector_rotation_scores（覆盖 L648-744，mock akshare）
# ============================================================


class TestFetchSectorRotationScoresReal:
    """fetch_sector_rotation_scores AKShare 申万二级板块评分真实路径"""

    @pytest.fixture(autouse=True)
    def _mock_market_benchmark(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """mock 大盘基准涨幅，避免 f4 RS 触发真实网络调用（腾讯行情）"""
        import collect_endpoints as ce
        monkeypatch.setattr(ce, "_fetch_market_benchmark_return", lambda window=20: 0.0)

    @pytest.fixture(autouse=True)
    def _mock_fund_flow(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """mock f2 资金流获取，避免 L1(AKShare)/L2(hexin-v) 触发真实网络调用。

        返回 None 模拟 L1/L2/L3 全失败 → 降级 L4 量价代理（amt_ratio），
        保持与改造前 f2=amt_ranks 等价的测试断言。
        """
        import _sector_fund_flow
        monkeypatch.setattr(
            _sector_fund_flow, "fetch_sector_fund_flow", lambda sector_names=None: None
        )

    @staticmethod
    def _spot_df():
        import pandas as pd

        return pd.DataFrame({
            "行业代码": ["801120.SI", "801150.SI"],
            "行业名称": ["煤炭", "医药生物"],
            "上级行业": ["采掘", "医药"],
            "成份个数": [50, 40],
            "静态市盈率": [10.0, 30.0],
            "市净率": [1.0, 3.0],
        })

    @staticmethod
    def _flat_hist(n: int = 30):
        import pandas as pd

        return pd.DataFrame({
            "收盘": [100.0] * n,
            "成交量": [1000.0] * n,
            "成交额": [10000.0] * n,
        })

    def test_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """成功返回板块评分列表，字段完整"""
        spot_df = self._spot_df()
        hist_df = self._flat_hist(30)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": hist_df,
        )

        items = fetch_sector_rotation_scores(topN=2)
        assert len(items) == 2
        coal = next(i for i in items if i.sectorCode == "801120.SI")
        assert coal.sectorName == "煤炭"
        assert coal.swLevel1 == "采掘"
        assert coal.modelUsed == "akshare-sw-v1"
        assert coal.scoreDate == datetime.now().strftime("%Y-%m-%d")
        # f4 RS 在 flat_hist + mock 大盘0 下，两板块 rs 相同，归一化后 0/100 不定，仅校验范围
        assert 0.0 <= coal.f4Beta <= 100.0
        assert coal.resonance == coal.total / 10.0

    def test_signal_strong_and_weak(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """构造差异数据验证 signal/alertLevel 全部分支"""
        import pandas as pd

        spot_df = pd.DataFrame({
            "行业代码": ["801120.SI", "801150.SI"],
            "行业名称": ["煤炭", "医药生物"],
            "上级行业": ["采掘", "医药"],
            "成份个数": [50, 40],
            "静态市盈率": [5.0, 50.0],
            "市净率": [0.5, 5.0],
        })
        rising_hist = pd.DataFrame({
            "收盘": [100.0] * 24 + [100.0, 120.0, 140.0, 160.0, 180.0, 200.0],
            "成交量": [1000.0] * 20 + [2000.0] * 10,
            "成交额": [10000.0] * 20 + [20000.0] * 10,
        })
        flat_hist = self._flat_hist(30)

        def _hist(symbol, period="day"):
            return rising_hist if "801120" in symbol else flat_hist

        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=_hist,
        )

        items = fetch_sector_rotation_scores(topN=2)
        assert len(items) == 2
        coal = next(i for i in items if i.sectorCode == "801120.SI")
        pharma = next(i for i in items if i.sectorCode == "801150.SI")
        # 煤炭在所有因子上排名第一 → total=100 → 强势上攻/正常
        assert coal.total == 100.0
        assert coal.signal == "强势上攻"
        assert coal.alertLevel == "正常"
        # 医药在所有因子上排名末位 → total=0 → 弱势/预警
        assert pharma.total == 0.0
        assert pharma.signal == "弱势"
        assert pharma.alertLevel == "预警"

    def test_single_sector_low_score(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """单板块时归一化排名为 0 → total=0 → 弱势/预警"""
        import pandas as pd

        spot_df = pd.DataFrame({
            "行业代码": ["801120.SI"],
            "行业名称": ["煤炭"],
            "上级行业": ["采掘"],
            "成份个数": [50],
            "静态市盈率": [10.0],
            "市净率": [1.0],
        })
        hist_df = self._flat_hist(30)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": hist_df,
        )

        items = fetch_sector_rotation_scores(topN=1)
        assert len(items) == 1
        assert items[0].total == 0.0
        assert items[0].signal == "弱势"
        assert items[0].alertLevel == "预警"

    def test_two_sectors_mid_score(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """两板块一升一平，居中者 total 落在 30-70 区间 → 观望/震荡上行"""
        import pandas as pd

        spot_df = pd.DataFrame({
            "行业代码": ["801120.SI", "801150.SI"],
            "行业名称": ["煤炭", "医药生物"],
            "上级行业": ["采掘", "医药"],
            "成份个数": [50, 40],
            "静态市盈率": [10.0, 10.0],
            "市净率": [1.0, 1.0],
        })
        rising_hist = pd.DataFrame({
            "收盘": [100.0] * 24 + [100.0, 110.0, 120.0, 130.0, 140.0, 150.0],
            "成交量": [1000.0] * 30,
            "成交额": [10000.0] * 30,
        })
        flat_hist = self._flat_hist(30)

        def _hist(symbol, period="day"):
            return rising_hist if "801120" in symbol else flat_hist

        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=_hist,
        )

        items = fetch_sector_rotation_scores(topN=2)
        assert len(items) == 2
        coal = next(i for i in items if i.sectorCode == "801120.SI")
        # 煤炭在 change 上排第一（f1=100），其它因子两板块相同 → 排序后煤炭居首
        assert 30.0 <= coal.total <= 100.0
        assert coal.signal in ("震荡上行", "强势上攻", "观望")

    def test_empty_spot_returns_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """空板块列表 → 返回空列表"""
        import pandas as pd

        spot_df = pd.DataFrame({
            "行业代码": [], "行业名称": [], "上级行业": [],
            "成份个数": [], "静态市盈率": [],
        })
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": self._flat_hist(),
        )
        assert fetch_sector_rotation_scores(topN=2) == []

    def test_hist_too_short_returns_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """所有板块 hist 长度 < 25 → 全部被跳过 → 空列表"""
        spot_df = self._spot_df()
        short_hist = self._flat_hist(10)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": short_hist,
        )
        assert fetch_sector_rotation_scores(topN=2) == []

    def test_hist_exception_returns_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """index_hist_sw 抛异常 → calc_sector 返回 None → 空列表"""
        spot_df = self._spot_df()

        def _raise(symbol, period="day"):
            raise RuntimeError("hist 接口失败")

        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=_raise,
        )
        assert fetch_sector_rotation_scores(topN=2) == []

    def test_topn_limits_sectors(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """topN 限制返回的板块数量（按成份个数降序取前 N）"""
        import pandas as pd

        spot_df = pd.DataFrame({
            "行业代码": ["A.SI", "B.SI", "C.SI"],
            "行业名称": ["A", "B", "C"],
            "上级行业": ["X", "X", "X"],
            "成份个数": [50, 40, 30],
            "静态市盈率": [10.0, 20.0, 30.0],
            "市净率": [1.0, 2.0, 3.0],
        })
        hist_df = self._flat_hist(30)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": hist_df,
        )
        items = fetch_sector_rotation_scores(topN=2)
        assert len(items) == 2
        codes = {i.sectorCode for i in items}
        assert codes == {"A.SI", "B.SI"}

    def test_f2_uses_real_fund_flow(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """f2 优先使用真实主力净流入（mock 返回匹配的资金流数据）。

        覆盖 autouse fixture 的 None mock，返回模拟资金流：
        - 煤炭净流入 +50亿（最高）→ f2 应为 100
        - 医药净流入 -30亿（最低）→ f2 应为 0

        _normalize_to_100 升序排名：最小值得 0，最大值得 100。
        """
        import _sector_fund_flow

        mock_fund_flow = {"煤炭": 50.0, "医药生物": -30.0}
        monkeypatch.setattr(
            _sector_fund_flow,
            "fetch_sector_fund_flow",
            lambda sector_names=None: dict(mock_fund_flow),
        )

        spot_df = self._spot_df()  # 煤炭 + 医药生物
        hist_df = self._flat_hist(30)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": hist_df,
        )

        items = fetch_sector_rotation_scores(topN=2)
        assert len(items) == 2
        coal = next(i for i in items if i.sectorCode == "801120.SI")
        pharma = next(i for i in items if i.sectorCode == "801150.SI")
        assert coal.f2Zijin == 100.0, f"煤炭 f2 应为 100（净流入最高），实际 {coal.f2Zijin}"
        assert pharma.f2Zijin == 0.0, f"医药 f2 应为 0（净流入最低），实际 {pharma.f2Zijin}"

    def test_f2_low_match_rate_fallback_l4(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """f2 匹配率 <50% 时降级 L4 量价代理（amt_ratio）。

        mock 返回完全不匹配的行业数据 → 匹配率 0% < 50% → 降级 L4。
        flat_hist 下两板块 amt_ratio 相同，归一化后 0/100 各一个。
        """
        import _sector_fund_flow

        mock_fund_flow = {"不存在的行业XYZ": 100.0}
        monkeypatch.setattr(
            _sector_fund_flow,
            "fetch_sector_fund_flow",
            lambda sector_names=None: dict(mock_fund_flow),
        )

        spot_df = self._spot_df()
        hist_df = self._flat_hist(30)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": hist_df,
        )

        items = fetch_sector_rotation_scores(topN=2)
        assert len(items) == 2
        # 降级 L4 后 f2 仍为有效分值
        f2_values = {i.sectorCode: i.f2Zijin for i in items}
        assert all(0.0 <= v <= 100.0 for v in f2_values.values())
        # flat_hist 下 amt_ratio 相同，归一化后应有一个 0 一个 100
        assert 0.0 in f2_values.values()
        assert 100.0 in f2_values.values()

    def test_f2_match_rate_exactly_50_percent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """f2 匹配率正好 50% 时使用真实资金流（边界：>= 50% 达标）。

        2 个板块中 1 个匹配 → 匹配率 1/2 = 50% ≥ 50% → 真实资金流
        - 煤炭匹配（净流入 +50亿）→ f2=100（最大值）
        - 医药未匹配（填 0 中性）→ f2=0（0 < 50）
        """
        import _sector_fund_flow

        mock_fund_flow = {"煤炭": 50.0}  # 只匹配煤炭
        monkeypatch.setattr(
            _sector_fund_flow,
            "fetch_sector_fund_flow",
            lambda sector_names=None: dict(mock_fund_flow),
        )

        spot_df = self._spot_df()  # 煤炭 + 医药生物
        hist_df = self._flat_hist(30)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": hist_df,
        )

        items = fetch_sector_rotation_scores(topN=2)
        assert len(items) == 2
        coal = next(i for i in items if i.sectorCode == "801120.SI")
        pharma = next(i for i in items if i.sectorCode == "801150.SI")
        # 匹配率 50% ≥ 50% → 真实资金流
        assert coal.f2Zijin == 100.0, f"煤炭 f2 应为 100（净流入最高），实际 {coal.f2Zijin}"
        assert pharma.f2Zijin == 0.0, f"医药 f2 应为 0（未匹配填0），实际 {pharma.f2Zijin}"

    def test_f2_match_rate_just_below_50_percent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """f2 匹配率 <50% 时降级 L4 量价代理（边界：< 50% 不达标）。

        3 个板块中 1 个匹配 → 匹配率 1/3 ≈ 33.3% < 50% → 降级 L4。
        flat_hist 下 amt_ratio 相同，3 个相同值归一化后得 0/50/100。
        """
        import _sector_fund_flow
        import pandas as pd

        mock_fund_flow = {"煤炭": 50.0}  # 只匹配煤炭，3 板块中匹配率 33.3%
        monkeypatch.setattr(
            _sector_fund_flow,
            "fetch_sector_fund_flow",
            lambda sector_names=None: dict(mock_fund_flow),
        )

        spot_df = pd.DataFrame({
            "行业代码": ["801120.SI", "801150.SI", "801080.SI"],
            "行业名称": ["煤炭", "医药生物", "半导体"],
            "上级行业": ["采掘", "医药", "电子"],
            "成份个数": [50, 40, 30],
            "静态市盈率": [10.0, 30.0, 50.0],
            "市净率": [1.0, 3.0, 5.0],
        })
        hist_df = self._flat_hist(30)
        _make_mock_akshare(
            monkeypatch,
            sw_index_second_info=lambda: spot_df,
            index_hist_sw=lambda symbol, period="day": hist_df,
        )

        items = fetch_sector_rotation_scores(topN=3)
        assert len(items) == 3
        # 匹配率 33.3% < 50% → 降级 L4（amt_ratio）
        # flat_hist 下 3 个 amt_ratio 相同，归一化后 0/50/100
        f2_values = {i.sectorCode: i.f2Zijin for i in items}
        assert all(0.0 <= v <= 100.0 for v in f2_values.values())
        assert 0.0 in f2_values.values(), "降级 L4 后应有 f2=0 的板块"
        assert 100.0 in f2_values.values(), "降级 L4 后应有 f2=100 的板块"


# ============================================================
# f2Zijin 三层降级编排测试（_sector_fund_flow.py L1→L2→L3→L4）
# ============================================================


class TestSectorFundFlowDegradation:
    """fetch_sector_fund_flow 三层降级编排测试。

    覆盖场景：
    - L1 失败 → L2 兜底 → SQLite 写入
    - L1+L2 失败 → L3 SQLite 缓存读取（AVG 聚合）
    - L1+L2+L3 全失败 → 返回 None（调用方降级 L4）
    """

    # 测试用行业名前缀，避免污染真实行业数据
    _TEST_PREFIX = "__test_degradation_"

    @pytest.fixture(autouse=True)
    def _cleanup_test_data(self) -> None:
        """每个测试后清理测试行业数据，避免 SQLite 污染。"""
        yield
        import _sector_fund_flow_db as db
        conn = db._get_conn()
        try:
            conn.execute(
                "DELETE FROM sector_fund_flow WHERE sector_name LIKE ?",
                (f"{self._TEST_PREFIX}%",),
            )
            conn.commit()
        finally:
            conn.close()

    def test_l1_fail_l2_fallback_with_sqlite_write(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """L1 失败 → L2 兜底 → 验证返回数据 + SQLite 写入。"""
        import _sector_fund_flow as ff
        import _sector_fund_flow_db as db

        mock_l2_data = {
            f"{self._TEST_PREFIX}白酒": 12.5,
            f"{self._TEST_PREFIX}银行": -8.3,
            f"{self._TEST_PREFIX}半导体": 25.7,
        }
        monkeypatch.setattr(ff, "fetch_sector_fund_flow_l1", lambda: None)
        monkeypatch.setattr(
            ff, "fetch_sector_fund_flow_l2", lambda: dict(mock_l2_data)
        )

        result = ff.fetch_sector_fund_flow(sector_names=list(mock_l2_data.keys()))

        assert result is not None
        assert len(result) == 3
        assert result[f"{self._TEST_PREFIX}白酒"] == 12.5
        assert result[f"{self._TEST_PREFIX}银行"] == -8.3

        # 验证 SQLite 写入
        avg = db.get_recent_avg_net_amount(
            f"{self._TEST_PREFIX}白酒", days=1
        )
        assert avg == 12.5, f"SQLite 中白酒净流入应为 12.5，实际 {avg}"

    def test_l1_l2_fail_l3_cache_fallback(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """L1+L2 失败 → L3 SQLite 缓存读取 + AVG 聚合验证。"""
        import _sector_fund_flow as ff
        import _sector_fund_flow_db as db
        from datetime import datetime, timedelta

        sector_name = f"{self._TEST_PREFIX}avg_test"

        # 预置 5 天波动数据：10.0, 10.5, 11.0, 11.5, 12.0 → 均值 11.0
        today = datetime.now()
        rows = []
        for days_ago in range(5):
            date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
            rows.append({
                "date": date,
                "sector_code": sector_name,
                "sector_name": sector_name,
                "net_amount": 10.0 + days_ago * 0.5,
                "source": "test",
                "fetched_at": date + "T10:00:00",
            })
        written = db.upsert_batch(rows)
        assert written == 5

        monkeypatch.setattr(ff, "fetch_sector_fund_flow_l1", lambda: None)
        monkeypatch.setattr(ff, "fetch_sector_fund_flow_l2", lambda: None)

        result = ff.fetch_sector_fund_flow(sector_names=[sector_name])

        assert result is not None
        expected_avg = (10.0 + 10.5 + 11.0 + 11.5 + 12.0) / 5  # 11.0
        assert abs(result[sector_name] - expected_avg) < 0.01, (
            f"L3 AVG 应为 {expected_avg}，实际 {result[sector_name]}"
        )

    def test_all_fail_returns_none(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """L1+L2+L3 全失败 → 返回 None（调用方降级 L4）。"""
        import _sector_fund_flow as ff

        monkeypatch.setattr(ff, "fetch_sector_fund_flow_l1", lambda: None)
        monkeypatch.setattr(ff, "fetch_sector_fund_flow_l2", lambda: None)

        # 查询不存在的行业，L3 缓存也不会命中
        result = ff.fetch_sector_fund_flow(
            sector_names=[f"{self._TEST_PREFIX}nonexistent"]
        )
        assert result is None

    def test_l1_exception_caught_fallback_l2(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """L1 抛异常（非返回 None）→ try/except 捕获 → 降级 L2。"""
        import _sector_fund_flow as ff
        import _sector_fund_flow_db as db

        def _l1_raise():
            raise RuntimeError("mock: AKShare 连接超时")

        mock_l2_data = {f"{self._TEST_PREFIX}exception": 15.0}
        monkeypatch.setattr(ff, "fetch_sector_fund_flow_l1", _l1_raise)
        monkeypatch.setattr(
            ff, "fetch_sector_fund_flow_l2", lambda: dict(mock_l2_data)
        )

        result = ff.fetch_sector_fund_flow(
            sector_names=list(mock_l2_data.keys())
        )

        assert result is not None
        assert result[f"{self._TEST_PREFIX}exception"] == 15.0
        # 验证 SQLite 写入（L2 成功后应持久化）
        avg = db.get_recent_avg_net_amount(
            f"{self._TEST_PREFIX}exception", days=1
        )
        assert avg == 15.0


# ============================================================
# SectorFundFlowStreamer 分钟级流式采集器测试
# ============================================================


class TestSectorFundFlowStreamer:
    """SectorFundFlowStreamer 内存环形缓冲 + 5 分钟批量写入测试。

    覆盖场景：
    - 单次轮询 → 缓冲区写入
    - 5 次轮询 → 触发批量写入 SQLite
    - 轮询失败 → 不清空缓冲区
    - 环形缓冲满 → 丢弃最旧
    - get_latest / get_history / get_stats 查询接口
    """

    _TEST_PREFIX = "__test_streamer_"

    @pytest.fixture(autouse=True)
    def _cleanup(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """每个测试前后清理 SQLite 测试数据 + mock upsert_batch。"""
        import _sector_fund_flow_db as db

        # mock upsert_batch 避免真实 SQLite 写入（测试隔离）
        self._written_rows: list[dict] = []
        monkeypatch.setattr(
            db, "upsert_batch", self._mock_upsert_batch
        )

        yield

        # 测试后清理
        conn = db._get_conn()
        try:
            conn.execute(
                "DELETE FROM sector_fund_flow WHERE sector_name LIKE ?",
                (f"{self._TEST_PREFIX}%",),
            )
            conn.commit()
        finally:
            conn.close()

    def _mock_upsert_batch(self, rows: list[dict]) -> int:
        """记录写入调用，不实际写 SQLite。"""
        self._written_rows.extend(rows)
        return len(rows)

    def _make_streamer(self) -> "SectorFundFlowStreamer":
        """创建独立 streamer 实例（不使用全局单例）。"""
        from _sector_fund_flow_streamer import SectorFundFlowStreamer
        return SectorFundFlowStreamer()

    def _mock_fund_flow(self, monkeypatch, data: dict[str, float]) -> None:
        """mock fetch_sector_fund_flow 返回固定数据。"""
        import _sector_fund_flow as ff
        monkeypatch.setattr(
            ff, "fetch_sector_fund_flow", lambda sector_names=None: dict(data)
        )

    def test_poll_once_buffers_data(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """单次轮询 → 缓冲区写入 1 条快照。"""
        streamer = self._make_streamer()
        mock_data = {f"{self._TEST_PREFIX}白酒": 12.5, f"{self._TEST_PREFIX}银行": -8.3}
        self._mock_fund_flow(monkeypatch, mock_data)

        streamer._poll_once()

        assert len(streamer._buffer) == 1
        snapshot = streamer._buffer[0]
        assert snapshot["count"] == 2
        assert snapshot["sectors"][f"{self._TEST_PREFIX}白酒"] == 12.5
        assert streamer._poll_count == 1

    def test_batch_write_after_5_polls(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """5 次轮询后触发批量写入（第 5 次 _poll_count % 5 == 0）。"""
        streamer = self._make_streamer()
        mock_data = {f"{self._TEST_PREFIX}白酒": 10.0}
        self._mock_fund_flow(monkeypatch, mock_data)

        for _ in range(5):
            streamer._poll_once()

        # 5 次轮询后缓冲区有 5 条
        assert len(streamer._buffer) == 5
        # 第 5 次触发批量写入，同行业 5 次去重后 1 条
        assert len(self._written_rows) == 1
        # 待写队列已清空
        assert len(streamer._pending_writes) == 0
        assert streamer._last_write_time is not None

    def test_no_batch_write_before_5_polls(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """4 次轮询不触发批量写入。"""
        streamer = self._make_streamer()
        mock_data = {f"{self._TEST_PREFIX}白酒": 10.0}
        self._mock_fund_flow(monkeypatch, mock_data)

        for _ in range(4):
            streamer._poll_once()

        assert len(self._written_rows) == 0
        assert len(streamer._pending_writes) == 4

    def test_poll_failure_doesnt_clear_buffer(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """轮询失败不清空缓冲区，仅记录错误。"""
        streamer = self._make_streamer()
        import _sector_fund_flow as ff

        # 第一次成功
        self._mock_fund_flow(monkeypatch, {f"{self._TEST_PREFIX}白酒": 10.0})
        streamer._poll_once()
        assert len(streamer._buffer) == 1

        # 第二次失败
        monkeypatch.setattr(ff, "fetch_sector_fund_flow", lambda sector_names=None: None)
        streamer._poll_once()

        # 缓冲区仍为 1（失败不追加）
        assert len(streamer._buffer) == 1
        assert streamer._last_error == "L1/L2/L3 全失败"
        assert streamer._poll_count == 2

    def test_buffer_maxlen_drops_oldest(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """环形缓冲满后丢弃最旧数据。"""
        from _sector_fund_flow_streamer import SectorFundFlowStreamer

        # 创建小容量 streamer 方便测试
        streamer = SectorFundFlowStreamer()
        streamer.BUFFER_MAXLEN = 3
        streamer._buffer = __import__("collections").deque(maxlen=3)

        mock_data = {f"{self._TEST_PREFIX}白酒": 10.0}
        self._mock_fund_flow(monkeypatch, mock_data)

        for i in range(5):
            streamer._poll_once()

        # 缓冲区容量 3，只保留最后 3 条
        assert len(streamer._buffer) == 3
        # 第一条和第二条被丢弃
        timestamps = [s["timestamp"] for s in streamer._buffer]
        assert len(timestamps) == 3

    def test_get_latest(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """get_latest 返回最新一次轮询数据。"""
        streamer = self._make_streamer()
        self._mock_fund_flow(monkeypatch, {
            f"{self._TEST_PREFIX}白酒": 12.5,
            f"{self._TEST_PREFIX}银行": -8.3,
        })
        streamer._poll_once()

        latest = streamer.get_latest()
        assert latest[f"{self._TEST_PREFIX}白酒"] == 12.5
        assert latest[f"{self._TEST_PREFIX}银行"] == -8.3

        # 过滤查询
        filtered = streamer.get_latest(sector_names=[f"{self._TEST_PREFIX}白酒"])
        assert len(filtered) == 1
        assert filtered[f"{self._TEST_PREFIX}白酒"] == 12.5

    def test_get_latest_empty_buffer(self) -> None:
        """空缓冲区时 get_latest 返回空字典。"""
        streamer = self._make_streamer()
        assert streamer.get_latest() == {}

    def test_get_history(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """get_history 返回最近 N 条快照（升序）。"""
        streamer = self._make_streamer()
        self._mock_fund_flow(monkeypatch, {f"{self._TEST_PREFIX}白酒": 10.0})

        for _ in range(3):
            streamer._poll_once()

        # 获取最近 2 条
        history = streamer.get_history(minutes=2)
        assert len(history) == 2
        # 升序排列（最旧在前）
        assert history[0]["timestamp"] <= history[1]["timestamp"]

    def test_get_stats(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """get_stats 返回运行状态。"""
        streamer = self._make_streamer()
        self._mock_fund_flow(monkeypatch, {f"{self._TEST_PREFIX}白酒": 10.0})
        streamer._poll_once()

        stats = streamer.get_stats()
        assert stats["poll_count"] == 1
        assert stats["buffer_size"] == 1
        assert stats["buffer_capacity"] == 240
        assert stats["running"] is False  # 未调用 start()
        assert stats["last_error"] is None
        assert stats["poll_interval_sec"] == 60
        assert stats["batch_write_threshold"] == 5

    def test_dedup_in_flush(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """批量写入去重：同一 sector_code 多次轮询只保留最新。"""
        streamer = self._make_streamer()
        import _sector_fund_flow as ff

        # 5 次轮询，同一行业不同值
        values = [10.0, 11.0, 12.0, 13.0, 14.0]
        for v in values:
            monkeypatch.setattr(
                ff,
                "fetch_sector_fund_flow",
                lambda sector_names=None, _v=v: {f"{self._TEST_PREFIX}白酒": _v},
            )
            streamer._poll_once()

        # 5 次轮询触发批量写入，去重后只保留最新值 14.0
        assert len(self._written_rows) == 1  # 去重后 1 条
        assert self._written_rows[0]["net_amount"] == 14.0


# ============================================================
# 健康检查模型：HealthCheckResponse error 字段默认值
# ============================================================


class TestHealthCheckResponseModel:
    """HealthCheckResponse 模型字段（补充 error 默认值覆盖）"""

    def test_error_defaults_to_none(self, client: TestClient) -> None:
        """健康端点不返回 error，模型 error 默认 None"""
        body = client.get("/health").json()
        assert body.get("error") is None

    def test_error_field_settable(self) -> None:
        """HealthCheckResponse 可显式设置 error 字段"""
        from collect_endpoints import HealthCheckResponse

        resp = HealthCheckResponse(
            status="degraded", service="v9-data-collector", version="0.1.0", error="db down"
        )
        assert resp.error == "db down"
        assert resp.status == "degraded"
