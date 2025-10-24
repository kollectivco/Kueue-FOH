import { Hono } from 'npm:hono';

export const smsRouter = new Hono();

// SMS Misr API Configuration
const SMS_MISR_CONFIG = {
  username: Deno.env.get('SMS_MISR_USERNAME') || '',
  password: Deno.env.get('SMS_MISR_PASSWORD') || '',
  senderId: Deno.env.get('SMS_MISR_SENDER_ID') || '',
  apiUrl: 'https://smsmisr.com/api/SMS'
};

// Helper function to log SMS operations
function logSms(operation: string, data: any) {
  console.log(`📱 SMS ${operation}:`, JSON.stringify(data, null, 2));
}

// Calculate SMS cost
function calculateCost(message: string, language: number): string {
  const maxChars = language === 2 ? 70 : 160; // Arabic vs English
  const smsCount = Math.ceil(message.length / maxChars);
  const costPerSms = 0.10; // $0.10 per SMS
  return (smsCount * costPerSms).toFixed(2);
}

// Clean phone number
function cleanPhoneNumber(phone: string): string {
  // Remove any non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with +20, keep it
  // If starts with 20, add +
  // If starts with 0, replace with +20
  if (cleaned.startsWith('+20')) {
    return cleaned;
  } else if (cleaned.startsWith('20')) {
    return '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    return '+2' + cleaned;
  }
  
  return cleaned;
}

// Send single SMS
smsRouter.post('/send', async (c) => {
  try {
    const { recipient, message, language = 1, environment = 2 } = await c.req.json();

    logSms('Request received', { recipient, messageLength: message?.length, language, environment });

    // Validate input
    if (!recipient || !message) {
      return c.json({ 
        success: false, 
        error: 'Recipient and message required' 
      }, 400);
    }

    // Check if credentials are configured
    if (!SMS_MISR_CONFIG.username || !SMS_MISR_CONFIG.password || !SMS_MISR_CONFIG.senderId) {
      console.warn('⚠️ SMS Misr credentials not configured');
      return c.json({
        success: false,
        error: 'SMS Misr credentials not configured',
        demo: true
      }, 503);
    }

    // Clean phone number
    const cleanedPhone = cleanPhoneNumber(recipient);
    logSms('Cleaned phone', { original: recipient, cleaned: cleanedPhone });

    // Prepare SMS Misr request
    const smsData = {
      Username: SMS_MISR_CONFIG.username,
      Password: SMS_MISR_CONFIG.password,
      Mobile: cleanedPhone,
      Message: message,
      Language: language, // 1 = English, 2 = Arabic
      SenderID: SMS_MISR_CONFIG.senderId,
      Environment: environment // 1 = Live, 2 = Test
    };

    logSms('Sending to SMS Misr API', { 
      mobile: cleanedPhone, 
      messageLength: message.length,
      language,
      environment: environment === 1 ? 'Live' : 'Test'
    });

    // Call SMS Misr API
    const response = await fetch(SMS_MISR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(smsData)
    });

    const responseText = await response.text();
    logSms('SMS Misr API response', { status: response.status, body: responseText });

    if (!response.ok) {
      throw new Error(`SMS Misr API error: ${response.status} - ${responseText}`);
    }

    // SMS Misr response format
    // Success: "SMSID-xxxx" or just the ID
    // Error: Error message string

    if (responseText && (responseText.startsWith('SMSID-') || responseText.length > 5)) {
      logSms('Success', { smsId: responseText });
      
      return c.json({
        success: true,
        smsId: responseText,
        cost: calculateCost(message, language),
        provider: 'SMS Misr',
        environment: environment === 1 ? 'Live' : 'Test',
        recipient: cleanedPhone
      });
    } else {
      logSms('Error', { response: responseText });
      
      return c.json({
        success: false,
        error: responseText || 'Unknown SMS Misr error'
      }, 400);
    }

  } catch (error) {
    console.error('❌ SMS send error:', error);
    logSms('Exception', { error: error.message, stack: error.stack });
    
    return c.json({
      success: false,
      error: error.message || 'Failed to send SMS',
      details: error.stack
    }, 500);
  }
});

// Send bulk SMS
smsRouter.post('/bulk', async (c) => {
  try {
    const { recipients, message, language = 1, environment = 2 } = await c.req.json();

    logSms('Bulk request received', { 
      recipientCount: recipients?.length, 
      messageLength: message?.length 
    });

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Recipients array required' 
      }, 400);
    }

    if (!message) {
      return c.json({ 
        success: false, 
        error: 'Message required' 
      }, 400);
    }

    // Check credentials
    if (!SMS_MISR_CONFIG.username || !SMS_MISR_CONFIG.password || !SMS_MISR_CONFIG.senderId) {
      return c.json({
        success: false,
        error: 'SMS Misr credentials not configured'
      }, 503);
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        const cleanedPhone = cleanPhoneNumber(recipient);
        
        const smsData = {
          Username: SMS_MISR_CONFIG.username,
          Password: SMS_MISR_CONFIG.password,
          Mobile: cleanedPhone,
          Message: message,
          Language: language,
          SenderID: SMS_MISR_CONFIG.senderId,
          Environment: environment
        };

        const response = await fetch(SMS_MISR_CONFIG.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(smsData)
        });

        const responseText = await response.text();

        if (responseText && (responseText.startsWith('SMSID-') || responseText.length > 5)) {
          successCount++;
          results.push({ 
            recipient: cleanedPhone, 
            success: true, 
            smsId: responseText 
          });
        } else {
          failureCount++;
          results.push({ 
            recipient: cleanedPhone, 
            success: false, 
            error: responseText 
          });
        }

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        failureCount++;
        results.push({ 
          recipient, 
          success: false, 
          error: error.message 
        });
      }
    }

    logSms('Bulk complete', { total: recipients.length, success: successCount, failed: failureCount });

    return c.json({
      success: true,
      total: recipients.length,
      sent: successCount,
      failed: failureCount,
      results
    });

  } catch (error) {
    console.error('❌ Bulk SMS error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to send bulk SMS'
    }, 500);
  }
});

// Test SMS configuration
smsRouter.get('/test', async (c) => {
  try {
    const hasUsername = !!SMS_MISR_CONFIG.username;
    const hasPassword = !!SMS_MISR_CONFIG.password;
    const hasSenderId = !!SMS_MISR_CONFIG.senderId;
    
    return c.json({
      success: true,
      configured: hasUsername && hasPassword && hasSenderId,
      credentials: {
        username: hasUsername ? '✓ Set' : '✗ Missing',
        password: hasPassword ? '✓ Set' : '✗ Missing',
        senderId: hasSenderId ? '✓ Set' : '✗ Missing'
      },
      apiUrl: SMS_MISR_CONFIG.apiUrl
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Get SMS statistics (placeholder)
smsRouter.get('/stats', async (c) => {
  try {
    // This would normally come from database
    return c.json({
      success: true,
      stats: {
        totalSent: 0,
        totalCost: '0.00',
        lastSent: null
      },
      demo: true
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

export default smsRouter;
