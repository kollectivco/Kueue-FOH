// FCM (Firebase Cloud Messaging) Routes for Kueue RSVP Platform
// Handles push notifications for reservations, orders, events, and support tickets

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

// Firebase Admin SDK for sending push notifications
// Note: This requires FIREBASE_SERVICE_ACCOUNT environment variable
let admin: any = null;

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = async () => {
  if (admin) return admin;

  try {
    // Check if service account credentials exist
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    
    if (!serviceAccountJson) {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not configured - FCM will run in demo mode');
      console.warn('📚 See FCM_COMPLETE_SETUP_AR.md for setup instructions');
      return null;
    }

    // Import Firebase Admin dynamically
    const { initializeApp, cert, getApps } = await import('npm:firebase-admin@12.0.0/app');
    const { getMessaging } = await import('npm:firebase-admin@12.0.0/messaging');

    // Parse service account
    const serviceAccount = JSON.parse(serviceAccountJson);

    // Initialize Firebase Admin if not already initialized
    if (getApps().length === 0) {
      admin = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      admin = getApps()[0];
      console.log('✅ Firebase Admin SDK already initialized');
    }

    return admin;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
    console.warn('⚠️ FCM will run in demo mode');
    return null;
  }
};

const app = new Hono();

// Types
interface FCMToken {
  token: string;
  userId: string;
  deviceInfo?: {
    platform: string;
    browser: string;
    userAgent: string;
  };
  organizationId?: string;
  createdAt: string;
  lastUsed: string;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  click_action?: string;
}

interface SendNotificationRequest {
  tokens?: string[];
  userIds?: string[];
  organizationId?: string;
  roles?: string[];
  notification: NotificationPayload;
  priority?: 'high' | 'normal';
}

// ===== FCM Token Management =====

// Register FCM token for a user
app.post('/register-token', async (c) => {
  try {
    const { token, userId, deviceInfo, organizationId } = await c.req.json();

    if (!token || !userId) {
      return c.json({ error: 'Token and userId are required' }, 400);
    }

    const fcmToken: FCMToken = {
      token,
      userId,
      deviceInfo,
      organizationId,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    // Store token in KV store
    await kv.set(`fcm:token:${token}`, fcmToken);
    
    // Also store in user's tokens list
    const userTokensKey = `fcm:user:${userId}:tokens`;
    const existingTokens = await kv.get(userTokensKey) || [];
    
    // Add token if not already in list
    if (!existingTokens.includes(token)) {
      existingTokens.push(token);
      await kv.set(userTokensKey, existingTokens);
    }

    console.log(`✅ FCM token registered for user ${userId}`);

    return c.json({ 
      success: true, 
      message: 'FCM token registered successfully',
      token
    });
  } catch (error: any) {
    console.error('❌ Error registering FCM token:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Unregister FCM token
app.post('/unregister-token', async (c) => {
  try {
    const { token, userId } = await c.req.json();

    if (!token || !userId) {
      return c.json({ error: 'Token and userId are required' }, 400);
    }

    // Remove token from KV store
    await kv.del(`fcm:token:${token}`);
    
    // Remove from user's tokens list
    const userTokensKey = `fcm:user:${userId}:tokens`;
    const existingTokens = await kv.get(userTokensKey) || [];
    const updatedTokens = existingTokens.filter((t: string) => t !== token);
    
    if (updatedTokens.length > 0) {
      await kv.set(userTokensKey, updatedTokens);
    } else {
      await kv.del(userTokensKey);
    }

    console.log(`✅ FCM token unregistered for user ${userId}`);

    return c.json({ 
      success: true, 
      message: 'FCM token unregistered successfully' 
    });
  } catch (error: any) {
    console.error('❌ Error unregistering FCM token:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get user's registered tokens
app.get('/user/:userId/tokens', async (c) => {
  try {
    const userId = c.req.param('userId');
    const userTokensKey = `fcm:user:${userId}:tokens`;
    const tokens = await kv.get(userTokensKey) || [];

    return c.json({ 
      success: true, 
      tokens,
      count: tokens.length 
    });
  } catch (error: any) {
    console.error('❌ Error getting user tokens:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ===== Send Notifications =====

// Send notification to specific users/tokens
app.post('/send', async (c) => {
  try {
    const request: SendNotificationRequest = await c.req.json();
    const { notification, tokens, userIds, organizationId, roles, priority = 'high' } = request;

    if (!notification || !notification.title || !notification.body) {
      return c.json({ error: 'Notification title and body are required' }, 400);
    }

    let targetTokens: string[] = [];

    // Collect tokens from direct token list
    if (tokens && tokens.length > 0) {
      targetTokens.push(...tokens);
    }

    // Collect tokens from user IDs
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        const userTokensKey = `fcm:user:${userId}:tokens`;
        const userTokens = await kv.get(userTokensKey) || [];
        targetTokens.push(...userTokens);
      }
    }

    // Collect tokens from organization
    if (organizationId) {
      const orgTokensKey = `fcm:org:${organizationId}:tokens`;
      const orgTokens = await kv.get(orgTokensKey) || [];
      targetTokens.push(...orgTokens);
    }

    // Filter by roles if specified
    if (roles && roles.length > 0) {
      const roleTokensPromises = roles.map(role => 
        kv.get(`fcm:role:${role}:tokens`)
      );
      const roleTokensArrays = await Promise.all(roleTokensPromises);
      roleTokensArrays.forEach(tokens => {
        if (tokens) targetTokens.push(...tokens);
      });
    }

    // Remove duplicates
    targetTokens = [...new Set(targetTokens)];

    if (targetTokens.length === 0) {
      return c.json({ 
        success: false, 
        message: 'No target tokens found',
        sentCount: 0 
      }, 400);
    }

    // Store notification in history
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notificationRecord = {
      id: notificationId,
      notification,
      targetTokensCount: targetTokens.length,
      sentAt: new Date().toISOString(),
      priority,
      metadata: {
        organizationId,
        roles,
        userIds: userIds?.slice(0, 10), // Store first 10 for reference
      }
    };

    await kv.set(`fcm:notification:${notificationId}`, notificationRecord);

    // Initialize Firebase Admin
    const firebaseAdmin = await initializeFirebaseAdmin();
    
    let sendResults: any;

    if (firebaseAdmin) {
      // Real FCM sending with Firebase Admin SDK
      console.log(`📤 Sending FCM notification to ${targetTokens.length} devices`);
      console.log(`📧 Title: ${notification.title}`);
      console.log(`📝 Body: ${notification.body}`);

      try {
        const { getMessaging } = await import('npm:firebase-admin@12.0.0/messaging');
        const messaging = getMessaging(firebaseAdmin);

        // Prepare FCM message
        const message = {
          notification: {
            title: notification.title,
            body: notification.body,
            imageUrl: notification.image
          },
          data: notification.data || {},
          webpush: {
            headers: {
              Urgency: priority === 'high' ? 'high' : 'normal'
            },
            notification: {
              icon: notification.icon || '/icons/default-icon.png',
              badge: notification.badge || '/icons/badge-icon.png',
              requireInteraction: priority === 'high',
              vibrate: [200, 100, 200]
            },
            fcmOptions: {
              link: notification.click_action
            }
          },
          tokens: targetTokens
        };

        // Send multicast message
        const response = await messaging.sendEachForMulticast(message);

        console.log(`✅ Successfully sent ${response.successCount} notifications`);
        if (response.failureCount > 0) {
          console.warn(`⚠️ Failed to send ${response.failureCount} notifications`);
        }

        sendResults = {
          successCount: response.successCount,
          failureCount: response.failureCount,
          results: response.responses.map((r: any, idx: number) => ({
            success: r.success,
            token: targetTokens[idx],
            error: r.error?.message
          }))
        };

        // Remove invalid tokens
        const failedTokens = response.responses
          .map((r: any, idx: number) => (r.success ? null : targetTokens[idx]))
          .filter((t: any) => t !== null);

        if (failedTokens.length > 0) {
          console.log(`🗑️ Removing ${failedTokens.length} invalid tokens`);
          for (const token of failedTokens) {
            await kv.del(`fcm:token:${token}`);
          }
        }
      } catch (error: any) {
        console.error('❌ Error sending FCM notification:', error);
        throw error;
      }
    } else {
      // Demo mode - simulate sending
      console.log(`📤 [DEMO MODE] Simulating notification send to ${targetTokens.length} devices`);
      console.log(`📧 Title: ${notification.title}`);
      console.log(`📝 Body: ${notification.body}`);
      console.warn('⚠️ To send real notifications, configure FIREBASE_SERVICE_ACCOUNT');

      sendResults = {
        successCount: targetTokens.length,
        failureCount: 0,
        results: targetTokens.map(token => ({ success: true, token, demo: true }))
      };
    }

    // Store send statistics
    const statsKey = `fcm:stats:${new Date().toISOString().split('T')[0]}`;
    const todayStats = await kv.get(statsKey) || { 
      sent: 0, 
      delivered: 0, 
      failed: 0 
    };
    
    todayStats.sent += sendResults.successCount;
    todayStats.delivered += sendResults.successCount;
    todayStats.failed += sendResults.failureCount;
    
    await kv.set(statsKey, todayStats);

    return c.json({ 
      success: true,
      notificationId,
      sentCount: sendResults.successCount,
      failedCount: sendResults.failureCount,
      message: `Notification sent to ${sendResults.successCount} devices`,
      mode: firebaseAdmin ? 'production' : 'demo'
    });
  } catch (error: any) {
    console.error('❌ Error sending notification:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Send notification for new reservation
app.post('/send/reservation', async (c) => {
  try {
    const { reservationId, organizationId, guestName, dateTime } = await c.req.json();

    const notification: NotificationPayload = {
      title: '🎉 حجز جديد - New Reservation',
      body: `حجز جديد من ${guestName} في ${new Date(dateTime).toLocaleString('ar-EG')}`,
      icon: '/icons/reservation-icon.png',
      badge: '/icons/badge-icon.png',
      data: {
        type: 'reservation',
        reservationId,
        organizationId,
        click_action: `/reservations/${reservationId}`
      },
      click_action: `/reservations/${reservationId}`
    };

    // Send to organization admins and vendors
    const request: SendNotificationRequest = {
      organizationId,
      roles: ['super_admin', 'vendor'],
      notification,
      priority: 'high'
    };

    const response = await fetch(new URL('/send', c.req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error sending reservation notification:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Send notification for new order (POS)
app.post('/send/order', async (c) => {
  try {
    const { orderId, organizationId, tableNumber, totalAmount } = await c.req.json();

    const notification: NotificationPayload = {
      title: '🛎️ طلب جديد - New Order',
      body: `طلب جديد من طاولة ${tableNumber} - ${totalAmount} EGP`,
      icon: '/icons/order-icon.png',
      data: {
        type: 'order',
        orderId,
        organizationId,
        tableNumber,
        click_action: `/pos/orders/${orderId}`
      },
      click_action: `/pos/orders/${orderId}`
    };

    const request: SendNotificationRequest = {
      organizationId,
      roles: ['vendor'],
      notification,
      priority: 'high'
    };

    const response = await fetch(new URL('/send', c.req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error sending order notification:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Send notification for support ticket
app.post('/send/support', async (c) => {
  try {
    const { ticketId, subject, priority } = await c.req.json();

    const notification: NotificationPayload = {
      title: '🎫 تذكرة دعم جديدة - New Support Ticket',
      body: `${subject} - Priority: ${priority}`,
      icon: '/icons/support-icon.png',
      data: {
        type: 'support',
        ticketId,
        priority,
        click_action: `/support/tickets/${ticketId}`
      },
      click_action: `/support/tickets/${ticketId}`
    };

    const request: SendNotificationRequest = {
      roles: ['support_admin', 'support'],
      notification,
      priority: priority === 'high' || priority === 'urgent' ? 'high' : 'normal'
    };

    const response = await fetch(new URL('/send', c.req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error sending support notification:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ===== Analytics & Statistics =====

// Get notification statistics
app.get('/stats', async (c) => {
  try {
    const { startDate, endDate } = c.req.query();
    
    const today = new Date().toISOString().split('T')[0];
    const stats = await kv.get(`fcm:stats:${today}`) || { 
      sent: 0, 
      delivered: 0, 
      failed: 0 
    };

    // Get total tokens count
    const tokensData = await kv.getByPrefix('fcm:token:');
    const totalTokens = tokensData.length;

    // Get notifications sent in last 7 days
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayStats = await kv.get(`fcm:stats:${dateKey}`) || { sent: 0, delivered: 0, failed: 0 };
      last7Days.push({
        date: dateKey,
        ...dayStats
      });
    }

    return c.json({
      success: true,
      today: stats,
      totalRegisteredDevices: totalTokens,
      last7Days: last7Days.reverse()
    });
  } catch (error: any) {
    console.error('❌ Error getting FCM stats:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get notification history
app.get('/history', async (c) => {
  try {
    const { limit = 50 } = c.req.query();
    
    const notifications = await kv.getByPrefix('fcm:notification:');
    
    // Sort by sent date (newest first)
    const sortedNotifications = notifications
      .sort((a, b) => {
        const dateA = new Date(a.sentAt || 0).getTime();
        const dateB = new Date(b.sentAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, parseInt(limit as string));

    return c.json({
      success: true,
      notifications: sortedNotifications,
      count: sortedNotifications.length
    });
  } catch (error: any) {
    console.error('❌ Error getting notification history:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ===== Admin Functions =====

// Get all registered tokens (Admin only)
app.get('/admin/tokens', async (c) => {
  try {
    const tokens = await kv.getByPrefix('fcm:token:');
    
    const tokensList = tokens.map((t: FCMToken) => ({
      token: t.token,
      userId: t.userId,
      organizationId: t.organizationId,
      deviceInfo: t.deviceInfo,
      createdAt: t.createdAt,
      lastUsed: t.lastUsed
    }));

    return c.json({
      success: true,
      tokens: tokensList,
      count: tokensList.length
    });
  } catch (error: any) {
    console.error('❌ Error getting all tokens:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Test notification (Admin only)
app.post('/admin/test', async (c) => {
  try {
    const { userId, title, body } = await c.req.json();

    const notification: NotificationPayload = {
      title: title || '🧪 Test Notification',
      body: body || 'This is a test notification from Kueue RSVP',
      icon: '/icons/test-icon.png',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };

    const request: SendNotificationRequest = {
      userIds: userId ? [userId] : undefined,
      notification,
      priority: 'high'
    };

    const response = await fetch(new URL('/send', c.req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error sending test notification:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Broadcast to all users (Admin only)
app.post('/admin/broadcast', async (c) => {
  try {
    const { notification, priority = 'normal' } = await c.req.json();

    if (!notification || !notification.title || !notification.body) {
      return c.json({ error: 'Notification title and body are required' }, 400);
    }

    // Get all tokens
    const allTokens = await kv.getByPrefix('fcm:token:');
    const tokens = allTokens.map((t: FCMToken) => t.token);

    if (tokens.length === 0) {
      return c.json({ 
        success: false, 
        message: 'No registered devices found' 
      }, 400);
    }

    const request: SendNotificationRequest = {
      tokens,
      notification,
      priority
    };

    const response = await fetch(new URL('/send', c.req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    console.log(`📢 Broadcast sent to all ${tokens.length} devices`);

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error broadcasting notification:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Health check
app.get('/health', async (c) => {
  const firebaseAdmin = await initializeFirebaseAdmin();
  
  return c.json({ 
    status: 'healthy', 
    service: 'fcm-routes',
    mode: firebaseAdmin ? 'production' : 'demo',
    configured: !!Deno.env.get('FIREBASE_SERVICE_ACCOUNT'),
    timestamp: new Date().toISOString() 
  });
});

export default app;
