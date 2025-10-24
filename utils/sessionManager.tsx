/**
 * Session Manager
 * 
 * Handles session lifecycle, activity tracking, and auto-logout
 * Part of Phase 2: Auth & Permissions Fixes
 */

import { updateSessionActivity, clearSessionInfo, logAuditEvent } from './authSecurity';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export const SESSION_CONFIG = {
  // Inactivity timeout: 30 minutes
  INACTIVITY_TIMEOUT: 30 * 60 * 1000,
  
  // Warning time: Show warning 5 minutes before logout
  WARNING_TIME: 5 * 60 * 1000,
  
  // Check interval: Check activity every minute
  CHECK_INTERVAL: 60 * 1000,
  
  // Token refresh interval: 45 minutes
  TOKEN_REFRESH_INTERVAL: 45 * 60 * 1000,
  
  // Activity tracking debounce: 5 seconds
  ACTIVITY_DEBOUNCE: 5 * 1000
};

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY TRACKING
// ═══════════════════════════════════════════════════════════════════

class ActivityTracker {
  private lastActivityTime: number = Date.now();
  private activityListeners: (() => void)[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;
  
  /**
   * Start tracking user activity
   */
  start(): void {
    if (this.isTracking) return;
    
    this.lastActivityTime = Date.now();
    this.isTracking = true;
    
    // Events that indicate user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];
    
    // Attach listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, this.handleActivity, true);
    });
    
    console.log('👁️ Activity tracking started');
    logAuditEvent('activity_tracking_started', {
      timestamp: Date.now()
    });
  }
  
  /**
   * Stop tracking activity
   */
  stop(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];
    
    activityEvents.forEach(event => {
      document.removeEventListener(event, this.handleActivity, true);
    });
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    console.log('👁️ Activity tracking stopped');
  }
  
  /**
   * Handle activity event (debounced)
   */
  private handleActivity = (): void => {
    // Debounce to avoid excessive updates
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.lastActivityTime = Date.now();
      updateSessionActivity();
      
      // Notify listeners
      this.activityListeners.forEach(listener => listener());
    }, SESSION_CONFIG.ACTIVITY_DEBOUNCE);
  };
  
  /**
   * Get time since last activity (in milliseconds)
   */
  getInactiveTime(): number {
    return Date.now() - this.lastActivityTime;
  }
  
  /**
   * Get last activity timestamp
   */
  getLastActivityTime(): number {
    return this.lastActivityTime;
  }
  
  /**
   * Check if user is inactive
   */
  isInactive(threshold: number = SESSION_CONFIG.INACTIVITY_TIMEOUT): boolean {
    return this.getInactiveTime() > threshold;
  }
  
  /**
   * Reset activity timer
   */
  reset(): void {
    this.lastActivityTime = Date.now();
    updateSessionActivity();
  }
  
  /**
   * Subscribe to activity events
   */
  onActivity(callback: () => void): () => void {
    this.activityListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.activityListeners = this.activityListeners.filter(cb => cb !== callback);
    };
  }
}

// Singleton instance
export const activityTracker = new ActivityTracker();

// ═══════════════════════════════════════════════════════════════════
// AUTO-LOGOUT MANAGER
// ═══════════════════════════════════════════════════════════════════

export interface AutoLogoutCallbacks {
  onWarning?: (remainingMinutes: number) => void;
  onLogout?: () => void;
  onExtend?: () => void;
}

class AutoLogoutManager {
  private checkInterval: NodeJS.Timeout | null = null;
  private warningShown: boolean = false;
  private callbacks: AutoLogoutCallbacks = {};
  private isEnabled: boolean = false;
  
  /**
   * Start auto-logout monitoring
   */
  start(callbacks: AutoLogoutCallbacks): void {
    if (this.isEnabled) {
      console.warn('Auto-logout already enabled');
      return;
    }
    
    this.callbacks = callbacks;
    this.isEnabled = true;
    this.warningShown = false;
    
    // Start activity tracking
    activityTracker.start();
    
    // Start checking for inactivity
    this.checkInterval = setInterval(() => {
      this.checkInactivity();
    }, SESSION_CONFIG.CHECK_INTERVAL);
    
    console.log('🔒 Auto-logout enabled');
    logAuditEvent('auto_logout_enabled', {
      timeout: SESSION_CONFIG.INACTIVITY_TIMEOUT,
      warningTime: SESSION_CONFIG.WARNING_TIME
    });
  }
  
  /**
   * Stop auto-logout monitoring
   */
  stop(): void {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    activityTracker.stop();
    
    console.log('🔒 Auto-logout disabled');
  }
  
  /**
   * Check for inactivity and trigger warnings/logout
   */
  private checkInactivity(): void {
    if (!this.isEnabled) return;
    
    const inactiveTime = activityTracker.getInactiveTime();
    
    // Check if should logout
    if (inactiveTime > SESSION_CONFIG.INACTIVITY_TIMEOUT) {
      console.warn('⏱️ Inactivity timeout reached - logging out');
      
      logAuditEvent('auto_logout_triggered', {
        inactiveTime,
        timeout: SESSION_CONFIG.INACTIVITY_TIMEOUT
      });
      
      this.triggerLogout();
      return;
    }
    
    // Check if should show warning
    const warningThreshold = SESSION_CONFIG.INACTIVITY_TIMEOUT - SESSION_CONFIG.WARNING_TIME;
    
    if (inactiveTime > warningThreshold && !this.warningShown) {
      const remainingTime = SESSION_CONFIG.INACTIVITY_TIMEOUT - inactiveTime;
      const remainingMinutes = Math.ceil(remainingTime / 60000);
      
      console.warn(`⚠️ Inactivity warning - ${remainingMinutes} minute(s) remaining`);
      
      logAuditEvent('auto_logout_warning_shown', {
        remainingMinutes,
        inactiveTime
      });
      
      this.warningShown = true;
      
      if (this.callbacks.onWarning) {
        this.callbacks.onWarning(remainingMinutes);
      }
    }
    
    // Reset warning if user became active
    if (inactiveTime < warningThreshold && this.warningShown) {
      this.warningShown = false;
    }
  }
  
  /**
   * Trigger logout
   */
  private triggerLogout(): void {
    this.stop();
    clearSessionInfo();
    
    if (this.callbacks.onLogout) {
      this.callbacks.onLogout();
    }
  }
  
  /**
   * Extend session (called when user clicks "Stay signed in")
   */
  extendSession(): void {
    console.log('✅ Session extended by user');
    
    activityTracker.reset();
    this.warningShown = false;
    
    logAuditEvent('session_extended', {
      timestamp: Date.now()
    });
    
    if (this.callbacks.onExtend) {
      this.callbacks.onExtend();
    }
  }
  
  /**
   * Get remaining time before logout (in milliseconds)
   */
  getRemainingTime(): number {
    const inactiveTime = activityTracker.getInactiveTime();
    return Math.max(0, SESSION_CONFIG.INACTIVITY_TIMEOUT - inactiveTime);
  }
  
  /**
   * Get remaining time in minutes
   */
  getRemainingMinutes(): number {
    return Math.ceil(this.getRemainingTime() / 60000);
  }
  
  /**
   * Check if warning should be shown
   */
  shouldShowWarning(): boolean {
    const inactiveTime = activityTracker.getInactiveTime();
    const warningThreshold = SESSION_CONFIG.INACTIVITY_TIMEOUT - SESSION_CONFIG.WARNING_TIME;
    return inactiveTime > warningThreshold;
  }
}

// Singleton instance
export const autoLogoutManager = new AutoLogoutManager();

// ═══════════════════════════════════════════════════════════════════
// SESSION REFRESH MANAGER
// ═══════════════════════════════════════════════════════════════════

export interface SessionRefreshCallbacks {
  onRefresh?: () => Promise<void>;
  onRefreshError?: (error: Error) => void;
}

class SessionRefreshManager {
  private refreshInterval: NodeJS.Timeout | null = null;
  private callbacks: SessionRefreshCallbacks = {};
  private isEnabled: boolean = false;
  private lastRefreshTime: number = 0;
  
  /**
   * Start automatic token refresh
   */
  start(callbacks: SessionRefreshCallbacks): void {
    if (this.isEnabled) {
      console.warn('Session refresh already enabled');
      return;
    }
    
    this.callbacks = callbacks;
    this.isEnabled = true;
    this.lastRefreshTime = Date.now();
    
    this.refreshInterval = setInterval(async () => {
      await this.performRefresh();
    }, SESSION_CONFIG.TOKEN_REFRESH_INTERVAL);
    
    console.log('🔄 Token refresh enabled');
    logAuditEvent('token_refresh_enabled', {
      interval: SESSION_CONFIG.TOKEN_REFRESH_INTERVAL
    });
  }
  
  /**
   * Stop automatic token refresh
   */
  stop(): void {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    console.log('🔄 Token refresh disabled');
  }
  
  /**
   * Perform token refresh
   */
  private async performRefresh(): Promise<void> {
    if (!this.isEnabled) return;
    
    // Only refresh if user is active (not idle)
    if (activityTracker.isInactive(SESSION_CONFIG.INACTIVITY_TIMEOUT / 2)) {
      console.log('⏸️ Skipping token refresh - user inactive');
      return;
    }
    
    try {
      console.log('🔄 Refreshing session token...');
      
      const startTime = Date.now();
      
      if (this.callbacks.onRefresh) {
        await this.callbacks.onRefresh();
      }
      
      this.lastRefreshTime = Date.now();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Token refreshed successfully (${duration}ms)`);
      
      logAuditEvent('token_refreshed', {
        timestamp: Date.now(),
        duration
      });
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      
      logAuditEvent('token_refresh_failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (this.callbacks.onRefreshError) {
        this.callbacks.onRefreshError(error as Error);
      }
    }
  }
  
  /**
   * Get time since last refresh (in milliseconds)
   */
  getTimeSinceLastRefresh(): number {
    return Date.now() - this.lastRefreshTime;
  }
  
  /**
   * Get time until next refresh (in milliseconds)
   */
  getTimeUntilNextRefresh(): number {
    const elapsed = this.getTimeSinceLastRefresh();
    return Math.max(0, SESSION_CONFIG.TOKEN_REFRESH_INTERVAL - elapsed);
  }
  
  /**
   * Force immediate refresh
   */
  async forceRefresh(): Promise<void> {
    await this.performRefresh();
  }
}

// Singleton instance
export const sessionRefreshManager = new SessionRefreshManager();

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGER (Main Interface)
// ═══════════════════════════════════════════════════════════════════

export interface SessionManagerConfig {
  autoLogout?: boolean;
  autoRefresh?: boolean;
  onWarning?: (remainingMinutes: number) => void;
  onLogout?: () => void;
  onRefresh?: () => Promise<void>;
  onRefreshError?: (error: Error) => void;
}

class SessionManager {
  private config: SessionManagerConfig = {};
  private isInitialized: boolean = false;
  
  /**
   * Initialize session manager
   */
  init(config: SessionManagerConfig): void {
    if (this.isInitialized) {
      console.warn('Session manager already initialized');
      return;
    }
    
    this.config = config;
    this.isInitialized = true;
    
    console.log('🚀 Session manager initialized');
    
    // Start auto-logout if enabled
    if (config.autoLogout !== false) { // Default: enabled
      autoLogoutManager.start({
        onWarning: config.onWarning,
        onLogout: config.onLogout
      });
    }
    
    // Start auto-refresh if enabled
    if (config.autoRefresh !== false) { // Default: enabled
      sessionRefreshManager.start({
        onRefresh: config.onRefresh,
        onRefreshError: config.onRefreshError
      });
    }
    
    logAuditEvent('session_manager_initialized', {
      autoLogout: config.autoLogout !== false,
      autoRefresh: config.autoRefresh !== false
    });
  }
  
  /**
   * Cleanup session manager
   */
  cleanup(): void {
    if (!this.isInitialized) return;
    
    autoLogoutManager.stop();
    sessionRefreshManager.stop();
    activityTracker.stop();
    
    this.isInitialized = false;
    
    console.log('🧹 Session manager cleaned up');
  }
  
  /**
   * Extend session
   */
  extendSession(): void {
    autoLogoutManager.extendSession();
  }
  
  /**
   * Force refresh token
   */
  async forceRefresh(): Promise<void> {
    await sessionRefreshManager.forceRefresh();
  }
  
  /**
   * Get session status
   */
  getStatus() {
    return {
      isActive: this.isInitialized,
      inactiveTime: activityTracker.getInactiveTime(),
      remainingTime: autoLogoutManager.getRemainingTime(),
      remainingMinutes: autoLogoutManager.getRemainingMinutes(),
      shouldShowWarning: autoLogoutManager.shouldShowWarning(),
      timeSinceLastRefresh: sessionRefreshManager.getTimeSinceLastRefresh(),
      timeUntilNextRefresh: sessionRefreshManager.getTimeUntilNextRefresh()
    };
  }
  
  /**
   * Subscribe to activity events
   */
  onActivity(callback: () => void): () => void {
    return activityTracker.onActivity(callback);
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default sessionManager;
