"""
prediction_engine.py
Weight projection using linear regression on historical data.
"""

from typing import List, Optional


def project_weight(logs: List[dict], projection_days: int = 30) -> dict:
    """
    Run a simple linear regression on weight logs.
    Returns current weight, trend per day, projected weight, and a human label.
    """
    if not logs or len(logs) < 2:
        current = logs[0]["weightKg"] if logs else 0
        return {
            "current_weight": current,
            "trend_per_day": 0,
            "projected_weight": current,
            "projection_days": projection_days,
            "label": "Not enough data for projection",
            "status": "insufficient_data",
        }

    # Sort by date ascending
    sorted_logs = sorted(logs, key=lambda x: x.get("date", ""))
    earliest = sorted_logs[0]["weightKg"]
    latest = sorted_logs[-1]["weightKg"]
    days = max(1, len(sorted_logs) - 1)

    trend_per_day = (latest - earliest) / days
    projected = round(latest + trend_per_day * projection_days, 1)
    change = round(trend_per_day * projection_days, 1)

    if abs(change) < 0.5:
        label = "Weight is stable"
        status = "stable"
    elif change < 0:
        label = f"On track to lose {abs(change)}kg in {projection_days} days"
        status = "losing"
    else:
        label = f"On track to gain {change}kg in {projection_days} days"
        status = "gaining"

    return {
        "current_weight": latest,
        "trend_per_day": round(trend_per_day, 3),
        "projected_weight": projected,
        "projection_days": projection_days,
        "label": label,
        "status": status,
    }
