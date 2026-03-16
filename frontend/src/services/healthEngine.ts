/**
 * healthEngine.ts
 * Core health metrics calculation engine.
 * UI screens should call these functions instead of computing inline.
 */

export interface DailyLog {
  date: string; // ISO date string e.g. "2026-03-15"
  waterMl: number;
  calories: number;
  protein: number;
  sleepMinutes: number;
  mealsLogged: number;
}

export interface HealthGoals {
  waterLiters: number;       // e.g. 4.0
  calories: number;          // e.g. 2500
  protein: number;           // g, e.g. 150
  sleepHours: number;        // e.g. 8
}

// --- Water ---
export function getWaterProgress(waterMl: number, goalLiters: number): {
  consumed: number;
  goal: number;
  remaining: number;
  percentage: number;
} {
  const consumed = waterMl / 1000;
  const remaining = Math.max(0, goalLiters - consumed);
  const percentage = Math.min(100, (consumed / goalLiters) * 100);
  return { consumed, goal: goalLiters, remaining, percentage };
}

// --- Nutrition ---
export function getNutritionProgress(calories: number, protein: number, goals: HealthGoals): {
  caloriesPct: number;
  proteinPct: number;
  caloriesRemaining: number;
  proteinRemaining: number;
} {
  const caloriesPct = Math.min(100, (calories / goals.calories) * 100);
  const proteinPct = Math.min(100, (protein / goals.protein) * 100);
  return {
    caloriesPct,
    proteinPct,
    caloriesRemaining: Math.max(0, goals.calories - calories),
    proteinRemaining: Math.max(0, goals.protein - protein),
  };
}

// --- Sleep ---
export function getSleepMetrics(sleepMinutes: number, goalHours: number): {
  hours: number;
  percentage: number;
  deficit: number;
  qualityScore: number;
} {
  const hours = sleepMinutes / 60;
  const percentage = Math.min(100, (hours / goalHours) * 100);
  const deficit = Math.max(0, goalHours - hours);
  // Quality heuristic: full sleep = 100, each missing hour reduces by ~12 pts
  const qualityScore = Math.max(0, Math.min(100, Math.round(percentage - deficit * 5)));
  return { hours, percentage, deficit, qualityScore };
}

// --- Meal Status ---
export type MealStatus = 'Completed' | 'Pending' | 'Missed';

export function getMealStatus(mealsLogged: number, currentHour: number): Record<string, MealStatus> {
  return {
    Breakfast:      mealsLogged >= 1 ? 'Completed' : (currentHour >= 11 ? 'Missed' : 'Pending'),
    Lunch:          mealsLogged >= 2 ? 'Completed' : (currentHour >= 15 ? 'Missed' : 'Pending'),
    'Protein Shake': mealsLogged >= 4 ? 'Completed' : (currentHour >= 23 ? 'Missed' : 'Pending'),
    Dinner:         mealsLogged >= 3 ? 'Completed' : (currentHour >= 22 ? 'Missed' : 'Pending'),
  };
}
