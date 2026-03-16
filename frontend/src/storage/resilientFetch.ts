/**
 * resilientFetch.ts
 * Resilience layer — tries FastAPI backend first, falls back to Firestore.
 */

import axios from 'axios';

/**
 * Attempts to GET from the backend API first.
 * If the backend is unreachable (network error, timeout, etc.),
 * falls back to the provided Firestore query function.
 */
export async function resilientGet<T>(
  backendUrl: string,
  firestoreFallback: () => Promise<T>
): Promise<T> {
  try {
    const response = await axios.get(backendUrl, { timeout: 8000 });
    return response.data;
  } catch (error) {
    console.warn('Backend unreachable, falling back to Firestore');
    return await firestoreFallback();
  }
}
