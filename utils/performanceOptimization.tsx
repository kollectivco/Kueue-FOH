/**
 * Performance Optimization Utilities
 * 
 * Provides helpers for optimizing React components and reducing unnecessary renders
 * Part of Phase 4: Performance & Caching Optimization
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════
// DEBOUNCE & THROTTLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Debounce function - delays execution until after wait time
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait time
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      
      previous = now;
      func(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  };
}

/**
 * React hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * React hook for debounced callbacks
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  
  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useMemo(
    () => debounce((...args: Parameters<T>) => callbackRef.current(...args), delay),
    [delay]
  );
}

/**
 * React hook for throttled callbacks
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useMemo(
    () => throttle((...args: Parameters<T>) => callbackRef.current(...args), delay),
    [delay]
  );
}

// ═══════════════════════════════════════════════════════════════════
// LAZY LOADING
// ═══════════════════════════════════════════════════════════════════

/**
 * Lazy load images with Intersection Observer
 */
export function useLazyImage(src: string, options?: IntersectionObserverInit) {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    if (!imgRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.disconnect();
        }
      },
      options || { rootMargin: '50px' }
    );
    
    observer.observe(imgRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [src, options]);
  
  useEffect(() => {
    if (!imageSrc) return;
    
    const img = new Image();
    img.src = imageSrc;
    
    img.onload = () => setIsLoading(false);
    img.onerror = () => setIsLoading(false);
  }, [imageSrc]);
  
  return { imageSrc, isLoading, ref: imgRef };
}

/**
 * Lazy load component when visible
 */
export function useLazyComponent(options?: IntersectionObserverInit) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      options || { rootMargin: '100px' }
    );
    
    observer.observe(ref.current);
    
    return () => {
      observer.disconnect();
    };
  }, [options]);
  
  return { isVisible, ref };
}

// ═══════════════════════════════════════════════════════════════════
// MEMOIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Deep comparison for useMemo/useCallback dependencies
 */
export function useDeepMemo<T>(factory: () => T, deps: any[]): T {
  const ref = useRef<{ deps: any[]; value: T }>();
  
  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = {
      deps,
      value: factory()
    };
  }
  
  return ref.current.value;
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => deepEqual(a[key], b[key]));
}

/**
 * Stable callback that doesn't change reference
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  );
}

// ═══════════════════════════════════════════════════════════════════
// RENDER TRACKING
// ═══════════════════════════════════════════════════════════════════

/**
 * Track component render count (dev only)
 */
export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current++;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${componentName}] Rendered ${renderCount.current} times`);
    }
  });
  
  return renderCount.current;
}

/**
 * Track why component re-rendered
 */
export function useWhyDidYouUpdate(name: string, props: Record<string, any>) {
  const previousProps = useRef<Record<string, any>>();
  
  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: any; to: any }> = {};
      
      allKeys.forEach(key => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key]
          };
        }
      });
      
      if (Object.keys(changedProps).length > 0) {
        console.log(`[${name}] Changed props:`, changedProps);
      }
    }
    
    previousProps.current = props;
  });
}

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE MONITORING
// ═══════════════════════════════════════════════════════════════════

/**
 * Measure component render time
 */
export function useMeasureRender(componentName: string) {
  const startTime = useRef<number>(0);
  
  // Before render
  startTime.current = performance.now();
  
  useEffect(() => {
    // After render
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;
    
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(
        `[${componentName}] Slow render: ${renderTime.toFixed(2)}ms (target: <16ms)`
      );
    }
  });
}

/**
 * Track expensive operations
 */
export function measurePerformance<T>(
  name: string,
  fn: () => T
): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// BATCHING & SCHEDULING
// ═══════════════════════════════════════════════════════════════════

/**
 * Batch multiple state updates together
 */
export function useBatchedUpdates() {
  const [, forceUpdate] = React.useState({});
  const updatesRef = useRef<(() => void)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const batch = useCallback((update: () => void) => {
    updatesRef.current.push(update);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const updates = updatesRef.current;
      updatesRef.current = [];
      
      updates.forEach(update => update());
      forceUpdate({});
    }, 0);
  }, []);
  
  return batch;
}

/**
 * Schedule low-priority work
 */
export function useIdleCallback(callback: () => void, options?: IdleRequestOptions) {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(callback, options);
      return () => cancelIdleCallback(id);
    } else {
      const timeout = setTimeout(callback, 1);
      return () => clearTimeout(timeout);
    }
  }, [callback, options]);
}

// ═══════════════════════════════════════════════════════════════════
// MEMORY OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Auto-cleanup effect on unmount
 */
export function useAutoCleanup<T>(
  create: () => T,
  cleanup: (value: T) => void
): T {
  const valueRef = useRef<T>();
  
  if (!valueRef.current) {
    valueRef.current = create();
  }
  
  useEffect(() => {
    return () => {
      if (valueRef.current) {
        cleanup(valueRef.current);
      }
    };
  }, [cleanup]);
  
  return valueRef.current;
}

/**
 * Prevent memory leaks from async operations
 */
export function useIsMounted() {
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  return useCallback(() => isMounted.current, []);
}

/**
 * Safe async callback that checks if component is mounted
 */
export function useSafeCallback<T extends (...args: any[]) => Promise<any>>(
  callback: T
): T {
  const isMounted = useIsMounted();
  
  return useCallback(
    (async (...args: Parameters<T>) => {
      const result = await callback(...args);
      
      if (!isMounted()) {
        return;
      }
      
      return result;
    }) as T,
    [callback, isMounted]
  );
}

// ═══════════════════════════════════════════════════════════════════
// LIST OPTIMIZATION
// ═══════════================================================================

/**
 * Optimize large list rendering with pagination
 */
export function usePagination<T>(items: T[], pageSize: number = 20) {
  const [currentPage, setCurrentPage] = React.useState(0);
  
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  const currentItems = items.slice(startIndex, endIndex);
  
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);
  
  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);
  
  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);
  
  return {
    currentItems,
    currentPage,
    totalPages,
    hasNext: currentPage < totalPages - 1,
    hasPrev: currentPage > 0,
    goToPage,
    nextPage,
    prevPage
  };
}

/**
 * Infinite scroll hook
 */
export function useInfiniteScroll(
  loadMore: () => void,
  options?: IntersectionObserverInit
) {
  const loadMoreRef = useRef(loadMore);
  const observerRef = useRef<IntersectionObserver>();
  const elementRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);
  
  useEffect(() => {
    if (!elementRef.current) return;
    
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreRef.current();
        }
      },
      options || { threshold: 0.5 }
    );
    
    observerRef.current.observe(elementRef.current);
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, [options]);
  
  return elementRef;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  debounce,
  throttle,
  useDebounce,
  useDebouncedCallback,
  useThrottledCallback,
  useLazyImage,
  useLazyComponent,
  useDeepMemo,
  useStableCallback,
  useRenderCount,
  useWhyDidYouUpdate,
  useMeasureRender,
  measurePerformance,
  useBatchedUpdates,
  useIdleCallback,
  useAutoCleanup,
  useIsMounted,
  useSafeCallback,
  usePagination,
  useInfiniteScroll
};
