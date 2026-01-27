"""
Generate a sample media plan Excel file without running the API server.

Usage:
  python scripts/generate_sample_excel.py

The file `mediaplan_sample.xlsx` will be saved in the project root.
"""
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import PlanRequest, build_plan, plan_to_workbook


def main() -> None:
    req = PlanRequest(
        budget=2000,
        goal="leads",
        avg_frequency=1.6,
        period_days=30,
        targeting_depth="balanced",
        seasonality=1.0,
        pricing_mode="auto",
        country="kz",
        platforms=[
            "meta",
            "google_display_cpm",
            "google_display_cpc",
            "google_search",
            "google_shopping",
            "youtube",
            "tiktok",
        ],
    )

    plan = build_plan(req)
    workbook = plan_to_workbook(plan, req)

    out_path = Path(__file__).resolve().parent.parent / "mediaplan_sample.xlsx"
    with open(out_path, "wb") as f:
        f.write(workbook.getvalue())

    print(f"Sample Excel saved to {out_path}")


if __name__ == "__main__":
    main()
