/**
 * coachEngine.ts
 * Logic Layer — AI Coach that analyzes user health data and provides personalized feedback.
 * Uses a rule-based inference engine with pattern detection & predictive analytics.
 * 
 * ML-like capabilities:
 *  - Weighted scoring with exponential decay for recency bias
 *  - Pattern detection across 7-day trends
 *  - Predictive energy/performance modeling
 *  - Smart food recommendations based on nutritional gaps + time of day
 */

import { HealthGoals } from '../storage/userStorage';
import { ScoreBreakdown } from './scoreEngine';

export interface CoachInput {
  nutrition: {
    calories: number;
    protein: number;
    goalCalories: number;
    goalProtein: number;
  };
  hydration: {
    liters: number;
    goalLiters: number;
  };
  sleep: {
    hours: number;
    goalHours: number;
    qualityScore: number;
  };
  score: ScoreBreakdown;
  timetable?: any[];
  userQuery?: string;
  // New: historical data for pattern detection
  weeklyHistory?: {
    calories: number[];   // Last 7 days
    protein: number[];
    waterLiters: number[];
    sleepHours: number[];
  };
}

// ─── Pattern Detection Engine ──────────────────────────────────────

/**
 * Detects declining trends using exponential weighted moving average.
 * Returns: 'declining' | 'improving' | 'stable'
 */
function detectTrend(values: number[]): 'declining' | 'improving' | 'stable' {
  if (values.length < 3) return 'stable';
  
  const alpha = 0.3; // Exponential decay factor - recent data weighs more
  let ewma = values[0];
  const ewmaValues: number[] = [ewma];
  
  for (let i = 1; i < values.length; i++) {
    ewma = alpha * values[i] + (1 - alpha) * ewma;
    ewmaValues.push(ewma);
  }
  
  // Compare first half average vs second half average
  const mid = Math.floor(ewmaValues.length / 2);
  const firstHalf = ewmaValues.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const secondHalf = ewmaValues.slice(mid).reduce((a, b) => a + b, 0) / (ewmaValues.length - mid);
  
  const changePercent = ((secondHalf - firstHalf) / Math.max(firstHalf, 1)) * 100;
  
  if (changePercent < -10) return 'declining';
  if (changePercent > 10) return 'improving';
  return 'stable';
}

/**
 * Predicts energy level based on current nutrition + sleep data.
 * Returns a score 0-100.
 */
function predictEnergyLevel(input: CoachInput): number {
  const calorieRatio = Math.min(1, input.nutrition.calories / Math.max(1, input.nutrition.goalCalories));
  const proteinRatio = Math.min(1, input.nutrition.protein / Math.max(1, input.nutrition.goalProtein));
  const sleepRatio = Math.min(1, input.sleep.hours / Math.max(1, input.sleep.goalHours));
  const hydrationRatio = Math.min(1, input.hydration.liters / Math.max(1, input.hydration.goalLiters));
  
  // Weighted energy model: sleep matters most, then nutrition, then hydration
  const energy = (sleepRatio * 35) + (calorieRatio * 25) + (proteinRatio * 20) + (hydrationRatio * 20);
  return Math.round(Math.max(0, Math.min(100, energy)));
}

/**
 * Smart food recommendation engine based on nutritional gaps + time of day.
 */
function getSmartFoodSuggestion(input: CoachInput): string {
  const hour = new Date().getHours();
  const proteinGap = input.nutrition.goalProtein - input.nutrition.protein;
  const calorieGap = input.nutrition.goalCalories - input.nutrition.calories;
  
  // Morning recommendations
  if (hour < 10) {
    if (proteinGap > input.nutrition.goalProtein * 0.8) {
      return "Start with a protein-rich breakfast: eggs, Greek yogurt, or a protein shake with banana.";
    }
    return "Fuel up: oats with milk and peanut butter gives you slow-release energy for morning lectures.";
  }
  
  // Midday recommendations
  if (hour < 14) {
    if (proteinGap > input.nutrition.goalProtein * 0.5) {
      return "Lunch tip: Go for dal with rice and paneer/chicken — hits your protein target efficiently.";
    }
    if (calorieGap > 1000) {
      return "You're undereating. Add a calorie-dense side like curd rice or chapati with ghee.";
    }
    return "Balance your lunch plate: 1/3 protein, 1/3 carbs, 1/3 vegetables.";
  }
  
  // Afternoon recommendations
  if (hour < 18) {
    if (proteinGap > 40) {
      return "Afternoon protein fix: grab peanut butter toast, a protein bar, or roasted chana.";
    }
    if (input.hydration.liters < input.hydration.goalLiters * 0.5) {
      return "Hydration alert: You're behind. Drink 500ml now — dehydration kills afternoon focus.";
    }
    return "Smart snacking: almonds, fruits, or a glass of milk to sustain energy until dinner.";
  }
  
  // Evening recommendations
  if (proteinGap > 30) {
    return "Evening protein recovery: milk with protein powder, paneer tikka, or egg whites.";
  }
  if (calorieGap > 500) {
    return "You're under your calorie goal. A hearty dinner with rice, dal, and sabzi will help.";
  }
  return "Light dinner suggestion: soup, salad, or grilled items for better sleep quality.";
}

// ─── Main Coach Engine ──────────────────────────────────────────────

/**
 * Generates a personalized insight based on daily performance, 
 * pattern analysis, and campus schedule.
 */
export function generateDailyInsight(input: CoachInput): string {
  const insights: string[] = [];
  const query = input.userQuery?.toLowerCase() || "";
  const now = new Date();
  const hour = now.getHours();

  // ─── Specific Query Handling ──────────────────────────────────
  if (query.includes("consistency") || query.includes("score")) {
    const scoreVal = input.score.total;
    if (scoreVal === 0) return "Logging is the first step to mastery! Start tracking your day, and I'll unlock your Life Consistency Score. 📈";
    if (scoreVal > 90) return `Your consistency is legendary (${scoreVal}/100)! You're outperforming 98% of students today. Stay locked in. 🔥`;
    return `Your score is ${scoreVal}/100. Focus on your water goal — it's the easiest way to push into the elite bracket! 🚀`;
  }

  if (query.includes("water") || query.includes("hydration")) {
    const liters = input.hydration.liters;
    const goal = input.hydration.goalLiters;
    const remaining = Math.max(0, goal - liters);
    if (liters === 0) return `Dehydration is the enemy of focus! Grab a bottle — your goal today is ${goal}L. 💧`;
    if (remaining === 0) return "Hydration peak reached! Your brain is sufficiently fueled for maximum focus. 🧠💎";
    return `You've crushed ${liters.toFixed(1)}L so far. Just ${remaining.toFixed(1)}L to go. Try drinking 500ml before your next class!`;
  }

  if (query.includes("sleep") || query.includes("tired")) {
    const hours = input.sleep.hours;
    if (hours === 0) return "Short on data? Sleep is when your brain 'garbage collects' its thoughts. Log last night's rest so I can analyze your recovery! 😴";
    if (hours < 6) return `Ouch, only ${hours.toFixed(1)}h of rest. Avoid high-caffeine drinks after 4 PM to ensure tonight is better. Your logic and memory might be a bit slower today.`;
    return `Solid ${hours.toFixed(1)}h of recovery! Your sleep quality was ${input.sleep.qualityScore}%. You're in prime shape for deep work. ⚡`;
  }

  if (query.includes("protein") || query.includes("snack") || query.includes("muscle") || query.includes("eat")) {
    return getSmartFoodSuggestion(input);
  }

  if (query.includes("energy") || query.includes("tired") || query.includes("fatigue")) {
    const energy = predictEnergyLevel(input);
    if (energy < 40) return `⚠️ Your predicted energy is low (${energy}/100). Prioritize: 1) 500ml water now, 2) high-protein snack, 3) 10min power nap if possible.`;
    if (energy < 70) return `Your energy level is moderate (${energy}/100). A balanced meal and staying hydrated will push you through the rest of the day.`;
    return `Energy prediction: ${energy}/100 — you're firing on all cylinders! Perfect time for challenging study sessions. 🚀`;
  }

  // ─── Proactive Pattern-Based Analysis ─────────────────────────
  
  // 1. Predictive Energy Alert
  const energyLevel = predictEnergyLevel(input);
  if (energyLevel < 50 && hour > 12) {
    insights.push(`⚡ Energy Alert: Your predicted energy is ${energyLevel}/100. ${getSmartFoodSuggestion(input)}`);
  }

  // 2. Pattern Detection (if weekly history available)
  if (input.weeklyHistory) {
    const proteinTrend = detectTrend(input.weeklyHistory.protein);
    const waterTrend = detectTrend(input.weeklyHistory.waterLiters);
    const sleepTrend = detectTrend(input.weeklyHistory.sleepHours);
    
    if (proteinTrend === 'declining') {
      insights.push("📉 Pattern Detected: Your protein intake has been declining over the past week. This could affect muscle recovery and energy levels.");
    }
    if (waterTrend === 'declining') {
      insights.push("📉 Hydration Warning: Your water intake has been trending downward. Dehydration compounds over days — time to reset!");
    }
    if (sleepTrend === 'declining') {
      insights.push("📉 Sleep Debt Building: Your sleep duration is declining. Consider setting a consistent bedtime alarm tonight.");
    }
    if (proteinTrend === 'improving' && waterTrend === 'improving') {
      insights.push("📈 Great Trend: Both protein and hydration are improving! Your consistency is building real momentum.");
    }
  }

  // 3. Time-Based Proactive Insights
  const hydrationRatio = input.hydration.liters / (input.hydration.goalLiters || 4);
  const proteinRatio = input.nutrition.protein / (input.nutrition.goalProtein || 150);

  if (hour < 10) {
    insights.push("🌅 Morning fuel: Start with 500ml water to jumpstart your metabolism before your first lecture.");
  }

  if (hydrationRatio < 0.4 && hour > 12) {
    insights.push("🚰 Hydration Alert: You're lagging. Low water levels cause brain fog during afternoon study sessions.");
  }

  if (proteinRatio < 0.3 && hour > 14) {
    insights.push("🥩 Protein Check: " + getSmartFoodSuggestion(input));
  }

  if (input.sleep.hours > 0 && input.sleep.hours < 6) {
    insights.push("😴 Recovery Warning: Low sleep detected. Prioritize critical tasks first and aim for an early bedtime tonight.");
  }

  // 4. Timetable/Schedule Awareness
  if (input.timetable && input.timetable.length > 0) {
    const classCount = input.timetable.length;
    if (classCount > 4) {
      insights.push(`📚 Heavy day ahead with ${classCount} classes! Pack an extra bottle of water and stay disciplined with your snacks.`);
    } else if (classCount > 0) {
      insights.push(`📅 You have ${classCount} sessions today. Use the gaps for deep focus or a quick hydration reset.`);
    }
  }

  // 5. Evening Performance Summary
  if (hour >= 20 && input.score.total > 0) {
    const score = input.score.total;
    if (score >= 80) {
      insights.push(`🏆 Day Summary: Score ${score}/100 — Elite performance today! You're building serious consistency.`);
    } else if (score >= 50) {
      insights.push(`📊 Day Summary: Score ${score}/100 — Solid effort. Focus on ${input.nutrition.protein < input.nutrition.goalProtein ? 'protein' : 'water'} to push higher.`);
    }
  }

  // ─── Default Synthesis ────────────────────────────────────────
  if (insights.length === 0) {
    if (input.score.total > 80) return "Elite performance detected. You're balancing campus life and health perfectly! Keep the momentum. 🚀🏆";
    if (input.score.total > 0) return `Today's focus: ${getSmartFoodSuggestion(input)} Your consistency score is ${input.score.total}/100 — every log moves it higher. 📈`;
    return "Start logging to activate your AI coach! I'll analyze your patterns and give you personalized strategies as data builds up. 🧠";
  }

  return insights.join("\n\n");
}

/**
 * Generates a structured analysis response for the coach chat endpoint.
 */
export function generateCoachResponse(input: CoachInput): {
  reply: string;
  suggestions: string[];
  energyLevel: number;
  confidenceScore: number;
} {
  const reply = generateDailyInsight(input);
  const energyLevel = predictEnergyLevel(input);
  
  // Generate contextual suggestions
  const suggestions: string[] = [];
  const proteinGap = input.nutrition.goalProtein - input.nutrition.protein;
  const calorieGap = input.nutrition.goalCalories - input.nutrition.calories;
  
  if (proteinGap > 30) suggestions.push(`Add ${Math.round(proteinGap)}g protein`);
  if (input.hydration.liters < input.hydration.goalLiters * 0.7) suggestions.push("Drink 500ml water");
  if (calorieGap > 500) suggestions.push("Eat a balanced meal");
  if (input.sleep.hours < input.sleep.goalHours) suggestions.push("Prioritize sleep tonight");
  if (suggestions.length === 0) suggestions.push("Keep maintaining this streak!");
  
  // Confidence based on data availability
  const dataPoints = [
    input.nutrition.calories > 0,
    input.nutrition.protein > 0,
    input.hydration.liters > 0,
    input.sleep.hours > 0,
    (input.weeklyHistory?.calories?.length || 0) > 3,
  ].filter(Boolean).length;
  
  const confidenceScore = Math.round((dataPoints / 5) * 100);
  
  return { reply, suggestions, energyLevel, confidenceScore };
}
