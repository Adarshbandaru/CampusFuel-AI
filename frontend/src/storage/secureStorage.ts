import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * secureStorage.ts
 * A wrapper for Expo SecureStore with fallback to localStorage for Web.
 */

export const secureStorage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch (e) {}
      return;
    }
    
    try {
      if (SecureStore && SecureStore.setItemAsync) {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.error("Secure Store Save Error:", e);
    }
  },

  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    try {
      if (SecureStore && SecureStore.getItemAsync) {
        return await SecureStore.getItemAsync(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  deleteItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch (e) {}
      return;
    }
    try {
      if (SecureStore && SecureStore.deleteItemAsync) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {}
  }
};
