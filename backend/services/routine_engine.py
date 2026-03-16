from datetime import datetime, timedelta
import re
from firebase_admin import firestore
from db import db

def load_user_goals(uid: str) -> dict:
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        return {"waterGoalLiters": 4.0, "sleepGoalHours": 8.0, "proteinGoal": 150}
    user_data = user_doc.to_dict()
    goals = user_data.get("goals", {})
    settings = user_data.get("settings", {})
    return {
        "waterGoalLiters": float(goals.get("waterGoalLiters", settings.get("daily_water_goal_liters", 4.0))),
        "sleepGoalHours": float(goals.get("sleepGoalHours", settings.get("sleep_goal", 8.0))),
        "proteinGoal": float(goals.get("proteinGoal", settings.get("daily_protein_goal", 150.0)))
    }

async def generate_routine_plan(uid: str, date_str: str) -> dict:
    # Caching
    routine_doc_ref = db.collection("dailyRoutine").document(f"{uid}_{date_str}")
    routine_doc = routine_doc_ref.get()
    if routine_doc.exists:
        data = routine_doc.to_dict()
        plan_dict = data.get("plan", data)
        plan_dict["is_cached"] = True
        return plan_dict

    # 1. Load timetable
    # In earlier routers we saw timetable docs: db.collection("timetable") or users/uid/timetable?
    # the prompt says: "(timetable collection, filter by uid)"
    timetable_docs = db.collection("timetable").where("userId", "==", uid).get()
    
    # 2. Load today's logs
    meal_docs = db.collection("mealLogs").where("userId", "==", uid).where("date", "==", date_str).get()
    water_docs = db.collection("waterLogs").where("userId", "==", uid).where("date", "==", date_str).get()
    sleep_docs = db.collection("sleepLogs").where("userId", "==", uid).where("date", "==", date_str).get()
    
    # 3. Load user goals
    goals = load_user_goals(uid)
    water_goal_ml = goals["waterGoalLiters"] * 1000
    sleep_goal_hrs = goals["sleepGoalHours"]
    
    # Process timetable
    # timetable may be structured as days? We need classes for exactly 'date_str'
    # Actually, timetable often has 'day' like 'Monday'. Let's find the weekday of date_str.
    dt_today = datetime.fromisoformat(date_str)
    day_name = dt_today.strftime("%A")
    
    today_classes = []
    # If the app stores flat classes with a 'day' field:
    for doc in timetable_docs:
        d = doc.to_dict()
        if d.get("day") == day_name or d.get("date") == date_str:
            today_classes.append(d)
        elif d.get("timetable"):
            # sometimes users have a single doc containing a timetable mapping
            tt = d.get("timetable", {})
            if day_name in tt:
                today_classes.extend(tt[day_name])
                
    # Sort classes by start time
    def parse_time(t_str):
        # handle HH:MM or HH:MM AM/PM
        try:
            return datetime.strptime(t_str, "%H:%M").time()
        except:
            try:
                return datetime.strptime(t_str, "%I:%M %p").time()
            except:
                return datetime.strptime("00:00", "%H:%M").time()

    today_classes.sort(key=lambda c: parse_time(c.get("start", "23:59")))

    # EMPTY TIMETABLE FALLBACK
    if not today_classes:
        plan = {
            "morning_tip": "Add your class timetable to unlock your full daily plan.",
            "hydration_tip": "Aim to drink water every 2 hours throughout the day.",
            "workout_window": "Try a 30-minute workout between 5–7 PM.",
            "sleep_tip": "Wind down by 11PM for a full 8 hours of sleep.",
            "exam_mode": False
        }
        routine_doc_ref.set({
            "plan": plan,
            "generatedAt": firestore.SERVER_TIMESTAMP
        })
        return plan

    # EXAM MODE
    exam_mode = False
    for c in today_classes:
        combined_text = f"{c.get('name', '')} {c.get('subject', '')} {c.get('notes', '')}".lower()
        if "exam" in combined_text or "test" in combined_text:
            exam_mode = True
            break
            
    # MORNING TIP
    first_class = today_classes[0]
    first_class_start = first_class.get("start", "09:00")
    fc_time = parse_time(first_class_start)
    if fc_time < datetime.strptime("09:00", "%H:%M").time():
        morning_tip = f"Have a banana + milk or peanut butter toast before your {first_class_start} class — it takes under 5 minutes"
    else:
        morning_tip = f"You have time before your {first_class_start} class. Cook a proper high-protein breakfast like eggs and toast to stay sharp."

    # HYDRATION TIP
    now = datetime.now()
    cutoff_time = now.replace(hour=14, minute=0, second=0, microsecond=0)
    
    total_water = 0
    for w in water_docs:
        w_dict = w.to_dict()
        logged_at_str = w_dict.get("loggedAt", "2000-01-01T00:00:00")
        try:
            wt = datetime.fromisoformat(logged_at_str.replace("Z", ""))
            if wt.date() == dt_today.date() and wt.time() < cutoff_time.time():
                total_water += w_dict.get("amountMl", 0)
        except:
            total_water += w_dict.get("amountMl", 0)

    if total_water < (0.3 * water_goal_ml):
        deficit = int(water_goal_ml - total_water)
        hydration_tip = f"You're {deficit}ml behind on hydration. Drink a full glass now before your next class."
    else:
        hydration_tip = "You're doing great on hydration today. Keep it up!"

    # WORKOUT WINDOW
    last_class_end = "16:00"
    for c in reversed(today_classes):
        if c.get("end"):
            last_class_end = c.get("end")
            break
            
    try:
        lc_time = parse_time(last_class_end)
        workout_start = datetime.combine(dt_today.date(), lc_time) + timedelta(minutes=30)
        workout_end = workout_start + timedelta(minutes=60)
        workout_window = f"Your classes end at {last_class_end}. Best workout window: {workout_start.strftime('%I:%M')}–{workout_end.strftime('%I:%M %p')}"
    except:
        workout_window = "Try an early morning workout before your first class."

    # SLEEP TIP
    yesterday_str = (dt_today - timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday_sleep_docs = db.collection("sleepLogs").where("userId", "==", uid).where("date", "==", yesterday_str).get()
    
    logged_sleep_hrs = 0
    if len(yesterday_sleep_docs) > 0:
        sleep_log = yesterday_sleep_docs[0].to_dict()
        logged_sleep_hrs = sleep_log.get("durationMinutes", 0) / 60.0
        
    if logged_sleep_hrs > 0 and logged_sleep_hrs < sleep_goal_hrs:
        deficit_hrs = sleep_goal_hrs - logged_sleep_hrs
        bedtime = now + timedelta(hours=sleep_goal_hrs - logged_sleep_hrs)
        bedtime = bedtime.replace(hour=22, minute=0) # Adjusted to a sensible hour
        sleep_tip = f"You got {logged_sleep_hrs:.1f}h last night. To recover fully, aim to be in bed by {bedtime.strftime('%I:%M %p')} tonight."
    else:
        sleep_tip = "Great sleep last night! Stick to your regular bedtime to maintain energy."

    plan = {
        "morning_tip": morning_tip,
        "hydration_tip": hydration_tip,
        "workout_window": workout_window,
        "sleep_tip": sleep_tip,
        "exam_mode": exam_mode,
        "is_cached": False
    }

    if exam_mode:
        plan["morning_tip"] = "Exam day: high-protein breakfast, no heavy carbs."
        plan["hydration_tip"] = "Exam day: drink every 45 minutes, 200ml per session."
        plan["sleep_tip"] = "Exam day: must be in bed by 10:30 PM minimum for memory consolidation."
        plan["focus_tip"] = "Exam day: study in 45-min blocks, drink water between each block, avoid caffeine after 2PM"

    routine_doc_ref.set({
        "plan": plan,
        "generatedAt": firestore.SERVER_TIMESTAMP
    })

    return plan
