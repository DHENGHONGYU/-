"""
Embedding Service 单元测试

覆盖 embedding_service.py 的全部 FastAPI 端点与错误处理分支。
通过 mock httpx.AsyncClient 隔离对 daemon 的网络依赖。

运行方式：
    cd backend
    pytest test_embedding_service.py -v
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from embedding_service import app, DAEMON_URL


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _make_mock_httpx_client(response_status: int = 200, response_json: dict | None = None, response_text: str = ""):
    """
    构建一个可替代 httpx.AsyncClient 的 mock。

    使用方式：
        with patch("embedding_service.httpx.AsyncClient", return_value=_make_mock_httpx_client(200, {...})):
            client.get("/api/embed/health")

    内部实现 async context manager 协议 (__aenter__ / __aexit__)。
    注意：httpx.AsyncClient 的 get/post 返回的是 coroutine（被 await），
    所以 get/post 必须用 AsyncMock 而非 MagicMock。
    """
    mock_resp = MagicMock()
    mock_resp.status_code = response_status
    mock_resp.json.return_value = response_json or {}
    mock_resp.text = response_text

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.post = AsyncMock(return_value=mock_resp)

    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    return mock_client


def _make_mock_httpx_raises(exception):
    """
    构建一个会抛出异常的 mock httpx.AsyncClient。
    get/post 直接抛出异常（非 await 形式，因为异常在调用时立即触发）。
    """
    mock_client = MagicMock()
    mock_client.get.side_effect = exception
    mock_client.post.side_effect = exception
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


# ============================================================
# Root endpoint
# ============================================================


class TestRoot:
    def test_root_returns_service_info(self, client: TestClient) -> None:
        resp = client.get("/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["service"] == "V9 Embedding Service"
        assert body["version"] == "1.0.0"
        assert body["daemon_url"] == DAEMON_URL

    def test_root_lists_endpoints(self, client: TestClient) -> None:
        body = client.get("/").json()
        assert len(body["endpoints"]) == 3
        assert "/api/embed/health" in body["endpoints"][0]
        assert "/api/embed" in body["endpoints"][1]
        assert "/api/embed/batch" in body["endpoints"][2]


# ============================================================
# Health check
# ============================================================


class TestHealthCheck:
    def test_health_daemon_healthy(self, client: TestClient) -> None:
        mock_client = _make_mock_httpx_client(200, {
            "status": "ok",
            "model_loaded": True,
            "model_id": "all-MiniLM-L6-v2",
        })
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.get("/api/embed/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["model_loaded"] is True
        assert body["model_id"] == "all-MiniLM-L6-v2"

    def test_health_daemon_unhealthy(self, client: TestClient) -> None:
        mock_client = _make_mock_httpx_client(503, {
            "status": "loading",
            "model_loaded": False,
            "model_id": "all-MiniLM-L6-v2",
        })
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.get("/api/embed/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "unhealthy"
        assert body["model_loaded"] is False

    def test_health_daemon_unreachable(self, client: TestClient) -> None:
        import httpx
        mock_client = _make_mock_httpx_raises(httpx.ConnectError("Connection refused"))
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.get("/api/embed/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "unreachable"
        assert body["model_loaded"] is False

    def test_health_daemon_timeout(self, client: TestClient) -> None:
        import httpx
        mock_client = _make_mock_httpx_raises(httpx.TimeoutException("Request timed out"))
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.get("/api/embed/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "unreachable"


# ============================================================
# Embed endpoint
# ============================================================


class TestEmbed:
    def test_embed_success(self, client: TestClient) -> None:
        mock_client = _make_mock_httpx_client(200, {
            "vector": [0.1, 0.2, 0.3],
            "dimension": 3,
            "model_id": "all-MiniLM-L6-v2",
        })
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed", json={"text": "Hello world"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["vector"] == [0.1, 0.2, 0.3]
        assert body["dimension"] == 3
        assert body["model_id"] == "all-MiniLM-L6-v2"

    def test_embed_with_custom_pooling(self, client: TestClient) -> None:
        mock_client = _make_mock_httpx_client(200, {
            "vector": [0.1, 0.2],
            "dimension": 2,
            "model_id": "all-MiniLM-L6-v2",
        })
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed", json={"text": "Test", "pooling": "max"})
        assert resp.status_code == 200

    def test_embed_daemon_error(self, client: TestClient) -> None:
        mock_client = _make_mock_httpx_client(500, response_text="Internal daemon error")
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed", json={"text": "Hello"})
        assert resp.status_code == 500
        assert "Daemon error" in resp.json()["detail"]

    def test_embed_daemon_unreachable(self, client: TestClient) -> None:
        import httpx
        mock_client = _make_mock_httpx_raises(httpx.ConnectError("Connection refused"))
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed", json={"text": "Hello"})
        assert resp.status_code == 503
        assert "not available" in resp.json()["detail"]

    def test_embed_daemon_timeout(self, client: TestClient) -> None:
        import httpx
        mock_client = _make_mock_httpx_raises(httpx.TimeoutException("Request timed out"))
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed", json={"text": "Hello"})
        assert resp.status_code == 504
        assert "timed out" in resp.json()["detail"].lower()

    def test_embed_validation_missing_text(self, client: TestClient) -> None:
        resp = client.post("/api/embed", json={})
        assert resp.status_code == 422

    def test_embed_validation_invalid_type(self, client: TestClient) -> None:
        resp = client.post("/api/embed", json={"text": 123})
        assert resp.status_code == 422


# ============================================================
# Batch embed endpoint
# ============================================================


class TestBatchEmbed:
    def test_batch_embed_success(self, client: TestClient) -> None:
        mock_client = _make_mock_httpx_client(200, {
            "vectors": [[0.1, 0.2], [0.3, 0.4]],
            "dimension": 2,
            "model_id": "all-MiniLM-L6-v2",
        })
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed/batch", json=["Hello", "World"])
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["vectors"]) == 2
        assert body["dimension"] == 2

    def test_batch_embed_daemon_error(self, client: TestClient) -> None:
        mock_client = _make_mock_httpx_client(500, response_text="Batch error")
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed/batch", json=["Hello"])
        assert resp.status_code == 500

    def test_batch_embed_daemon_unreachable(self, client: TestClient) -> None:
        import httpx
        mock_client = _make_mock_httpx_raises(httpx.ConnectError("Connection refused"))
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed/batch", json=["Hello"])
        assert resp.status_code == 503

    def test_batch_embed_daemon_timeout(self, client: TestClient) -> None:
        import httpx
        mock_client = _make_mock_httpx_raises(httpx.TimeoutException("Request timed out"))
        with patch("embedding_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post("/api/embed/batch", json=["Hello"])
        assert resp.status_code == 504

    def test_batch_embed_validation_invalid_item_type(self, client: TestClient) -> None:
        resp = client.post("/api/embed/batch", json=[123, 456])
        assert resp.status_code == 422

    def test_batch_embed_validation_invalid_type(self, client: TestClient) -> None:
        resp = client.post("/api/embed/batch", json={"not": "a list"})
        assert resp.status_code == 422


# ============================================================
# CORS middleware
# ============================================================


class TestCORS:
    def test_cors_headers_present(self, client: TestClient) -> None:
        resp = client.options(
            "/api/embed/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers

    def test_cors_allow_all_origins(self, client: TestClient) -> None:
        resp = client.get("/", headers={"Origin": "https://any-origin.com"})
        assert resp.status_code == 200


# ============================================================
# Configuration & smoke tests
# ============================================================


class TestConfiguration:
    def test_daemon_url_default(self) -> None:
        import embedding_service
        assert hasattr(embedding_service, "DAEMON_URL")
        assert "8765" in embedding_service.DAEMON_URL

    def test_service_app_title(self, client: TestClient) -> None:
        body = client.get("/").json()
        assert body["service"] == "V9 Embedding Service"

    def test_all_endpoints_respond(self, client: TestClient) -> None:
        """Smoke test: all endpoints return valid HTTP responses."""
        assert client.get("/").status_code == 200
        assert client.get("/api/embed/health").status_code in (200,)
        assert client.post("/api/embed", json={"text": "test"}).status_code in (200, 503, 504)
        assert client.post("/api/embed/batch", json=["test"]).status_code in (200, 503, 504)