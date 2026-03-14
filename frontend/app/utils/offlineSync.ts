import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios, { AxiosRequestConfig } from 'axios';

const SYNC_QUEUE_KEY = 'campusfuel_sync_queue';
const CACHE_PREFIX = 'campusfuel_cache_';

type QueuedRequest = {
  id: string;
  url: string;
  data: any;
  method: string;
  timestamp: number;
};

/**
 * Checks if the device is currently online.
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected && !!state.isInternetReachable !== false;
}

/**
 * Performs a GET request. 
 * If online, fetches fresh data and caches it.
 * If offline (or fetch fails), returns the last cached fallback data.
 */
export async function offlineGet(url: string, config?: AxiosRequestConfig) {
  const cacheKey = `${CACHE_PREFIX}${url}`;
  
  try {
    const online = await isOnline();
    if (!online) throw new Error('Offline');

    // Try live fetch
    const res = await axios.get(url, config);
    // Cache success
    await AsyncStorage.setItem(cacheKey, JSON.stringify(res.data));
    return res;
  } catch (error) {
    // Fallback to cache
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      console.log(`[Offline Sync] Using cached data for ${url}`);
      return { data: JSON.parse(cachedData), status: 200, fromCache: true };
    }
    // If no cache exists, throw original
    throw error;
  }
}

/**
 * Performs a POST request.
 * If online, sends immediately.
 * If offline (or connection drops), queues the request locally and resolves optimistically.
 */
export async function offlinePost(url: string, data: any, config?: AxiosRequestConfig) {
  try {
    const online = await isOnline();
    if (!online) throw new Error('Offline');

    // Fast-fail timeout to catch hanging connections
    const enhancedConfig = { ...config, timeout: 5000 };
    return await axios.post(url, data, enhancedConfig);
    
  } catch (error: any) {
    // If it's a true API application error (e.g. 400 Bad Request), throw it.
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      throw error;
    }
    
    // Otherwise it's likely a network error / timeout / server down. Queue it.
    console.log(`[Offline Sync] Network unavailable, queueing POST to ${url}`);
    
    const requestItem: QueuedRequest = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      url,
      data,
      method: 'POST',
      timestamp: Date.now(),
    };

    const existingQueueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue: QueuedRequest[] = existingQueueStr ? JSON.parse(existingQueueStr) : [];
    
    queue.push(requestItem);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    
    // Optimistic success return for the UI
    return { 
      data: { message: 'Saved offline, will sync when connected.' }, 
      status: 202, 
      offlineQueued: true 
    };
  }
}

/**
 * Drains the async queue by attempting to POST all saved requests.
 */
export async function syncPendingRequests() {
  const online = await isOnline();
  if (!online) return;

  const existingQueueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  if (!existingQueueStr) return;

  const queue: QueuedRequest[] = JSON.parse(existingQueueStr);
  if (queue.length === 0) return;

  console.log(`[Offline Sync] Connectivity restored. Syncing ${queue.length} pending requests...`);

  const remainingQueue: QueuedRequest[] = [];

  for (const req of queue) {
    try {
      await axios.request({
        method: req.method,
        url: req.url,
        data: req.data,
      });
      console.log(`[Offline Sync] Successfully synced req ${req.id}`);
    } catch (err) {
      console.error(`[Offline Sync] Failed to sync req ${req.id}, keeping in queue.`);
      remainingQueue.push(req);
    }
  }

  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
  if (remainingQueue.length === 0) {
    console.log('[Offline Sync] Queue fully cleared!');
  }
}
