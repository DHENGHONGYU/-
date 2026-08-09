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
    _normalize_to_100,
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
