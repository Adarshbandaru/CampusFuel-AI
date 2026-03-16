/**
 * syncService.ts
 * Data Layer — handles syncing local logs with the backend server.
 *
 * Architecture:
 *  1. All writes go to local storage first (logStorage.ts / userStorage.ts).
 *  2. syncService queues changes and pushes them to the remote backend.
 *  3. On failure, items remain in the pending queue and are retried later.
 *  4. On app launch, syncService.syncOnStartup() is called to flush pending items.
 *
 * Screens must NEVER call the backend API directly.
 * They write to local storage → syncService handles the rest.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Config from '../constants/Config';
import { auth } from '../firebaseConfig';

// ─── Configuration ─────────────────────────────────────────────────────────

const BASE_URL = Config.API_BASE_URL;
const PENDING_QUEUE_KEY = 'campusfuel_sync_queue';
const TIMEOUT_MS = 10_000;

// ─── Types ─────────────────────────────────────────────────────────────────

export type SyncItemType = 'meal' | 'water' | 'weight' | 'sleep' | 'profile' | 'goals';

export interface SyncItem {
  id: string;
  type: SyncItemType;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

export type SyncStatus = 'synced' | 'pending' | 'failed';

// ─── Queue Helpers ─────────────────────────────────────────────────────────

async function getQueue(): Promise<SyncItem[]> {
  const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: SyncItem[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
}

async function enqueueItem(item: Omit<SyncItem, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
  await saveQueue(queue);
}

// ─── Specific Enqueue Actions ───────────────────────────────────────────────

export async function enqueueMealSync(payload: Record<string, unknown>): Promise<void> {
  const uid = auth.currentUser?.uid || 'user123';
  await enqueueItem({
    type: 'meal',
    endpoint: `/users/${uid}/meal/plate`,
    method: 'POST',
    payload,
  });
}

export async function enqueueWaterSync(amountMl: number): Promise<void> {
  const uid = auth.currentUser?.uid || 'user123';
  await enqueueItem({
    type: 'water',
    endpoint: `/users/${uid}/water?amount_ml=${amountMl}`,
    method: 'POST',
    payload: {},
  });
}

export async function enqueueWeightSync(weightKg: number): Promise<void> {
  const uid = auth.currentUser?.uid || 'user123';
  await enqueueItem({
    type: 'weight',
    endpoint: `/users/${uid}/weight`,
    method: 'POST',
    payload: { weight_kg: weightKg },
  });
}

export async function enqueueSleepSync(startTime: string, endTime: string): Promise<void> {
  const uid = auth.currentUser?.uid || 'user123';
  await enqueueItem({
    type: 'sleep',
    endpoint: `/users/${uid}/sleep`,
    method: 'POST',
    payload: { sleep_start: startTime, sleep_end: endTime },
  });
}

export async function enqueueGoalsSync(goals: Record<string, unknown>): Promise<void> {
  const uid = auth.currentUser?.uid || 'user123';
  await enqueueItem({
    type: 'goals',
    endpoint: `/users/${uid}/health-profile`,
    method: 'POST',
    payload: goals,
  });
}

// ─── Sync Engine ───────────────────────────────────────────────────────────

/**
 * Attempt to flush the entire pending queue to the backend.
 * Successfully synced items are removed from the queue.
 * Failed items have their retry count incremented (max 5 retries, then dropped).
 *
 * Returns { synced, failed } counts.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const remaining: SyncItem[] = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await axios({
        method: item.method,
        url: `${BASE_URL}${item.endpoint}`,
        data: item.payload,
        timeout: TIMEOUT_MS,
      });
      synced++;
      // Item removed by not pushing to remaining[]
    } catch {
      if (item.retries >= 5) {
        // Drop after 5 retries
        failed++;
      } else {
        remaining.push({ ...item, retries: item.retries + 1 });
        failed++;
      }
    }
  }

  await saveQueue(remaining);
  return { synced, failed };
}

/**
 * Called on app startup. Attempts to sync any pending items from previous sessions.
 */
export async function syncOnStartup(): Promise<void> {
  try {
    await flushQueue();
  } catch {
    // Silently fail — will retry on next startup or manual trigger
  }
}

/**
 * Returns the count of items currently pending sync.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Checks connectivity by pinging the backend health endpoint.
 */
export async function isServerReachable(): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch fresh dashboard data from the backend (used after a successful sync).
 * Returns null if offline.
 */
export async function fetchDashboard(): Promise<Record<string, unknown> | null> {
  try {
    const uid = auth.currentUser?.uid || 'user123';
    const res = await axios.get(`${BASE_URL}/users/${uid}/dashboard`, { timeout: TIMEOUT_MS });
    return res.data;
  } catch {
    return null;
  }
}
