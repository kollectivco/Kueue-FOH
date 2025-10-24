// Admin Dashboard Routes for System Admin Portal
// Provides platform-wide analytics and management data

import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Enable CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ==================== ADMIN DASHBOARD DATA ====================

/**
 * GET /make-server-6eefa08e/admin/dashboard
 * Get complete admin dashboard data
 */
app.get('/', async (c) => {
  try {
    console.log(`🔐 Fetching admin dashboard data`);

    // Get all organizations
    const orgsData = await kv.getByPrefix('org:');
    const allOrganizations = orgsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Get all plans and filter out invalid/duplicate ones
    const plansData = await kv.getByPrefix('plan_');
    
    // Deduplicate plans by ID (in case they're stored with multiple keys)
    const planMap = new Map<string, any>();
    plansData.forEach((item: any) => {
      const plan = typeof item === 'object' && item.value ? item.value : item;
      
      // Only include valid plans with proper data
      if (plan && 
          plan.id &&
          plan.name && 
          typeof plan.priceMonth === 'number' && 
          typeof plan.priceYear === 'number' &&
          !isNaN(plan.priceMonth) &&
          !isNaN(plan.priceYear)) {
        // Only add if not already in map (keeps first occurrence)
        if (!planMap.has(plan.id)) {
          planMap.set(plan.id, plan);
        }
      }
    });
    
    const allPlans = Array.from(planMap.values());
    
    // Get all reservations across all orgs
    const reservationsData = await kv.getByPrefix('reservation:');
    const allReservations = reservationsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Get all activities/audit logs
    const activitiesData = await kv.getByPrefix('activity:');
    const allActivities = activitiesData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Get all billing records
    const billingData = await kv.getByPrefix('billing:');
    const allBillingRecords = billingData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );

    // Calculate platform-wide stats
    const activeOrganizations = allOrganizations.filter((org: any) => 
      org.status === 'active'
    ).length;
    
    const totalUsers = allOrganizations.reduce((sum: number, org: any) => 
      sum + (org.userCount || 1), 0
    );
    
    const totalReservations = allReservations.length;
    
    const totalRevenue = allBillingRecords
      .filter((bill: any) => bill.status === 'paid')
      .reduce((sum: number, bill: any) => sum + (bill.amount || 0), 0);
    
    const monthlyRecurringRevenue = allOrganizations
      .filter((org: any) => org.status === 'active')
      .reduce((sum: number, org: any) => sum + (org.monthlyRevenue || 0), 0);

    // Calculate growth rates
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0].substring(0, 7); // YYYY-MM
    
    const newOrgsThisMonth = allOrganizations.filter((org: any) => 
      org.createdAt?.startsWith(now.toISOString().split('T')[0].substring(0, 7))
    ).length;
    
    const activeSubscriptions = allOrganizations.filter((org: any) => 
      org.subscriptionStatus === 'active'
    ).length;
    
    const trialSubscriptions = allOrganizations.filter((org: any) => 
      org.subscriptionStatus === 'trial'
    ).length;

    // Recent activities (last 20)
    const recentActivities = [...allActivities]
      .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 20);

    // Top organizations by revenue
    const topOrganizations = [...allOrganizations]
      .filter((org: any) => org.status === 'active')
      .sort((a: any, b: any) => (b.monthlyRevenue || 0) - (a.monthlyRevenue || 0))
      .slice(0, 10);

    // Failed payments
    const failedPayments = allBillingRecords.filter((bill: any) => 
      bill.status === 'failed'
    ).length;

    // Plan distribution
    const planDistribution = allPlans.map((plan: any) => ({
      planId: plan.id,
      planName: plan.name,
      count: allOrganizations.filter((org: any) => org.planId === plan.id).length
    }));

    // Build response
    const dashboardData = {
      stats: {
        totalOrganizations: allOrganizations.length,
        activeOrganizations,
        totalUsers,
        totalReservations,
        totalRevenue,
        monthlyRecurringRevenue,
        activeSubscriptions,
        trialSubscriptions,
        newOrgsThisMonth,
        failedPayments,
        totalPlans: allPlans.length
      },
      organizations: allOrganizations.slice(0, 50), // First 50
      topOrganizations,
      plans: allPlans,
      planDistribution,
      recentActivities,
      billingRecords: allBillingRecords.slice(0, 50),
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Admin dashboard data fetched successfully:`, {
      totalOrgs: allOrganizations.length,
      activeOrgs: activeOrganizations,
      totalRevenue,
      mrr: monthlyRecurringRevenue
    });

    return c.json({
      success: true,
      data: dashboardData
    });

  } catch (error: any) {
    console.error('❌ Error fetching admin dashboard data:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch admin dashboard data'
    }, 500);
  }
});

/**
 * GET /make-server-6eefa08e/admin/dashboard/stats
 * Get quick stats (lightweight)
 */
app.get('/stats', async (c) => {
  try {
    console.log(`📈 Fetching admin quick stats`);

    const orgsData = await kv.getByPrefix('org:');
    const allOrganizations = orgsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    const reservationsData = await kv.getByPrefix('reservation:');
    const allReservations = reservationsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    const billingData = await kv.getByPrefix('billing:');
    const allBillingRecords = billingData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );

    const stats = {
      totalOrganizations: allOrganizations.length,
      activeOrganizations: allOrganizations.filter((org: any) => org.status === 'active').length,
      totalReservations: allReservations.length,
      totalRevenue: allBillingRecords
        .filter((bill: any) => bill.status === 'paid')
        .reduce((sum: number, bill: any) => sum + (bill.amount || 0), 0),
      timestamp: new Date().toISOString()
    };

    return c.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('❌ Error fetching admin quick stats:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch stats'
    }, 500);
  }
});

/**
 * GET /make-server-6eefa08e/admin/dashboard/chart-data
 * Get chart data for admin analytics
 */
app.get('/chart-data', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');
    
    console.log(`📊 Fetching admin chart data for ${days} days`);

    const reservationsData = await kv.getByPrefix('reservation:');
    const allReservations = reservationsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    const orgsData = await kv.getByPrefix('org:');
    const allOrganizations = orgsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    const billingData = await kv.getByPrefix('billing:');
    const allBillingRecords = billingData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Generate data for last N days
    const chartData = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayReservations = allReservations.filter((res: any) => 
        res.date === dateStr
      );
      
      const dayBilling = allBillingRecords.filter((bill: any) => 
        bill.createdAt?.startsWith(dateStr)
      );
      
      const dayRevenue = dayBilling
        .filter((bill: any) => bill.status === 'paid')
        .reduce((sum: number, bill: any) => sum + (bill.amount || 0), 0);
      
      chartData.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        reservations: dayReservations.length,
        revenue: dayRevenue,
        newOrgs: allOrganizations.filter((org: any) => 
          org.createdAt?.startsWith(dateStr)
        ).length
      });
    }

    return c.json({
      success: true,
      data: chartData
    });

  } catch (error: any) {
    console.error('❌ Error fetching admin chart data:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch chart data'
    }, 500);
  }
});

/**
 * GET /make-server-6eefa08e/admin/dashboard/feature-flags
 * Get all feature flags
 */
app.get('/feature-flags', async (c) => {
  try {
    console.log(`🚩 Fetching feature flags`);

    const flagsData = await kv.getByPrefix('flag:');
    const allFlags = flagsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    return c.json({
      success: true,
      data: allFlags
    });

  } catch (error: any) {
    console.error('❌ Error fetching feature flags:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch feature flags'
    }, 500);
  }
});

/**
 * POST /make-server-6eefa08e/admin/dashboard/log-activity
 * Log an admin activity/audit log
 */
app.post('/log-activity', async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, role, orgId, action, payload, severity } = body;

    const activity = {
      id: `activity:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      actorId,
      role,
      orgId,
      action,
      payload,
      severity: severity || 'info',
      timestamp: new Date().toISOString()
    };

    await kv.set(activity.id, activity);

    console.log(`📝 Activity logged:`, activity.action);

    return c.json({
      success: true,
      data: activity
    });

  } catch (error: any) {
    console.error('❌ Error logging activity:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to log activity'
    }, 500);
  }
});

export default app;
