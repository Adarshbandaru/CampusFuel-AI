"""Analytics router — dashboard, insights, trends, heatmap, summaries."""

from fastapi import APIRouter, HTTPException
from datetime import date, datetime, timedelta
from db import db
from utils import get_user_or_404
from services.analytics_engine import compute_trend

router = APIRouter(prefix="/users", tags=["analytics"])


# ─── Firestore Helpers (legacy collections) ──────────────────────────────

def _get_fs_water(uid: str, date_str: str) -> dict:
    doc = db.collection("water").document(f"{uid}_{date_str}").get()
    return doc.to_dict() if doc.exists else {"amount_ml": 0}


def _get_fs_meals(uid: str, date_str: str) -> list:
    return [d.to_dict() for d in
            db.collection("meals").where("uid", "==", uid).where("date", "==", date_str).get()]


def _get_fs_sleep(uid: str, date_str: str) -> list:
    return [d.to_dict() for d in
            db.collection("sleep").where("uid", "==", uid).where("date", "==", date_str).get()]


# ─── Dashboard ────────────────────────────────────────────────────────────

@router.get("/{uid}/dashboard")
def get_dashboard(uid: str):
    user = get_user_or_404(uid)
    settings = user.get("settings", {})
    goals = user.get("goals", {})
    
    goal_cal = goals.get("caloriesGoal", settings.get("daily_calories_goal", 2500))
    goal_pro = goals.get("proteinGoal", settings.get("daily_protein_goal", 150))
    goal_water = float(goals.get("waterGoalLiters", settings.get("daily_water_goal_liters", 4.0)))
    goal_sleep = goals.get("sleepGoalHours", settings.get("sleep_goal", 8))
    today_str = date.today().isoformat()

    water_info = _get_fs_water(uid, today_str)
    meals = _get_fs_meals(uid, today_str)

    # Real sleep data from sleepLogs collection
    sleep_docs = db.collection("sleepLogs").where("userId", "==", uid).where("date", "==", today_str).get()
    sleep_log = sleep_docs[0].to_dict() if sleep_docs else None
    sleep_hours = (sleep_log["durationMinutes"] / 60.0) if sleep_log else 0
    sleep_quality = sleep_log.get("qualityScore", 0) if sleep_log else 0

    water_drunk_liters = water_info["amount_ml"] / 1000.0
    calories_consumed = sum(m.get("calories", 0) for m in meals)
    protein_consumed = sum(m.get("protein", 0) for m in meals)

    cal_perf = min(1.0, calories_consumed / max(1, goal_cal))
    pro_perf = min(1.0, protein_consumed / max(1, goal_pro))
    wat_perf = min(1.0, water_drunk_liters / max(0.1, goal_water))
    slp_perf = min(1.0, sleep_hours / max(1, goal_sleep))

    consistency_score = int((cal_perf * 25) + (pro_perf * 25) + (wat_perf * 25) + (slp_perf * 25))

    return {
        "water_drunk_liters": water_drunk_liters,
        "water_goal_liters": goal_water,
        "calories_consumed": int(calories_consumed),
        "calories_goal": int(goal_cal),
        "protein_consumed": int(protein_consumed),
        "protein_goal": int(goal_pro),
        "meals_todaycount": len(meals),
        "life_consistency_score": consistency_score,
        "score_reason": "Consistency is king!",
        "detailed_analysis": ["Based on real data from your logs."],
        "score_breakdown": {"Nutrition": 85, "Hydration": 90, "Sleep": 80, "Habits": 75, "Discipline": 80},
        "habit_streak": int(settings.get("water_streak", 0)),
        "meals_tracker": {"breakfast": True, "lunch": len(meals) > 1, "dinner": len(meals) > 2},
        "sleep_duration_hours": round(sleep_hours, 1),
        "sleep_quality_score": sleep_quality,
        "sleep_consistency": 92,
        "level": int(settings.get("level", 1)),
        "level_title": "Student Athlete",
        "xp_current": int(settings.get("xp", 0)),
        "xp_target": 1000,
        "xp_progress_percentage": int((int(settings.get("xp", 0)) / 1000) * 100),
        "streak_counters": {
            "Water": int(settings.get("water_streak", 0)),
            "Protein": 5, "Calories": 3, "Sleep": 8,
        },
        "achievements": list(user.get("achievements", [])),
        "badges": list(user.get("badges", [])),
        "prediction_insight": "Protein intake slightly low; consider a snack.",
        "preventive_suggestion": "Hydrate well before your next class.",
        "adaptive_reminders": ["Drink water now", "Post-workout meal"],
        "habit_recovery": [],
        "daily_challenge": {"title": "Water Warrior", "description": "Drink 4L today"},
    }


# ─── Heatmap ──────────────────────────────────────────────────────────────

@router.get("/{uid}/habits/heatmap")
def get_heatmap(uid: str):
    heatmap = []
    today = date.today()
    for i in range(30):
        d_str = (today - timedelta(days=i)).isoformat()
        water = _get_fs_water(uid, d_str)
        meals = _get_fs_meals(uid, d_str)
        sleep = _get_fs_sleep(uid, d_str)
        score = sum([water.get("amount_ml", 0) > 0, len(meals) > 0, len(sleep) > 0])
        heatmap.append({
            "date": d_str,
            "status": "met" if score >= 2 else ("partial" if score == 1 else "missed"),
            "score": score,
        })
    return {"status": "success", "heatmap_data": heatmap}


# ─── Weekly Report ────────────────────────────────────────────────────────

@router.get("/{uid}/report/weekly")
def get_weekly_report(uid: str):
    today = date.today()
    cals, pro, wat, days = 0.0, 0.0, 0.0, 0

    for i in range(7):
        d_str = (today - timedelta(days=i)).isoformat()
        day_meals = _get_fs_meals(uid, d_str)
        day_water = _get_fs_water(uid, d_str)

        m_cals = sum(float(m.get("calories", 0) or 0) for m in day_meals)
        m_pro = sum(float(m.get("protein", 0) or 0) for m in day_meals)
        m_wat = float(day_water.get("amount_ml", 0) or 0) / 1000.0

        if len(day_meals) > 0 or m_wat > 0:
            cals += m_cals
            pro += m_pro
            wat += m_wat
            days += 1

    div = float(max(1, days))
    return {
        "status": "success",
        "averages": {
            "calories": round(cals / div, 1),
            "protein": round(pro / div, 1),
            "water_liters": round(wat / div, 1),
        },
        "streak": 5,
        "insights": ["Weekly analysis complete."],
    }


# ─── Weekly Analysis ──────────────────────────────────────────────────────

@router.get("/{uid}/analyze")
def analyze_weekly(uid: str):
    get_user_or_404(uid)
    today = date.today()
    daily_data = []

    for i in range(7):
        d_str = (today - timedelta(days=i)).isoformat()
        day_meals = _get_fs_meals(uid, d_str)
        day_water = _get_fs_water(uid, d_str)
        day_sleep = _get_fs_sleep(uid, d_str)
        daily_data.append({
            "date": d_str,
            "calories": sum(m.get("calories", 0) for m in day_meals),
            "protein": sum(m.get("protein", 0) for m in day_meals),
            "water_ml": day_water.get("amount_ml", 0),
            "sleep_mins": sum(s.get("duration_minutes", 0) for s in day_sleep),
            "meals_count": len(day_meals),
        })

    cal_values = [d["calories"] for d in reversed(daily_data)]
    pro_values = [d["protein"] for d in reversed(daily_data)]
    water_values = [d["water_ml"] / 1000 for d in reversed(daily_data)]

    active_days = [d for d in daily_data if d["calories"] > 0 or d["water_ml"] > 0]
    div = max(1, len(active_days))

    cal_trend = compute_trend(cal_values)
    pro_trend = compute_trend(pro_values)
    water_trend = compute_trend(water_values)

    insights = []
    if cal_trend == "declining":
        insights.append("⚠️ Your calorie intake has been declining this week.")
    if pro_trend == "declining":
        insights.append("⚠️ Protein intake is trending downward.")
    if water_trend == "declining":
        insights.append("⚠️ Hydration is slipping.")
    if cal_trend == "improving" and pro_trend == "improving":
        insights.append("📈 Great momentum! Both nutrition metrics are improving.")
    if not insights:
        insights.append("Your weekly metrics look stable. Keep it up!")

    return {
        "status": "success",
        "daily_data": daily_data,
        "trends": {"calories": cal_trend, "protein": pro_trend, "water": water_trend},
        "averages": {
            "calories": round(sum(cal_values) / div, 1),
            "protein": round(sum(pro_values) / div, 1),
            "water_liters": round(sum(water_values) / div, 1),
        },
        "insights": insights,
        "active_days": len(active_days),
    }


# ─── Daily Summary ────────────────────────────────────────────────────────

@router.get("/{uid}/summary/today")
def get_today_summary(uid: str):
    today_str = date.today().isoformat()

    meal_docs = db.collection("mealLogs").where("userId", "==", uid).where("date", "==", today_str).get()
    meals = [d.to_dict() for d in meal_docs]

    water_docs = db.collection("waterLogs").where("userId", "==", uid).where("date", "==", today_str).get()
    water_logs = [d.to_dict() for d in water_docs]

    sleep_docs = db.collection("sleepLogs").where("userId", "==", uid).where("date", "==", today_str).get()
    sleep_log = sleep_docs[0].to_dict() if sleep_docs else None

    return {
        "meals": meals,
        "mealsCount": len(meals),
        "totalWaterMl": sum(w.get("amountMl", 0) for w in water_logs),
        "totalCalories": sum(m.get("calories", 0) for m in meals),
        "totalProtein": sum(m.get("protein", 0) for m in meals),
        "totalCarbs": sum(m.get("carbs", 0) for m in meals),
        "totalFat": sum(m.get("fat", 0) for m in meals),
        "sleepMinutes": sleep_log.get("durationMinutes", 0) if sleep_log else 0,
    }


@router.post("/{uid}/summary/daily")
def save_daily_summary(uid: str, date_str: str = None):
    if not date_str:
        date_str = date.today().isoformat()
        
    meal_docs = db.collection("mealLogs").where("userId", "==", uid).where("date", "==", date_str).get()
    meals = [d.to_dict() for d in meal_docs]

    water_docs = db.collection("waterLogs").where("userId", "==", uid).where("date", "==", date_str).get()
    water_logs = [d.to_dict() for d in water_docs]

    sleep_docs = db.collection("sleepLogs").where("userId", "==", uid).where("date", "==", date_str).get()
    sleep_log = sleep_docs[0].to_dict() if sleep_docs else None
    
    summary_data = {
        "userId": uid,
        "date": date_str,
        "mealsCount": len(meals),
        "totalWaterMl": sum(w.get("amountMl", 0) for w in water_logs),
        "totalCalories": sum(m.get("calories", 0) for m in meals),
        "totalProtein": sum(m.get("protein", 0) for m in meals),
        "totalCarbs": sum(m.get("carbs", 0) for m in meals),
        "totalFat": sum(m.get("fat", 0) for m in meals),
        "sleepMinutes": sleep_log.get("durationMinutes", 0) if sleep_log else 0,
        "savedAt": datetime.utcnow().isoformat() + "Z"
    }
    
    doc_id = f"{uid}_{date_str}"
    db.collection("dailySummary").document(doc_id).set(summary_data)
    
    return {"status": "success", "message": "Daily summary saved.", "summary": summary_data}



@router.get("/{uid}/summary/range")
def get_summary_range(uid: str, dates: str = ""):
    date_list = [d.strip() for d in dates.split(",") if d.strip()]
    results = []
    for d_str in date_list:
        meal_docs = db.collection("mealLogs").where("userId", "==", uid).where("date", "==", d_str).get()
        meals = [doc.to_dict() for doc in meal_docs]
        water_docs = db.collection("waterLogs").where("userId", "==", uid).where("date", "==", d_str).get()
        sleep_docs = db.collection("sleepLogs").where("userId", "==", uid).where("date", "==", d_str).get()
        sleep_log = sleep_docs[0].to_dict() if sleep_docs else None

        results.append({
            "date": d_str,
            "mealsCount": len(meals),
            "totalCalories": sum(m.get("calories", 0) for m in meals),
            "totalProtein": sum(m.get("protein", 0) for m in meals),
            "totalCarbs": sum(m.get("carbs", 0) for m in meals),
            "totalFat": sum(m.get("fat", 0) for m in meals),
            "totalWaterMl": sum(d.to_dict().get("amountMl", 0) for d in water_docs),
            "sleepMinutes": sleep_log.get("durationMinutes", 0) if sleep_log else 0,
        })
    return {"status": "success", "summaries": results}


# ─── Insights ─────────────────────────────────────────────────────────────

@router.get("/{uid}/insights")
def get_insights(uid: str):
    user = get_user_or_404(uid)
    settings = user.get("settings", {})
    goals = user.get("goals", {})
    
    goal_cal = goals.get("caloriesGoal", settings.get("daily_calories_goal", 2500))
    goal_pro = goals.get("proteinGoal", settings.get("daily_protein_goal", 150))
    goal_water = float(goals.get("waterGoalLiters", settings.get("daily_water_goal_liters", 4.0)))
    goal_sleep = goals.get("sleepGoalHours", settings.get("sleep_goal", 8))
    
    today_str = date.today().isoformat()
    water_info = _get_fs_water(uid, today_str)
    meals = _get_fs_meals(uid, today_str)
    
    sleep_docs = db.collection("sleepLogs").where("userId", "==", uid).where("date", "==", today_str).get()
    sleep_log = sleep_docs[0].to_dict() if sleep_docs else None
    
    water_liters = water_info["amount_ml"] / 1000.0
    cals = sum(m.get("calories", 0) for m in meals)
    pro = sum(m.get("protein", 0) for m in meals)
    sleep_hrs = (sleep_log.get("durationMinutes", 0) / 60.0) if sleep_log else 0
    
    insights = []
    
    # Rules
    if water_liters < goal_water * 0.5:
        insights.append(f"💧 You've only drank {water_liters:.1f}L of water today. Try to keep a bottle nearby!")
    elif water_liters >= goal_water:
        insights.append("🌊 Great job hitting your hydration goal today!")
        
    if pro < goal_pro * 0.5:
        insights.append(f"🍗 Your protein intake is low ({int(pro)}g). Consider a high-protein snack.")
        
    if cals > goal_cal * 1.1:
        insights.append("⚖️ You are slightly over your calorie tracking goal for today.")
    elif cals < goal_cal * 0.5 and len(meals) > 0:
        insights.append("🔋 You might need more fuel to get through the day.")
        
    if sleep_hrs > 0 and sleep_hrs < goal_sleep - 1:
        insights.append(f"🛌 You got {sleep_hrs:.1f} hours of sleep, which is under your goal. Try winding down earlier tonight.")

    if not insights:
        insights.append("✨ You're perfectly on track with your daily goals.")
        
    return {"status": "success", "insights": insights}


# ─── Morning Summary ─────────────────────────────────────────────────────

@router.get("/{uid}/summary/morning")
def get_morning_summary(uid: str):
    user = get_user_or_404(uid)
    settings = user.get("settings", {})
    goals = user.get("goals", {})
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    water = _get_fs_water(uid, yesterday)

    water_drunk = water.get("amount_ml", 0) / 1000.0
    water_goal = float(goals.get("waterGoalLiters", settings.get("daily_water_goal_liters", 4.0)))
    goal_pro = goals.get("proteinGoal", settings.get("daily_protein_goal", 150))

    recovery = []
    if water_drunk < water_goal:
        recovery.append(
            f"You missed your hydration goal yesterday ({water_drunk}L / {water_goal}L)."
        )

    return {
        "greeting": "Good Morning!",
        "summary": "You're starting with a clean slate today.",
        "habit_recovery": recovery,
        "todays_focus": f"Hit your protein goal of {goal_pro}g.",
    }


# ─── Intelligence ─────────────────────────────────────────────────────────

@router.get("/{uid}/intelligence")
def get_intelligence(uid: str):
    return {
        "prediction_insight": "Your energy levels might dip this afternoon.",
        "preventive_suggestion": "Pack a high-protein snack for your 3 PM lab.",
        "long_term_trend": "You are on track to reach your goal weight in 4 weeks.",
    }
