"""
analytics_engine.py
Pattern detection and trend analysis for weekly data.
"""

from typing import List


def compute_trend(values: List[float]) -> str:
    """Simple linear regression slope indicator."""
    if len(values) < 3:
        return "stable"
    n = len(values)
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    numerator = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    slope = numerator / max(denominator, 0.001)
    relative_change = slope / max(y_mean, 0.001)
    if relative_change < -0.1:
        return "declining"
    elif relative_change > 0.1:
        return "improving"
    return "stable"
