/**
 * useSessionSecurity Hook
 * 
 * Provides session security features including hijacking detection,
 * device validation, and audit logging
 * Part of Phase 2: Auth & Permissions Fixes
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getDeviceFingerprint,
  saveSessionInfo,
  loadSessionInfo,
  validateSessionDevice,
  clearSessionInfo,
  logAuditEvent,
  type SessionInfo
} from '../utils/authSecurity';

export interface UseSessionSecurityOptions {
  /**
   * User ID for session tracking
   */
  userId?: string;
  
  /**
   * Enable device validation
   * @default true
   */
  validateDevice?: boolean;
  
  /**
   * Callback when session hijacking is detected
   */
  onHijackingDetected?: () => void;
  
  /**
   * Callback when new device is detected
   */
  onNewDevice?: (oldDevice: string, newDevice: string) => void;
  
  /**
   * Enable automatic audit logging
   * @default true
   */
  enableAuditLog?: boolean;
}

export interface UseSessionSecurityReturn {
  /**
   * Current session info
   */
  sessionInfo: SessionInfo | null;
  
  /**
   * Is session valid (no hijacking detected)
   */
  isValid: boolean;
  
  /**
   * Device fingerprint
   */
  deviceId: string;
  
  /**
   * Check session security manually
   */
  checkSecurity: () => Promise<boolean>;
  
  /**
   * Log a security event
   */
  logSecurityEvent: (event: string, details?: Record<string, any>) => void;
  
  /**
   * Clear session data
   */
  clearSession: () => void;
}

export function useSessionSecurity(
  options: UseSessionSecurityOptions = {}
): UseSessionSecurityReturn {
  const {
    userId,
    validateDevice = true,
    onHijackingDetected,
    onNewDevice,
    enableAuditLog = true
  } = options;
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [deviceId] = useState(() => getDeviceFingerprint());
  
  const isInitialized = useRef(false);
  const lastValidationTime = useRef(0);
  
  // Initialize session on mount
  useEffect(() => {
    if (isInitialized.current || !userId) return;
    
    console.log('🔐 useSessionSecurity: Initializing for user:', userId);
    
    const initializeSession = async () => {
      // Save session info
      await saveSessionInfo(userId);
      
      // Load it back
      const info = loadSessionInfo();
      setSessionInfo(info);
      
      // Log session start
      if (enableAuditLog) {
        logAuditEvent('session_security_initialized', {
          userId,
          deviceId,
          timestamp: Date.now()
        });
      }
      
      isInitialized.current = true;
    };
    
    initializeSession();
    
    return () => {
      console.log('🔐 useSessionSecurity: Cleanup');
    };
  }, [userId, deviceId, enableAuditLog]);
  
  // Periodic security validation
  useEffect(() => {
    if (!validateDevice || !userId) return;
    
    const validateInterval = setInterval(async () => {
      const now = Date.now();
      
      // Don't validate too frequently (max once per 10 seconds)
      if (now - lastValidationTime.current < 10000) {
        return;
      }
      
      lastValidationTime.current = now;
      
      // Validate device
      const isDeviceValid = validateSessionDevice();
      
      if (!isDeviceValid) {
        console.error('🚨 Session hijacking detected!');
        setIsValid(false);
        
        if (enableAuditLog) {
          logAuditEvent('session_hijacking_detected', {
            userId,
            expectedDevice: sessionInfo?.deviceId,
            currentDevice: deviceId,
            timestamp: now
          });
        }
        
        if (onHijackingDetected) {
          onHijackingDetected();
        }
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(validateInterval);
  }, [validateDevice, userId, deviceId, sessionInfo, enableAuditLog, onHijackingDetected]);
  
  // Check for device changes
  useEffect(() => {
    if (!sessionInfo || !onNewDevice) return;
    
    if (sessionInfo.deviceId !== deviceId) {
      console.warn('⚠️ Device changed detected');
      onNewDevice(sessionInfo.deviceId, deviceId);
    }
  }, [sessionInfo, deviceId, onNewDevice]);
  
  // Check security manually
  const checkSecurity = useCallback(async (): Promise<boolean> => {
    if (!userId) return true;
    
    console.log('🔍 Checking session security...');
    
    // Validate device fingerprint
    const isDeviceValid = validateSessionDevice();
    
    if (!isDeviceValid) {
      console.error('❌ Device validation failed');
      setIsValid(false);
      
      if (enableAuditLog) {
        logAuditEvent('manual_security_check_failed', {
          userId,
          deviceId,
          timestamp: Date.now()
        });
      }
      
      return false;
    }
    
    // Check session age (optional - could add max session duration)
    const info = loadSessionInfo();
    if (info) {
      const sessionAge = Date.now() - info.createdAt;
      const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (sessionAge > maxSessionAge) {
        console.warn('⚠️ Session expired (too old)');
        setIsValid(false);
        
        if (enableAuditLog) {
          logAuditEvent('session_expired_age', {
            userId,
            sessionAge,
            maxSessionAge,
            timestamp: Date.now()
          });
        }
        
        return false;
      }
    }
    
    console.log('✅ Session security check passed');
    setIsValid(true);
    
    if (enableAuditLog) {
      logAuditEvent('manual_security_check_passed', {
        userId,
        timestamp: Date.now()
      });
    }
    
    return true;
  }, [userId, deviceId, enableAuditLog]);
  
  // Log security event
  const logSecurityEvent = useCallback((
    event: string,
    details: Record<string, any> = {}
  ) => {
    if (!enableAuditLog) return;
    
    logAuditEvent(event, {
      ...details,
      userId,
      deviceId,
      timestamp: Date.now()
    });
  }, [userId, deviceId, enableAuditLog]);
  
  // Clear session
  const clearSession = useCallback(() => {
    console.log('🧹 Clearing session security data');
    
    clearSessionInfo();
    setSessionInfo(null);
    setIsValid(false);
    
    if (enableAuditLog) {
      logAuditEvent('session_cleared', {
        userId,
        timestamp: Date.now()
      });
    }
  }, [userId, enableAuditLog]);
  
  return {
    sessionInfo,
    isValid,
    deviceId,
    checkSecurity,
    logSecurityEvent,
    clearSession
  };
}

// ═══════════════════════════════════════════════════════════════════
// ADDITIONAL SECURITY HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook for detecting suspicious activity
 * Returns true if suspicious activity is detected
 */
export function useSuspiciousActivityDetection(): boolean {
  const [isSuspicious, setIsSuspicious] = useState(false);
  
  useEffect(() => {
    let rapidClickCount = 0;
    let lastClickTime = 0;
    
    const handleClick = () => {
      const now = Date.now();
      
      // Detect rapid clicking (possible bot)
      if (now - lastClickTime < 100) {
        rapidClickCount++;
        
        if (rapidClickCount > 10) {
          console.warn('⚠️ Suspicious activity: Rapid clicking detected');
          setIsSuspicious(true);
          
          logAuditEvent('suspicious_activity_rapid_clicking', {
            count: rapidClickCount,
            timestamp: now
          });
        }
      } else {
        rapidClickCount = 0;
      }
      
      lastClickTime = now;
    };
    
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);
  
  return isSuspicious;
}

/**
 * Hook for network change detection
 * Detects when user switches networks (could indicate device change)
 */
export function useNetworkChangeDetection(
  onNetworkChange?: () => void
): boolean {
  const [networkChanged, setNetworkChanged] = useState(false);
  
  useEffect(() => {
    if (!('connection' in navigator)) {
      return; // Network Information API not supported
    }
    
    const connection = (navigator as any).connection;
    
    const handleChange = () => {
      console.log('🌐 Network change detected');
      setNetworkChanged(true);
      
      logAuditEvent('network_change_detected', {
        effectiveType: connection?.effectiveType,
        timestamp: Date.now()
      });
      
      if (onNetworkChange) {
        onNetworkChange();
      }
      
      // Reset after 5 seconds
      setTimeout(() => setNetworkChanged(false), 5000);
    };
    
    connection?.addEventListener('change', handleChange);
    
    return () => {
      connection?.removeEventListener('change', handleChange);
    };
  }, [onNetworkChange]);
  
  return networkChanged;
}

/**
 * Hook for session timeout warning
 * Shows warning before session expires
 */
export function useSessionTimeoutWarning(
  sessionStartTime: number,
  maxSessionDuration: number = 24 * 60 * 60 * 1000, // 24 hours
  warningTime: number = 30 * 60 * 1000 // 30 minutes before
): {
  shouldWarn: boolean;
  timeRemaining: number;
  isExpired: boolean;
} {
  const [status, setStatus] = useState({
    shouldWarn: false,
    timeRemaining: maxSessionDuration,
    isExpired: false
  });
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - sessionStartTime;
      const remaining = maxSessionDuration - elapsed;
      
      setStatus({
        shouldWarn: remaining <= warningTime && remaining > 0,
        timeRemaining: Math.max(0, remaining),
        isExpired: remaining <= 0
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionStartTime, maxSessionDuration, warningTime]);
  
  return status;
}
