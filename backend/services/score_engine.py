"""
score_engine.py
Life Consistency Score logic — server-side version.
"""


def calculate_consistency_score(
    calories: float, calories_goal: float,
    protein: float, protein_goal: float,
    water_liters: float, water_goal: float,
    sleep_hours: float, sleep_goal: float,
    streaks: dict,
) -> dict:
    """Calculate the Life Consistency Score (0-100)."""
    cal_pct = min(1.0, calories / max(1, calories_goal))
    pro_pct = min(1.0, protein / max(1, protein_goal))
    wat_pct = min(1.0, water_liters / max(0.1, water_goal))
    slp_pct = min(1.0, sleep_hours / max(1, sleep_goal))

    nutrition = round((cal_pct + pro_pct) / 2 * 30)
    hydration = round(wat_pct * 20)
    sleep = round(slp_pct * 20)

    streak_values = [streaks.get("water", 0), streaks.get("protein", 0),
                     streaks.get("calories", 0), streaks.get("sleep", 0)]
    active_habits = sum(1 for s in streak_values if s > 0)
    habits = round(min(1, active_habits / 4) * 15)

    avg_streak = sum(streak_values) / max(1, len(streak_values))
    discipline = round(min(1.0, avg_streak / 7) * 15)

    total = max(0, min(100, nutrition + hydration + sleep + habits + discipline))

    return {
        "total": total,
        "breakdown": {
            "Nutrition": round(cal_pct * 100),
            "Hydration": round(wat_pct * 100),
            "Sleep": round(slp_pct * 100),
            "Habits": round(min(1, active_habits / 4) * 100),
            "Discipline": round(min(1.0, avg_streak / 7) * 100),
        },
    }
