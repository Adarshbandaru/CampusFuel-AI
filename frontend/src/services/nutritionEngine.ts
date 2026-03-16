/**
 * nutritionEngine.ts
 * All nutrition-related calculations: macro totals, meal parsing, goal deltas, and suggestions.
 * Screens import functions from here instead of calculating inline.
 */

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  unit: string;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
}

export interface MealSuggestion {
  message: string;
  severity: 'success' | 'warning' | 'danger';
}

/**
 * Calculate total macros from a list of food items with quantities.
 */
export function calculateMacroTotals(items: FoodItem[]): MacroTotals {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories * item.quantity,
      protein:  acc.protein  + item.protein  * item.quantity,
      carbs:    acc.carbs    + item.carbs     * item.quantity,
      fat:      acc.fat      + item.fat       * item.quantity,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * Calculate how far the user is from their daily goals.
 */
export function getGoalDeltas(totals: MacroTotals, goals: NutritionGoals): {
  caloriesDelta: number;
  proteinDelta: number;
  caloriesAchieved: boolean;
  proteinAchieved: boolean;
  overallPct: number;
} {
  const caloriesDelta = goals.calories - totals.calories;
  const proteinDelta  = goals.protein  - totals.protein;
  const caloriesPct   = Math.min(1, totals.calories / goals.calories);
  const proteinPct    = Math.min(1, totals.protein  / goals.protein);
  return {
    caloriesDelta,
    proteinDelta,
    caloriesAchieved: caloriesDelta <= 0,
    proteinAchieved:  proteinDelta  <= 0,
    overallPct: Math.round(((caloriesPct + proteinPct) / 2) * 100),
  };
}

/**
 * Generate a contextual suggestion based on the user's current nutrition status.
 */
export function getNutritionSuggestion(totals: MacroTotals, goals: NutritionGoals): MealSuggestion {
  const { caloriesDelta, proteinDelta } = getGoalDeltas(totals, goals);

  if (proteinDelta > 30) {
    return {
      message: `You're ${Math.round(proteinDelta)}g short on protein. Consider adding paneer, eggs, or milk to your next meal.`,
      severity: 'warning',
    };
  }
  if (caloriesDelta > 500) {
    return {
      message: `Still ${Math.round(caloriesDelta)} kcal away from your daily target. Have a balanced meal before dinner.`,
      severity: 'warning',
    };
  }
  if (caloriesDelta < -200) {
    return {
      message: `You've exceeded your calorie goal by ${Math.round(-caloriesDelta)} kcal today. Consider a lighter dinner.`,
      severity: 'danger',
    };
  }
  if (caloriesDelta <= 0 && proteinDelta <= 0) {
    return {
      message: 'All nutrition goals met today! Great discipline. 💪',
      severity: 'success',
    };
  }
  return {
    message: `Looking good! ${Math.round(caloriesDelta)} kcal and ${Math.round(proteinDelta)}g protein left for the day.`,
    severity: 'success',
  };
}

/**
 * Calculate weekly averages from an array of 7 daily totals.
 */
export function calculateWeeklyAverages(weeklyTotals: MacroTotals[]): MacroTotals {
  if (weeklyTotals.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const sum = weeklyTotals.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      protein:  acc.protein  + day.protein,
      carbs:    acc.carbs    + day.carbs,
      fat:      acc.fat      + day.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const count = weeklyTotals.length;
  return {
    calories: Math.round(sum.calories / count),
    protein:  Math.round(sum.protein  / count),
    carbs:    Math.round(sum.carbs    / count),
    fat:      Math.round(sum.fat      / count),
  };
}

/**
 * Determine if a single day's nutrition "hit" the goal (>= 80% of both calories and protein).
 */
export function didHitNutritionGoal(totals: MacroTotals, goals: NutritionGoals): boolean {
  const calPct = totals.calories / goals.calories;
  const proPct = totals.protein  / goals.protein;
  return calPct >= 0.8 && proPct >= 0.8;
}
