import { Platform } from 'react-native';

// Conditional import for SecureStore (only on mobile)
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (error) {
    console.warn('SecureStore not available:', error);
  }
}

/**
 * Cross-platform secure storage utility
 * Uses SecureStore on mobile and localStorage on web
 */
export class CrossPlatformStorage {
  
  static async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        console.warn('localStorage not available');
        return null;
      } else {
        // Use SecureStore on mobile
        if (SecureStore && SecureStore.getItemAsync) {
          return await SecureStore.getItemAsync(key);
        }
        console.warn('SecureStore not available');
        return null;
      }
    } catch (error) {
      console.error(`Failed to get item '${key}':`, error);
      return null;
    }
  }
  
  static async setItem(key: string, value: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
          return true;
        }
        console.warn('localStorage not available');
        return false;
      } else {
        // Use SecureStore on mobile
        if (SecureStore && SecureStore.setItemAsync) {
          await SecureStore.setItemAsync(key, value);
          return true;
        }
        console.warn('SecureStore not available');
        return false;
      }
    } catch (error) {
      console.error(`Failed to set item '${key}':`, error);
      return false;
    }
  }
  
  static async removeItem(key: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
          return true;
        }
        console.warn('localStorage not available');
        return false;
      } else {
        // Use SecureStore on mobile
        if (SecureStore && SecureStore.deleteItemAsync) {
          await SecureStore.deleteItemAsync(key);
          return true;
        }
        console.warn('SecureStore not available');
        return false;
      }
    } catch (error) {
      console.error(`Failed to remove item '${key}':`, error);
      return false;
    }
  }
}

// Convenience functions for GitHub token management
export const GitHubTokenStorage = {
  async getToken(): Promise<string | null> {
    return CrossPlatformStorage.getItem('github_token');
  },
  
  async getUsername(): Promise<string | null> {
    return CrossPlatformStorage.getItem('github_username');
  },
  
  async setToken(token: string): Promise<boolean> {
    return CrossPlatformStorage.setItem('github_token', token);
  },
  
  async setUsername(username: string): Promise<boolean> {
    return CrossPlatformStorage.setItem('github_username', username);
  },
  
  async clearAll(): Promise<boolean> {
    const results = await Promise.all([
      CrossPlatformStorage.removeItem('github_token'),
      CrossPlatformStorage.removeItem('github_username'),
    ]);
    return results.every(result => result);
  }
};