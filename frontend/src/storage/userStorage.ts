/**
 * userStorage.ts
 * Data Layer — all data flows through FastAPI backend.
 * Falls back to Firestore when backend is unreachable.
 *
 * Architecture: Mobile App → FastAPI Backend → Firestore (with fallback)
 */

import axios from 'axios';
import Config from '../constants/Config';
import { auth } from '../firebaseConfig';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { resilientGet } from './resilientFetch';

// ─── Types ─────────────────────────────────────────────────────────────────

export type GoalType = 'bulking' | 'maintenance' | 'fat_loss';

export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  createdAt: string;       // ISO datetime
}

export interface HealthGoals {
  caloriesGoal: number;
  proteinGoal: number;     // grams
  waterGoalLiters: number;
  sleepGoalHours: number;
  goalType: GoalType;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
}

export interface AppPreferences {
  themeMode: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  waterReminderIntervalHours: number;
  sleepTargetHour: number;  // e.g. 23 = 11 PM
  developerMode: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const getBaseUrl = (): string => Config.API_BASE_URL || 'http://localhost:8000';

const getUserId = (): string => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    console.error("[userStorage] Attempted restricted operation without UID");
    throw new Error("User not authenticated");
  }
  return uid;
};

const api = () => {
  const baseURL = getBaseUrl();
  return axios.create({ baseURL, timeout: 10_000 });
};

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_GOALS: HealthGoals = {
  caloriesGoal: 2500,
  proteinGoal: 150,
  waterGoalLiters: 4.0,
  sleepGoalHours: 8,
  goalType: 'maintenance',
};

const DEFAULT_PREFERENCES: AppPreferences = {
  themeMode: 'system',
  notificationsEnabled: true,
  waterReminderIntervalHours: 2,
  sleepTargetHour: 23,
  developerMode: false,
};

// ─── Profile ───────────────────────────────────────────────────────────────

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/profile`, {
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  });
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/profile`);
    const data = res.data;
    if (!data || !data.name) return null;
    return { uid, ...data } as UserProfile;
  } catch {
    // Firestore fallback
    console.warn('Backend unreachable, falling back to Firestore for profile');
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        return { uid, name: data.name || '', email: data.email, ...data } as UserProfile;
      }
    } catch {}
    return null;
  }
}

// ─── Health Goals ──────────────────────────────────────────────────────────

export async function saveHealthGoals(goals: Partial<HealthGoals>): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/goals`, goals);
}

export async function getHealthGoals(): Promise<HealthGoals> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/goals`);
    return { ...DEFAULT_GOALS, ...res.data } as HealthGoals;
  } catch {
    // Firestore fallback
    console.warn('Backend unreachable, falling back to Firestore for goals');
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.goals) return { ...DEFAULT_GOALS, ...data.goals } as HealthGoals;
      }
    } catch {}
    return DEFAULT_GOALS;
  }
}

/**
 * Calculate goals from health profile input.
 * Used by the Personal Health Profile setup screen.
 * This runs client-side since it's pure math with no DB access.
 */
export function calculateGoalsFromProfile(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  goalType: GoalType
): HealthGoals {
  // Mifflin-St Jeor BMR (male assumption; can be parameterized)
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  const tdee = bmr * 1.55; // Moderate activity multiplier

  let caloriesGoal: number;
  let proteinGoal: number;

  switch (goalType) {
    case 'bulking':
      caloriesGoal = Math.round(tdee + 400);
      proteinGoal  = Math.round(weightKg * 2.2);
      break;
    case 'fat_loss':
      caloriesGoal = Math.round(tdee - 400);
      proteinGoal  = Math.round(weightKg * 2.0);
      break;
    default: // maintenance
      caloriesGoal = Math.round(tdee);
      proteinGoal  = Math.round(weightKg * 1.8);
  }

  // Water: ~35ml per kg bodyweight
  const waterGoalLiters = Math.round((weightKg * 35) / 1000 * 10) / 10;

  return {
    caloriesGoal,
    proteinGoal,
    waterGoalLiters: Math.max(2.5, Math.min(5.0, waterGoalLiters)),
    sleepGoalHours: 8,
    goalType,
    heightCm,
    weightKg,
  };
}

// ─── App Preferences ───────────────────────────────────────────────────────

export async function savePreferences(prefs: Partial<AppPreferences>): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/preferences`, prefs);
}

export async function getPreferences(): Promise<AppPreferences> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/preferences`);
    return { ...DEFAULT_PREFERENCES, ...res.data } as AppPreferences;
  } catch {
    console.warn('Backend unreachable, falling back to Firestore for preferences');
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.preferences) return { ...DEFAULT_PREFERENCES, ...data.preferences } as AppPreferences;
      }
    } catch {}
    return DEFAULT_PREFERENCES;
  }
}

// ─── XP & Gamification ─────────────────────────────────────────────────────

export async function getXP(): Promise<number> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/xp`);
    return res.data.xp || 0;
  } catch {
    console.warn('Backend unreachable, falling back to Firestore for XP');
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) return docSnap.data().xp || 0;
    } catch {}
    return 0;
  }
}

export async function addXP(amount: number): Promise<number> {
  const uid = getUserId();
  const res = await api().post(`/users/${uid}/xp/add?amount=${amount}`);
  return res.data.xp || 0;
}

// ─── Streaks ───────────────────────────────────────────────────────────────

export interface StreakMap {
  water: number;
  protein: number;
  calories: number;
  sleep: number;
  lastUpdatedDate: string;
}

const DEFAULT_STREAKS: StreakMap = {
  water: 0, protein: 0, calories: 0, sleep: 0, lastUpdatedDate: ''
};

export async function getStreaks(): Promise<StreakMap> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/streaks`);
    return { ...DEFAULT_STREAKS, ...res.data } as StreakMap;
  } catch {
    console.warn('Backend unreachable, falling back to Firestore for streaks');
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.streaks) return { ...DEFAULT_STREAKS, ...data.streaks } as StreakMap;
      }
    } catch {}
    return DEFAULT_STREAKS;
  }
}

export async function updateStreaks(updates: Partial<Omit<StreakMap, 'lastUpdatedDate'>>): Promise<StreakMap> {
  const uid = getUserId();
  const res = await api().post(`/users/${uid}/streaks`, updates);
  return res.data as StreakMap;
}

export async function resetStreak(key: keyof Omit<StreakMap, 'lastUpdatedDate'>): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/streaks/${key}/reset`);
}

// ─── Timetable ──────────────────────────────────────────────────────────────

export async function saveTimetable(timetable: Record<string, unknown[]>): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/timetable`, timetable);
}

export async function getTimetable(): Promise<Record<string, unknown[]>> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/timetable`);
    return res.data || {};
  } catch {
    console.warn('Backend unreachable, falling back to Firestore for timetable');
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.timetable) return data.timetable;
      }
    } catch {}
    return {};
  }
}

// ─── Onboarding ────────────────────────────────────────────────────────────

export async function setOnboardingComplete(): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/onboarding/complete`);
}

export async function isOnboardingComplete(): Promise<boolean> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/onboarding`);
    return res.data.completed === true;
  } catch {
    console.warn('Backend unreachable, falling back to Firestore for onboarding');
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) return docSnap.data().onboardingComplete === true;
    } catch {}
    return false;
  }
}

