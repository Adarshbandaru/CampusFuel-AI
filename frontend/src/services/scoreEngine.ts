/**
 * scoreEngine.ts
 * Life Consistency Score engine.
 * Weights: Nutrition 30% | Hydration 20% | Sleep 20% | Habits 15% | Discipline 15%
 *
 * Rules:
 *   - If no data logged → score is 0 for that category (no fake defaults).
 *   - Score updates dynamically from real logs passed in.
 */

export interface ScoreInputs {
  // Nutrition
  calories: number;
  caloriesGoal: number;
  protein: number;
  proteinGoal: number;
  mealsLogged: number;

  // Hydration
  waterLiters: number;
  waterGoalLiters: number;

  // Sleep
  sleepHours: number;
  sleepGoalHours: number;

  // Habits / Discipline
  streaks: {
    water: number;
    protein: number;
    calories: number;
    sleep: number;
  };
}

export interface ScoreBreakdown {
  nutrition: number;       // out of 30
  hydration: number;       // out of 20
  sleep: number;           // out of 20
  habits: number;          // out of 15
  discipline: number;      // out of 15
  total: number;           // out of 100
  percentages: {
    nutrition: number;
    hydration: number;
    sleep: number;
    habits: number;
    discipline: number;
  };
  analysis: string[];
}

export function calculateConsistencyScore(inputs: ScoreInputs): ScoreBreakdown {
  // --- Nutrition (30 pts) ---
  const calPct  = inputs.caloriesGoal > 0 ? Math.min(1, inputs.calories / inputs.caloriesGoal) : 0;
  const proPct  = inputs.proteinGoal > 0  ? Math.min(1, inputs.protein / inputs.proteinGoal)   : 0;
  const mealPct = Math.min(1, inputs.mealsLogged / 3);
  const nutritionRaw = (calPct + proPct + mealPct) / 3;
  const nutrition = Math.round(nutritionRaw * 30);

  // --- Hydration (20 pts) ---
  const hydrationPct = inputs.waterGoalLiters > 0 ? Math.min(1, inputs.waterLiters / inputs.waterGoalLiters) : 0;
  const hydration = Math.round(hydrationPct * 20);

  // --- Sleep (20 pts) ---
  const sleepPct = inputs.sleepGoalHours > 0 ? Math.min(1, inputs.sleepHours / inputs.sleepGoalHours) : 0;
  const sleep = Math.round(sleepPct * 20);

  // --- Habits (15 pts) ---
  const allStreaks = Object.values(inputs.streaks);
  const activeHabits = allStreaks.filter(s => s > 0).length;
  const habitPct = Math.min(1, activeHabits / 4);
  const habits = Math.round(habitPct * 15);

  // --- Discipline (15 pts) --- based on 7-day streak average
  const avgStreak = allStreaks.reduce((a, b) => a + b, 0) / Math.max(1, allStreaks.length);
  const disciplinePct = Math.min(1, avgStreak / 7);
  const discipline = Math.round(disciplinePct * 15);

  const total = Math.max(0, Math.min(100, nutrition + hydration + sleep + habits + discipline));

  // --- Analysis ---
  const analysis: string[] = [];
  if (calPct < 0.8) analysis.push("Calorie intake is lower than targeted.");
  if (proPct < 0.8) analysis.push("Protein intake is below goal. Focus on high-protein foods.");
  if (hydrationPct < 0.8) analysis.push("Hydration could be better; try drinking more water.");
  if (sleepPct < 0.8) analysis.push("Sleep duration is below target. Aim for more rest.");
  if (activeHabits < 3) analysis.push("Try to be more consistent with all health habits.");
  if (total >= 85) analysis.push("Excellent consistency! You're performing at an elite level.");
  else if (total >= 60) analysis.push("Solid performance. Keep maintaining these habits.");
  
  if (analysis.length === 0) analysis.push("Keep following your daily routine.");

  return {
    nutrition,
    hydration,
    sleep,
    habits,
    discipline,
    total,
    percentages: {
      nutrition:  Math.round(nutritionRaw * 100),
      hydration:  Math.round(hydrationPct * 100),
      sleep:      Math.round(sleepPct * 100),
      habits:     Math.round(habitPct * 100),
      discipline: Math.round(disciplinePct * 100),
    },
    analysis
  };
}

export function getLevelFromXP(xp: number): { level: number; title: string; xpToNext: number; progressPct: number } {
  const tiers = [
    { level: 1, min: 0,    title: 'Beginner' },
    { level: 2, min: 100,  title: 'Habit Builder' },
    { level: 3, min: 250,  title: 'Consistency Pro' },
    { level: 4, min: 500,  title: 'Discipline Master' },
    { level: 5, min: 800,  title: 'Elite Performer' },
    { level: 6, min: 1200, title: 'Legend' },
  ];

  let current = tiers[0];
  let next = tiers[1];
  for (let i = 0; i < tiers.length; i++) {
    if (xp >= tiers[i].min) {
      current = tiers[i];
      next = tiers[i + 1] ?? tiers[i];
    }
  }

  const range = next.min - current.min;
  const earned = xp - current.min;
  const progressPct = range > 0 ? Math.round((earned / range) * 100) : 100;

  return {
    level: current.level,
    title: current.title,
    xpToNext: next.min,
    progressPct,
  };
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Elite',        color: '#10B981' };
  if (score >= 70) return { label: 'Strong',        color: '#22C55E' };
  if (score >= 55) return { label: 'Progressing',  color: '#F59E0B' };
  if (score >= 35) return { label: 'Building',     color: '#F97316' };
  return              { label: 'Getting Started', color: '#EF4444' };
}
