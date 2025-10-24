// Firebase Cloud Messaging Service Worker for Kueue RSVP Platform
// Handles background notifications when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// ✅ FIREBASE CREDENTIALS CONFIGURED
//
// These credentials match the config in /utils/fcmService.tsx
//
// 📚 See setup guides:
// - FCM_QUICK_SETUP.md (Arabic)
// - FCM_CREDENTIALS_NEEDED.md (English)

// Firebase configuration (✅ Configured and matching /utils/fcmService.tsx)
const firebaseConfig = {
  apiKey: "AIzaSyBe8Wq31JMPGwMkMNTUsGYK4ILmfu8u9b0",
  authDomain: "kueue-rsvp.firebaseapp.com",
  databaseURL: "https://kueue-rsvp-default-rtdb.firebaseio.com",
  projectId: "kueue-rsvp",
  storageBucket: "kueue-rsvp.firebasestorage.app",
  messagingSenderId: "551608674399",
  appId: "1:551608674399:web:4cb2945695053bd2b853ea",
  measurementId: "G-80R694J5H1"
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const { notification, data } = payload;

  // Customize notification
  const notificationTitle = notification?.title || 'Kueue RSVP';
  const notificationOptions = {
    body: notification?.body || 'You have a new notification',
    icon: notification?.icon || '/icons/default-icon.png',
    badge: notification?.badge || '/icons/badge-icon.png',
    image: notification?.image,
    data: data || {},
    tag: data?.type || 'general',
    requireInteraction: data?.priority === 'high',
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/icons/open-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-icon.png'
      }
    ],
    vibrate: [200, 100, 200],
    sound: '/sounds/notification.mp3'
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  const clickAction = event.notification.data?.click_action;
  const action = event.action;

  if (action === 'dismiss') {
    // User dismissed the notification
    return;
  }

  // Handle notification click
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window/tab open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Focus existing window and navigate if needed
            if (clickAction) {
              client.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: clickAction
              });
            }
            return client.focus();
          }
        }

        // No window open, open a new one
        if (clients.openWindow) {
          const url = clickAction || self.location.origin;
          return clients.openWindow(url);
        }
      })
  );
});

// Handle push event (for silent notifications)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push received:', event);

  if (!event.data) {
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[firebase-messaging-sw.js] Push payload:', payload);

    // Handle silent notifications
    if (payload.data?.silent === 'true') {
      // Don't show notification, just sync data
      event.waitUntil(
        self.registration.sync.register('sync-data')
      );
      return;
    }

    // Show notification for non-silent pushes
    const { notification, data } = payload;
    const notificationTitle = notification?.title || 'Kueue RSVP';
    const notificationOptions = {
      body: notification?.body || '',
      icon: notification?.icon || '/icons/default-icon.png',
      badge: notification?.badge || '/icons/badge-icon.png',
      data: data || {}
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error handling push:', error);
  }
});

// Handle background sync (for offline support)
self.addEventListener('sync', (event) => {
  console.log('[firebase-messaging-sw.js] Background sync:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Sync data function
async function syncData() {
  try {
    console.log('[firebase-messaging-sw.js] Syncing data...');
    // Implement data sync logic here
    return Promise.resolve();
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Sync error:', error);
    return Promise.reject(error);
  }
}

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installing...');
  self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activating...');
  event.waitUntil(clients.claim());
});

console.log('[firebase-messaging-sw.js] Service Worker loaded successfully');
