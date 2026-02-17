#!/usr/bin/env python3
"""
Sync selected Envidicy operational tables into BigQuery.

MVP behavior:
- Pull recent rows from source DB (SQLite/Postgres via app.db.get_conn)
- Create dataset/table on first load (autodetect schema)
- For incremental windows, delete recent partition range in BQ then append rows
"""

from __future__ import annotations

import argparse
import datetime as dt
import decimal
import json
import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

from app.db import get_conn


TABLES = [
    {"name": "users", "created_col": "created_at"},
    {"name": "ad_accounts", "created_col": "created_at"},
    {"name": "topups", "created_col": "created_at"},
    {"name": "wallet_transactions", "created_col": "created_at"},
    {"name": "account_requests", "created_col": "created_at"},
    {"name": "wallet_topup_requests", "created_col": "created_at"},
]


def _serialize(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    if isinstance(value, (list, tuple)):
        return [_serialize(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize(v) for k, v in value.items()}
    return value


def _row_to_dict(row: Any) -> Dict[str, Any]:
    if isinstance(row, dict):
        return {k: _serialize(v) for k, v in row.items()}
    if hasattr(row, "keys"):
        return {k: _serialize(row[k]) for k in row.keys()}
    raise TypeError(f"Unsupported row type: {type(row)}")


def _fetch_rows(table: str, created_col: str, from_ts: str | None) -> List[Dict[str, Any]]:
    query = f"SELECT * FROM {table}"
    params: List[Any] = []
    if from_ts:
        query += f" WHERE {created_col} >= ?"
        params.append(from_ts)
    query += f" ORDER BY {created_col} ASC"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall() if params else conn.execute(query).fetchall()
    return [_row_to_dict(r) for r in rows]


def _ensure_dataset(client: bigquery.Client, project: str, dataset: str, location: str) -> None:
    dataset_id = f"{project}.{dataset}"
    try:
        client.get_dataset(dataset_id)
    except NotFound:
        ds = bigquery.Dataset(dataset_id)
        ds.location = location
        client.create_dataset(ds)


def _table_exists(client: bigquery.Client, table_id: str) -> bool:
    try:
        client.get_table(table_id)
        return True
    except NotFound:
        return False


def _delete_incremental_range(
    client: bigquery.Client,
    table_id: str,
    created_col: str,
    from_date: str,
) -> None:
    sql = f"DELETE FROM `{table_id}` WHERE DATE({created_col}) >= @from_date"
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("from_date", "DATE", from_date),
        ]
    )
    client.query(sql, job_config=job_config).result()


def _load_rows(client: bigquery.Client, table_id: str, rows: List[Dict[str, Any]]) -> int:
    if not rows:
        return 0
    total = 0
    chunk_size = 5000
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            autodetect=True,
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        )
        job = client.load_table_from_json(chunk, table_id, job_config=job_config)
        job.result()
        total += len(chunk)
    return total


def run_sync(days: int, dry_run: bool = False) -> None:
    load_dotenv()
    project = os.getenv("BQ_PROJECT_ID")
    dataset = os.getenv("BQ_DATASET", "envidicy_raw")
    location = os.getenv("BQ_LOCATION", "US")
    if not project:
        raise RuntimeError("BQ_PROJECT_ID is required")

    now = dt.datetime.utcnow()
    from_dt = now - dt.timedelta(days=days)
    from_ts = from_dt.strftime("%Y-%m-%d %H:%M:%S")
    from_date = from_dt.strftime("%Y-%m-%d")

    client = bigquery.Client(project=project)
    _ensure_dataset(client, project, dataset, location)

    print(f"[bq_sync] project={project} dataset={dataset} location={location} days={days} dry_run={dry_run}")
    for t in TABLES:
        table_name = t["name"]
        created_col = t["created_col"]
        table_id = f"{project}.{dataset}.{table_name}"
        rows = _fetch_rows(table_name, created_col, from_ts)
        print(f"[bq_sync] {table_name}: fetched {len(rows)} rows since {from_ts}")
        if dry_run or not rows:
            continue
        exists = _table_exists(client, table_id)
        if exists:
            _delete_incremental_range(client, table_id, created_col, from_date)
        loaded = _load_rows(client, table_id, rows)
        print(f"[bq_sync] {table_name}: loaded {loaded} rows")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Envidicy DB tables to BigQuery")
    parser.add_argument("--days", type=int, default=int(os.getenv("BQ_SYNC_DAYS", "7")))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run_sync(days=args.days, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
