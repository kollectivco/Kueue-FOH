/**
 * Cache Manager
 * 
 * Provides intelligent caching for API requests and expensive computations
 * Part of Phase 4: Performance & Caching Optimization
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  stale: boolean;
}

interface CacheOptions {
  ttl?: number;           // Time to live in milliseconds
  staleWhileRevalidate?: number; // Time to serve stale data while revalidating
  maxAge?: number;        // Maximum age before hard invalidation
  tags?: string[];        // Tags for grouped invalidation
}

// ═══════════════════════════════════════════════════════════════════
// CACHE MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private tags = new Map<string, Set<string>>(); // tag -> Set of keys
  private pendingRequests = new Map<string, Promise<any>>();
  
  // Default options
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_STALE_TIME = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_CACHE_SIZE = 100; // entries
  
  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    
    // Check if completely expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Mark as stale if past TTL but not expired
    if (now > entry.timestamp + (entry.expiresAt - entry.timestamp) * 0.8) {
      entry.stale = true;
    }
    
    return entry.data as T;
  }
  
  /**
   * Set cache data
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const {
      ttl = this.DEFAULT_TTL,
      tags = []
    } = options;
    
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      stale: false
    };
    
    // Add to cache
    this.cache.set(key, entry);
    
    // Add tags
    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(key);
    }
    
    // Check cache size
    this.enforceMaxSize();
  }
  
  /**
   * Check if key exists and is fresh
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    return now < entry.expiresAt;
  }
  
  /**
   * Check if data is stale (but still valid)
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? entry.stale : false;
  }
  
  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    // Remove from tags
    for (const tagSet of this.tags.values()) {
      tagSet.delete(key);
    }
    
    return this.cache.delete(key);
  }
  
  /**
   * Invalidate by pattern
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern.replace(/\*/g, '.*'))
      : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Invalidate by tag
   */
  invalidateTag(tag: string): number {
    const keys = this.tags.get(tag);
    if (!keys) return 0;
    
    let count = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        count++;
      }
    }
    
    this.tags.delete(tag);
    return count;
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.tags.clear();
    this.pendingRequests.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    let totalSize = 0;
    let staleCount = 0;
    let freshCount = 0;
    
    const now = Date.now();
    
    for (const entry of this.cache.values()) {
      totalSize++;
      
      if (now > entry.expiresAt) {
        // Expired (will be removed on next access)
      } else if (entry.stale) {
        staleCount++;
      } else {
        freshCount++;
      }
    }
    
    return {
      totalEntries: totalSize,
      freshEntries: freshCount,
      staleEntries: staleCount,
      tags: this.tags.size,
      pendingRequests: this.pendingRequests.size
    };
  }
  
  /**
   * Enforce maximum cache size (LRU eviction)
   */
  private enforceMaxSize(): void {
    if (this.cache.size <= this.MAX_CACHE_SIZE) {
      return;
    }
    
    // Sort by timestamp (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries
    const toRemove = this.cache.size - this.MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      this.delete(entries[i][0]);
    }
  }
  
  /**
   * Cached fetch with deduplication
   * Prevents multiple simultaneous requests for the same key
   */
  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null && !this.isStale(key)) {
      return cached;
    }
    
    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    
    // Make new request
    const promise = fetcher()
      .then(data => {
        this.set(key, data, options);
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
  
  /**
   * Prefetch data into cache
   */
  async prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<void> {
    // Don't prefetch if already cached and fresh
    if (this.has(key) && !this.isStale(key)) {
      return;
    }
    
    try {
      await this.fetch(key, fetcher, options);
    } catch (error) {
      // Silent fail for prefetch
      console.warn(`Prefetch failed for key: ${key}`, error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const cache = new CacheManager();

// ═══════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for cached data fetching
 */
export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & { enabled?: boolean } = {}
) {
  const { enabled = true, ...cacheOptions } = options;
  
  const [data, setData] = useState<T | null>(() => cache.get<T>(key));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const refetch = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await cache.fetch(key, fetcher, cacheOptions);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, enabled, cacheOptions]);
  
  useEffect(() => {
    // Check cache first
    const cached = cache.get<T>(key);
    if (cached !== null) {
      setData(cached);
      
      // Revalidate if stale
      if (cache.isStale(key)) {
        refetch();
      }
      return;
    }
    
    // Fetch if not cached
    refetch();
  }, [key, refetch]);
  
  return {
    data,
    loading,
    error,
    refetch,
    isStale: cache.isStale(key)
  };
}

/**
 * Hook for cache invalidation
 */
export function useCacheInvalidation() {
  const invalidate = useCallback((pattern: string | RegExp) => {
    return cache.invalidate(pattern);
  }, []);
  
  const invalidateTag = useCallback((tag: string) => {
    return cache.invalidateTag(tag);
  }, []);
  
  const clear = useCallback(() => {
    cache.clear();
  }, []);
  
  return {
    invalidate,
    invalidateTag,
    clear
  };
}

// ═══════════════════════════════════════════════════════════════════
// CACHE KEYS HELPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate cache keys consistently
 */
export const cacheKeys = {
  // Organizations
  org: (id: string) => `org:${id}`,
  orgs: () => 'orgs:all',
  orgsByUser: (userId: string) => `orgs:user:${userId}`,
  
  // Users
  user: (id: string) => `user:${id}`,
  users: () => 'users:all',
  usersByOrg: (orgId: string) => `users:org:${orgId}`,
  
  // Reservations
  reservation: (id: string) => `reservation:${id}`,
  reservations: () => 'reservations:all',
  reservationsByOrg: (orgId: string) => `reservations:org:${orgId}`,
  reservationsByDate: (orgId: string, date: string) => 
    `reservations:org:${orgId}:date:${date}`,
  
  // Plans
  plan: (id: string) => `plan:${id}`,
  plans: () => 'plans:all',
  
  // Menu
  menu: (orgId: string) => `menu:${orgId}`,
  menuItem: (id: string) => `menu-item:${id}`,
  
  // Analytics
  analytics: (orgId: string, period: string) => 
    `analytics:${orgId}:${period}`,
  
  // Dashboard
  dashboard: (orgId: string) => `dashboard:${orgId}`,
  stats: (orgId: string) => `stats:${orgId}`
};

// ═══════════════════════════════════════════════════════════════════
// CACHE TAGS
// ═══════════════════════════════════════════════════════════════════

export const cacheTags = {
  ORGANIZATIONS: 'organizations',
  USERS: 'users',
  RESERVATIONS: 'reservations',
  PLANS: 'plans',
  MENU: 'menu',
  ANALYTICS: 'analytics',
  DASHBOARD: 'dashboard'
};

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a cached version of any async function
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string,
  options: CacheOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyFn(...args);
    return cache.fetch(key, () => fn(...args), options);
  }) as T;
}

/**
 * Memoize expensive computations
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyFn 
      ? keyFn(...args) 
      : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default cache;
