/**
 * Paymob Payment Gateway Routes
 * Handles all Paymob payment operations
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const paymobRoutes = new Hono();

// Paymob Credentials (from environment variables)
const PAYMOB_API_KEY = Deno.env.get('PAYMOB_API_KEY') || '';
const PAYMOB_SECRET_KEY = Deno.env.get('PAYMOB_SECRET_KEY') || '';
const PAYMOB_PUBLIC_KEY = Deno.env.get('PAYMOB_PUBLIC_KEY') || '';
const PAYMOB_HMAC = Deno.env.get('PAYMOB_HMAC') || '';
const PAYMOB_MERCHANT_ID = Deno.env.get('PAYMOB_MERCHANT_ID') || '';
const PAYMOB_INTEGRATION_ID = Deno.env.get('PAYMOB_INTEGRATION_ID') || '';
const PAYMOB_IFRAME_ID = Deno.env.get('PAYMOB_IFRAME_ID') || ''; // NEW: iFrame ID for payment page

// Paymob API Base URL
const PAYMOB_API_URL = 'https://accept.paymob.com/api';

// ========= Helper Functions =========

/**
 * Compute HMAC-SHA512 for Paymob callback verification using Web Crypto API
 * Field order must match Paymob's documentation exactly
 */
async function computeHmacFromProcessedObj(obj: any): Promise<string> {
  // Order of fields as specified in Paymob docs for Processed Callback
  const parts = [
    String(obj.amount_cents ?? ''),
    String(obj.created_at ?? ''),
    String(obj.currency ?? ''),
    String(obj.error_occured ?? ''),
    String(obj.has_parent_transaction ?? ''),
    String(obj.id ?? ''),
    String(obj.integration_id ?? ''),
    String(obj.is_3d_secure ?? ''),
    String(obj.is_auth ?? ''),
    String(obj.is_capture ?? ''),
    String(obj.is_refunded ?? ''),
    String(obj.is_standalone_payment ?? ''),
    String(obj.is_voided ?? ''),
    String(obj.order?.id ?? ''),
    String(obj.owner ?? ''),
    String(obj.pending ?? ''),
    String(obj.source_data?.pan ?? ''),
    String(obj.source_data?.sub_type ?? ''),
    String(obj.source_data?.type ?? ''),
    String(obj.success ?? '')
  ];
  
  const concatenated = parts.join('');
  
  // Convert strings to Uint8Array
  const encoder = new TextEncoder();
  const keyData = encoder.encode(PAYMOB_HMAC);
  const messageData = encoder.encode(concatenated);
  
  // Import the key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  
  // Sign the message
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Convert signature to hex string
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

async function getAuthToken(): Promise<string> {
  try {
    console.log('🔑 Requesting Paymob auth token...');
    
    const response = await fetch(`${PAYMOB_API_URL}/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PAYMOB_API_KEY
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Paymob auth failed:', response.status, errorText);
      throw new Error('Failed to get auth token from Paymob');
    }

    const data = await response.json();
    console.log('✅ Paymob auth token received');
    return data.token;
  } catch (error) {
    console.error('💥 Paymob auth error:', error);
    throw new Error('Authentication failed');
  }
}

// ========= Configuration Routes =========

// Get all configurations
paymobRoutes.get('/integrations/paymob/configs', async (c) => {
  try {
    const configs = await kv.getByPrefix('paymob_config_');
    return c.json({ 
      success: true,
      configs: configs.map(item => item.value)
    });
  } catch (error) {
    console.error('Error loading configs:', error);
    return c.json({ error: 'Failed to load configurations' }, 500);
  }
});

// Create new configuration
paymobRoutes.post('/integrations/paymob/configs', async (c) => {
  try {
    const config = await c.req.json();
    const configId = `paymob_config_${Date.now()}`;
    
    const newConfig = {
      id: configId,
      orgId: config.orgId,
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      isLive: config.isLive || false,
      webhookUrl: config.webhookUrl,
      allowedMethods: config.allowedMethods || ['card', 'wallet', 'installments'],
      currency: config.currency || 'EGP',
      isEnabled: config.isEnabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(configId, newConfig);
    
    return c.json({ 
      success: true, 
      configId,
      config: newConfig
    });
  } catch (error) {
    console.error('Error creating config:', error);
    return c.json({ error: 'Failed to create configuration' }, 500);
  }
});

// Update configuration
paymobRoutes.put('/integrations/paymob/configs/:id', async (c) => {
  try {
    const configId = c.req.param('id');
    const updates = await c.req.json();
    
    const existing = await kv.get(configId);
    if (!existing) {
      return c.json({ error: 'Configuration not found' }, 404);
    }
    
    const updated = {
      ...existing.value,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(configId, updated);
    
    return c.json({ 
      success: true,
      config: updated
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return c.json({ error: 'Failed to update configuration' }, 500);
  }
});

// Toggle configuration
paymobRoutes.patch('/integrations/paymob/configs/:id/toggle', async (c) => {
  try {
    const configId = c.req.param('id');
    const { enabled } = await c.req.json();
    
    const existing = await kv.get(configId);
    if (!existing) {
      return c.json({ error: 'Configuration not found' }, 404);
    }
    
    const updated = {
      ...existing.value,
      isEnabled: enabled,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(configId, updated);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error toggling config:', error);
    return c.json({ error: 'Failed to toggle configuration' }, 500);
  }
});

// Test connection
paymobRoutes.post('/integrations/paymob/test', async (c) => {
  try {
    // Test authentication with Paymob
    const token = await getAuthToken();
    
    if (token) {
      return c.json({ 
        success: true, 
        message: 'Connection successful',
        token: token.substring(0, 20) + '...' // Show partial token
      });
    }
    
    return c.json({ error: 'Authentication failed' }, 400);
  } catch (error) {
    console.error('Connection test error:', error);
    return c.json({ 
      error: 'Connection test failed',
      details: error.message
    }, 500);
  }
});

// ========= Payment Routes =========

// Create payment order
paymobRoutes.post('/integrations/paymob/create-order', async (c) => {
  try {
    const { amount, currency, customerEmail, items, description, configId } = await c.req.json();
    
    console.log('Creating Paymob order:', { amount, currency, customerEmail });
    
    // Get config if provided, otherwise use default
    let apiKey = PAYMOB_API_KEY;
    let integrationId = PAYMOB_INTEGRATION_ID;
    
    if (configId) {
      const config = await kv.get(configId);
      if (config && config.value.secretKey) {
        apiKey = config.value.secretKey;
      }
    }
    
    // Step 1: Get auth token
    const authResponse = await fetch(`${PAYMOB_API_URL}/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey })
    });
    
    if (!authResponse.ok) {
      throw new Error('Failed to authenticate with Paymob');
    }
    
    const { token } = await authResponse.json();
    console.log('Got auth token');
    
    // Step 2: Create order
    const orderResponse = await fetch(`${PAYMOB_API_URL}/ecommerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: false,
        amount_cents: Math.round(amount * 100), // Convert to cents
        currency: currency || 'EGP',
        items: items || [
          {
            name: description || 'Payment',
            amount_cents: Math.round(amount * 100),
            description: description || 'Payment',
            quantity: 1
          }
        ]
      })
    });
    
    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('Order creation failed:', errorText);
      throw new Error('Failed to create order');
    }
    
    const order = await orderResponse.json();
    console.log('Created order:', order.id);
    
    // Step 3: Create payment key
    const paymentKeyResponse = await fetch(`${PAYMOB_API_URL}/acceptance/payment_keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: Math.round(amount * 100),
        expiration: 3600, // 1 hour
        order_id: order.id,
        billing_data: {
          email: customerEmail,
          first_name: 'Guest',
          last_name: 'User',
          phone_number: '+201000000000',
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          state: 'NA'
        },
        currency: currency || 'EGP',
        integration_id: integrationId
      })
    });
    
    if (!paymentKeyResponse.ok) {
      const errorText = await paymentKeyResponse.text();
      console.error('Payment key creation failed:', errorText);
      throw new Error('Failed to create payment key');
    }
    
    const { token: paymentToken } = await paymentKeyResponse.json();
    console.log('Created payment token');
    
    // Save transaction
    const transactionId = `txn_${Date.now()}`;
    await kv.set(transactionId, {
      id: transactionId,
      orderId: order.id.toString(),
      amount: amount,
      currency: currency || 'EGP',
      customerEmail: customerEmail,
      status: 'pending',
      paymentMethod: 'pending',
      description: description || 'Payment',
      createdAt: new Date().toISOString(),
      paymobOrderId: order.id
    });
    
    console.log('Transaction saved:', transactionId);
    
    // Use IFRAME_ID instead of integration_id for the payment page URL
    const iframeUrl = PAYMOB_IFRAME_ID 
      ? `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`
      : `https://accept.paymob.com/api/acceptance/iframes/${integrationId}?payment_token=${paymentToken}`;
    
    return c.json({
      success: true,
      paymentToken: paymentToken,
      orderId: order.id,
      transactionId: transactionId,
      iframeUrl: iframeUrl
    });
    
  } catch (error) {
    console.error('Paymob order creation error:', error);
    return c.json({ 
      error: 'Failed to create payment order',
      details: error.message
    }, 500);
  }
});

// ========= Transaction Routes =========

// Get all transactions
paymobRoutes.get('/integrations/paymob/transactions', async (c) => {
  try {
    const transactions = await kv.getByPrefix('txn_');
    
    // Sort by creation date (newest first)
    const sorted = transactions
      .map(t => t.value)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return c.json({ 
      success: true,
      transactions: sorted
    });
  } catch (error) {
    console.error('Error loading transactions:', error);
    return c.json({ error: 'Failed to load transactions' }, 500);
  }
});

// Get transaction by ID
paymobRoutes.get('/integrations/paymob/transactions/:id', async (c) => {
  try {
    const transactionId = c.req.param('id');
    const transaction = await kv.get(transactionId);
    
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    
    return c.json({ 
      success: true,
      transaction: transaction.value
    });
  } catch (error) {
    console.error('Error loading transaction:', error);
    return c.json({ error: 'Failed to load transaction' }, 500);
  }
});

// ========= Webhook Routes =========

// Webhook handler for Paymob callbacks with HMAC verification
paymobRoutes.post('/integrations/paymob/webhook', async (c) => {
  try {
    const payload = await c.req.json();
    
    console.log('📨 Received Paymob webhook:', payload.type);
    
    // Extract HMAC and transaction object
    const sentHmac = payload?.hmac || payload?.obj?.hmac;
    const obj = payload?.obj || payload;
    
    // Verify HMAC signature if configured
    if (PAYMOB_HMAC && sentHmac) {
      const calculatedHmac = await computeHmacFromProcessedObj(obj);
      
      if (sentHmac !== calculatedHmac) {
        console.error('❌ Invalid HMAC signature');
        console.log('Sent HMAC:', sentHmac?.substring(0, 20) + '...');
        console.log('Calculated HMAC:', calculatedHmac?.substring(0, 20) + '...');
        return c.json({ error: 'Invalid HMAC signature' }, 401);
      }
      
      console.log('✅ HMAC verification passed');
    } else if (!PAYMOB_HMAC) {
      console.warn('⚠️ HMAC verification disabled - PAYMOB_HMAC not configured');
    }
    
    // Extract transaction details
    const orderId = obj.order?.id;
    const success = obj.success;
    const isPending = obj.pending;
    const errorOccured = obj.error_occured;
    
    console.log('Transaction details:', {
      orderId,
      success,
      isPending,
      errorOccured,
      amount: obj.amount_cents,
      currency: obj.currency
    });
    
    // Find transaction by order ID
    const transactions = await kv.getByPrefix('txn_');
    const transaction = transactions.find(t => 
      t.value.paymobOrderId === orderId || t.value.orderId === orderId.toString()
    );
    
    if (transaction) {
      // Determine final status
      const status = errorOccured ? 'failed' : 
                     success ? 'completed' : 
                     isPending ? 'pending' : 'failed';
      
      // Update transaction with complete data
      await kv.set(transaction.key, {
        ...transaction.value,
        status: status,
        paymentMethod: obj.source_data?.type || 'card',
        updatedAt: new Date().toISOString(),
        paymobData: obj,
        isPending: isPending,
        isRefunded: obj.is_refunded || false,
        isVoided: obj.is_voided || false,
        errorOccured: errorOccured || false,
        transactionId: obj.id,
        integrationId: obj.integration_id,
        last4: obj.source_data?.pan,
        cardType: obj.source_data?.sub_type
      });
      
      console.log(`✅ Transaction ${transaction.key} updated to ${status}`);
    } else {
      console.warn('⚠️ Transaction not found for order:', orderId);
      
      // Create transaction record from webhook data
      const transactionId = `txn_webhook_${Date.now()}`;
      await kv.set(transactionId, {
        id: transactionId,
        orderId: orderId?.toString(),
        amount: (obj.amount_cents || 0) / 100,
        currency: obj.currency || 'EGP',
        status: errorOccured ? 'failed' : success ? 'completed' : isPending ? 'pending' : 'failed',
        paymentMethod: obj.source_data?.type || 'card',
        createdAt: obj.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paymobData: obj,
        paymobOrderId: orderId,
        isRefunded: obj.is_refunded || false,
        isVoided: obj.is_voided || false,
        errorOccured: errorOccured || false,
        source: 'webhook'
      });
      
      console.log(`✅ Created transaction from webhook: ${transactionId}`);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('💥 Webhook error:', error);
    return c.json({ error: 'Webhook processing failed', details: error.message }, 500);
  }
});

// ========= Stats Routes =========

// Get payment statistics
paymobRoutes.get('/integrations/paymob/stats', async (c) => {
  try {
    const transactions = await kv.getByPrefix('txn_');
    const txnData = transactions.map(t => t.value);
    
    const stats = {
      totalTransactions: txnData.length,
      completedTransactions: txnData.filter(t => t.status === 'completed').length,
      pendingTransactions: txnData.filter(t => t.status === 'pending').length,
      failedTransactions: txnData.filter(t => t.status === 'failed').length,
      totalVolume: txnData
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + (t.amount || 0), 0),
      successRate: txnData.length > 0
        ? Math.round((txnData.filter(t => t.status === 'completed').length / txnData.length) * 100)
        : 0
    };
    
    return c.json({ 
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error loading stats:', error);
    return c.json({ error: 'Failed to load statistics' }, 500);
  }
});

export default paymobRoutes;
