# Envidicy Media Plan API

FastAPI backend for media plan calculation (KZ/UZ, USD) with Excel export.

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Endpoints
- `GET /health` — ping
- `GET /rate-cards` — seed rates and benchmarks
- `POST /plans/estimate` — calculate budget split and forecast
- `POST /plans/estimate/excel` — те же расчеты, но отдаёт Excel-файл (`mediaplan.xlsx`)

### Request example
```json
{
  "budget": 2000,
  "goal": "leads",
  "avg_frequency": 1.6,
  "period_days": 30,
  "targeting_depth": "balanced",
  "seasonality": 1.0,
  "pricing_mode": "auto",
  "country": "kz",
  "platforms": ["meta", "google_display_cpm", "google_search", "youtube", "tiktok"]
}
```

## Tests

```bash
pytest
```
