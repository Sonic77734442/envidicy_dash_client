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

## BigQuery Sync (MVP)

Syncs core operational tables from app DB to BigQuery:
- `users`
- `ad_accounts`
- `topups`
- `wallet_transactions`
- `account_requests`
- `wallet_topup_requests`

### Env

```bash
BQ_PROJECT_ID=your-gcp-project
BQ_DATASET=envidicy_raw
BQ_LOCATION=US
BQ_SYNC_DAYS=7
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Run

```bash
python scripts/bq_sync.py --dry-run
python scripts/bq_sync.py --days 7
```

Recommended cron (Render Cron Job): `python scripts/bq_sync.py --days 2`
