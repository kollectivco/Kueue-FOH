// Firebase Cloud Messaging Service for Kueue RSVP Platform
// Handles FCM initialization, token management, and notification receiving

import { projectId, publicAnonKey } from './supabase/info';

// ✅ FIREBASE CLOUD MESSAGING - FULLY CONFIGURED ✅
// 
// FCM system is now READY TO USE with complete Firebase credentials!
// 
// 🎉 What's Enabled:
// ✅ Firebase Config - Complete
// ✅ VAPID Key - Configured
// ✅ Push Notifications - Ready
// ✅ Service Worker - Active
// ✅ Background Messages - Enabled
//
// 🚀 How to Use:
// 1. Login to Admin or Developer Portal
// 2. Click "Push Notifications" in sidebar
// 3. Click "Enable FCM" button
// 4. Allow notifications when browser asks
// 5. Send test notification to verify
//
// 🎯 Automatic Notifications For: Reservations, Orders, Support Tickets!

// FCM Configuration (✅ CONFIGURED)
const FCM_CONFIG = {
  apiKey: "AIzaSyBe8Wq31JMPGwMkMNTUsGYK4ILmfu8u9b0",
  authDomain: "kueue-rsvp.firebaseapp.com",
  databaseURL: "https://kueue-rsvp-default-rtdb.firebaseio.com",
  projectId: "kueue-rsvp",
  storageBucket: "kueue-rsvp.firebasestorage.app",
  messagingSenderId: "551608674399",
  appId: "1:551608674399:web:4cb2945695053bd2b853ea",
  measurementId: "G-80R694J5H1"
};

// ✅ VAPID Key CONFIGURED - Web Push certificates enabled
const VAPID_KEY = "BKGoIdK7YlbB13lef172MeCSgdpPlTtzy-ZbjPnQAa0cGVpeKp7AjFbRYr7k198AqvoY0gz5I6uFWd-Fcavx_bQ";

class FCMService {
  private messaging: any = null;
  private currentToken: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize Firebase and FCM
   */
  async initialize(userId: string, organizationId?: string): Promise<boolean> {
    try {
      console.log('🚀 Starting FCM initialization for user:', userId);

      // Check if Firebase is already configured
      if (this.isInitialized) {
        console.log('✅ FCM already initialized');
        return true;
      }

      // Check if running in browser
      if (typeof window === 'undefined') {
        console.error('⚠️ FCM can only be initialized in browser');
        throw new Error('FCM can only be initialized in browser');
      }

      // Check if Firebase SDK is loaded
      if (!(window as any).firebase) {
        console.log('📦 Loading Firebase SDK...');
        await this.loadFirebaseSDK();
        console.log('✅ Firebase SDK loaded successfully');
      } else {
        console.log('✅ Firebase SDK already loaded');
      }

      const firebase = (window as any).firebase;

      // Verify Firebase loaded correctly
      if (!firebase) {
        console.error('❌ Firebase SDK failed to load');
        throw new Error('Firebase SDK failed to load');
      }

      // Initialize Firebase app if not already initialized
      if (!firebase.apps || firebase.apps.length === 0) {
        console.log('🔧 Initializing Firebase app with config...');
        firebase.initializeApp(FCM_CONFIG);
        console.log('✅ Firebase app initialized');
      } else {
        console.log('✅ Firebase app already initialized');
      }

      // Check if messaging is supported
      if (!firebase.messaging.isSupported()) {
        console.error('⚠️ FCM is not supported in this browser');
        throw new Error('Push notifications are not supported in this browser. Please use Chrome, Firefox, or Edge.');
      }

      // Initialize messaging
      console.log('🔧 Initializing Firebase Messaging...');
      this.messaging = firebase.messaging();
      console.log('✅ Firebase Messaging initialized successfully');

      // Register service worker before requesting token
      await this.registerServiceWorker();

      // Request permission and get token
      console.log('🔑 Requesting notification permission and FCM token...');
      const token = await this.requestPermissionAndGetToken(userId, organizationId);
      
      if (token) {
        console.log('✅ FCM initialization complete with token:', token.substring(0, 20) + '...');
        this.isInitialized = true;
        this.setupMessageListener();
        return true;
      }

      console.error('❌ Failed to obtain FCM token');
      return false;
    } catch (error: any) {
      console.error('❌ Error initializing FCM:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error; // Re-throw to show user-friendly error
    }
  }

  /**
   * Register service worker for background notifications
   */
  private async registerServiceWorker(): Promise<void> {
    try {
      if ('serviceWorker' in navigator) {
        console.log('🔧 Checking service worker registration...');
        
        // Check if service worker is already registered
        const existingRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        
        if (existingRegistration) {
          console.log('✅ Service worker already registered');
          return;
        }

        // Register the service worker
        console.log('📝 Registering service worker...');
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('✅ Service worker registered successfully');
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('✅ Service worker is ready');
      } else {
        console.warn('⚠️ Service Worker not supported in this browser');
      }
    } catch (error) {
      console.error('❌ Error registering service worker:', error);
      // Don't throw - we can still work without service worker for foreground notifications
    }
  }

  /**
   * Load Firebase SDK dynamically
   */
  private async loadFirebaseSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load Firebase App
      const appScript = document.createElement('script');
      appScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
      appScript.onload = () => {
        // Load Firebase Messaging
        const messagingScript = document.createElement('script');
        messagingScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js';
        messagingScript.onload = () => resolve();
        messagingScript.onerror = reject;
        document.head.appendChild(messagingScript);
      };
      appScript.onerror = reject;
      document.head.appendChild(appScript);
    });
  }

  /**
   * Request notification permission and get FCM token
   */
  async requestPermissionAndGetToken(userId: string, organizationId?: string): Promise<string | null> {
    try {
      console.log('🔔 Requesting notification permission...');
      
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('🔔 Notification permission status:', permission);
      
      if (permission === 'denied') {
        console.error('❌ Notification permission denied by user');
        throw new Error('Notification permission denied. Please enable notifications in your browser settings.');
      }
      
      if (permission !== 'granted') {
        console.warn('⚠️ Notification permission not granted:', permission);
        throw new Error('Notification permission not granted');
      }

      console.log('✅ Notification permission granted');

      // Verify messaging is initialized
      if (!this.messaging) {
        console.error('❌ Firebase Messaging not initialized');
        throw new Error('Firebase Messaging not initialized');
      }

      // Get FCM token with VAPID key
      console.log('🔑 Requesting FCM token with VAPID key...');
      console.log('🔑 VAPID Key (first 10 chars):', VAPID_KEY.substring(0, 10) + '...');
      
      const token = await this.messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.ready
      });

      if (!token) {
        console.error('❌ Failed to obtain FCM token - returned empty');
        throw new Error('Failed to obtain FCM token');
      }

      console.log('✅ FCM token obtained successfully:', token.substring(0, 20) + '...');
      this.currentToken = token;

      // Register token with backend
      console.log('📤 Registering token with backend...');
      await this.registerToken(token, userId, organizationId);
      console.log('✅ Token registered with backend');

      // Listen for token refresh
      this.messaging.onTokenRefresh(async () => {
        console.log('🔄 FCM token refresh detected...');
        try {
          const newToken = await this.messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.ready
          });
          console.log('🔄 FCM token refreshed successfully');
          this.currentToken = newToken;
          await this.registerToken(newToken, userId, organizationId);
        } catch (refreshError) {
          console.error('❌ Error refreshing FCM token:', refreshError);
        }
      });

      return token;
    } catch (error: any) {
      console.error('❌ Error getting FCM token:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error; // Re-throw to show user-friendly error
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerToken(token: string, userId: string, organizationId?: string): Promise<void> {
    try {
      const deviceInfo = {
        platform: navigator.platform,
        browser: this.getBrowserInfo(),
        userAgent: navigator.userAgent
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/fcm/register-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            token,
            userId,
            organizationId,
            deviceInfo
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to register FCM token');
      }

      const data = await response.json();
      console.log('✅ FCM token registered with backend:', data);
    } catch (error) {
      console.error('❌ Error registering FCM token:', error);
    }
  }

  /**
   * Setup message listener for foreground notifications
   */
  private setupMessageListener(): void {
    this.messaging.onMessage((payload: any) => {
      console.log('📬 Foreground notification received:', payload);

      const { notification, data } = payload;

      // Show notification
      if (notification) {
        this.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/icons/default-icon.png',
          badge: notification.badge || '/icons/badge-icon.png',
          data: data,
          tag: data?.type || 'general',
          requireInteraction: data?.priority === 'high'
        });
      }

      // Dispatch custom event for app to handle
      window.dispatchEvent(new CustomEvent('fcm-notification', { 
        detail: payload 
      }));
    });
  }

  /**
   * Show browser notification
   */
  private showNotification(title: string, options: NotificationOptions): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, options);

      notification.onclick = (event) => {
        event.preventDefault();
        
        // Get click action from notification data
        const clickAction = (options.data as any)?.click_action;
        if (clickAction) {
          window.focus();
          window.location.href = clickAction;
        }

        notification.close();
      };
    }
  }

  /**
   * Unregister FCM token
   */
  async unregisterToken(userId: string): Promise<void> {
    try {
      if (!this.currentToken) {
        console.log('⚠️ No token to unregister');
        return;
      }

      // Delete token from Firebase
      await this.messaging.deleteToken();

      // Unregister from backend
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/fcm/unregister-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            token: this.currentToken,
            userId
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unregister FCM token');
      }

      console.log('✅ FCM token unregistered');
      this.currentToken = null;
    } catch (error) {
      console.error('❌ Error unregistering FCM token:', error);
    }
  }

  /**
   * Get current FCM token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Check if FCM is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get browser info
   */
  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    let browser = 'Unknown';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';

    return browser;
  }

  /**
   * Send test notification (for testing)
   */
  async sendTestNotification(userId: string, title?: string, body?: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/fcm/admin/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            userId,
            title,
            body
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Failed to send test notification';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Test notification sent:', data);
    } catch (error: any) {
      console.error('❌ Error sending test notification:', error);
      
      // Provide detailed error messages
      if (error.name === 'AbortError') {
        throw new Error('⏱️ Request timeout - Server is not responding. Please ensure backend is deployed.');
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('🌐 Network error - Cannot connect to server. Please check your connection and ensure backend is deployed.');
      } else {
        throw error;
      }
    }
  }
}

// Export singleton instance
export const fcmService = new FCMService();

// Helper functions for sending notifications from frontend
export const sendReservationNotification = async (
  reservationId: string,
  organizationId: string,
  guestName: string,
  dateTime: string
): Promise<void> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/fcm/send/reservation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          reservationId,
          organizationId,
          guestName,
          dateTime
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to send reservation notification';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    console.log('✅ Reservation notification sent');
  } catch (error: any) {
    console.error('❌ Error sending reservation notification:', error);
    
    // Silent fail for notifications - don't break the reservation flow
    // Just log the detailed error
    if (error.name === 'AbortError') {
      console.warn('⚠️ Notification timeout - Reservation was successful but notification failed');
    } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('⚠️ Network error - Reservation was successful but notification failed');
    }
    // Don't re-throw - silent fail
  }
};

export const sendOrderNotification = async (
  orderId: string,
  organizationId: string,
  tableNumber: string,
  totalAmount: number
): Promise<void> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/fcm/send/order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          orderId,
          organizationId,
          tableNumber,
          totalAmount
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to send order notification';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    console.log('✅ Order notification sent');
  } catch (error: any) {
    console.error('❌ Error sending order notification:', error);
    
    // Silent fail for notifications - don't break the order flow
    // Just log the detailed error
    if (error.name === 'AbortError') {
      console.warn('⚠️ Notification timeout - Order was successful but notification failed');
    } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('⚠️ Network error - Order was successful but notification failed');
    }
    // Don't re-throw - silent fail
  }
};

export const sendSupportNotification = async (
  ticketId: string,
  subject: string,
  priority: string
): Promise<void> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/fcm/send/support`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          ticketId,
          subject,
          priority
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to send support notification';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    console.log('✅ Support notification sent');
  } catch (error: any) {
    console.error('❌ Error sending support notification:', error);
    
    // Silent fail for notifications - don't break the support ticket flow
    // Just log the detailed error
    if (error.name === 'AbortError') {
      console.warn('⚠️ Notification timeout - Support ticket was created but notification failed');
    } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('⚠️ Network error - Support ticket was created but notification failed');
    }
    // Don't re-throw - silent fail
  }
};
