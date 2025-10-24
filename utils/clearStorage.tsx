/**
 * Utility functions for clearing browser storage
 * Use with caution - these operations cannot be undone!
 */

export interface ClearStorageOptions {
  localStorage?: boolean;
  sessionStorage?: boolean;
  cookies?: boolean;
  indexedDB?: boolean;
  serviceWorkers?: boolean;
  caches?: boolean;
}

/**
 * Clear all browser storage
 * @param options - Specify which storage types to clear (default: all)
 */
export async function clearAllStorage(options: ClearStorageOptions = {}): Promise<void> {
  const {
    localStorage: clearLocalStorage = true,
    sessionStorage: clearSessionStorage = true,
    cookies: clearCookies = true,
    indexedDB: clearIndexedDB = true,
    serviceWorkers: clearServiceWorkers = true,
    caches: clearCaches = true,
  } = options;

  const results: string[] = [];

  try {
    // 1. Clear localStorage
    if (clearLocalStorage) {
      const localStorageKeys = Object.keys(localStorage);
      localStorage.clear();
      results.push(`✅ Cleared ${localStorageKeys.length} localStorage items`);
      console.log('🗑️ localStorage cleared');
    }

    // 2. Clear sessionStorage
    if (clearSessionStorage) {
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorage.clear();
      results.push(`✅ Cleared ${sessionStorageKeys.length} sessionStorage items`);
      console.log('🗑️ sessionStorage cleared');
    }

    // 3. Clear cookies
    if (clearCookies) {
      const cookies = document.cookie.split(';');
      cookies.forEach((cookie) => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
      results.push(`✅ Cleared ${cookies.length} cookies`);
      console.log('🗑️ Cookies cleared');
    }

    // 4. Clear IndexedDB
    if (clearIndexedDB && window.indexedDB) {
      try {
        const databases = await indexedDB.databases();
        let deletedCount = 0;
        
        for (const db of databases) {
          if (db.name) {
            await new Promise<void>((resolve, reject) => {
              const request = indexedDB.deleteDatabase(db.name!);
              request.onsuccess = () => {
                deletedCount++;
                resolve();
              };
              request.onerror = () => reject(request.error);
              request.onblocked = () => {
                console.warn(`Blocked deleting database: ${db.name}`);
                resolve(); // Continue even if blocked
              };
            });
          }
        }
        
        results.push(`✅ Cleared ${deletedCount} IndexedDB databases`);
        console.log('🗑️ IndexedDB cleared');
      } catch (error) {
        console.warn('⚠️ Failed to clear IndexedDB:', error);
        results.push('⚠️ IndexedDB clearing failed (may not be supported)');
      }
    }

    // 5. Unregister Service Workers
    if (clearServiceWorkers && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        let unregisteredCount = 0;
        
        for (const registration of registrations) {
          await registration.unregister();
          unregisteredCount++;
        }
        
        results.push(`✅ Unregistered ${unregisteredCount} service workers`);
        console.log('🗑️ Service workers unregistered');
      } catch (error) {
        console.warn('⚠️ Failed to unregister service workers:', error);
        results.push('⚠️ Service worker clearing failed');
      }
    }

    // 6. Clear Cache Storage
    if (clearCaches && 'caches' in window) {
      try {
        const cacheNames = await caches.keys();
        let deletedCount = 0;
        
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          deletedCount++;
        }
        
        results.push(`✅ Cleared ${deletedCount} cache storages`);
        console.log('🗑️ Cache storage cleared');
      } catch (error) {
        console.warn('⚠️ Failed to clear cache storage:', error);
        results.push('⚠️ Cache storage clearing failed');
      }
    }

    console.log('✅ Storage clearing complete:', results);
    return;
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
    throw error;
  }
}

/**
 * Clear only Kueue RSVP specific storage
 */
export function clearKueueStorage(): void {
  const keysToDelete: string[] = [];

  // Find all Kueue-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('kueue_') ||
      key.startsWith('org_') ||
      key.startsWith('plan_') ||
      key.startsWith('reservation_') ||
      key.startsWith('menu_') ||
      key.startsWith('supabase.')
    )) {
      keysToDelete.push(key);
    }
  }

  // Delete found keys
  keysToDelete.forEach(key => {
    localStorage.removeItem(key);
  });

  console.log(`🗑️ Cleared ${keysToDelete.length} Kueue-specific items from localStorage`);
}

/**
 * Clear all storage and reload the page
 */
export async function clearStorageAndReload(delay: number = 1500): Promise<void> {
  await clearAllStorage();
  
  console.log(`🔄 Reloading page in ${delay}ms...`);
  
  setTimeout(() => {
    window.location.reload();
  }, delay);
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  localStorage: { items: number; sizeKB: number };
  sessionStorage: { items: number; sizeKB: number };
  cookies: { count: number };
  indexedDB?: { databases: number };
  caches?: { caches: number };
}> {
  const stats: any = {
    localStorage: {
      items: localStorage.length,
      sizeKB: new Blob(Object.values(localStorage)).size / 1024,
    },
    sessionStorage: {
      items: sessionStorage.length,
      sizeKB: new Blob(Object.values(sessionStorage)).size / 1024,
    },
    cookies: {
      count: document.cookie.split(';').filter(c => c.trim()).length,
    },
  };

  // IndexedDB stats
  if (window.indexedDB) {
    try {
      const databases = await indexedDB.databases();
      stats.indexedDB = { databases: databases.length };
    } catch (error) {
      console.warn('Could not get IndexedDB stats');
    }
  }

  // Cache stats
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      stats.caches = { caches: cacheNames.length };
    } catch (error) {
      console.warn('Could not get cache stats');
    }
  }

  return stats;
}

/**
 * Export storage data before clearing (for backup)
 */
export function exportStorageData(): string {
  const data = {
    timestamp: new Date().toISOString(),
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    cookies: document.cookie,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Import storage data from backup
 */
export function importStorageData(jsonData: string): void {
  try {
    const data = JSON.parse(jsonData);

    // Restore localStorage
    if (data.localStorage) {
      Object.entries(data.localStorage).forEach(([key, value]) => {
        localStorage.setItem(key, value as string);
      });
    }

    // Restore sessionStorage
    if (data.sessionStorage) {
      Object.entries(data.sessionStorage).forEach(([key, value]) => {
        sessionStorage.setItem(key, value as string);
      });
    }

    console.log('✅ Storage data imported successfully');
  } catch (error) {
    console.error('❌ Failed to import storage data:', error);
    throw error;
  }
}
