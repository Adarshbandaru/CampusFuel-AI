import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

const SYNC_QUEUE_KEY = '@sync_queue';
const CACHE_PREFIX = '@cache_';

interface QueueItem {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  timestamp: number;
}

/**
 * Enhanced GET with caching
 */
export const offlineGet = async (url: string, options?: any) => {
  try {
    const netState = await NetInfo.fetch();
    if (netState.isConnected && netState.isInternetReachable) {
      const response = await axios.get(url, options);
      // Cache the successful response
      await AsyncStorage.setItem(CACHE_PREFIX + url, JSON.stringify(response.data));
      return response;
    } else {
      console.log('Offline: Fetching from cache for', url);
      const cachedData = await AsyncStorage.getItem(CACHE_PREFIX + url);
      if (cachedData) {
        return { data: JSON.parse(cachedData), status: 200, fromCache: true };
      }
      throw new Error('No internet and no cached data');
    }
  } catch (error) {
    const cachedData = await AsyncStorage.getItem(CACHE_PREFIX + url);
    if (cachedData) {
      return { data: JSON.parse(cachedData), status: 200, fromCache: true };
    }
    throw error;
  }
};

/**
 * Enhanced POST with queuing
 */
export const offlinePost = async (url: string, data: any) => {
  try {
    const netState = await NetInfo.fetch();
    if (netState.isConnected && netState.isInternetReachable) {
      return await axios.post(url, data);
    } else {
      await queueRequest(url, 'POST', data);
      return { data: { message: 'Offline: Request queued' }, status: 202 };
    }
  } catch (error) {
    await queueRequest(url, 'POST', data);
    return { data: { message: 'Error: Request queued' }, status: 202 };
  }
};

const queueRequest = async (url: string, method: any, data: any) => {
  const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  const queue: QueueItem[] = queueJson ? JSON.parse(queueJson) : [];
  
  const newItem: QueueItem = {
    id: Math.random().toString(36).substr(2, 9),
    url,
    method,
    data,
    timestamp: Date.now()
  };
  
  queue.push(newItem);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  console.log('Request queued for background sync');
};

/**
 * Background Synchronization Engine
 */
export const syncOfflineData = async () => {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected || !netState.isInternetReachable) return;

  const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  if (!queueJson) return;

  const queue: QueueItem[] = JSON.parse(queueJson);
  if (queue.length === 0) return;

  console.log(`Syncing ${queue.length} offline requests...`);
  
  const remainingQueue: QueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.method === 'POST') {
        await axios.post(item.url, item.data);
      }
      console.log('Successfully synced:', item.url);
    } catch (error) {
      console.error('Failed to sync:', item.url, error);
      remainingQueue.push(item);
    }
  }

  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
};

// Monitor connection changes to trigger sync
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    syncOfflineData();
  }
});
