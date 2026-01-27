import os
import sys

from fastapi.testclient import TestClient

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"


def test_estimate_plan_returns_totals():
    payload = {
        "budget": 2000,
        "goal": "leads",
        "avg_frequency": 1.6,
        "period_days": 30,
        "targeting_depth": "balanced",
        "seasonality": 1.0,
        "country": "kz",
        "pricing_mode": "auto",
        "platforms": ["meta", "google_display_cpm", "google_search", "youtube", "tiktok"],
    }
    resp = client.post("/plans/estimate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["totals"]["budget"] == payload["budget"]
    assert len(data["lines"]) == len(payload["platforms"])


def test_excel_endpoint_streams_file():
    payload = {
        "budget": 1500,
        "goal": "traffic",
        "avg_frequency": 1.5,
        "period_days": 30,
        "targeting_depth": "balanced",
        "seasonality": 1.0,
        "country": "uz",
    }
    resp = client.post("/plans/estimate/excel", json=payload)
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in resp.headers.get("content-type", "")
    assert resp.headers.get("content-disposition", "").startswith("attachment;")
    assert len(resp.content) > 100  # workbook bytes
