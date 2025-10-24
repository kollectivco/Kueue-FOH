/**
 * useAutoLogout Hook
 * 
 * Easy-to-use hook for implementing auto-logout functionality
 * Part of Phase 2: Auth & Permissions Fixes
 */

import { useEffect, useState, useCallback } from 'react';
import { sessionManager, SESSION_CONFIG } from '../utils/sessionManager';
import { logAuditEvent } from '../utils/authSecurity';

export interface UseAutoLogoutOptions {
  /**
   * Enable/disable auto-logout
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Inactivity timeout in milliseconds
   * @default 30 minutes
   */
  timeout?: number;
  
  /**
   * Warning time before logout in milliseconds
   * @default 5 minutes
   */
  warningTime?: number;
  
  /**
   * Callback when warning should be shown
   */
  onWarning?: (remainingMinutes: number) => void;
  
  /**
   * Callback when user should be logged out
   */
  onLogout?: () => void;
  
  /**
   * Callback when session is extended
   */
  onExtend?: () => void;
  
  /**
   * Enable auto token refresh
   * @default true
   */
  autoRefresh?: boolean;
  
  /**
   * Token refresh callback
   */
  onRefresh?: () => Promise<void>;
}

export interface UseAutoLogoutReturn {
  /**
   * Current inactivity time in milliseconds
   */
  inactiveTime: number;
  
  /**
   * Remaining time before logout in milliseconds
   */
  remainingTime: number;
  
  /**
   * Remaining minutes before logout
   */
  remainingMinutes: number;
  
  /**
   * Whether warning should be shown
   */
  shouldShowWarning: boolean;
  
  /**
   * Extend the session (reset inactivity timer)
   */
  extendSession: () => void;
  
  /**
   * Force refresh token immediately
   */
  forceRefresh: () => Promise<void>;
  
  /**
   * Get full session status
   */
  getStatus: () => ReturnType<typeof sessionManager.getStatus>;
  
  /**
   * Is auto-logout currently active
   */
  isActive: boolean;
}

export function useAutoLogout(options: UseAutoLogoutOptions = {}): UseAutoLogoutReturn {
  const {
    enabled = true,
    timeout = SESSION_CONFIG.INACTIVITY_TIMEOUT,
    warningTime = SESSION_CONFIG.WARNING_TIME,
    onWarning,
    onLogout,
    onExtend,
    autoRefresh = true,
    onRefresh
  } = options;
  
  const [sessionStatus, setSessionStatus] = useState(() => 
    sessionManager.getStatus()
  );
  
  // Initialize session manager
  useEffect(() => {
    if (!enabled) return;
    
    console.log('🔒 useAutoLogout: Initializing...');
    
    sessionManager.init({
      autoLogout: true,
      autoRefresh,
      onWarning: (remainingMinutes) => {
        console.log(`⚠️ Auto-logout warning: ${remainingMinutes} minutes remaining`);
        if (onWarning) {
          onWarning(remainingMinutes);
        }
      },
      onLogout: () => {
        console.log('🚪 Auto-logout triggered');
        if (onLogout) {
          onLogout();
        }
      },
      onRefresh,
      onRefreshError: (error) => {
        console.error('❌ Token refresh error:', error);
      }
    });
    
    // Update status every second
    const statusInterval = setInterval(() => {
      setSessionStatus(sessionManager.getStatus());
    }, 1000);
    
    return () => {
      clearInterval(statusInterval);
      sessionManager.cleanup();
    };
  }, [enabled, autoRefresh, onWarning, onLogout, onRefresh]);
  
  // Extend session handler
  const extendSession = useCallback(() => {
    sessionManager.extendSession();
    
    if (onExtend) {
      onExtend();
    }
    
    logAuditEvent('session_extended_by_user', {
      timestamp: Date.now()
    });
  }, [onExtend]);
  
  // Force refresh handler
  const forceRefresh = useCallback(async () => {
    await sessionManager.forceRefresh();
  }, []);
  
  // Get status handler
  const getStatus = useCallback(() => {
    return sessionManager.getStatus();
  }, []);
  
  return {
    inactiveTime: sessionStatus.inactiveTime,
    remainingTime: sessionStatus.remainingTime,
    remainingMinutes: sessionStatus.remainingMinutes,
    shouldShowWarning: sessionStatus.shouldShowWarning,
    extendSession,
    forceRefresh,
    getStatus,
    isActive: sessionStatus.isActive
  };
}

// ═══════════════════════════════════════════════════════════════════
// ADDITIONAL HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook for simple inactivity detection
 * Returns true if user has been inactive for specified duration
 */
export function useInactivityDetection(timeoutMs: number = 30 * 60 * 1000): boolean {
  const [isInactive, setIsInactive] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const status = sessionManager.getStatus();
      setIsInactive(status.inactiveTime > timeoutMs);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeoutMs]);
  
  return isInactive;
}

/**
 * Hook for session remaining time
 * Returns remaining time in minutes
 */
export function useSessionRemainingTime(): number {
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const status = sessionManager.getStatus();
      setRemainingMinutes(status.remainingMinutes);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return remainingMinutes;
}

/**
 * Hook for activity tracking
 * Calls callback on user activity
 */
export function useActivityTracking(callback: () => void): void {
  useEffect(() => {
    const unsubscribe = sessionManager.onActivity(callback);
    return unsubscribe;
  }, [callback]);
}
