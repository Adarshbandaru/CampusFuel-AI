/**
 * logStorage.ts
 * Data Layer — all data flows through FastAPI backend.
 * Falls back to Firestore when backend is unreachable.
 * 
 * Architecture: Mobile App → FastAPI Backend → Firestore (with fallback)
 */

import axios from 'axios';
import Config from '../constants/Config';
import { auth } from '../firebaseConfig';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore';
import { resilientGet } from './resilientFetch';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MealLog {
  id: string;
  date: string;          // ISO "2026-03-15"
  name: string;          // e.g. "Lunch" or food name
  items?: string[];      // Optional list of foods
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt: string;      // ISO datetime
}

export interface WaterLog {
  id: string;
  date: string;
  amountMl: number;
  loggedAt: string;
}

export interface WeightLog {
  id: string;
  date: string;
  weightKg: number;
  loggedAt: string;
}

export interface SleepLog {
  id: string;
  date: string;          // The morning date (end of sleep)
  startTime: string;     // ISO datetime
  endTime: string;       // ISO datetime
  durationMinutes: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const getBaseUrl = (): string => Config.API_BASE_URL || 'http://localhost:8000';

const getUserId = (): string => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    console.error("[logStorage] Attempted restricted operation without UID");
    throw new Error("User not authenticated");
  }
  return uid;
};

const api = () => {
  const baseURL = getBaseUrl();
  return axios.create({ baseURL, timeout: 10_000 });
};

// ──────────────────────────────────────────────────────────────────────────
// MEALS
// ──────────────────────────────────────────────────────────────────────────

export async function saveMealLog(log: Partial<MealLog>): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/meals/log`, {
    name: log.name || 'Meal',
    items: log.items || [],
    calories: log.calories || 0,
    protein: log.protein || 0,
    carbs: log.carbs || 0,
    fat: log.fat || 0,
    date: log.date || new Date().toISOString().split('T')[0],
    loggedAt: log.loggedAt || new Date().toISOString(),
  });
}

export async function getAllMealLogs(): Promise<MealLog[]> {
  const uid = getUserId();
  return resilientGet<MealLog[]>(
    `${getBaseUrl()}/users/${uid}/meals/all`,
    async () => {
      const snap = await getDocs(collection(db, 'users', uid, 'meals'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as MealLog));
    }
  );
}

export async function getMealLogsForDate(date: string): Promise<MealLog[]> {
  const uid = getUserId();
  return resilientGet<MealLog[]>(
    `${getBaseUrl()}/users/${uid}/meals/date/${date}`,
    async () => {
      const snap = await getDocs(query(collection(db, 'users', uid, 'meals'), where('date', '==', date)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as MealLog));
    }
  );
}

export async function deleteMealLog(id: string): Promise<void> {
  const uid = getUserId();
  await api().delete(`/users/${uid}/meals/${id}`);
}

// ──────────────────────────────────────────────────────────────────────────
// WATER
// ──────────────────────────────────────────────────────────────────────────

export async function saveWaterLog(amountMl: number): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/water/log?amount_ml=${amountMl}`);
}

export async function getAllWaterLogs(): Promise<WaterLog[]> {
  const uid = getUserId();
  return resilientGet<WaterLog[]>(
    `${getBaseUrl()}/users/${uid}/water/logs`,
    async () => {
      const snap = await getDocs(collection(db, 'users', uid, 'water_logs'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WaterLog));
    }
  );
}

export async function getWaterForDate(date: string): Promise<number> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/water/date/${date}`);
    return res.data.totalMl || 0;
  } catch {
    // Firestore fallback
    console.warn('Backend unreachable, falling back to Firestore for water');
    try {
      const snap = await getDocs(query(collection(db, 'users', uid, 'water_logs'), where('date', '==', date)));
      return snap.docs.reduce((sum, d) => sum + (d.data().amountMl || 0), 0);
    } catch { return 0; }
  }
}

export async function deleteWaterLog(id: string): Promise<void> {
  const uid = getUserId();
  await api().delete(`/users/${uid}/water/${id}`);
}

// ──────────────────────────────────────────────────────────────────────────
// WEIGHT
// ──────────────────────────────────────────────────────────────────────────

export async function saveWeightLog(weightKg: number): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/weight`, { weight_kg: weightKg });
}

export async function getAllWeightLogs(): Promise<WeightLog[]> {
  const uid = getUserId();
  return resilientGet<WeightLog[]>(
    `${getBaseUrl()}/users/${uid}/weight`,
    async () => {
      const snap = await getDocs(collection(db, 'users', uid, 'weight_logs'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WeightLog));
    }
  );
}

export async function getLatestWeight(): Promise<WeightLog | null> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/weight/latest`);
    return res.data.latest || null;
  } catch {
    console.warn('Backend unreachable, falling back to Firestore for weight');
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SLEEP
// ──────────────────────────────────────────────────────────────────────────

export async function saveSleepLog(log: Omit<SleepLog, 'id'>): Promise<void> {
  const uid = getUserId();
  await api().post(`/users/${uid}/sleep/log`, {
    date: log.date,
    startTime: log.startTime,
    endTime: log.endTime,
    durationMinutes: log.durationMinutes,
  });
}

export async function getAllSleepLogs(): Promise<SleepLog[]> {
  const uid = getUserId();
  return resilientGet<SleepLog[]>(
    `${getBaseUrl()}/users/${uid}/sleep/all`,
    async () => {
      const snap = await getDocs(collection(db, 'users', uid, 'sleep_logs'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SleepLog));
    }
  );
}

export async function getSleepForDate(date: string): Promise<SleepLog | null> {
  const uid = getUserId();
  try {
    const res = await api().get(`/users/${uid}/sleep/date/${date}`);
    return res.data.log || null;
  } catch {
    console.warn('Backend unreachable, falling back to Firestore for sleep');
    try {
      const snap = await getDocs(query(collection(db, 'users', uid, 'sleep_logs'), where('date', '==', date)));
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as SleepLog;
    } catch { return null; }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// DAILY RESET HELPER
// ──────────────────────────────────────────────────────────────────────────

/**
 * Returns all logs for today only — aggregated server-side.
 * Falls back to Firestore doc if backend is unreachable.
 */
export async function getTodaysSummary(todayDate: string) {
  const uid = getUserId();
  return resilientGet(
    `${getBaseUrl()}/users/${uid}/summary/today`,
    async () => {
      // Fallback: read the daily_summaries doc for today
      try {
        const docSnap = await getDoc(doc(db, 'users', uid, 'daily_summaries', todayDate));
        if (docSnap.exists()) return docSnap.data();
      } catch {}
      // Return empty summary if nothing found
      return {
        totalCalories: 0, totalProtein: 0, totalWaterMl: 0,
        sleepMinutes: 0, mealsCount: 0,
      };
    }
  );
}

/**
 * Convenience version of getTodaysSummary that takes a Date object.
 */
export async function getDailyLog(date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  return getTodaysSummary(dateStr);
}

/**
 * Returns summaries for a range of dates (used for weekly charts).
 * Falls back to reading individual Firestore docs.
 */
export async function getSummaryForRange(dates: string[]) {
  const uid = getUserId();
  const dateStr = dates.join(',');
  return resilientGet(
    `${getBaseUrl()}/users/${uid}/summary/range?dates=${dateStr}`,
    async () => {
      // Fallback: read each day's summary individually
      const results = await Promise.all(
        dates.map(async (d) => {
          try {
            const docSnap = await getDoc(doc(db, 'users', uid, 'daily_summaries', d));
            if (docSnap.exists()) return docSnap.data();
          } catch {}
          return { totalCalories: 0, totalProtein: 0, totalWaterMl: 0, sleepMinutes: 0, mealsCount: 0 };
        })
      );
      return results;
    }
  );
}

/**
 * Triggers the backend rule to capture the end-of-day summary.
 * If dateStr is not provided, defaults to today.
 */
export async function saveDailySummary(dateStr?: string) {
  const uid = getUserId();
  const url = dateStr ? `/users/${uid}/summary/daily?date_str=${dateStr}` : `/users/${uid}/summary/daily`;
  const res = await api().post(url);
  return res.data;
}

