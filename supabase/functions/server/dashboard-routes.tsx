// Dashboard Routes for Vendor Portal
// Provides real-time analytics and dashboard data

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

// ==================== VENDOR DASHBOARD DATA ====================

/**
 * GET /make-server-6eefa08e/dashboard/vendor/:orgId
 * Get dashboard data for a specific organization
 */
app.get('/vendor/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    console.log(`📊 Fetching vendor dashboard data for org: ${orgId}`);

    // Get all reservations for this organization
    const reservationsData = await kv.getByPrefix(`reservation:${orgId}:`);
    const allReservations = reservationsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Get all waitlist entries
    const waitlistData = await kv.getByPrefix(`waitlist:${orgId}:`);
    const allWaitlist = waitlistData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Get all guests
    const guestsData = await kv.getByPrefix(`guest:${orgId}:`);
    const allGuests = guestsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Get organization/property data - try both old org format and new property format
    let orgData = await kv.get(`org:${orgId}`);
    
    // If not found as org, try as property
    if (!orgData) {
      orgData = await kv.get(`property:${orgId}`);
      console.log(`🏢 Loaded as property: ${orgId}`);
    }
    
    // If organization/property exists, enrich it with package features
    if (orgData && (orgData.planId || orgData.packageId)) {
      try {
        // Support both old planId and new packageId
        const packageKey = orgData.packageId || orgData.planId;
        
        // Use consistent key format (pkg_ or plan_ prefix)
        const finalKey = packageKey.startsWith('pkg_') || packageKey.startsWith('plan_') 
          ? packageKey 
          : `pkg_${packageKey}`;
          
        let packageData = await kv.get(finalKey);
        
        // Try alternative key formats if not found
        if (!packageData && packageKey.startsWith('pkg_')) {
          packageData = await kv.get(packageKey.replace('pkg_', 'plan_'));
        } else if (!packageData && packageKey.startsWith('plan_')) {
          packageData = await kv.get(packageKey.replace('plan_', 'pkg_'));
        }
        
        if (packageData && packageData.features) {
          // Add planFeatures to organization (normalized key)
          orgData.planFeatures = packageData.features;
          console.log(`✅ Enriched org/property ${orgId} with package features from ${finalKey}`);
          console.log(`📦 Features loaded:`, Object.keys(packageData.features).filter(k => packageData.features[k] === true));
        } else {
          console.warn(`⚠️ Package ${finalKey} not found in KV store - using default features`);
          // Set default features (all enabled for demo)
          orgData.planFeatures = {
            enable_reservations: true,
            enable_events: true,
            enable_digital_menu: true,
            enable_floor_plan: true,
            enable_waitlist: true,
            enable_guests: true,
            enable_communications: true,
            enable_analytics: true,
            enable_pos: true,
            enable_team_management: true,
            enable_reports: true,
            enable_integrations: true,
          };
          console.log(`✅ Using default features (all enabled) for demo mode`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load package features:`, error);
      }
    } else if (orgData) {
      // No packageId/planId set, enable all features for demo
      console.log(`⚠️ No package assigned to ${orgId}, enabling all features for demo`);
      orgData.planFeatures = {
        enable_reservations: true,
        enable_events: true,
        enable_digital_menu: true,
        enable_floor_plan: true,
        enable_waitlist: true,
        enable_guests: true,
        enable_communications: true,
        enable_analytics: true,
        enable_pos: true,
        enable_team_management: true,
        enable_reports: true,
        enable_integrations: true,
      };
    }

    // Calculate analytics
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // Filter today's reservations
    const todayReservations = allReservations.filter((res: any) => 
      res.date === today
    );
    
    // Calculate stats
    const totalReservations = allReservations.length;
    const confirmedReservations = allReservations.filter((res: any) => 
      res.status === 'confirmed'
    ).length;
    const pendingReservations = allReservations.filter((res: any) => 
      res.status === 'pending'
    ).length;
    const cancelledReservations = allReservations.filter((res: any) => 
      res.status === 'cancelled'
    ).length;
    const completedReservations = allReservations.filter((res: any) => 
      res.status === 'completed'
    ).length;
    
    // Calculate guest stats
    const totalGuests = allGuests.length;
    const totalPartySize = allReservations.reduce((sum: number, res: any) => 
      sum + (res.partySize || 0), 0
    );
    const avgPartySize = totalReservations > 0 
      ? Math.round(totalPartySize / totalReservations) 
      : 0;

    // Calculate revenue (mock for now - will be replaced with real payment data)
    const totalRevenue = confirmedReservations * 50; // Avg $50 per reservation
    const monthlyRevenue = totalRevenue; // For now, all revenue is this month

    // Get upcoming reservations (next 7 days)
    const upcomingReservations = allReservations
      .filter((res: any) => {
        const resDate = new Date(res.date);
        const daysDiff = Math.floor((resDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff <= 7 && res.status !== 'cancelled';
      })
      .sort((a: any, b: any) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      })
      .slice(0, 10); // Top 10 upcoming

    // Get recent reservations (last 10)
    const recentReservations = [...allReservations]
      .sort((a: any, b: any) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      })
      .slice(0, 10);

    // Calculate occupancy rate
    const totalTables = 20; // Mock - will be replaced with real floor plan data
    const occupiedTables = todayReservations.filter((res: any) => 
      res.status === 'seated' || res.status === 'confirmed'
    ).length;
    const occupancyRate = totalTables > 0 
      ? Math.round((occupiedTables / totalTables) * 100) 
      : 0;

    // Build response
    const dashboardData = {
      organization: orgData || {
        id: orgId,
        name: 'Your Restaurant',
        logo: null
      },
      analytics: {
        totalReservations,
        confirmedReservations,
        pendingReservations,
        cancelledReservations,
        completedReservations,
        totalGuests,
        avgPartySize,
        totalRevenue,
        monthlyRevenue,
        occupancyRate,
        todayReservations: todayReservations.length,
        upcomingReservations: upcomingReservations.length,
        activeWaitlist: allWaitlist.filter((w: any) => w.status === 'waiting').length
      },
      reservations: recentReservations,
      upcomingReservations,
      todayReservations,
      waitlist: allWaitlist
        .filter((w: any) => w.status === 'waiting')
        .slice(0, 10),
      guests: allGuests.slice(0, 20), // Top 20 guests
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Dashboard data fetched successfully:`, {
      totalReservations,
      confirmedReservations,
      totalGuests,
      upcomingCount: upcomingReservations.length
    });

    return c.json({
      success: true,
      data: dashboardData
    });

  } catch (error: any) {
    console.error('❌ Error fetching vendor dashboard data:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch dashboard data'
    }, 500);
  }
});

/**
 * GET /make-server-6eefa08e/dashboard/vendor/:orgId/stats
 * Get quick stats for an organization (lightweight)
 */
app.get('/vendor/:orgId/stats', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    console.log(`📈 Fetching quick stats for org: ${orgId}`);

    // Get counts only (faster)
    const reservationsData = await kv.getByPrefix(`reservation:${orgId}:`);
    const allReservations = reservationsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    const waitlistData = await kv.getByPrefix(`waitlist:${orgId}:`);
    const allWaitlist = waitlistData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    const guestsData = await kv.getByPrefix(`guest:${orgId}:`);
    const allGuests = guestsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );

    const stats = {
      totalReservations: allReservations.length,
      confirmedReservations: allReservations.filter((r: any) => r.status === 'confirmed').length,
      pendingReservations: allReservations.filter((r: any) => r.status === 'pending').length,
      totalGuests: allGuests.length,
      activeWaitlist: allWaitlist.filter((w: any) => w.status === 'waiting').length,
      timestamp: new Date().toISOString()
    };

    return c.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('❌ Error fetching quick stats:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch stats'
    }, 500);
  }
});

/**
 * GET /make-server-6eefa08e/dashboard/vendor/:orgId/chart-data
 * Get chart data for analytics visualizations
 */
app.get('/vendor/:orgId/chart-data', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const days = parseInt(c.req.query('days') || '7');
    
    console.log(`📊 Fetching chart data for org: ${orgId}, days: ${days}`);

    const reservationsData = await kv.getByPrefix(`reservation:${orgId}:`);
    const allReservations = reservationsData.map((item: any) => 
      typeof item === 'object' && item.value ? item.value : item
    );
    
    // Generate data for last N days
    const chartData = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayReservations = allReservations.filter((res: any) => res.date === dateStr);
      
      chartData.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        total: dayReservations.length,
        confirmed: dayReservations.filter((r: any) => r.status === 'confirmed').length,
        pending: dayReservations.filter((r: any) => r.status === 'pending').length,
        cancelled: dayReservations.filter((r: any) => r.status === 'cancelled').length,
        completed: dayReservations.filter((r: any) => r.status === 'completed').length,
        revenue: dayReservations.filter((r: any) => r.status === 'confirmed' || r.status === 'completed').length * 50
      });
    }

    return c.json({
      success: true,
      data: chartData
    });

  } catch (error: any) {
    console.error('❌ Error fetching chart data:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch chart data'
    }, 500);
  }
});

export default app;
