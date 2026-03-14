from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date
import io
import re
import PyPDF2

app = FastAPI(title="CampusFuel AI Backend")

# Models
class UserSettings(BaseModel):
    daily_water_goal: int = 8
    daily_calories_goal: int = 2500
    daily_protein_goal: int = 150
    notification_mode: str = "at_start" # "at_start", "before_class", "after_class"
    target_weight: float = 65.0
    current_weight: float = 60.0
    sleep_goal: int = 8
    
    # Gamification Fields
    xp: int = 0
    level: int = 1
    water_streak: int = 0
    meal_streak: int = 0
    sleep_streak: int = 0
    skincare_streak: int = 0

class UserProfile(BaseModel):
    uid: str
    name: str
    settings: UserSettings
    achievements: List[str] = []

class MealLog(BaseModel):
    id: str
    uid: str
    name: str
    calories: int
    protein: int
    date: date

class WaterLog(BaseModel):
    id: str
    uid: str
    amount_ml: int
    date: str

class DashboardData(BaseModel):
    water_drunk_liters: float
    water_goal_liters: float
    calories_consumed: int
    calories_goal: int
    protein_consumed: int
    protein_goal: int
    meals_today: int
    life_consistency_score: int
    score_reason: str
    score_breakdown: dict
    habit_streak: int
    meals_tracker: dict
    
    # Gamification Returns
    level: int
    xp_current: int
    xp_target: int
    xp_progress_percentage: int
    streak_counters: dict
    achievements: List[str]
    
    # Behavioral AI Predictions
    prediction_insight: str
    preventive_suggestion: str
    adaptive_reminders: List[str]
    habit_recovery: List[str] = []

class WeightLogReq(BaseModel):
    weight_kg: float

class SleepSessionReq(BaseModel):
    sleep_start: str # ISO formatted string e.g. "2023-10-15T23:30:00"
    sleep_end: str   # ISO formatted string e.g. "2023-10-16T07:10:00"

class NutritionFacts(BaseModel):
    calories: int
    protein: float
    fat: float
    carbs: float
    sugar: float
    sodium: float

class FoodDetectionReq(BaseModel):
    image_base64: str

class ConfirmedPlateItem(BaseModel):
    item: str
    quantity: float

class ConfirmedPlateLogReq(BaseModel):
    items: List[ConfirmedPlateItem]
    original_detection: List[str] # for mock training algorithm!

# Mock Database
db = {
    "users": {
        "user123": {
            "uid": "user123",
            "name": "Hostel Student",
            "settings": {
                "daily_water_goal": 8,
                "daily_water_goal_liters": 4.0,
                "daily_calories_goal": 2500,
                "daily_protein_goal": 150,
                "notification_mode": "at_start",
                "target_weight": 65.0,
                "current_weight": 61.2,
                "sleep_goal": 8,
                "xp": 340,
                "level": 3,
                "water_streak": 6,
                "meal_streak": 5,
                "sleep_streak": 2,
                "skincare_streak": 1
            },
            "achievements": ["3-Day Water Streak", "First Week Without Skipping Dinner", "Nutrition Novice"],
            "timetable": {
                "Monday": [{"start": "10:00", "end": "11:00", "subject": "Math"}, {"start": "14:00", "end": "15:30", "subject": "Physics"}],
                "Wednesday": [{"start": "14:00", "end": "15:30", "subject": "Chemistry"}]
            },
            "weight": [
                {"date": "2023-09-15", "weight": 60.5},
                {"date": "2023-09-22", "weight": 60.8},
                {"date": "2023-10-01", "weight": 61.2}
            ],
            "sleep_hours_yesterday": 6.5
        }
    },
    "meals": [],
    "water": {},
    "analytics": [],
    "sleep": [
        {"uid": "user123", "date": "2023-10-14", "duration_minutes": 460}, # ~7.6 hrs
        {"uid": "user123", "date": "2023-10-15", "duration_minutes": 310}  # ~5.1 hrs (bad sleep)
    ],
    "packaged_foods": {
        "00001": {
            "name": "Lays Classic Chips",
            "macros": {"calories": 160, "protein": 2.0, "fat": 10.0, "carbs": 15.0, "sugar": 1.0}
        },
        "00002": {
            "name": "Whey Protein Scoop",
            "macros": {"calories": 120, "protein": 24.0, "fat": 1.5, "carbs": 3.0, "sugar": 1.0}
        },
        "00003": {
            "name": "Coke Can",
            "macros": {"calories": 140, "protein": 0.0, "fat": 0.0, "carbs": 39.0, "sugar": 39.0}
        }
    }
}

class SkipEvent(BaseModel):
    category: str  # e.g., 'water', 'meal'
    time_scheduled: str
    skipped_at: str

class PlateItem(BaseModel):
    item: str
    quantity: float

class PlateLog(BaseModel):
    items: List[PlateItem]

class SavedMealReq(BaseModel):
    name: str
    items: List[PlateItem]

class NLPLog(BaseModel):
    text: str

class OCRLog(BaseModel):
    food_name: str
    image_base64: str

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    suggestions: List[str]

# Mock Nutrition Database (Calories, Protein)
NUTRITION_DB = {
    "rice": {"calories": 130, "protein": 2.7}, # per bowl (approx 100g)
    "dal": {"calories": 150, "protein": 9.0}, # per bowl
    "chapati": {"calories": 70, "protein": 3.0}, # per piece
    "paneer": {"calories": 260, "protein": 18.0}, # per 100g
    "curd": {"calories": 100, "protein": 11.0}, # per bowl
    "vegetable curry": {"calories": 120, "protein": 2.0}, # per bowl
    "oats": {"calories": 380, "protein": 13.0}, # per bowl
    "milk": {"calories": 150, "protein": 8.0}, # per glass
    "banana": {"calories": 105, "protein": 1.3}, # per piece
    "peanut butter": {"calories": 190, "protein": 8.0} # per spoon
}

@app.get("/")
def read_root():
    return {"message": "Welcome to CampusFuel AI Backend"}

@app.get("/users/{uid}/habits/heatmap")
def get_habit_heatmap(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")

    import datetime, random
    user = db["users"][uid]
    settings = user["settings"]
    today = datetime.date.today()

    water_goal = settings.get("daily_water_goal_liters", 4.0)
    sleep_goal = settings.get("sleep_goal", 8)

    # Precompute lookups
    water_data = db["water"].get(uid, {})
    sleep_map = {s["date"]: s["duration_minutes"] / 60.0
                 for s in db["sleep"] if s["uid"] == uid}

    cells = []
    random.seed(42)  # deterministic mock fill for days without real data

    for i in range(29, -1, -1):
        d = today - datetime.timedelta(days=i)
        d_str = d.isoformat()
        day_label = d.strftime("%d")
        weekday = d.strftime("%a")

        # Habit scores (0 or 1 each):
        # 1) Meals logged that day
        day_meals = [m for m in db["meals"] if m.get("date") == d_str]
        meal_score = 1 if len(day_meals) >= 2 else (0.5 if day_meals else 0)

        # 2) Water goal hit
        water_ml = water_data.get(d_str, 0)
        water_score = 1 if (water_ml / 1000.0) >= water_goal else (
            0.5 if (water_ml / 1000.0) >= water_goal * 0.5 else 0
        )

        # 3) Sleep goal hit
        sleep_hrs = sleep_map.get(d_str, None)
        if sleep_hrs is None:
            # Use seeded random to fill historical days with plausible data
            sleep_hrs = random.uniform(4.5, 9.0)
        sleep_score = 1 if sleep_hrs >= sleep_goal else (
            0.5 if sleep_hrs >= sleep_goal * 0.7 else 0
        )

        # 4) Skincare (mock - alternate days)
        skincare_score = 0.5 if i % 2 == 0 else 1

        # Aggregate: total out of 4
        total = meal_score + water_score + sleep_score + skincare_score
        pct = total / 4.0  # 0.0 → 1.0

        # Color label
        if pct >= 0.75:
            color = "green"
        elif pct >= 0.4:
            color = "yellow"
        else:
            color = "red"

        cells.append({
            "date": d_str,
            "day": day_label,
            "weekday": weekday,
            "score": round(pct * 100),
            "color": color,
            "is_today": d_str == today.isoformat(),
        })

    # Summary stats
    greens = sum(1 for c in cells if c["color"] == "green")
    yellows = sum(1 for c in cells if c["color"] == "yellow")
    reds = sum(1 for c in cells if c["color"] == "red")

    return {
        "cells": cells,
        "summary": {
            "perfect_days": greens,
            "partial_days": yellows,
            "skipped_days": reds,
            "best_streak": settings.get("water_streak", 0),
        }
    }


@app.get("/users/{uid}/report/weekly")
def get_weekly_report(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")

    import datetime
    user = db["users"][uid]
    settings = user["settings"]
    today = datetime.date.today()
    
    # Build 7-day date range (Mon-Sun or last 7 days)
    days = [(today - datetime.timedelta(days=i)) for i in range(6, -1, -1)]
    day_labels = [d.strftime("%a") for d in days]
    day_strs = [d.isoformat() for d in days]

    # --- Nutrition: calories & protein per day ---
    cal_per_day = []
    pro_per_day = []
    for d in day_strs:
        day_meals = [m for m in db["meals"] if m.get("date") == d]
        cal_per_day.append(sum(m.get("calories", 0) for m in day_meals))
        pro_per_day.append(sum(m.get("protein", 0) for m in day_meals))

    avg_calories = round(sum(cal_per_day) / 7, 1)
    avg_protein = round(sum(pro_per_day) / 7, 1)
    cal_goal = settings.get("daily_calories_goal", 2500)
    pro_goal = settings.get("daily_protein_goal", 150)

    # --- Hydration: water per day ---
    water_data = db["water"].get(uid, {})
    water_per_day = [round(water_data.get(d, 0) / 1000.0, 2) for d in day_strs]
    avg_water = round(sum(water_per_day) / 7, 2)
    water_goal = settings.get("daily_water_goal_liters", 4.0)
    hydration_days_hit = sum(1 for w in water_per_day if w >= water_goal)

    # --- Sleep: hours per day ---
    user_sleep = [s for s in db["sleep"] if s["uid"] == uid]
    sleep_map = {s["date"]: round(s["duration_minutes"] / 60.0, 1) for s in user_sleep}
    sleep_per_day = [sleep_map.get(d, 0.0) for d in day_strs]
    avg_sleep = round(sum(sleep_per_day) / 7, 1)
    sleep_goal = settings.get("sleep_goal", 8)
    sleep_days_hit = sum(1 for s in sleep_per_day if s >= sleep_goal)

    # --- Habit Consistency (mock) ---
    water_streak = settings.get("water_streak", 0)
    meal_streak = settings.get("meal_streak", 0)
    sleep_streak = settings.get("sleep_streak", 0)
    skincare_streak = settings.get("skincare_streak", 0)
    habit_consistency_pct = min(100, int(((water_streak + meal_streak + sleep_streak + skincare_streak) / (4 * 7)) * 100))

    # --- Weekly Health Score (mock avg) ---
    meals_score = min(20, int((avg_calories / cal_goal) * 20))
    water_score = min(15, int((avg_water / water_goal) * 15))
    pro_score = min(15, int((avg_protein / pro_goal) * 15))
    sleep_score = min(15, int((avg_sleep / sleep_goal) * 15))
    habit_score_avg = meals_score + water_score + pro_score + sleep_score + 15  # 15 for habits base
    habit_score_avg = max(0, min(100, habit_score_avg))

    # --- Insights ---
    nutrition_insight = (
        f"You averaged {avg_calories} kcal/day against your {cal_goal} kcal goal."
        if avg_calories < cal_goal * 0.8
        else f"Great nutrition week! You averaged {avg_calories} kcal/day — close to your {cal_goal} target."
    )
    hydration_insight = (
        f"You hit your water goal on {hydration_days_hit}/7 days. "
        + ("Try setting morning water reminders to improve!" if hydration_days_hit < 4 else "Well done on staying hydrated!")
    )
    sleep_insight = (
        f"You achieved your sleep goal on {sleep_days_hit}/7 nights. "
        + ("Prioritize an earlier bedtime." if sleep_days_hit < 4 else "Your sleep consistency is strong!")
    )

    return {
        "week_start": day_strs[0],
        "week_end": day_strs[-1],
        "day_labels": day_labels,
        # Scores
        "weekly_health_score": habit_score_avg,
        "habit_consistency_pct": habit_consistency_pct,
        # Nutrition
        "avg_calories": avg_calories,
        "calories_goal": cal_goal,
        "calories_per_day": cal_per_day,
        "avg_protein": avg_protein,
        "protein_goal": pro_goal,
        "protein_per_day": pro_per_day,
        "nutrition_insight": nutrition_insight,
        # Hydration
        "avg_water_liters": avg_water,
        "water_goal_liters": water_goal,
        "water_per_day": water_per_day,
        "hydration_days_hit": hydration_days_hit,
        "hydration_insight": hydration_insight,
        # Sleep
        "avg_sleep_hours": avg_sleep,
        "sleep_goal_hours": sleep_goal,
        "sleep_per_day": sleep_per_day,
        "sleep_days_hit": sleep_days_hit,
        "sleep_insight": sleep_insight,
        # Habits
        "streak_counters": {
            "Water": water_streak,
            "Meal": meal_streak,
            "Sleep": sleep_streak,
            "Skincare": skincare_streak,
        },
    }


@app.get("/users/{uid}/summary/morning")
def get_morning_summary(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")

    import datetime
    user = db["users"][uid]
    today = datetime.date.today()
    now = datetime.datetime.now()

    # 1. Greeting & Date
    hour = now.hour
    if hour < 12:
        greeting = "Good morning"
    elif hour < 17:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"

    # 2. Schedule
    day_name = today.strftime("%A")
    raw_schedule = user.get("timetable", {}).get(day_name, [])
    schedule = [{"time": c["start"].zfill(5), "label": c.get("subject", f"Class ({c['start']}-{c['end']})")} for c in raw_schedule]
    
    # 3. Water Target
    water_target = f"{user.get('settings', {}).get('daily_water_goal_liters', 4.0)} L"
    
    # 4. Habit Focus / Prediction logic
    predicted_risks = []
    has_long_class = False
    for c in raw_schedule:
        try:
            start_hr = int(c["start"].split(":")[0])
            if 10 <= start_hr <= 14 and len(raw_schedule) > 1:
                has_long_class = True
        except: pass
        
    if has_long_class or day_name == "Wednesday":
        predicted_risks.append("High risk of skipping lunch today. Pack a snack!")
    
    if day_name in ["Saturday", "Sunday"]:
        predicted_risks.append("Weekend: Watch out for late sleeping patterns.")
        
    # --- 5. SMART HABIT RECOVERY ---
    # Look at yesterday's data to generate positive recovery nudges.
    yesterday = today - datetime.timedelta(days=1)
    yesterday_str = yesterday.isoformat()
    settings = user.get("settings", {})
    
    recovery_actions = []
    
    # Check Meals (Did they log < 2 meals yesterday?)
    y_meals = [m for m in db["meals"] if m.get("uid") == uid and m.get("date") == yesterday_str]
    if len(y_meals) < 2:
        recovery_actions.append("You missed some meals yesterday. Let's aim to log a solid breakfast today to bounce back! 🍳")
        
    # Check Water
    y_water_ml = db["water"].get(uid, {}).get(yesterday_str, 0)
    w_goal_ml = settings.get("daily_water_goal_liters", 4.0) * 1000
    if y_water_ml < (w_goal_ml * 0.75):
        recovery_actions.append(f"Hydration was low yesterday ({y_water_ml/1000}L). Fill a 1L water bottle right now to get a head start! 💧")
        
    # Check Sleep
    y_sleep_logs = [s for s in db["sleep"] if s["uid"] == uid and s["date"] == yesterday_str]
    y_sleep_hrs = (y_sleep_logs[0]["duration_minutes"] / 60.0) if y_sleep_logs else 0
    s_goal = settings.get("sleep_goal", 8)
    if 0 < y_sleep_hrs < (s_goal - 1.5): # Missed goal by more than 1.5hrs
        recovery_actions.append(f"You only got {round(y_sleep_hrs,1)}h sleep last night. Try going to bed 30 mins earlier tonight. 🛌")
    
    return {
        "greeting": greeting,
        "day": day_name,
        "date": today.strftime("%b %d"),
        "schedule": schedule,
        "water_target": water_target,
        "predicted_risks": predicted_risks,
        "habit_focus": "Maintain your water streak today!",
        "habit_recovery": recovery_actions
    }


@app.get("/users/{uid}/dashboard", response_model=DashboardData)
def get_dashboard(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = db["users"][uid]
    settings = user["settings"]
    
    # Calculate mock data (In reality this aggregates from db["meals"] and db["water"])
    today_str = date.today().isoformat()
    if uid in db["water"] and today_str in db["water"][uid]:
        water_drunk_liters = db["water"][uid][today_str] / 1000.0
    else:
        water_drunk_liters = 0.0
        
    meals_today = len(db["meals"])
    calories_consumed = sum(m.get("calories", 0) for m in db["meals"]) if db["meals"] else 0
    protein_consumed = sum(m.get("protein", 0) for m in db["meals"]) if db["meals"] else 0
    habit_streak = 12
    
    meals_tracker = {
        "Breakfast": True,
        "Lunch": meals_today > 1,
        "Snack": False,
        "Dinner": False,
        "Protein shake": False
    }
    
    # --- 1. Nutrition (Meals/Cals/Pro) - 40% ---
    meals_score = min(10.0, (meals_today / 3.0) * 10.0)
    cals_score = min(15.0, (calories_consumed / settings["daily_calories_goal"]) * 15.0) if settings["daily_calories_goal"] else 0
    pro_score = min(15.0, (protein_consumed / settings["daily_protein_goal"]) * 15.0) if settings["daily_protein_goal"] else 0
    nutrition_total = meals_score + cals_score + pro_score # max 40
    
    # --- 2. Hydration - 15% ---
    hydration_score = min(15.0, (water_drunk_liters / settings.get("daily_water_goal_liters", 4.0)) * 15.0)
    
    # --- 3. Sleep Consistency - 15% ---
    today_sleep_logs = [s for s in db["sleep"] if s["uid"] == uid]
    if today_sleep_logs:
        latest_sleep = today_sleep_logs[-1]
        sleep_hours_actual = latest_sleep["duration_minutes"] / 60.0
    else:
        sleep_hours_actual = 8.0
    sleep_score = min(15.0, (sleep_hours_actual / settings.get("sleep_goal", 8)) * 15.0)
    
    # --- 4. Habit Tracking - 15% ---
    habits_score = 15.0 # Mocked for now (Skincare, etc.)
    
    # --- 5. Schedule Discipline - 15% ---
    # Award points if meals were logged near class finish times
    discipline_score = 0
    day_name = date.today().strftime("%A")
    raw_schedule = user.get("timetable", {}).get(day_name, [])
    
    if raw_schedule and db["meals"]:
        # Mock discipline: if you have meals and a schedule today, you get 10-15 points
        discipline_score = 15.0 if meals_today >= 2 else 5.0
    elif not raw_schedule:
        discipline_score = 15.0 # Free points on holidays!
        
    life_consistency_score = int(nutrition_total + hydration_score + sleep_score + habits_score + discipline_score)
    life_consistency_score = max(0, min(100, life_consistency_score))

    # Reason generation
    reasons = []
    if hydration_score < 10: reasons.append("lower hydration")
    if sleep_score < 10: reasons.append("shorter sleep")
    if nutrition_total < 30: reasons.append("nutrition targets")
    if discipline_score < 10: reasons.append("irregular meal timing")
    
    score_reason = "Consistency dropped due to " + ", ".join(reasons) + "." if reasons else "Elite consistency! You're following your schedule perfectly."
    
    score_breakdown = {
        "Nutrition": int(nutrition_total),
        "Hydration": int(hydration_score),
        "Sleep": int(sleep_score),
        "Habits": int(habits_score),
        "Discipline": int(discipline_score)
    }
    
    # Gamification Mapping
    level_reqs = {1: 0, 2: 100, 3: 250, 4: 500, 5: 800, 6: 1200}
    curr_level = settings.get("level", 1)
    curr_xp = settings.get("xp", 0)
    
    xp_target = 100
    for lvl, req in sorted(level_reqs.items()):
        if lvl == curr_level + 1:
             xp_target = req
             break
             
    base_xp = level_reqs.get(curr_level, 0)
    needed_xp = xp_target - base_xp
    earned_xp = curr_xp - base_xp
    xp_progress_percentage = int((earned_xp / (needed_xp or 1)) * 100)
    
    streak_counters = {
        "Water": settings.get("water_streak", 0),
        "Meal": settings.get("meal_streak", 0),
        "Sleep": settings.get("sleep_streak", 0),
        "Skincare": settings.get("skincare_streak", 0)
    }
    
    # Behavioral Prediction AI (Mock Logic)
    import datetime
    day_of_week = datetime.datetime.now().strftime("%A")
    user_schedule = user.get("timetable", {}).get(day_of_week, [])
    
    prediction_insight = "No major behavioral risks detected today."
    preventive_suggestion = "Maintain your current routine."
    adaptive_reminders = []
    
    has_long_class = False
    for c in user_schedule:
        try:
            start_hr = int(c["start"].split(":")[0])
            if 10 <= start_hr <= 14 and len(user_schedule) > 1:
                has_long_class = True
        except: pass
            
    if has_long_class or day_of_week == "Wednesday":
        prediction_insight = "High risk of skipping lunch due to long class schedule."
        preventive_suggestion = "Prepare a protein snack before 1:00 PM."
        adaptive_reminders.append("Lunch reminder automatically shifted to 1:45 PM based on your habits.")
    elif day_of_week in ["Saturday", "Sunday"]:
        prediction_insight = "You usually sleep late on weekends."
        preventive_suggestion = "Try not to exceed 10 hours of sleep to maintain energy."
        adaptive_reminders.append("Morning water reminder paused until 10:30 AM.")
    elif water_drunk_liters < 1.0 and datetime.datetime.now().hour > 12:
        prediction_insight = "Hydration is usually low before noon on this day."
        preventive_suggestion = "Drink 500 ml water before your next class."
        
    return DashboardData(
        water_drunk_liters=water_drunk_liters,
        water_goal_liters=settings.get("daily_water_goal_liters", 4.0),
        calories_consumed=calories_consumed,
        calories_goal=settings["daily_calories_goal"],
        protein_consumed=protein_consumed,
        protein_goal=settings["daily_protein_goal"],
        meals_today=meals_today,
        life_consistency_score=life_consistency_score,
        score_reason=score_reason,
        score_breakdown=score_breakdown,
        habit_streak=habit_streak,
        meals_tracker=meals_tracker,
        level=curr_level,
        xp_current=curr_xp,
        xp_target=xp_target,
        xp_progress_percentage=xp_progress_percentage,
        streak_counters=streak_counters,
        achievements=user.get("achievements", []),
        prediction_insight=prediction_insight,
        preventive_suggestion=preventive_suggestion,
        adaptive_reminders=adaptive_reminders,
        habit_recovery=[]
    )

@app.post("/users/{uid}/water")
def log_water(uid: str, amount_ml: int):
    today_str = date.today().isoformat()
    if uid not in db["water"]:
        # Mock some history for the UI demo!
        db["water"][uid] = {
            "2023-10-01": 3200,
            "2023-10-02": 2800,
            "2023-10-03": 4100
        }
    
    if today_str not in db["water"][uid]:
        db["water"][uid][today_str] = 0
        
    db["water"][uid][today_str] += amount_ml
    return {"message": "Water logged successfully", "total_ml_today": db["water"][uid][today_str]}

@app.get("/users/{uid}/water/history")
def get_water_history(uid: str):
    if uid not in db["water"]:
        return {"history": []}
        
    history = []
    # Sort descending by date, take last 7
    for d, ml in sorted(db["water"][uid].items(), reverse=True)[:7]:
        history.append({"date": d, "liters": ml / 1000.0})
    return {"history": history}

@app.post("/users/{uid}/meal")
def log_meal_manual(uid: str, meal: MealLog):
    db["meals"].append(meal.model_dump())
    return {"message": "Manual meal logged successfully"}

@app.post("/users/{uid}/meal/plate")
def log_meal_plate(uid: str, req: PlateLog):
    total_cal = 0
    total_pro = 0
    names = []
    
    for item in req.items:
        key = item.item.lower()
        if key in NUTRITION_DB:
            total_cal += NUTRITION_DB[key]["calories"] * item.quantity
            total_pro += NUTRITION_DB[key]["protein"] * item.quantity
            names.append(f"{item.quantity}x {item.item}")
            
    meal = {
        "id": "plate_" + date.today().isoformat(),
        "uid": uid,
        "name": ", ".join(names) or "Plate Builder Meal",
        "calories": int(total_cal),
        "protein": int(total_pro),
        "date": date.today().isoformat()
    }
    db["meals"].append(meal)
    return {"message": "Plate logged successfully", "meal": meal}

@app.post("/users/{uid}/food/saved_meals")
def create_saved_meal(uid: str, req: SavedMealReq):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    total_cal = 0
    total_pro = 0
    names = []
    
    for item in req.items:
        key = item.item.lower()
        if key in NUTRITION_DB:
            total_cal += NUTRITION_DB[key]["calories"] * item.quantity
            total_pro += NUTRITION_DB[key]["protein"] * item.quantity
            names.append(f"{item.quantity}x {item.item}")
            
    if "saved_meals" not in db["users"][uid]:
        db["users"][uid]["saved_meals"] = []
        
    saved_meal = {
        "id": "svd_" + str(len(db["users"][uid].get("saved_meals", []))),
        "name": req.name,
        "items": names,
        "calories": int(total_cal),
        "protein": int(total_pro)
    }
    db["users"][uid]["saved_meals"].append(saved_meal)
    
    return {"message": "Meal saved successfully", "saved_meal": saved_meal}

@app.get("/users/{uid}/food/saved_meals")
def get_saved_meals(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    meals = db["users"][uid].get("saved_meals", [])
    return {"saved_meals": meals}

@app.get("/users/{uid}/developer/insights")
def get_developer_insights(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    user = db["users"][uid]
    
    return {
        "ai_confidence_score": 94.2,
        "model_insights": {
            "prediction_engine": "RandomForest Classifier v2.1",
            "active_features": ["meal_time", "sleep_duration", "water_delta", "class_schedule_proximity"],
            "feature_weights": {
                "nutrition": 0.40,
                "hydration": 0.15,
                "discipline": 0.15,
                "sleep": 0.15,
                "habits": 0.15
            }
        },
        "habit_analytics": {
            "completion_ratio_30d": 0.82,
            "consistency_trend": "Increasing",
            "most_missed_habit": "Evening Skincare",
            "optimal_log_time": "14:15"
        },
        "system_health": {
            "database_latency": "14ms",
            "sync_queue_status": "Idle",
            "last_cloud_sync": "2026-03-14T23:55:00Z"
        }
    }

@app.post("/users/{uid}/meal/nlp")
def log_meal_nlp(uid: str, req: NLPLog):
    import re
    text = req.text.lower()
    
    total_cal = 0
    total_pro = 0
    matched = []
    
    for food, macros in NUTRITION_DB.items():
        if food in text:
            # Try to grab a preceding number, eg. "2 chapati"
            match = re.search(rf'(\d+)\s*{food}', text)
            qty = int(match.group(1)) if match else 1
            
            total_cal += macros["calories"] * qty
            total_pro += macros["protein"] * qty
            matched.append(f"{qty}x {food}")
            
    meal = {
        "id": "nlp_" + date.today().isoformat(),
        "uid": uid,
        "name": ", ".join(matched) or "Text Log Meal",
        "calories": int(total_cal),
        "protein": int(total_pro),
        "date": date.today().isoformat()
    }
    db["meals"].append(meal)
    return {"message": "NLP parsed successfully", "meal": meal}

@app.post("/users/{uid}/meal/ocr")
def log_meal_ocr(uid: str, req: OCRLog):
    # Mocking OCR logic! We generate a plausible macro spread based on name length
    import random
    random.seed(req.food_name) # consistent results for same name
    
    cal = random.randint(120, 500)
    pro = random.randint(2, 25)
    
    # Save it to custom foods for future persistent tapping!
    custom_food = {
        "name": req.food_name,
        "calories": cal,
        "protein": pro
    }
    
    if "custom_foods" not in db["users"][uid]:
         db["users"][uid]["custom_foods"] = []
         
    # Check if already saved
    if not any(f["name"] == req.food_name for f in db["users"][uid]["custom_foods"]):
        db["users"][uid]["custom_foods"].append(custom_food)
    
    meal = {
        "id": "ocr_" + date.today().isoformat(),
        "uid": uid,
        "name": req.food_name,
        "calories": cal,
        "protein": pro,
        "date": date.today().isoformat()
    }
    db["meals"].append(meal)
    return {"message": "OCR parsed successfully", "meal": meal, "saved_to_custom": True}

@app.post("/users/{uid}/food/detect-plate")
def detect_food_plate(uid: str, req: FoodDetectionReq):
    import random
    # Mocking AI Image Recognition -> Returning random known foods from our DB
    random.seed(req.image_base64[:10] if req.image_base64 else "random_plate")
    
    # Pick 2-3 random foods
    num_items = random.randint(2, 3)
    available_foods = list(NUTRITION_DB.keys())
    detected = random.sample(available_foods, num_items)
    
    # Capitalize for UI
    detected_display = [f.title() for f in detected]
    
    return {
        "message": "Plate analyzed successfully",
        "detected_foods": detected_display
    }

@app.post("/users/{uid}/food/log-detected")
def log_detected_plate(uid: str, req: ConfirmedPlateLogReq):
    total_cal = 0
    total_pro = 0
    names = []
    
    for item in req.items:
        key = item.item.lower()
        if key in NUTRITION_DB:
            total_cal += NUTRITION_DB[key]["calories"] * item.quantity
            total_pro += NUTRITION_DB[key]["protein"] * item.quantity
            names.append(f"{item.quantity}x {item.item}")
    
    # "AI Learning" Mock -> Log differences to an analytics array
    db["analytics"].append({
         "event_type": "plate_correction",
         "original_detection": req.original_detection,
         "final_confirmation": [i.model_dump() for i in req.items]
    })
            
    meal = {
        "id": "ai_plate_" + date.today().isoformat(),
        "uid": uid,
        "name": ", ".join(names) or "AI Plate Log",
        "calories": int(total_cal),
        "protein": int(total_pro),
        "date": date.today().isoformat()
    }
    db["meals"].append(meal)
    return {"message": "Confirmed AI Plate logged successfully! Model learning from corrections.", "meal": meal}

@app.post("/users/{uid}/food/ocr-label")
def scan_ocr_label(uid: str, req: OCRLog):
    # This endpoint specifically parses Nutrition Labels for strict macros (not just name)
    import random
    random.seed(req.image_base64[:10] if req.image_base64 else "random")
    
    # Mocking a plausible macro extraction matrix from an image
    extracted_macros = {
        "calories": random.randint(100, 350),
        "protein": round(random.uniform(0, 15), 1),
        "fat": round(random.uniform(0, 20), 1),
        "carbs": round(random.uniform(5, 50), 1),
        "sugar": round(random.uniform(0, 30), 1),
        "sodium": round(random.uniform(10, 400), 1)
    }
    
    # Normally we would save this back to custom foods/db here 
    # so the next identical scan skips OCR.
    
    return {
        "message": "Label parsed successfully",
        "macros": extracted_macros
    }

@app.get("/users/{uid}/intelligence/snacks")
def get_smart_snacks(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404)
        
    import datetime
    user = db["users"][uid]
    settings = user["settings"]
    today_str = datetime.date.today().isoformat()
    
    # Calculate current macros
    day_meals = [m for m in db["meals"] if m.get("uid") == uid and m.get("date") == today_str]
    cal_consumed = sum(m.get("calories", 0) for m in day_meals)
    pro_consumed = sum(m.get("protein", 0) for m in day_meals)
    
    cal_goal = settings.get("daily_calories_goal", 2500)
    pro_goal = settings.get("daily_protein_goal", 150)
    
    cal_short = max(0, cal_goal - cal_consumed)
    pro_short = max(0, pro_goal - pro_consumed)
    
    # Decide strategy
    suggestions = []
    message = ""
    
    if pro_short == 0 and cal_short == 0:
        message = "You've hit all your macro targets for today! Great job! 🎉"
    elif pro_short > 20:
        message = f"You need {round(pro_short)}g more protein. Try these high-protein snacks:"
        # Sort NUTRITION_DB by protein descending
        sorted_foods = sorted(NUTRITION_DB.items(), key=lambda x: x[1]["protein"], reverse=True)
        # Suggest top 4
        for name, macros in sorted_foods[:4]:
            suggestions.append({"name": name.title(), "calories": macros["calories"], "protein": macros["protein"]})
    elif cal_short > 300:
        message = f"You have {round(cal_short)} kcal left. Try these calorie-dense snacks:"
        # Sort NUTRITION_DB by calories descending
        sorted_foods = sorted(NUTRITION_DB.items(), key=lambda x: x[1]["calories"], reverse=True)
        # Suggest top 4
        for name, macros in sorted_foods[:4]:
            suggestions.append({"name": name.title(), "calories": macros["calories"], "protein": macros["protein"]})
    else:
        message = "You're very close to your goals! A small top-up:"
        suggestions = [
            {"name": "Banana", "calories": NUTRITION_DB["banana"]["calories"], "protein": NUTRITION_DB["banana"]["protein"]},
            {"name": "Milk (1 glass)", "calories": NUTRITION_DB["milk"]["calories"], "protein": NUTRITION_DB["milk"]["protein"]}
        ]
        
    return {
        "status": "success",
        "current": {
            "calories": cal_consumed,
            "calories_target": cal_goal,
            "protein": pro_consumed,
            "protein_target": pro_goal
        },
        "deficit": {
            "calories": cal_short,
            "protein": pro_short
        },
        "message": message,
        "suggestions": suggestions
    }

@app.get("/users/{uid}/custom_foods")
def get_custom_foods(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404)
    return {"custom_foods": db["users"][uid].get("custom_foods", [])}

@app.post("/users/{uid}/analytics/skip")
def log_skip(uid: str, event: SkipEvent):
    db["analytics"].append({
        "uid": uid,
        "event": event.model_dump()
    })
    return {"message": "Skip event logged for analytics"}

@app.get("/users/{uid}/settings")
def get_user_settings(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
    return db["users"][uid]["settings"]

class UpdateSettingsReq(BaseModel):
    notification_mode: str

@app.post("/users/{uid}/settings")
def update_user_settings(uid: str, req: UpdateSettingsReq):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    db["users"][uid]["settings"]["notification_mode"] = req.notification_mode
    return {"message": "Settings updated", "settings": db["users"][uid]["settings"]}

@app.post("/users/{uid}/timetable/upload")
async def upload_timetable(uid: str, file: UploadFile = File(...)):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        
        extracted_text = ""
        for page in pdf_reader.pages:
            extracted_text += page.extract_text() + "\n"
            
        # Very basic mock Regex engine to extract days and time ranges
        # Looking for something like "Monday" and "10:00-11:00" or "10:00 - 11:30"
        days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        parsed_timetable: Dict[str, List[Dict[str, str]]] = {day: [] for day in days_of_week}
        
        current_day = None
        
        for line in extracted_text.split('\n'):
            line = line.strip()
            if not line:
                continue
                
            # Check if line contains a day of week
            for day in days_of_week:
                if day.lower() in line.lower():
                    current_day = day
                    break
                    
            if current_day:
                # Look for time ranges like HH:MM-HH:MM
                time_matches = re.findall(r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})', line)
                for start, end in time_matches:
                    # Basic normalization (e.g. 1:30 -> 13:30 if pm, but let's keep it simple for prototype)
                    parsed_timetable[current_day].append({"start": start, "end": end})

        # Save to DB
        db["users"][uid]["timetable"] = {k: v for k, v in parsed_timetable.items() if v}
        
        return {"message": "Timetable processed successfully", "timetable": db["users"][uid]["timetable"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process PDF: {str(e)}")

@app.get("/users/{uid}/timetable")
def get_timetable(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"timetable": db["users"][uid].get("timetable", {})}

@app.post("/users/{uid}/weight")
def log_weight(uid: str, req: WeightLogReq):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
    
    db["users"][uid]["settings"]["current_weight"] = req.weight_kg
    if "weight" not in db["users"][uid]:
        db["users"][uid]["weight"] = []
    
    db["users"][uid]["weight"].append({"date": date.today().isoformat(), "weight": req.weight_kg})
    return {"message": "Weight logged successfully"}

@app.get("/users/{uid}/intelligence/insights")
def get_insights(uid: str):
    # In a real system, this would analyze `db["meals"]` and `db["water"]` dynamically
    return {"insights": [
        "You skipped lunch twice this week.",
        "Your water intake is usually low before noon.",
        "You often delay dinner on Thursdays."
    ]}

@app.get("/users/{uid}/intelligence/energy")
def get_energy(uid: str):
    # Generates a 0-100 score based on mock data factors like sleep and hydration
    return {
        "score": 76, 
        "reason": "Energy level reduced due to low hydration yesterday."
    }

@app.get("/users/{uid}/intelligence/weight_prediction")
def get_weight_prediction(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = db["users"][uid]
    settings = user.get("settings", {})
    current_w = settings.get("current_weight", 60.0)
    target_w = settings.get("target_weight", 65.0)
    history = user.get("weight", [])
    
    # Progress Calculation
    start_w = history[0]["weight"] if history else current_w
    total_to_gain = target_w - start_w
    gained = current_w - start_w
    
    progress_percentage = 0
    if total_to_gain != 0:
        # Check if they are moving in right direction
        if (total_to_gain > 0 and gained > 0) or (total_to_gain < 0 and gained < 0):
            progress_percentage = max(0, min(100, int((gained / total_to_gain) * 100)))

    # Algorithmic predictive trend based on history
    if len(history) >= 2:
        weekly_gain = history[-1]["weight"] - history[-2]["weight"]
    else:
        weekly_gain = 0.5 # Default mock surplus
        
    estimated = round(current_w + (weekly_gain * 4), 1)
    
    # Calorie Adjustment Logic
    calorie_adjustment = "Keep it up! Calorie intake is optimally mapped to your goal."
    if total_to_gain > 0: # Gaining phase
        if weekly_gain < 0.2:
            calorie_adjustment = "If weight gain is slow, increase daily calories by 200."
        elif weekly_gain > 1.0:
            calorie_adjustment = "If weight is increasing too fast, reduce calorie intake slightly."
    elif total_to_gain < 0: # Losing phase
        if weekly_gain > -0.2:
            calorie_adjustment = "If weight loss is stalling, decrease daily calories by 200."
        elif weekly_gain < -1.0:
            calorie_adjustment = "If weight is dropping too fast, increase calories to prevent muscle loss."

    # Motivation Message
    motivation = "You're on the right track!"
    if abs(gained) > 0.1:
        if total_to_gain > 0 and gained > 0:
            motivation = f"You gained {round(gained, 1)} kg so far. Great progress!"
        elif total_to_gain < 0 and gained < 0:
            motivation = f"You lost {round(abs(gained), 1)} kg so far. Great progress!"
            
        if 48 <= progress_percentage <= 52:
            motivation = "You are halfway to your target weight!"
        elif progress_percentage >= 100:
            motivation = "You've hit your target weight! Fantastic job! 🎉"
    else:
        motivation = "Consistency is key. Keep logging your meals and weight!"
    
    return {
        "current_weight": current_w,
        "target_weight": target_w,
        "start_weight": start_w,
        "progress_percentage": progress_percentage,
        "estimated_weight_30d": estimated,
        "history": history,
        "calorie_adjustment": calorie_adjustment,
        "motivation_message": motivation
    }

@app.post("/users/{uid}/sleep/auto")
def auto_log_sleep(uid: str, req: SleepSessionReq):
    import datetime
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        start_time = datetime.datetime.fromisoformat(req.sleep_start)
        end_time = datetime.datetime.fromisoformat(req.sleep_end)
        
        diff = end_time - start_time
        duration_minutes = int(diff.total_seconds() / 60)
        
        # In a real app, 'date' is usually the day you wake up on
        wake_date = end_time.date().isoformat()
        
        # Don't log micro-sleeps or accidental screen-offs under 45 mins
        if duration_minutes < 45:
             return {"message": "Sleep duration too short to log as official sleep session.", "duration_minutes": duration_minutes}
             
        db["sleep"].append({
             "uid": uid,
             "date": wake_date,
             "duration_minutes": duration_minutes,
             "start_time": req.sleep_start,
             "end_time": req.sleep_end
        })
        
        return {"message": f"Automatically logged {duration_minutes} minutes of sleep.", "duration_minutes": duration_minutes}

    except Exception as e:
         raise HTTPException(status_code=400, detail=f"Invalid time format: {str(e)}")

@app.get("/users/{uid}/intelligence/sleep")
def get_sleep_intelligence(uid: str):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_sleep_logs = [s for s in db["sleep"] if s["uid"] == uid]
    
    if not user_sleep_logs:
         return {"score": 0, "insight": "No sleep data tracked yet.", "history": []}
         
    # Take latest
    latest_sleep = user_sleep_logs[-1]
    duration_hrs = latest_sleep["duration_minutes"] / 60.0
    
    settings = db["users"][uid]["settings"]
    target_hrs = settings.get("sleep_goal", 8)
    
    score = min(100, int((duration_hrs / target_hrs) * 100))
    score = max(0, score)
    
    # Generate Insight String
    insight = "You achieved great sleep last night."
    if duration_hrs < 6:
        insight = f"You slept less than 6 hours yesterday ({round(duration_hrs, 1)}h). Consider an earlier bedtime."
    elif duration_hrs < target_hrs:
        insight = f"You were {round(target_hrs - duration_hrs, 1)} hours shy of your {target_hrs}h target."
    elif duration_hrs > 10:
        insight = f"You slept {round(duration_hrs, 1)} hours. Oversleeping might cause lethargy."
        
    # Format history chart array
    history = [{"date": s["date"], "duration_hours": round(s["duration_minutes"] / 60.0, 1)} for s in user_sleep_logs]
    
    return {
        "score": score,
        "insight": insight,
        "history": history
    }

@app.get("/users/{uid}/intelligence/suggestions")
def get_suggestions(uid: str):
    # Observes if protein macros are low today
    return {
        "message": "Protein intake today is low.",
        "suggestions": ["Drink milk", "Eat paneer", "Add peanut butter"]
    }

@app.get("/users/{uid}/intelligence/quick_meal")
def get_quick_meal(uid: str):
    # Predicts the user's meal based on time of day
    import datetime
    hour = datetime.datetime.now().hour
    
    if 15 <= hour < 19:
        return {"suggestion": "Oats + Milk", "calories": 530, "protein": 21}
    elif 6 <= hour < 11:
        return {"suggestion": "2x Chapati + Curd", "calories": 240, "protein": 17}
    else:
        return {"suggestion": "Peanut butter snack", "calories": 190, "protein": 8}

@app.post("/users/{uid}/coach/chat", response_model=ChatResponse)
def coach_chat(uid: str, req: ChatMessage):
    if uid not in db["users"]:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = db["users"][uid]
    settings = user["settings"]
    msg = req.message.lower()
    
    # Gather live health context
    from datetime import date as _date
    today_str = _date.today().isoformat()
    water_ml = db["water"].get(uid, {}).get(today_str, 0)
    water_liters = water_ml / 1000.0
    water_goal = settings.get("daily_water_goal_liters", 4.0)
    
    meals = [m for m in db["meals"] if m.get("uid") == uid]
    calories = sum(m.get("calories", 0) for m in meals)
    protein = sum(m.get("protein", 0) for m in meals)
    cal_goal = settings.get("daily_calories_goal", 2500)
    pro_goal = settings.get("daily_protein_goal", 150)
    
    sleep_logs = [s for s in db["sleep"] if s["uid"] == uid]
    sleep_hrs = round(sleep_logs[-1]["duration_minutes"] / 60.0, 1) if sleep_logs else 0
    sleep_goal = settings.get("sleep_goal", 8)
    
    habit_score = 55  # simplified; full calc is in get_dashboard
    
    reply = ""
    suggestions = []

    # --- Rule-based NLP Matching ---
    if any(k in msg for k in ["health score", "score low", "score drop", "why is my score", "habit score"]):
        issues = []
        if water_liters < water_goal * 0.5: issues.append("low hydration")
        if protein < pro_goal * 0.5: issues.append("low protein intake")
        if calories < cal_goal * 0.5: issues.append("insufficient calories")
        if sleep_hrs < 6: issues.append("poor sleep")
        if len(meals) < 2: issues.append("missed meals")
        if issues:
            reply = f"Your health score is lower because of {', '.join(issues)}. Addressing these will boost it significantly! 💪"
        else:
            reply = "Your health score looks decent today! Keep hydrating and completing your meals to push it higher. 🌟"
        suggestions = ["Drink 500 ml water now", "Log your next meal", "Complete remaining habits"]

    elif any(k in msg for k in ["protein", "what should i eat", "eat more", "build muscle"]):
        remaining = max(0, pro_goal - protein)
        reply = f"You've consumed {protein}g of protein today against your goal of {pro_goal}g. You need {remaining}g more! 🥩"
        suggestions = ["Eat paneer (18g protein)", "Drink milk (8g protein)", "Add peanut butter (8g protein)"]

    elif any(k in msg for k in ["water", "hydra", "dehydrat", "thirsty"]):
        remaining_ml = max(0, int((water_goal - water_liters) * 1000))
        reply = f"You've drunk {water_liters}L today out of your {water_goal}L goal. {remaining_ml}ml to go! 💧"
        suggestions = ["Log 250 ml now", "Log 500 ml now", "Set a water reminder"]

    elif any(k in msg for k in ["sleep", "tired", "fatigue", "rest", "energy"]):
        if sleep_hrs < 6:
            reply = f"You only slept {sleep_hrs} hours last night — that's why you may feel drained. Your goal is {sleep_goal}h. 😴"
            suggestions = ["Go to bed by 11 PM tonight", "Limit screen time after 10 PM", "Avoid caffeine after 6 PM"]
        else:
            reply = f"You got {sleep_hrs}h of sleep last night — {'great!' if sleep_hrs >= sleep_goal else 'close to your goal.'} 🌙"
            suggestions = ["Maintain your sleep schedule", "Log tomorrow's sleep too"]

    elif any(k in msg for k in ["calorie", "calories", "weight", "fat", "diet"]):
        cal_status = "You're close!" if calories > cal_goal * 0.7 else "Add another meal to hit your target."
        reply = f"You've consumed {calories} kcal today out of your {cal_goal} kcal goal. {cal_status} 🍽️"
        suggestions = ["Log a plate meal", "Try oats + milk for quick calories", "Check your weight prediction"]

    elif any(k in msg for k in ["hello", "hi", "hey", "good morning", "good evening"]):
        import datetime
        hour = datetime.datetime.now().hour
        greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 17 else "Good evening")
        reply = f"{greeting}! I'm your CampusFuel AI Coach. Ask me anything about your health, meals, hydration, or sleep! 😊"
        suggestions = ["Why is my health score low?", "What should I eat for protein?", "How's my hydration today?"]

    else:
        reply = f"I'm your personal AI health coach! I can help you understand your health score, protein goals ({pro_goal}g), hydration ({water_goal}L), or sleep target ({sleep_goal}h). What would you like to know? 🤖"
        suggestions = ["Why is my health score low?", "Am I drinking enough water?", "How much protein do I need?"]

    return ChatResponse(reply=reply, suggestions=suggestions)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
