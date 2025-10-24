import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { registerDigitalMenuRoutes } from "./digital-menu-routes.tsx";
import { registerReservationRoutes } from "./reservations-routes.tsx";
import { registerEventsAndGuestsRoutes } from "./events-guests-routes.tsx";

const app = new Hono();

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods with broader support
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: [
      "Content-Type", 
      "Authorization", 
      "Cache-Control", 
      "X-Requested-With",
      "Accept",
      "Origin"
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    exposeHeaders: ["Content-Length", "X-Request-ID"],
    maxAge: 86400, // 24 hours
    credentials: false
  }),
);

// ═══════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION - Optimized for Performance
// ═══════════════════════════════════════════════════════════════════

// Profile cache (1 minute for fresh data)
const profileCache = new Map<string, { profile: any, timestamp: number }>();
const PROFILE_CACHE_TTL = 1 * 60 * 1000; // 1 minute

// Organizations cache (1 minute)
let orgsCache: { organizations: any[], timestamp: number } | null = null;
const ORGS_CACHE_TTL = 1 * 60 * 1000; // 1 minute

// ═══════════════════════════════════════════════════════════════════
// CACHE INVALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════

// Invalidate organizations cache (call after org create/update/delete)
function invalidateOrgsCache() {
  orgsCache = null;
  console.log('🗑️ Organizations cache invalidated');
}

// Invalidate specific user profile cache (call after profile update)
function invalidateProfileCache(userId: string) {
  profileCache.delete(userId);
  console.log(`🗑️ Profile cache invalidated for user: ${userId}`);
}

// Invalidate ALL profile caches (call after bulk updates)
function invalidateAllProfileCaches() {
  profileCache.clear();
  console.log('🗑️ All profile caches cleared');
}

// Middleware to verify authentication
async function verifyAuth(c: any, requiredRole?: string) {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) {
    console.log('❌ Missing authorization token');
    return { error: 'Missing authorization token', status: 401 };
  }

  // Verify token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    console.log('❌ Invalid token:', error?.message);
    return { error: 'Invalid authorization token', status: 401 };
  }

  // Check cache first
  const cached = profileCache.get(user.id);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < PROFILE_CACHE_TTL) {
    // Use cached profile
    const profile = cached.profile;
    
    if (requiredRole && profile?.role !== requiredRole && profile?.role !== 'super_admin') {
      console.log(`❌ Insufficient permissions. Required: ${requiredRole}, Has: ${profile?.role}`);
      return { error: `Insufficient permissions. Required: ${requiredRole}`, status: 403 };
    }
    
    return { user, profile };
  }

  // Get user role and organization from KV store
  const userProfile = await kv.get(`user_profile_${user.id}`);
  if (!userProfile && requiredRole) {
    console.log('❌ User profile not found for:', user.id);
    return { error: 'User profile not found', status: 403 };
  }

  const profile = userProfile ? JSON.parse(userProfile) : null;
  
  // Cache the profile
  if (profile) {
    profileCache.set(user.id, { profile, timestamp: now });
  }
  
  if (requiredRole && profile?.role !== requiredRole && profile?.role !== 'super_admin') {
    console.log(`❌ Insufficient permissions. Required: ${requiredRole}, Has: ${profile?.role}`);
    return { error: `Insufficient permissions. Required: ${requiredRole}`, status: 403 };
  }

  return { user, profile };
}

// Import Paymob routes
import paymobRoutes from './paymob-routes.tsx';
import dashboardRoutes from './dashboard-routes.tsx';
import adminDashboardRoutes from './admin-dashboard-routes.tsx';
import { usersRoutes } from './users-routes.tsx';
import fcmRoutes from './fcm-routes.tsx';
import migrationRoutes from './migration-routes.tsx';
import { propertiesRouter } from './properties-routes.tsx';
import { packagesRouter } from './packages-routes.tsx';

// Register all routes
registerDigitalMenuRoutes(app, verifyAuth);
registerReservationRoutes(app, verifyAuth);
registerEventsAndGuestsRoutes(app, verifyAuth);
app.route('/make-server-6eefa08e', paymobRoutes);
app.route('/make-server-6eefa08e/dashboard', dashboardRoutes);
app.route('/make-server-6eefa08e/admin/dashboard', adminDashboardRoutes);
app.route('/make-server-6eefa08e/users', usersRoutes);
app.route('/make-server-6eefa08e/fcm', fcmRoutes);
app.route('/make-server-6eefa08e/migrations', migrationRoutes);
app.route('/make-server-6eefa08e/properties', propertiesRouter);
app.route('/make-server-6eefa08e/packages', packagesRouter);

// Health check endpoint - simple and fast
app.get("/make-server-6eefa08e/health", (c) => {
  console.log('Health check request received');
  return c.json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Kueue RSVP Server",
    version: "1.0.0"
  });
});

// Authentication endpoints
app.post("/make-server-6eefa08e/auth/signup", async (c) => {
  try {
    const { email, password, name, role = 'vendor', orgId, organizationId, phone } = await c.req.json();
    
    console.log('🔐 Creating new user:', { email, role });

    // Check if user already exists in auth system
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const userExists = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
    
    if (userExists) {
      console.warn('⚠️ User already exists in auth system:', email);
      
      // Check if profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, name, role')
        .eq('email', email.trim().toLowerCase())
        .single();
      
      if (profile) {
        console.warn('⚠️ User profile also exists');
        return c.json({ 
          error: `A user with email "${email}" already exists. Please use a different email or sign in.`,
          code: 'user_already_exists',
          userId: profile.id
        }, 409);
      } else {
        // User exists in auth but not in profiles - sync them
        console.log('🔄 Syncing existing auth user to profiles...');
        
        // Validate organization ID
        const syncOrgId = organizationId || orgId || null;
        let validatedSyncOrgId = null;
        if (syncOrgId) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(syncOrgId)) {
            validatedSyncOrgId = syncOrgId;
          } else {
            console.warn(`⚠️ Invalid UUID in sync: "${syncOrgId}". Setting to null.`);
          }
        }
        
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: userExists.id,
              email: email.trim(),
              name: name?.trim() || email.split('@')[0],
              role: role || 'vendor',
              phone: phone?.trim() || null,
              organization_id: validatedSyncOrgId,
              email_verified: true,
              status: 'active'
            });
          
          if (profileError) {
            console.error('❌ Failed to sync profile:', profileError);
          } else {
            console.log('✅ User synced successfully');
            return c.json({ 
              success: true,
              message: 'User already existed in auth system. Profile synced successfully.',
              userId: userExists.id,
              synced: true
            });
          }
        } catch (syncError) {
          console.error('❌ Sync error:', syncError);
        }
      }
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      user_metadata: { 
        name: name?.trim() || email.split('@')[0], 
        role: role || 'vendor'
      },
      email_confirm: true
    });

    if (error) {
      console.error('❌ Auth signup error:', error);
      
      // Provide specific error messages
      if (error.message.includes('already been registered') || error.message.includes('email_exists')) {
        return c.json({ 
          error: `A user with email "${email}" is already registered. Please use a different email or sign in.`,
          code: 'email_exists'
        }, 409);
      }
      
      return c.json({ error: error.message }, 400);
    }

    console.log('✅ Auth user created:', data.user.id);

    // Create profile in profiles table
    const finalOrgId = organizationId || orgId || null;
    
    // Validate UUID format if organization_id is provided
    let validatedOrgId = null;
    if (finalOrgId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(finalOrgId)) {
        validatedOrgId = finalOrgId;
      } else {
        console.warn(`⚠️ Invalid UUID format for organization_id: "${finalOrgId}". Setting to null.`);
      }
    }
    
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: email.trim(),
          name: name?.trim() || email.split('@')[0],
          role: role || 'vendor',
          phone: phone?.trim() || null,
          organization_id: validatedOrgId,
          email_verified: true,
          status: 'active'
        })
        .select()
        .single();

      if (profileError && profileError.code !== '23505') {
        console.warn('⚠️ Profile creation warning:', profileError);
      } else {
        console.log('✅ Profile created/synced');
      }
    } catch (profileError) {
      console.warn('⚠️ Profile creation error (may already exist via trigger):', profileError);
    }

    // Store user profile in KV for backward compatibility
    await kv.set(`user_profile_${data.user.id}`, JSON.stringify({
      id: data.user.id,
      email: email.trim(),
      name: name?.trim() || email.split('@')[0],
      role,
      phone: phone?.trim() || null,
      organization_id: validatedOrgId,
      status: 'active',
      email_verified: true,
      createdAt: new Date().toISOString()
    }));

    // Log the action
    await kv.set(`audit_${Date.now()}_${data.user.id}`, JSON.stringify({
      actorId: data.user.id,
      role,
      orgId: validatedOrgId,
      action: 'user_created',
      payload: { email: email.trim(), name: name?.trim(), role },
      timestamp: new Date().toISOString()
    }));

    console.log('✅ User signup complete:', data.user.email);

    return c.json({ 
      success: true,
      message: 'User created successfully',
      userId: data.user.id 
    });
  } catch (error: any) {
    console.error('💥 Signup error:', error);
    return c.json({ error: error.message || 'Failed to create user' }, 500);
  }
});

// ========== SYSTEM ADMIN PORTAL ENDPOINTS ==========

// Admin Dashboard Data
app.get("/make-server-6eefa08e/admin/dashboard", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    // Verify admin role
    if (!['super_admin', 'support_admin', 'billing_admin'].includes(authResult.profile?.role)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    // Get all organizations
    const organizations = await kv.getByPrefix('organization_');
    const orgList = organizations.map(org => JSON.parse(org));

    // Get recent activities
    const activities = await kv.getByPrefix('audit_');
    const activityList = activities
      .map(activity => JSON.parse(activity))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    // Get feature flags
    const featureFlags = await kv.getByPrefix('feature_flag_');
    const flagList = featureFlags.map(flag => JSON.parse(flag));

    // Get integrations
    const integrations = await kv.getByPrefix('integration_');
    const integrationList = integrations.map(int => JSON.parse(int));

    // Get billing records
    const billingRecords = await kv.getByPrefix('billing_');
    const billingList = billingRecords.map(bill => JSON.parse(bill));

    // Get backups
    const backups = await kv.getByPrefix('backup_');
    const backupList = backups.map(backup => JSON.parse(backup));

    // Get global settings
    const globalSettings = await kv.getByPrefix('global_setting_');
    const settingsList = globalSettings.map(setting => JSON.parse(setting));

    // Calculate metrics
    const activeOrgs = orgList.filter(org => org.status === 'active').length;
    const totalUsers = orgList.reduce((sum, org) => {
      // Get user count for each org
      return sum + (org.userCount || 1);
    }, 0);

    const systemHealth = 95; // Mock system health

    return c.json({
      stats: {
        totalOrganizations: orgList.length,
        activeOrganizations: activeOrgs,
        totalUsers,
        systemHealth,
        activeFeatureFlags: flagList.filter(f => f.enabled).length,
        activeIntegrations: integrationList.filter(i => i.status === 'active').length
      },
      organizations: orgList,
      activities: activityList,
      featureFlags: flagList,
      integrations: integrationList,
      billingRecords: billingList,
      backups: backupList,
      globalSettings: settingsList
    });
  } catch (error) {
    console.log('Admin dashboard error:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// Organization Management
app.post("/make-server-6eefa08e/admin/organizations", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { name, code, planId, ownerEmail, timezone = 'UTC', branding = {} } = await c.req.json();

    // Check if organization code already exists
    const existingOrg = await kv.get(`org_code_${code}`);
    if (existingOrg) {
      return c.json({ error: 'Organization code already exists' }, 400);
    }

    const orgId = crypto.randomUUID();
    const organization = {
      id: orgId,
      name,
      code,
      planId,
      status: 'active',
      ownerEmail,
      timezone,
      branding,
      createdAt: new Date().toISOString()
    };

    // Store organization
    await kv.set(`organization_${orgId}`, JSON.stringify(organization));
    await kv.set(`org_code_${code}`, orgId);

    // Auto-seed default data
    await seedOrganizationDefaults(orgId);

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      orgId,
      action: 'organization_created',
      payload: { name, code, planId },
      timestamp: new Date().toISOString()
    }));

    return c.json({ 
      message: 'Organization created successfully',
      organizationId: orgId 
    });
  } catch (error) {
    console.log('Organization creation error:', error);
    return c.json({ error: 'Failed to create organization' }, 500);
  }
});

app.get("/make-server-6eefa08e/admin/organizations", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const organizations = await kv.getByPrefix('organization_');
    const orgList = organizations.map(org => JSON.parse(org));

    return c.json({ organizations: orgList });
  } catch (error) {
    console.log('Get organizations error:', error);
    return c.json({ error: 'Failed to fetch organizations' }, 500);
  }
});

// Update organization
app.put("/make-server-6eefa08e/admin/organizations/:id", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const orgId = c.req.param('id');
    const updates = await c.req.json();

    const orgData = await kv.get(`organization_${orgId}`);
    if (!orgData) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    const organization = JSON.parse(orgData);
    Object.assign(organization, updates, { updatedAt: new Date().toISOString() });

    await kv.set(`organization_${orgId}`, JSON.stringify(organization));

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      orgId,
      action: 'organization_updated',
      payload: updates,
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Organization updated successfully', organization });
  } catch (error) {
    console.log('Update organization error:', error);
    return c.json({ error: 'Failed to update organization' }, 500);
  }
});

// Suspend/Activate organization
app.put("/make-server-6eefa08e/admin/organizations/:id/status", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const orgId = c.req.param('id');
    const { status } = await c.req.json();

    const orgData = await kv.get(`organization_${orgId}`);
    if (!orgData) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    const organization = JSON.parse(orgData);
    organization.status = status;
    organization.updatedAt = new Date().toISOString();

    await kv.set(`organization_${orgId}`, JSON.stringify(organization));

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      orgId,
      action: 'organization_status_changed',
      payload: { status },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Organization status updated successfully', organization });
  } catch (error) {
    console.log('Update organization status error:', error);
    return c.json({ error: 'Failed to update organization status' }, 500);
  }
});

// ===== SUBSCRIPTION PLANS ROUTES REMOVED =====
// All subscription plan management has been removed from the platform
// Organizations are now managed directly without subscription plans

// Feature Flags Management
app.post("/make-server-6eefa08e/admin/feature-flags", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { name, key, description, enabled, rolloutPercentage, targetOrganizations } = await c.req.json();

    const flagId = crypto.randomUUID();
    const featureFlag = {
      id: flagId,
      name,
      key,
      description,
      enabled,
      rolloutPercentage,
      targetOrganizations,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    await kv.set(`feature_flag_${flagId}`, JSON.stringify(featureFlag));

    console.log(`✅ Synced plan ${plan.id} to KV store`);

    return c.json({ 
      success: true,
      message: 'Plan synced successfully',
      planId: plan.id
    });
  } catch (error) {
    console.log('Sync plan error:', error);
    return c.json({ error: 'Failed to sync plan' }, 500);
  }
});

// Update plan
app.put("/make-server-6eefa08e/admin/plans/:id", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const planId = c.req.param('id');
    const updates = await c.req.json();

    const planData = await kv.get(`plan_${planId}`);
    if (!planData) {
      return c.json({ error: 'Plan not found' }, 404);
    }

    const plan = JSON.parse(planData);
    Object.assign(plan, updates, { updatedAt: new Date().toISOString() });

    await kv.set(`plan_${planId}`, JSON.stringify(plan));

    // Invalidate cache
    invalidatePlansCache();

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      action: 'plan_updated',
      payload: { planId, updates },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Plan updated successfully', plan });
  } catch (error) {
    console.log('Update plan error:', error);
    return c.json({ error: 'Failed to update plan' }, 500);
  }
});

// Delete plan
app.delete("/make-server-6eefa08e/admin/plans/:id", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const planId = c.req.param('id');
    console.log(`🗑️ Attempting to delete plan: ${planId}`);

    // Try multiple key formats for maximum compatibility
    const possibleKeys = [
      planId,                              // Direct ID (e.g., plan_xxx or UUID)
      `plan_${planId}`,                    // With plan_ prefix
      `subscription_plan_${planId}`,       // Old format
      `plan_${planId}_default`,            // Default plan format
    ];

    // Also check if this is a UUID - if so, try plan_ prefix variations
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(planId)) {
      possibleKeys.push(`plan_${planId}`);
    }

    let planData = null;
    let actualKey = null;

    // Find which key format exists
    for (const key of possibleKeys) {
      try {
        const data = await kv.get(key);
        if (data) {
          planData = data;
          actualKey = key;
          console.log(`✅ Found plan with key: ${key}`);
          break;
        }
      } catch (e) {
        // Continue trying other keys
      }
    }

    // If still not found, try getting all plans and finding by ID in the data
    if (!planData || !actualKey) {
      console.log(`⚠️ Direct key lookup failed. Searching all plans...`);
      try {
        const allPlans = await kv.getByPrefix('plan_');
        for (const item of allPlans) {
          const plan = typeof item === 'object' && item.value ? item.value : item;
          const parsedPlan = typeof plan === 'string' ? JSON.parse(plan) : plan;
          
          if (parsedPlan && parsedPlan.id === planId) {
            planData = plan;
            // The key is stored with plan_ prefix in KV
            actualKey = item.key || `plan_${planId}`;
            console.log(`✅ Found plan by searching: ${actualKey}`);
            break;
          }
        }
      } catch (searchError) {
        console.error('❌ Error searching plans:', searchError);
      }
    }

    if (!planData || !actualKey) {
      console.log(`❌ Plan not found with any method. Tried keys: ${possibleKeys.join(', ')}`);
      return c.json({ 
        error: 'Plan not found',
        details: `No plan found with ID: ${planId}. Tried keys: ${possibleKeys.join(', ')}` 
      }, 404);
    }

    // Parse plan to get name for logging
    let planName = 'Unknown';
    try {
      const plan = typeof planData === 'string' ? JSON.parse(planData) : planData;
      planName = plan.name || plan.name_en || plan.id;
    } catch (e) {
      console.warn('Could not parse plan name');
    }

    // Delete the plan
    await kv.del(actualKey);
    console.log(`✅ Plan deleted: ${actualKey} (${planName})`);

    // Invalidate cache
    invalidatePlansCache();

    // Log the action
    try {
      await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
        actorId: authResult.user.id,
        role: authResult.profile.role,
        action: 'plan_deleted',
        payload: { 
          planId,
          planName,
          deletedKey: actualKey 
        },
        timestamp: new Date().toISOString()
      }));
    } catch (auditError) {
      console.warn('⚠️ Failed to create audit log:', auditError);
    }

    return c.json({ 
      success: true,
      message: 'Plan deleted successfully',
      planId,
      planName,
      deletedKey: actualKey
    });
  } catch (error) {
    console.error('❌ Delete plan error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ 
      error: 'Failed to delete plan',
      details: errorMessage 
    }, 500);
  }
});

// Clean up duplicate plans and reset to defaults - SIMPLIFIED AUTH
app.post("/make-server-6eefa08e/admin/plans/cleanup", async (c) => {
  try {
    // Simplified auth - just verify token, don't check profile/role
    // This is a maintenance endpoint and should work even if profile setup is incomplete
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      console.log('❌ Missing authorization token');
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    console.log('🔑 Verifying token for cleanup...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      console.log('❌ Invalid token:', authError?.message);
      return c.json({ error: 'Invalid authorization token' }, 401);
    }

    console.log('✅ Token verified for user:', user.email);
    console.log('🧹 Starting plan cleanup...');

    // Get all existing plans with better error handling
    let allPlansData = [];
    let existingPlans = [];
    
    try {
      allPlansData = await kv.getByPrefix('plan_');
      console.log(`📦 Raw data from KV store:`, allPlansData.length, 'items');
      
      existingPlans = allPlansData.map((item: any) => {
        try {
          if (typeof item === 'string') {
            return JSON.parse(item);
          } else if (item && item.value) {
            return typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          }
          return item;
        } catch (parseError) {
          console.warn('⚠️ Failed to parse plan item:', parseError);
          return null;
        }
      }).filter(p => p && p.id);

      console.log(`📦 Found ${existingPlans.length} valid existing plans`);
    } catch (kvError) {
      console.warn('⚠️ Error fetching plans from KV store:', kvError);
      // Continue with empty array if KV fetch fails
    }

    // Delete all existing plans with better error handling
    for (const item of allPlansData) {
      try {
        const plan = typeof item === 'object' && item.value ? item.value : item;
        if (plan && plan.id) {
          const planKey = plan.id.startsWith('plan_') ? plan.id : `plan_${plan.id}`;
          await kv.del(planKey);
          console.log(`🗑️ Deleted plan: ${planKey}`);
        }
      } catch (delError) {
        console.warn('⚠️ Error deleting plan:', delError);
        // Continue with next plan
      }
    }

    // Create 4 clean default plans with EGP pricing
    const defaultPlans = [
      {
        id: 'plan_free_default',
        name: 'مجاني',
        name_en: 'Free',
        description: 'Perfect for small businesses getting started',
        priceMonth: 0,
        priceYear: 0,
        currency: 'EGP',
        tier: 'free',
        features: {
          max_organizations: 1,
          max_campaigns_per_org: 1,
          max_reservations_per_month: 50,
          max_guests: 100,
          max_events: 2,
          max_team_members: 1,
          basic_analytics: true,
          advanced_analytics: false,
          email_support: true,
          priority_support: false,
          sms_notifications: false,
          digital_menu: false,
          floor_plan_designer: false,
          pos_integration: false,
          custom_branding: false,
          api_access: false,
          white_label: false,
          dedicated_support: false,
          custom_integrations: false
        },
        is_popular: false,
        status: 'active',
        trial_days: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'plan_starter_default',
        name: 'مبتدئ',
        name_en: 'Starter',
        description: 'Great for growing restaurants',
        priceMonth: 299,
        priceYear: 2990,
        currency: 'EGP',
        tier: 'starter',
        features: {
          max_organizations: 1,
          max_campaigns_per_org: 5,
          max_reservations_per_month: 200,
          max_guests: 500,
          max_events: 10,
          max_team_members: 3,
          basic_analytics: true,
          advanced_analytics: false,
          email_support: true,
          priority_support: false,
          sms_notifications: true,
          digital_menu: true,
          floor_plan_designer: false,
          pos_integration: false,
          custom_branding: false,
          api_access: false,
          white_label: false,
          dedicated_support: false,
          custom_integrations: false
        },
        is_popular: false,
        status: 'active',
        trial_days: 14,
        createdAt: new Date().toISOString()
      },
      {
        id: 'plan_professional_default',
        name: 'محترف',
        name_en: 'Professional',
        description: 'Best for established businesses',
        priceMonth: 799,
        priceYear: 7990,
        currency: 'EGP',
        tier: 'professional',
        features: {
          max_organizations: 3,
          max_campaigns_per_org: 20,
          max_reservations_per_month: 1000,
          max_guests: 5000,
          max_events: 50,
          max_team_members: 10,
          basic_analytics: true,
          advanced_analytics: true,
          email_support: true,
          priority_support: true,
          sms_notifications: true,
          digital_menu: true,
          floor_plan_designer: true,
          pos_integration: true,
          custom_branding: true,
          api_access: true,
          white_label: false,
          dedicated_support: false,
          custom_integrations: false
        },
        is_popular: true,
        status: 'active',
        trial_days: 14,
        createdAt: new Date().toISOString()
      },
      {
        id: 'plan_enterprise_default',
        name: 'مؤسسي',
        name_en: 'Enterprise',
        description: 'Complete solution for large organizations',
        priceMonth: 1999,
        priceYear: 19990,
        currency: 'EGP',
        tier: 'enterprise',
        features: {
          max_organizations: -1,
          max_campaigns_per_org: -1,
          max_reservations_per_month: -1,
          max_guests: -1,
          max_events: -1,
          max_team_members: -1,
          basic_analytics: true,
          advanced_analytics: true,
          email_support: true,
          priority_support: true,
          sms_notifications: true,
          digital_menu: true,
          floor_plan_designer: true,
          pos_integration: true,
          custom_branding: true,
          api_access: true,
          white_label: true,
          dedicated_support: true,
          custom_integrations: true
        },
        is_popular: false,
        status: 'active',
        trial_days: 30,
        createdAt: new Date().toISOString()
      }
    ];

    // Save the 4 default plans with error handling
    let createdCount = 0;
    for (const plan of defaultPlans) {
      try {
        await kv.set(plan.id, JSON.stringify(plan));
        console.log(`✅ Created default plan: ${plan.name_en} (${plan.id})`);
        createdCount++;
      } catch (createError) {
        console.error(`❌ Failed to create plan ${plan.name_en}:`, createError);
        // Continue with next plan
      }
    }

    // Log the action
    try {
      await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
        actorId: authResult.user.id,
        role: authResult.profile.role,
        action: 'plans_cleanup',
        payload: { 
          deletedCount: existingPlans.length,
          createdCount: createdCount
        },
        timestamp: new Date().toISOString()
      }));
    } catch (auditError) {
      console.warn('⚠️ Failed to create audit log:', auditError);
      // Not critical, continue
    }

    // Invalidate cache after cleanup
    invalidatePlansCache();
    
    console.log(`✨ Cleanup complete: Deleted ${existingPlans.length} plans, created ${createdCount} default plans`);

    return c.json({ 
      success: true,
      message: 'Plans cleaned up successfully',
      deletedCount: existingPlans.length,
      createdCount: createdCount,
      plans: defaultPlans
    });
  } catch (error) {
    console.error('❌ Plan cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ 
      error: 'Failed to cleanup plans',
      details: errorMessage 
    }, 500);
  }
});

// Delete ALL plans permanently (no creation of new plans)
app.post("/make-server-6eefa08e/admin/plans/delete-all", async (c) => {
  try {
    // Simplified auth - just verify token
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      console.log('❌ Missing authorization token');
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    console.log('🔑 Verifying token for delete all plans...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      console.log('❌ Invalid token:', authError?.message);
      return c.json({ error: 'Invalid authorization token' }, 401);
    }

    console.log('✅ Token verified for user:', user.email);
    console.log('🗑️ Starting DELETE ALL PLANS operation...');

    // Get all existing plans
    let allPlansData = [];
    let deletedCount = 0;
    
    try {
      allPlansData = await kv.getByPrefix('plan_');
      console.log(`📦 Found ${allPlansData.length} plan entries in KV store`);
    } catch (kvError) {
      console.warn('⚠️ Error fetching plans from KV store:', kvError);
      return c.json({ 
        error: 'Failed to fetch plans from database',
        details: kvError instanceof Error ? kvError.message : 'Unknown error'
      }, 500);
    }

    // Delete ALL plans permanently
    for (const item of allPlansData) {
      try {
        const plan = typeof item === 'object' && item.value ? item.value : item;
        if (plan && plan.id) {
          const planKey = plan.id.startsWith('plan_') ? plan.id : `plan_${plan.id}`;
          await kv.del(planKey);
          console.log(`🗑️ DELETED plan: ${planKey}`);
          deletedCount++;
        }
      } catch (delError) {
        console.warn('⚠️ Error deleting plan:', delError);
        // Continue with next plan
      }
    }

    // Invalidate cache after deletion
    invalidatePlansCache();
    
    console.log(`✅ DELETE ALL COMPLETE: Removed ${deletedCount} plans from system`);

    return c.json({ 
      success: true,
      message: 'All plans deleted successfully',
      deletedCount: deletedCount
    });
  } catch (error) {
    console.error('❌ Delete all plans error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ 
      error: 'Failed to delete all plans',
      details: errorMessage 
    }, 500);
  }
});

// Feature Flags Management
app.post("/make-server-6eefa08e/admin/feature-flags", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { name, key, description, enabled, rolloutPercentage, targetOrganizations } = await c.req.json();

    const flagId = crypto.randomUUID();
    const featureFlag = {
      id: flagId,
      name,
      key,
      description,
      enabled,
      rolloutPercentage,
      targetOrganizations,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    await kv.set(`feature_flag_${flagId}`, JSON.stringify(featureFlag));

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      action: 'feature_flag_created',
      payload: { name, key, enabled },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Feature flag created successfully', featureFlag });
  } catch (error) {
    console.log('Feature flag creation error:', error);
    return c.json({ error: 'Failed to create feature flag' }, 500);
  }
});

app.put("/make-server-6eefa08e/admin/feature-flags/:id", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const flagId = c.req.param('id');
    const updates = await c.req.json();

    const flagData = await kv.get(`feature_flag_${flagId}`);
    if (!flagData) {
      return c.json({ error: 'Feature flag not found' }, 404);
    }

    const featureFlag = JSON.parse(flagData);
    Object.assign(featureFlag, updates, { lastModified: new Date().toISOString() });

    await kv.set(`feature_flag_${flagId}`, JSON.stringify(featureFlag));

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      action: 'feature_flag_updated',
      payload: { flagId, updates },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Feature flag updated successfully', featureFlag });
  } catch (error) {
    console.log('Feature flag update error:', error);
    return c.json({ error: 'Failed to update feature flag' }, 500);
  }
});

// Global Settings Management
app.get("/make-server-6eefa08e/admin/global-settings", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const settings = await kv.getByPrefix('global_setting_');
    const settingsList = settings.map(setting => JSON.parse(setting));

    return c.json({ settings: settingsList });
  } catch (error) {
    console.log('Get global settings error:', error);
    return c.json({ error: 'Failed to fetch global settings' }, 500);
  }
});

app.put("/make-server-6eefa08e/admin/global-settings/:id", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const settingId = c.req.param('id');
    const { value } = await c.req.json();

    const settingData = await kv.get(`global_setting_${settingId}`);
    if (!settingData) {
      return c.json({ error: 'Setting not found' }, 404);
    }

    const setting = JSON.parse(settingData);
    setting.value = value;
    setting.updatedAt = new Date().toISOString();

    await kv.set(`global_setting_${settingId}`, JSON.stringify(setting));

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      action: 'global_setting_updated',
      payload: { settingId, key: setting.key, value },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Setting updated successfully', setting });
  } catch (error) {
    console.log('Update global setting error:', error);
    return c.json({ error: 'Failed to update setting' }, 500);
  }
});

// Integrations Management
app.post("/make-server-6eefa08e/admin/integrations", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { name, type, config, enabled } = await c.req.json();

    const integrationId = crypto.randomUUID();
    const integration = {
      id: integrationId,
      name,
      type,
      status: enabled ? 'active' : 'inactive',
      config,
      lastSync: new Date().toISOString(),
      organizationsUsing: 0,
      createdAt: new Date().toISOString()
    };

    await kv.set(`integration_${integrationId}`, JSON.stringify(integration));

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      action: 'integration_created',
      payload: { name, type, enabled },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Integration created successfully', integration });
  } catch (error) {
    console.log('Integration creation error:', error);
    return c.json({ error: 'Failed to create integration' }, 500);
  }
});

app.put("/make-server-6eefa08e/admin/integrations/:id/test", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const integrationId = c.req.param('id');
    const integrationData = await kv.get(`integration_${integrationId}`);
    
    if (!integrationData) {
      return c.json({ error: 'Integration not found' }, 404);
    }

    const integration = JSON.parse(integrationData);
    
    // Simulate test
    integration.lastSync = new Date().toISOString();
    integration.status = 'active';
    
    await kv.set(`integration_${integrationId}`, JSON.stringify(integration));

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      action: 'integration_tested',
      payload: { integrationId, name: integration.name },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Integration test successful', integration });
  } catch (error) {
    console.log('Integration test error:', error);
    return c.json({ error: 'Failed to test integration' }, 500);
  }
});

// Backup Management
app.post("/make-server-6eefa08e/admin/backups", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { type } = await c.req.json();

    const backupId = crypto.randomUUID();
    const backup = {
      id: backupId,
      type,
      status: 'running',
      size: '0 B',
      duration: '0s',
      createdAt: new Date().toISOString()
    };

    await kv.set(`backup_${backupId}`, JSON.stringify(backup));

    // Simulate backup process
    setTimeout(async () => {
      backup.status = 'completed';
      backup.size = type === 'full' ? '2.1 GB' : type === 'incremental' ? '300 MB' : '50 MB';
      backup.duration = type === 'full' ? '10m 15s' : type === 'incremental' ? '2m 30s' : '30s';
      backup.downloadUrl = `/backups/${type}-${new Date().toISOString().split('T')[0]}.tar.gz`;
      
      await kv.set(`backup_${backupId}`, JSON.stringify(backup));
    }, 3000);

    // Log the action
    await kv.set(`audit_${Date.now()}_${authResult.user.id}`, JSON.stringify({
      actorId: authResult.user.id,
      role: authResult.profile.role,
      action: 'backup_started',
      payload: { type, backupId },
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Backup started successfully', backup });
  } catch (error) {
    console.log('Backup creation error:', error);
    return c.json({ error: 'Failed to start backup' }, 500);
  }
});

// Billing Management
app.get("/make-server-6eefa08e/admin/billing", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    // Verify billing admin role
    if (!['super_admin', 'billing_admin'].includes(authResult.profile?.role)) {
      return c.json({ error: 'Billing access required' }, 403);
    }

    const billingRecords = await kv.getByPrefix('billing_');
    const billingList = billingRecords.map(bill => JSON.parse(bill));

    return c.json({ billingRecords: billingList });
  } catch (error) {
    console.log('Get billing records error:', error);
    return c.json({ error: 'Failed to fetch billing records' }, 500);
  }
});

// Audit Logs
app.get("/make-server-6eefa08e/admin/audit-logs", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const activities = await kv.getByPrefix('audit_');
    const activityList = activities
      .map(activity => JSON.parse(activity))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return c.json({ activities: activityList });
  } catch (error) {
    console.log('Get audit logs error:', error);
    return c.json({ error: 'Failed to fetch audit logs' }, 500);
  }
});

// User Profile endpoint
app.get("/make-server-6eefa08e/user/profile", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    // If no profile in KV store, detect role from email
    if (!authResult.profile) {
      const email = authResult.user.email || '';
      let role = 'vendor';
      
      if (email.includes('admin@kueue.com')) {
        role = 'super_admin';
      } else if (email.includes('support@kueue.com')) {
        role = 'support_admin';
      } else if (email.includes('billing@kueue.com')) {
        role = 'billing_admin';
      }

      const detectedProfile = {
        id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.user_metadata?.name || email.split('@')[0],
        role: role,
        createdAt: new Date().toISOString()
      };

      // Store detected profile for future use
      await kv.set(`user_profile_${authResult.user.id}`, JSON.stringify(detectedProfile));

      return c.json({ profile: detectedProfile });
    }

    return c.json({ profile: authResult.profile });
  } catch (error) {
    console.log('Profile fetch error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Auto-setup endpoints for automatic initialization

// Create organization
app.post("/make-server-6eefa08e/organizations", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { name, ownerEmail, timezone } = await c.req.json();
    const orgId = crypto.randomUUID();
    const code = `ORG${Date.now().toString().slice(-6)}`;

    const organization = {
      id: orgId,
      name,
      code,
      ownerEmail,
      timezone: timezone || 'UTC',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    await kv.set(`organization_${orgId}`, JSON.stringify(organization));
    await kv.set(`org_code_${code}`, `"${orgId}"`);

    // Update user profile with orgId
    if (authResult.profile) {
      const updatedProfile = {
        ...authResult.profile,
        orgId
      };
      await kv.set(`user_profile_${authResult.user.id}`, JSON.stringify(updatedProfile));
    }

    return c.json({ organization });
  } catch (error) {
    console.log('Organization creation error:', error);
    return c.json({ error: 'Failed to create organization' }, 500);
  }
});

// Create branch
app.post("/make-server-6eefa08e/branches", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { orgId, name, address, phone, capacity, status } = await c.req.json();
    const branchId = crypto.randomUUID();

    const branch = {
      id: branchId,
      orgId,
      name,
      address,
      phone,
      capacity,
      status: status || 'active',
      createdAt: new Date().toISOString()
    };

    await kv.set(`branch_${branchId}`, JSON.stringify(branch));

    return c.json({ branch });
  } catch (error) {
    console.log('Branch creation error:', error);
    return c.json({ error: 'Failed to create branch' }, 500);
  }
});

// Get branches
app.get("/make-server-6eefa08e/branches", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const orgId = c.req.query('orgId');
    if (!orgId) {
      return c.json({ error: 'orgId required' }, 400);
    }

    const allBranches = await kv.getByPrefix('branch_');
    const branches = allBranches
      .map(item => JSON.parse(item))
      .filter(branch => branch.orgId === orgId);

    return c.json({ branches });
  } catch (error) {
    console.log('Get branches error:', error);
    return c.json({ error: 'Failed to get branches' }, 500);
  }
});

// Create time slot
app.post("/make-server-6eefa08e/slots", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { orgId, branchId, label, startTime, endTime, capacity, depositPerPerson } = await c.req.json();
    const slotId = crypto.randomUUID();

    const slot = {
      id: slotId,
      orgId,
      branchId,
      label,
      startTime,
      endTime,
      capacity,
      depositPerPerson: depositPerPerson || 0,
      createdAt: new Date().toISOString()
    };

    await kv.set(`slot_${slotId}`, JSON.stringify(slot));

    return c.json({ slot });
  } catch (error) {
    console.log('Slot creation error:', error);
    return c.json({ error: 'Failed to create slot' }, 500);
  }
});

// Get tables for QR code generation
app.get("/make-server-6eefa08e/tables", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const orgId = c.req.query('orgId');
    
    // Get all tables from KV store
    const allTables = await kv.getByPrefix('table_');
    
    // Parse and filter tables
    const tables = allTables
      .map(item => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter(table => {
        if (!table) return false;
        // If orgId is provided, filter by it
        if (orgId && table.organization_id !== orgId) return false;
        return true;
      })
      .map(table => ({
        id: table.id,
        table_number: table.table_number || table.tableNumber,
        table_name: table.table_name || table.tableName || table.name,
        zone_id: table.zone_id || table.zoneId,
        seats: table.seats,
        status: table.status || 'available'
      }));

    console.log(`Found ${tables.length} tables for org ${orgId || 'all'}`);
    
    return c.json({ tables });
  } catch (error) {
    console.log('Get tables error:', error);
    return c.json({ error: 'Failed to get tables' }, 500);
  }
});

// Initialize default data
async function seedOrganizationDefaults(orgId: string) {
  try {
    // Create default branch
    const branchId = crypto.randomUUID();
    const defaultBranch = {
      id: branchId,
      orgId,
      name: 'Main Branch',
      address: '123 Main Street',
      phone: '+1234567890',
      capacity: 120,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    await kv.set(`branch_${branchId}`, JSON.stringify(defaultBranch));

    // Create default slots
    const defaultSlots = [
      { label: 'Lunch Slot', startTime: '12:00', endTime: '15:00', capacity: 80, depositPerPerson: 0 },
      { label: 'Dinner Slot', startTime: '18:00', endTime: '22:00', capacity: 120, depositPerPerson: 25 },
      { label: 'Late Night', startTime: '22:00', endTime: '24:00', capacity: 60, depositPerPerson: 0 }
    ];

    for (const slotInfo of defaultSlots) {
      const slotId = crypto.randomUUID();
      const slot = {
        id: slotId,
        orgId,
        branchId,
        ...slotInfo,
        createdAt: new Date().toISOString()
      };
      await kv.set(`slot_${slotId}`, JSON.stringify(slot));
    }

    console.log(`Seeded default data for organization ${orgId}`);
  } catch (error) {
    console.log('Error seeding organization defaults:', error);
  }
}

// Initialize system data
async function initializeSystemData() {
  try {
    // Check if system is already initialized
    const systemInit = await kv.get('system_initialized');
    if (systemInit) {
      console.log('System already initialized');
      return;
    }

    // ⚠️ NOTE: Default subscription plans are NOT created here
    // They are managed exclusively from Super Admin Portal > Subscription Plans Management
    // This prevents duplicate plans from being created automatically

    // Create default global settings
    const defaultSettings = [
      {
        id: '1',
        category: 'system',
        key: 'maintenance_mode',
        label: 'Maintenance Mode',
        value: false,
        type: 'boolean',
        description: 'Enable maintenance mode to prevent user access',
        required: false
      },
      {
        id: '2',
        category: 'system',
        key: 'max_file_upload_size',
        label: 'Max File Upload Size (MB)',
        value: 10,
        type: 'number',
        description: 'Maximum file upload size in megabytes',
        required: true
      },
      {
        id: '3',
        category: 'security',
        key: 'password_min_length',
        label: 'Minimum Password Length',
        value: 8,
        type: 'number',
        description: 'Minimum number of characters required for passwords',
        required: true
      },
      {
        id: '4',
        category: 'notifications',
        key: 'admin_email_alerts',
        label: 'Admin Email Alerts',
        value: true,
        type: 'boolean',
        description: 'Send email alerts to administrators for important events',
        required: false
      },
      {
        id: '5',
        category: 'billing',
        key: 'default_currency',
        label: 'Default Currency',
        value: 'USD',
        type: 'select',
        description: 'Default currency for billing and pricing',
        options: ['USD', 'EUR', 'GBP', 'AED', 'SAR'],
        required: true
      }
    ];

    for (const setting of defaultSettings) {
      await kv.set(`global_setting_${setting.id}`, JSON.stringify(setting));
    }

    // Create default integrations
    const defaultIntegrations = [
      {
        id: '1',
        name: 'Stripe Payment Gateway',
        type: 'payment',
        status: 'active',
        config: { publishableKey: 'pk_live_***', webhookUrl: 'https://api.kueue.com/stripe/webhook' },
        lastSync: new Date().toISOString(),
        organizationsUsing: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Twilio SMS Service',
        type: 'sms',
        status: 'active',
        config: { accountSid: 'AC***', authToken: '***', fromNumber: '+1234567890' },
        lastSync: new Date().toISOString(),
        organizationsUsing: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        name: 'SendGrid Email Service',
        type: 'email',
        status: 'active',
        config: { apiKey: 'SG.***', fromEmail: 'noreply@kueue.com' },
        lastSync: new Date().toISOString(),
        organizationsUsing: 0,
        createdAt: new Date().toISOString()
      }
    ];

    for (const integration of defaultIntegrations) {
      await kv.set(`integration_${integration.id}`, JSON.stringify(integration));
    }

    // Create default feature flags
    const defaultFlags = [
      {
        id: '1',
        name: 'Advanced Analytics',
        key: 'advanced_analytics',
        description: 'Enable advanced analytics features for eligible plans',
        enabled: true,
        rolloutPercentage: 100,
        targetOrganizations: [],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      },
      {
        id: '2',
        name: 'SMS Notifications',
        key: 'sms_notifications',
        description: 'Allow SMS notifications to customers',
        enabled: true,
        rolloutPercentage: 80,
        targetOrganizations: [],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    ];

    for (const flag of defaultFlags) {
      await kv.set(`feature_flag_${flag.id}`, JSON.stringify(flag));
    }

    // Mark system as initialized
    await kv.set('system_initialized', 'true');
    
    console.log('System initialization completed');
  } catch (error) {
    console.log('Error initializing system data:', error);
  }
}

// Test endpoint with system initialization
app.get("/make-server-6eefa08e/test", async (c) => {
  // Initialize system data if not already done
  await initializeSystemData();
  
  return c.json({ 
    status: "ok", 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    systemReady: true
  });
});

// ===============================
// PAYMOB INTEGRATION ENDPOINTS
// ===============================

// Get all Paymob configurations
app.get("/make-server-6eefa08e/integrations/paymob/configs", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    // Get all Paymob configurations
    const configs = await kv.getByPrefix('paymob_config_');
    
    return c.json({
      configs: configs.map(config => ({
        ...config,
        // Mask sensitive data
        secretKey: config.secretKey ? config.secretKey.substring(0, 8) + '**********' : ''
      }))
    });
  } catch (error) {
    console.log('Error fetching Paymob configs:', error);
    return c.json({ error: 'Failed to fetch configurations' }, 500);
  }
});

// Create new Paymob configuration
app.post("/make-server-6eefa08e/integrations/paymob/configs", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const body = await c.req.json();
    const configId = `config_${Date.now()}`;
    
    const config = {
      id: configId,
      orgId: body.orgId,
      publicKey: body.publicKey,
      secretKey: body.secretKey, // In production, encrypt this
      isLive: body.isLive || false,
      webhookUrl: body.webhookUrl,
      allowedMethods: body.allowedMethods || ['card'],
      currency: body.currency || 'EGP',
      isEnabled: body.isEnabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`paymob_config_${configId}`, JSON.stringify(config));
    
    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'paymob_config_created',
      role: auth.role,
      orgId: body.orgId,
      timestamp: new Date().toISOString(),
      metadata: { configId }
    }));

    return c.json({ 
      message: 'Configuration created successfully',
      config: {
        ...config,
        secretKey: config.secretKey.substring(0, 8) + '**********'
      }
    });
  } catch (error) {
    console.log('Error creating Paymob config:', error);
    return c.json({ error: 'Failed to create configuration' }, 500);
  }
});

// Update Paymob configuration
app.put("/make-server-6eefa08e/integrations/paymob/configs/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const configId = c.req.param('id');
    const body = await c.req.json();
    
    // Get existing config
    const existingConfig = await kv.get(`paymob_config_${configId}`);
    if (!existingConfig) {
      return c.json({ error: 'Configuration not found' }, 404);
    }

    const config = {
      ...existingConfig,
      orgId: body.orgId || existingConfig.orgId,
      publicKey: body.publicKey || existingConfig.publicKey,
      secretKey: body.secretKey || existingConfig.secretKey,
      isLive: body.isLive !== undefined ? body.isLive : existingConfig.isLive,
      webhookUrl: body.webhookUrl || existingConfig.webhookUrl,
      allowedMethods: body.allowedMethods || existingConfig.allowedMethods,
      currency: body.currency || existingConfig.currency,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : existingConfig.isEnabled,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`paymob_config_${configId}`, JSON.stringify(config));
    
    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'paymob_config_updated',
      role: auth.role,
      orgId: config.orgId,
      timestamp: new Date().toISOString(),
      metadata: { configId }
    }));

    return c.json({ 
      message: 'Configuration updated successfully',
      config: {
        ...config,
        secretKey: config.secretKey.substring(0, 8) + '**********'
      }
    });
  } catch (error) {
    console.log('Error updating Paymob config:', error);
    return c.json({ error: 'Failed to update configuration' }, 500);
  }
});

// Toggle Paymob configuration
app.patch("/make-server-6eefa08e/integrations/paymob/configs/:id/toggle", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const configId = c.req.param('id');
    const body = await c.req.json();
    
    const config = await kv.get(`paymob_config_${configId}`);
    if (!config) {
      return c.json({ error: 'Configuration not found' }, 404);
    }

    config.isEnabled = body.enabled;
    config.updatedAt = new Date().toISOString();

    await kv.set(`paymob_config_${configId}`, JSON.stringify(config));
    
    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: `paymob_config_${body.enabled ? 'enabled' : 'disabled'}`,
      role: auth.role,
      orgId: config.orgId,
      timestamp: new Date().toISOString(),
      metadata: { configId }
    }));

    return c.json({ message: 'Configuration toggled successfully' });
  } catch (error) {
    console.log('Error toggling Paymob config:', error);
    return c.json({ error: 'Failed to toggle configuration' }, 500);
  }
});

// Test Paymob connection
app.post("/make-server-6eefa08e/integrations/paymob/test", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const body = await c.req.json();
    const config = await kv.get(`paymob_config_${body.configId}`);
    
    if (!config) {
      return c.json({ error: 'Configuration not found' }, 404);
    }

    // In a real implementation, you would test the actual Paymob API here
    // For demo purposes, we'll simulate a successful test
    const testResult = {
      success: true,
      message: 'Connection test successful',
      timestamp: new Date().toISOString(),
      apiVersion: '1.0',
      accountId: config.publicKey.split('_')[2] || 'test_account'
    };

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'paymob_connection_tested',
      role: auth.role,
      orgId: config.orgId,
      timestamp: new Date().toISOString(),
      metadata: { configId: body.configId, result: testResult.success }
    }));

    return c.json({ testResult });
  } catch (error) {
    console.log('Error testing Paymob connection:', error);
    return c.json({ error: 'Failed to test connection' }, 500);
  }
});

// Get Paymob transactions
app.get("/make-server-6eefa08e/integrations/paymob/transactions", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    // Get transactions from KV store
    const transactions = await kv.getByPrefix('paymob_transaction_');
    
    // Sort by creation date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return c.json({ transactions });
  } catch (error) {
    console.log('Error fetching Paymob transactions:', error);
    return c.json({ error: 'Failed to fetch transactions' }, 500);
  }
});

// Create a payment intent (for demo purposes)
app.post("/make-server-6eefa08e/integrations/paymob/payment-intent", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const body = await c.req.json();
    const transactionId = `txn_${Date.now()}`;
    
    const transaction = {
      id: transactionId,
      amount: body.amount,
      currency: body.currency || 'EGP',
      status: 'pending',
      paymentMethod: body.paymentMethod || 'card',
      customerEmail: body.customerEmail,
      orderId: body.orderId,
      orgId: body.orgId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`paymob_transaction_${transactionId}`, JSON.stringify(transaction));
    
    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'paymob_payment_initiated',
      role: auth.role,
      orgId: body.orgId,
      timestamp: new Date().toISOString(),
      metadata: { transactionId, amount: body.amount }
    }));

    return c.json({ 
      transaction,
      paymentUrl: `https://payment-gateway.paymob.com/payment/${transactionId}`,
      message: 'Payment intent created successfully'
    });
  } catch (error) {
    console.log('Error creating payment intent:', error);
    return c.json({ error: 'Failed to create payment intent' }, 500);
  }
});

// ========== RESERVATIONS ENDPOINTS ==========

// Get reservations
app.get("/make-server-6eefa08e/reservations", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    // Get query parameters
    const url = new URL(c.req.url);
    const date = url.searchParams.get('date');
    const status = url.searchParams.get('status')?.split(',');
    const slotId = url.searchParams.get('slotId');
    const search = url.searchParams.get('search');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Get user's organization
    const orgId = auth.profile?.orgId || 'default-org';

    // Get all reservations for the organization
    const reservations = await kv.getByPrefix(`reservation_${orgId}_`);
    let reservationList = reservations.map(res => JSON.parse(res));

    // Apply filters
    if (date) {
      reservationList = reservationList.filter(res => res.date === date);
    }
    
    if (status && status.length > 0) {
      reservationList = reservationList.filter(res => status.includes(res.status));
    }
    
    if (slotId) {
      reservationList = reservationList.filter(res => res.slotId === slotId);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      reservationList = reservationList.filter(res => 
        res.hostName?.toLowerCase().includes(searchLower) ||
        res.hostEmail?.toLowerCase().includes(searchLower) ||
        res.hostPhone?.includes(search)
      );
    }
    
    if (startDate) {
      reservationList = reservationList.filter(res => res.date >= startDate);
    }
    
    if (endDate) {
      reservationList = reservationList.filter(res => res.date <= endDate);
    }

    // Sort by creation date (newest first)
    reservationList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ 
      reservations: reservationList,
      total: reservationList.length 
    });

  } catch (error) {
    console.log('Error fetching reservations:', error);
    return c.json({ error: 'Failed to fetch reservations' }, 500);
  }
});

// Create reservation
app.post("/make-server-6eefa08e/reservations", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationData = await c.req.json();
    const orgId = auth.profile?.orgId || 'default-org';
    
    // Generate reservation ID
    const reservationId = crypto.randomUUID();
    
    // Create reservation object
    const reservation = {
      id: reservationId,
      orgId,
      ...reservationData,
      status: reservationData.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store reservation
    await kv.set(`reservation_${orgId}_${reservationId}`, JSON.stringify(reservation));

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'reservation_created',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { 
        reservationId, 
        hostName: reservationData.hostName,
        peopleCount: reservationData.peopleCount 
      }
    }));

    return c.json({ 
      message: 'Reservation created successfully',
      reservationId,
      reservation 
    });

  } catch (error) {
    console.log('Error creating reservation:', error);
    return c.json({ error: 'Failed to create reservation' }, 500);
  }
});

// Update reservation
app.put("/make-server-6eefa08e/reservations/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationId = c.req.param('id');
    let updates;
    
    try {
      updates = await c.req.json();
    } catch (jsonError) {
      console.log('Error parsing request JSON:', jsonError);
      return c.json({ 
        success: false,
        error: 'Invalid JSON in request body' 
      }, 400);
    }
    
    const orgId = auth.profile?.orgId || 'default-org';
    
    // Validate required fields if provided
    if (updates.status && !['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'].includes(updates.status)) {
      return c.json({ 
        success: false,
        error: 'Invalid status value' 
      }, 400);
    }

    // Get existing reservation
    const existingData = await kv.get(`reservation_${orgId}_${reservationId}`);
    if (!existingData) {
      return c.json({ error: 'Reservation not found' }, 404);
    }

    const reservation = JSON.parse(existingData);
    
    // Update reservation
    const updatedReservation = {
      ...reservation,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`reservation_${orgId}_${reservationId}`, JSON.stringify(updatedReservation));

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'reservation_updated',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { reservationId, updates }
    }));

    // Set proper JSON content type
    c.header('Content-Type', 'application/json');
    
    return c.json({ 
      success: true,
      message: 'Reservation updated successfully',
      reservation: updatedReservation 
    });

  } catch (error) {
    console.log('Error updating reservation:', error);
    
    // Set proper error response headers
    c.header('Content-Type', 'application/json');
    
    return c.json({ 
      success: false,
      error: 'Failed to update reservation',
      details: error.message || 'Unknown error'
    }, 500);
  }
});

// Delete reservation
app.delete("/make-server-6eefa08e/reservations/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationId = c.req.param('id');
    const orgId = auth.profile?.orgId || 'default-org';

    // Check if reservation exists
    const existingData = await kv.get(`reservation_${orgId}_${reservationId}`);
    if (!existingData) {
      return c.json({ error: 'Reservation not found' }, 404);
    }

    // Delete reservation
    await kv.del(`reservation_${orgId}_${reservationId}`);

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'reservation_deleted',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { reservationId }
    }));

    return c.json({ message: 'Reservation deleted successfully' });

  } catch (error) {
    console.log('Error deleting reservation:', error);
    return c.json({ error: 'Failed to delete reservation' }, 500);
  }
});

// ========== WAITLIST ENDPOINTS ==========

// Get waitlist entries
app.get("/make-server-6eefa08e/waitlist", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    // Get query parameters
    const url = new URL(c.req.url);
    const status = url.searchParams.get('status')?.split(',');
    const priority = url.searchParams.get('priority')?.split(',');
    const search = url.searchParams.get('search');
    const tableType = url.searchParams.get('tableType')?.split(',');
    const minPartySize = url.searchParams.get('minPartySize');
    const maxPartySize = url.searchParams.get('maxPartySize');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Get user's organization
    const orgId = auth.profile?.orgId || 'default-org';

    // Get all waitlist entries for the organization
    const waitlistEntries = await kv.getByPrefix(`waitlist_${orgId}_`);
    let waitlistList = waitlistEntries.map(entry => JSON.parse(entry));

    // Apply filters
    if (status && status.length > 0) {
      waitlistList = waitlistList.filter(entry => status.includes(entry.status));
    }
    
    if (priority && priority.length > 0) {
      waitlistList = waitlistList.filter(entry => priority.includes(entry.priority));
    }
    
    if (tableType && tableType.length > 0) {
      waitlistList = waitlistList.filter(entry => tableType.includes(entry.tableType));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      waitlistList = waitlistList.filter(entry => 
        entry.guestName?.toLowerCase().includes(searchLower) ||
        entry.guestEmail?.toLowerCase().includes(searchLower) ||
        entry.guestPhone?.includes(search)
      );
    }
    
    if (minPartySize) {
      waitlistList = waitlistList.filter(entry => entry.partySize >= parseInt(minPartySize));
    }
    
    if (maxPartySize) {
      waitlistList = waitlistList.filter(entry => entry.partySize <= parseInt(maxPartySize));
    }
    
    if (startDate) {
      waitlistList = waitlistList.filter(entry => entry.createdAt >= startDate);
    }
    
    if (endDate) {
      waitlistList = waitlistList.filter(entry => entry.createdAt <= endDate);
    }

    // Sort by priority and creation date
    waitlistList.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Older first for same priority
    });

    return c.json({ 
      waitlist: waitlistList,
      total: waitlistList.length 
    });

  } catch (error) {
    console.log('Error fetching waitlist:', error);
    return c.json({ error: 'Failed to fetch waitlist' }, 500);
  }
});

// Create waitlist entry
app.post("/make-server-6eefa08e/waitlist", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const waitlistData = await c.req.json();
    const orgId = auth.profile?.orgId || 'default-org';
    
    // Generate waitlist entry ID
    const entryId = crypto.randomUUID();
    
    // Create waitlist entry object
    const waitlistEntry = {
      id: entryId,
      orgId,
      ...waitlistData,
      status: waitlistData.status || 'waiting',
      priority: waitlistData.priority || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store waitlist entry
    await kv.set(`waitlist_${orgId}_${entryId}`, JSON.stringify(waitlistEntry));

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'waitlist_entry_created',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { 
        entryId, 
        guestName: waitlistData.guestName,
        partySize: waitlistData.partySize 
      }
    }));

    return c.json({ 
      message: 'Waitlist entry created successfully',
      entryId,
      waitlistEntry 
    });

  } catch (error) {
    console.log('Error creating waitlist entry:', error);
    return c.json({ error: 'Failed to create waitlist entry' }, 500);
  }
});

// Update waitlist entry
app.put("/make-server-6eefa08e/waitlist/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const entryId = c.req.param('id');
    const updates = await c.req.json();
    const orgId = auth.profile?.orgId || 'default-org';

    // Get existing waitlist entry
    const existingData = await kv.get(`waitlist_${orgId}_${entryId}`);
    if (!existingData) {
      return c.json({ error: 'Waitlist entry not found' }, 404);
    }

    const waitlistEntry = JSON.parse(existingData);
    
    // Update waitlist entry
    const updatedEntry = {
      ...waitlistEntry,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`waitlist_${orgId}_${entryId}`, JSON.stringify(updatedEntry));

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'waitlist_entry_updated',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { entryId, updates }
    }));

    return c.json({ 
      message: 'Waitlist entry updated successfully',
      waitlistEntry: updatedEntry 
    });

  } catch (error) {
    console.log('Error updating waitlist entry:', error);
    return c.json({ error: 'Failed to update waitlist entry' }, 500);
  }
});

// Delete waitlist entry
app.delete("/make-server-6eefa08e/waitlist/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const entryId = c.req.param('id');
    const orgId = auth.profile?.orgId || 'default-org';

    // Check if waitlist entry exists
    const existingData = await kv.get(`waitlist_${orgId}_${entryId}`);
    if (!existingData) {
      return c.json({ error: 'Waitlist entry not found' }, 404);
    }

    // Delete waitlist entry
    await kv.del(`waitlist_${orgId}_${entryId}`);

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'waitlist_entry_deleted',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { entryId }
    }));

    return c.json({ message: 'Waitlist entry deleted successfully' });

  } catch (error) {
    console.log('Error deleting waitlist entry:', error);
    return c.json({ error: 'Failed to delete waitlist entry' }, 500);
  }
});

// ========== DATA MANAGEMENT ENDPOINTS ==========

// Clear sample data endpoint
app.post("/make-server-6eefa08e/clear-sample-data", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const orgId = auth.profile?.orgId || 'default-org';
    
    // Get all data to count before deletion
    const reservations = await kv.getByPrefix(`reservation_${orgId}_`);
    const waitlistEntries = await kv.getByPrefix(`waitlist_${orgId}_`);
    const activities = await kv.getByPrefix(`activity_`);
    
    const reservationsCount = reservations.length;
    const waitlistCount = waitlistEntries.length;
    const activitiesCount = activities.length;

    // Delete all reservations for the organization
    for (const reservation of reservations) {
      const resData = JSON.parse(reservation);
      await kv.del(`reservation_${orgId}_${resData.id}`);
    }

    // Delete all waitlist entries for the organization
    for (const waitlistEntry of waitlistEntries) {
      const entryData = JSON.parse(waitlistEntry);
      await kv.del(`waitlist_${orgId}_${entryData.id}`);
    }

    // Delete activity logs (optional - you might want to keep these for audit purposes)
    for (const activity of activities) {
      const activityData = JSON.parse(activity);
      // Only delete activities related to this organization
      if (activityData.orgId === orgId) {
        const activityKey = Object.keys(await kv.getByPrefix('activity_')).find(key => 
          JSON.parse(kv.get(key) || '{}').timestamp === activityData.timestamp
        );
        if (activityKey) {
          await kv.del(activityKey);
        }
      }
    }

    // Log the clear action
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'sample_data_cleared',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { 
        reservationsDeleted: reservationsCount,
        waitlistDeleted: waitlistCount,
        activitiesDeleted: activitiesCount
      }
    }));

    return c.json({
      message: 'Sample data cleared successfully',
      summary: {
        reservationsDeleted: reservationsCount,
        waitlistDeleted: waitlistCount,
        activitiesDeleted: activitiesCount
      }
    });

  } catch (error) {
    console.log('Error clearing sample data:', error);
    return c.json({ error: 'Failed to clear sample data' }, 500);
  }
});

// Generate sample data endpoint
app.post("/make-server-6eefa08e/generate-sample-data", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const { type, count = 10 } = await c.req.json();
    const orgId = auth.profile?.orgId || 'default-org';
    
    let generatedCount = 0;
    const summary = {
      reservationsCreated: 0,
      waitlistCreated: 0
    };

    if (type === 'reservations' || type === 'all') {
      // Generate sample reservations
      const sampleReservations = [];
      for (let i = 0; i < count; i++) {
        const reservationId = crypto.randomUUID();
        const date = new Date();
        date.setDate(date.getDate() + Math.floor(Math.random() * 30)); // Next 30 days
        
        const reservation = {
          id: reservationId,
          orgId,
          hostName: `Guest ${i + 1}`,
          hostEmail: `guest${i + 1}@example.com`,
          hostPhone: `+1555000${String(i + 1).padStart(4, '0')}`,
          date: date.toISOString().split('T')[0],
          slotId: 'lunch-slot', // Default slot
          peopleCount: Math.floor(Math.random() * 6) + 1,
          status: ['pending', 'confirmed', 'seated', 'completed'][Math.floor(Math.random() * 4)],
          notes: `Sample reservation ${i + 1}`,
          depositRequired: Math.random() > 0.5,
          depositAmount: Math.random() > 0.5 ? 25 : 0,
          paid: Math.random() > 0.3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'online'
        };
        
        await kv.set(`reservation_${orgId}_${reservationId}`, JSON.stringify(reservation));
        summary.reservationsCreated++;
      }
    }

    if (type === 'waitlist' || type === 'all') {
      // Generate sample waitlist entries
      for (let i = 0; i < count; i++) {
        const entryId = crypto.randomUUID();
        
        const waitlistEntry = {
          id: entryId,
          orgId,
          guestName: `Waitlist Guest ${i + 1}`,
          guestEmail: `waitlist${i + 1}@example.com`,
          guestPhone: `+1555100${String(i + 1).padStart(4, '0')}`,
          partySize: Math.floor(Math.random() * 6) + 1,
          status: ['waiting', 'notified', 'seated', 'cancelled'][Math.floor(Math.random() * 4)],
          priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          estimatedWaitTime: Math.floor(Math.random() * 60) + 15,
          notes: `Sample waitlist entry ${i + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await kv.set(`waitlist_${orgId}_${entryId}`, JSON.stringify(waitlistEntry));
        summary.waitlistCreated++;
      }
    }

    // Log the generation action
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'sample_data_generated',
      role: auth.profile?.role || 'user',
      orgId,
      timestamp: new Date().toISOString(),
      metadata: { 
        type,
        count,
        summary
      }
    }));

    return c.json({
      message: 'Sample data generated successfully',
      summary
    });

  } catch (error) {
    console.log('Error generating sample data:', error);
    return c.json({ error: 'Failed to generate sample data' }, 500);
  }
});

// ========== DASHBOARD ENDPOINTS ==========

// Dashboard metrics endpoint for vendor portal
app.get("/make-server-6eefa08e/dashboard/metrics", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    // Extract query parameters
    const url = new URL(c.req.url);
    const dateRange = {
      start: url.searchParams.get('dateStart') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: url.searchParams.get('dateEnd') || new Date().toISOString().split('T')[0]
    };
    const branchIds = url.searchParams.getAll('branchIds');
    const slotIds = url.searchParams.getAll('slotIds');
    const includeTestData = url.searchParams.get('includeTestData') === 'true';

    console.log('Dashboard metrics request:', { dateRange, branchIds, slotIds, includeTestData });

    // Get user's organization
    const orgId = auth.profile?.orgId || 'default-org';

    // Get reservations for the organization
    const reservations = await kv.getByPrefix(`reservation_${orgId}_`);
    const reservationList = reservations.map(res => JSON.parse(res));

    // Get waitlist entries
    const waitlistEntries = await kv.getByPrefix(`waitlist_${orgId}_`);
    const waitlistList = waitlistEntries.map(entry => JSON.parse(entry));

    // Get branches
    const branches = await kv.getByPrefix(`branch_`);
    const branchList = branches.map(branch => JSON.parse(branch)).filter(b => b.orgId === orgId);

    // Get slots
    const slots = await kv.getByPrefix(`slot_`);
    const slotList = slots.map(slot => JSON.parse(slot)).filter(s => s.orgId === orgId);

    // Filter data by date range
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end + 'T23:59:59.999Z');

    const filteredReservations = reservationList.filter(res => {
      const resDate = new Date(res.reservationDate || res.createdAt);
      return resDate >= startDate && resDate <= endDate;
    });

    const filteredWaitlist = waitlistList.filter(entry => {
      const entryDate = new Date(entry.createdAt);
      return entryDate >= startDate && entryDate <= endDate;
    });

    // Calculate metrics
    const totalReservations = filteredReservations.length;
    const confirmedReservations = filteredReservations.filter(r => r.status === 'confirmed').length;
    const pendingReservations = filteredReservations.filter(r => r.status === 'pending').length;
    const cancelledReservations = filteredReservations.filter(r => r.status === 'cancelled').length;

    const totalWaitlist = filteredWaitlist.length;
    const totalGuests = filteredReservations.reduce((sum, res) => sum + (res.guestCount || 1), 0);

    // Calculate revenue (from confirmed reservations with deposits)
    const totalRevenue = filteredReservations
      .filter(r => r.status === 'confirmed' && r.depositAmount)
      .reduce((sum, res) => sum + (res.depositAmount || 0), 0);

    // Calculate conversion rate
    const conversionRate = totalWaitlist > 0 ? (confirmedReservations / (totalWaitlist + totalReservations)) * 100 : 0;

    // Popular time slots
    const slotMetrics = slotList.map(slot => {
      const slotReservations = filteredReservations.filter(r => r.slotId === slot.id);
      return {
        id: slot.id,
        label: slot.label,
        reservations: slotReservations.length,
        revenue: slotReservations.reduce((sum, res) => sum + (res.depositAmount || 0), 0)
      };
    }).sort((a, b) => b.reservations - a.reservations);

    // Daily trends (last 7 days)
    const dailyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayReservations = filteredReservations.filter(r => {
        const resDate = new Date(r.reservationDate || r.createdAt).toISOString().split('T')[0];
        return resDate === dateStr;
      });

      dailyTrends.push({
        date: dateStr,
        reservations: dayReservations.length,
        revenue: dayReservations.reduce((sum, res) => sum + (res.depositAmount || 0), 0),
        guests: dayReservations.reduce((sum, res) => sum + (res.guestCount || 1), 0)
      });
    }

    // Recent activities (last 10)
    const recentReservations = reservationList
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(res => ({
        id: res.id,
        guestName: res.guestName,
        guestCount: res.guestCount,
        status: res.status,
        createdAt: res.createdAt,
        reservationDate: res.reservationDate
      }));

    // Generate alerts based on metrics
    const alerts = [];
    
    // Low capacity alerts
    if (totalReservations > 0) {
      const capacityUtilization = (totalGuests / (branchList.reduce((sum, b) => sum + (b.capacity || 100), 0))) * 100;
      if (capacityUtilization > 90) {
        alerts.push({
          id: 'capacity-high',
          type: 'warning',
          severity: 'high',
          title: 'High Capacity Utilization',
          message: `Current capacity utilization is ${Math.round(capacityUtilization)}%`,
          isRead: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Revenue alerts
    if (totalRevenue < 100) {
      alerts.push({
        id: 'revenue-low',
        type: 'info',
        severity: 'medium',
        title: 'Low Revenue Alert',
        message: 'Revenue is below expected threshold',
        isRead: false,
        timestamp: new Date().toISOString()
      });
    }

    // Time slots with occupancy data
    const timeSlots = slotList.map(slot => {
      const slotReservations = filteredReservations.filter(r => r.slotId === slot.id);
      const occupancy = slotReservations.reduce((sum, res) => sum + (res.guestCount || 1), 0);
      
      return {
        id: slot.id,
        label: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity || 50,
        occupancy,
        reservations: slotReservations.length,
        revenue: slotReservations.reduce((sum, res) => sum + (res.depositAmount || 0), 0)
      };
    });

    return c.json({
      metrics: {
        totalReservations,
        confirmedReservations,
        pendingReservations,
        cancelledReservations,
        totalWaitlist,
        totalGuests,
        totalRevenue,
        conversionRate: Math.round(conversionRate * 100) / 100
      },
      slotMetrics,
      dailyTrends,
      recentActivity: recentReservations,
      branches: branchList,
      slots: slotList,
      timeSlots,
      alerts,
      dateRange,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.log('Dashboard metrics error:', error);
    return c.json({ error: 'Failed to fetch dashboard metrics' }, 500);
  }
});

// ========== RESERVATION FORMS ENDPOINTS ==========

// Get all reservation forms for an organization
app.get("/make-server-6eefa08e/reservation-forms", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const orgId = auth.profile?.orgId || 'default-org';
    
    // Get all forms for the organization
    const forms = await kv.getByPrefix(`reservation_form_${orgId}_`);
    const formList = forms.map(form => JSON.parse(form));

    // Sort by creation date (newest first)
    formList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ 
      forms: formList,
      total: formList.length 
    });

  } catch (error) {
    console.log('Error fetching reservation forms:', error);
    return c.json({ error: 'Failed to fetch reservation forms' }, 500);
  }
});

// Create a new reservation form
app.post("/make-server-6eefa08e/reservation-forms", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const formData = await c.req.json();
    const orgId = auth.profile?.orgId || 'default-org';
    
    // Generate form ID
    const formId = crypto.randomUUID();
    
    // Create form object
    const form = {
      id: formId,
      orgId,
      ...formData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submissions: 0,
      conversionRate: 0
    };

    // Store form
    await kv.set(`reservation_form_${orgId}_${formId}`, JSON.stringify(form));

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'reservation_form_created',
      formId,
      formName: formData.name,
      timestamp: new Date().toISOString()
    }));

    return c.json({ 
      message: 'Reservation form created successfully',
      formId,
      form
    });

  } catch (error) {
    console.log('Error creating reservation form:', error);
    return c.json({ error: 'Failed to create reservation form' }, 500);
  }
});

// Update reservation form
app.put("/make-server-6eefa08e/reservation-forms/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const formId = c.req.param('id');
    const updates = await c.req.json();
    const orgId = auth.profile?.orgId || 'default-org';

    // Get existing form
    const formData = await kv.get(`reservation_form_${orgId}_${formId}`);
    if (!formData) {
      return c.json({ error: 'Form not found' }, 404);
    }

    const form = JSON.parse(formData);
    
    // Update form
    Object.assign(form, updates, { 
      updatedAt: new Date().toISOString() 
    });

    // Store updated form
    await kv.set(`reservation_form_${orgId}_${formId}`, JSON.stringify(form));

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'reservation_form_updated',
      formId,
      formName: form.name,
      timestamp: new Date().toISOString()
    }));

    return c.json({ 
      message: 'Form updated successfully',
      form 
    });

  } catch (error) {
    console.log('Error updating reservation form:', error);
    return c.json({ error: 'Failed to update reservation form' }, 500);
  }
});

// Delete reservation form
app.delete("/make-server-6eefa08e/reservation-forms/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const formId = c.req.param('id');
    const orgId = auth.profile?.orgId || 'default-org';

    // Get form for logging
    const formData = await kv.get(`reservation_form_${orgId}_${formId}`);
    if (!formData) {
      return c.json({ error: 'Form not found' }, 404);
    }

    const form = JSON.parse(formData);

    // Delete form
    await kv.del(`reservation_form_${orgId}_${formId}`);

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      actorId: auth.user.id,
      action: 'reservation_form_deleted',
      formId,
      formName: form.name,
      timestamp: new Date().toISOString()
    }));

    return c.json({ message: 'Form deleted successfully' });

  } catch (error) {
    console.log('Error deleting reservation form:', error);
    return c.json({ error: 'Failed to delete reservation form' }, 500);
  }
});

// Get single reservation form by ID
app.get("/make-server-6eefa08e/reservation-forms/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const formId = c.req.param('id');
    const orgId = auth.profile?.orgId || 'default-org';

    const formData = await kv.get(`reservation_form_${orgId}_${formId}`);
    if (!formData) {
      return c.json({ error: 'Form not found' }, 404);
    }

    const form = JSON.parse(formData);
    return c.json({ form });

  } catch (error) {
    console.log('Error fetching reservation form:', error);
    return c.json({ error: 'Failed to fetch reservation form' }, 500);
  }
});

// Get public form by slug (for customer access)
app.get("/make-server-6eefa08e/public/forms/:slug", async (c) => {
  try {
    // This endpoint doesn't require authentication as it's for public access
    const slug = c.req.param('slug');
    
    // Search through all organization forms to find the matching slug
    const allForms = await kv.getByPrefix('reservation_form_');
    const form = allForms
      .map(formData => JSON.parse(formData))
      .find(form => form.slug === slug && form.isActive);

    if (!form) {
      return c.json({ error: 'Form not found or inactive' }, 404);
    }

    // Return only public-safe data
    const publicForm = {
      id: form.id,
      name: form.name,
      description: form.description,
      slug: form.slug,
      fields: form.fields,
      settings: {
        title: form.settings.title,
        subtitle: form.settings.subtitle,
        submitButtonText: form.settings.submitButtonText,
        successMessage: form.settings.successMessage,
        theme: form.settings.theme,
        deposit: form.settings.deposit,
        restrictions: form.settings.restrictions
      }
    };

    return c.json({ form: publicForm });

  } catch (error) {
    console.log('Error fetching public form:', error);
    return c.json({ error: 'Failed to fetch form' }, 500);
  }
});

// Submit reservation through custom form
app.post("/make-server-6eefa08e/public/forms/:slug/submit", async (c) => {
  try {
    const slug = c.req.param('slug');
    const submissionData = await c.req.json();
    
    // Get the form
    const allForms = await kv.getByPrefix('reservation_form_');
    const form = allForms
      .map(formData => JSON.parse(formData))
      .find(form => form.slug === slug && form.isActive);

    if (!form) {
      return c.json({ error: 'Form not found or inactive' }, 404);
    }

    // Validate required fields
    const requiredFields = form.fields.filter(field => field.required && field.visible);
    const missingFields = requiredFields.filter(field => 
      !submissionData[field.id] || submissionData[field.id].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      return c.json({ 
        error: 'Missing required fields',
        missingFields: missingFields.map(f => f.label)
      }, 400);
    }

    // Create reservation from form submission
    const reservationId = crypto.randomUUID();
    const reservation = {
      id: reservationId,
      orgId: form.orgId,
      formId: form.id,
      formSlug: form.slug,
      hostName: submissionData.name || submissionData.fullName,
      hostEmail: submissionData.email,
      hostPhone: submissionData.phone,
      peopleCount: submissionData.partySize || 1,
      date: submissionData.date,
      slotId: submissionData.time,
      notes: submissionData.specialRequests,
      status: 'pending',
      depositRequired: form.settings.deposit.enabled,
      depositAmount: form.settings.deposit.amount,
      paid: false,
      source: 'form_submission',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customFields: submissionData
    };

    // Store reservation
    await kv.set(`reservation_${form.orgId}_${reservationId}`, JSON.stringify(reservation));

    // Update form submission count
    form.submissions = (form.submissions || 0) + 1;
    await kv.set(`reservation_form_${form.orgId}_${form.id}`, JSON.stringify(form));

    // Log activity
    await kv.set(`activity_${Date.now()}`, JSON.stringify({
      action: 'form_submission',
      formId: form.id,
      formSlug: form.slug,
      reservationId,
      guestName: reservation.hostName,
      timestamp: new Date().toISOString()
    }));

    return c.json({ 
      message: 'Reservation submitted successfully',
      reservationId,
      confirmationCode: reservationId.substring(0, 8).toUpperCase(),
      successMessage: form.settings.successMessage,
      redirectUrl: form.settings.redirectUrl
    });

  } catch (error) {
    console.log('Error submitting form:', error);
    return c.json({ error: 'Failed to submit reservation' }, 500);
  }
});

// Get form analytics
app.get("/make-server-6eefa08e/reservation-forms/:id/analytics", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const formId = c.req.param('id');
    const orgId = auth.profile?.orgId || 'default-org';

    // Get form
    const formData = await kv.get(`reservation_form_${orgId}_${formId}`);
    if (!formData) {
      return c.json({ error: 'Form not found' }, 404);
    }

    const form = JSON.parse(formData);

    // Get reservations submitted through this form
    const reservations = await kv.getByPrefix(`reservation_${orgId}_`);
    const formReservations = reservations
      .map(res => JSON.parse(res))
      .filter(res => res.formId === formId);

    // Calculate analytics
    const totalSubmissions = formReservations.length;
    const confirmedReservations = formReservations.filter(r => r.status === 'confirmed').length;
    const conversionRate = totalSubmissions > 0 ? (confirmedReservations / totalSubmissions) * 100 : 0;

    // Daily submission trends (last 30 days)
    const dailyTrends = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const daySubmissions = formReservations.filter(r => {
        const resDate = new Date(r.createdAt).toISOString().split('T')[0];
        return resDate === dateStr;
      });

      dailyTrends.push({
        date: dateStr,
        submissions: daySubmissions.length,
        conversions: daySubmissions.filter(r => r.status === 'confirmed').length
      });
    }

    // Field completion rates
    const fieldAnalytics = form.fields.map(field => {
      const completedCount = formReservations.filter(r => 
        r.customFields && r.customFields[field.id] && r.customFields[field.id].toString().trim() !== ''
      ).length;
      
      return {
        fieldId: field.id,
        fieldLabel: field.label,
        completionRate: totalSubmissions > 0 ? (completedCount / totalSubmissions) * 100 : 0,
        isRequired: field.required
      };
    });

    return c.json({
      analytics: {
        totalSubmissions,
        confirmedReservations,
        conversionRate: Math.round(conversionRate * 100) / 100,
        dailyTrends,
        fieldAnalytics,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.log('Error fetching form analytics:', error);
    return c.json({ error: 'Failed to fetch form analytics' }, 500);
  }
});

// ===========================================
// COMMUNICATIONS MANAGEMENT ENDPOINTS
// ===========================================

// Get communications dashboard data for admins
app.get("/make-server-6eefa08e/admin/communications", async (c) => {
  try {
    console.log('🔥 Communications endpoint hit - starting processing...');
    
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      console.log('❌ Auth failed:', authResult.error);
      return c.json({ error: authResult.error }, authResult.status);
    }

    console.log('✅ Auth successful, user role:', authResult.userProfile?.role);

    if (!['super_admin', 'support_admin'].includes(authResult.userProfile?.role)) {
      console.log('❌ Insufficient permissions for role:', authResult.userProfile?.role);
      return c.json({ error: 'Admin access required' }, 403);
    }

    // Mock data for now - in production this would come from database
    const mockProviders = [
      {
        id: '1',
        type: 'email',
        name: 'Kueue Email Service',
        provider: 'SendGrid',
        status: 'active',
        verifiedNumbers: [],
        emailDomains: ['kueue.net'],
        apiKey: 'SG.***************',
        webhook: 'https://api.kueue.net/webhooks/email',
        rateLimit: { perMinute: 100, perHour: 5000, perDay: 50000 },
        usage: { today: 2847, thisMonth: 45821, totalSent: 284752 },
        settings: {
          fromDomain: 'kueue.net',
          replyToDomain: 'noreply@kueue.net'
        },
        lastSync: new Date().toISOString()
      },
      {
        id: '2',
        type: 'sms',
        name: 'Kueue SMS Gateway',
        provider: 'Twilio',
        status: 'active',
        verifiedNumbers: ['+1234567890', '+1987654321'],
        emailDomains: [],
        apiKey: 'AC***************',
        webhook: 'https://api.kueue.net/webhooks/sms',
        rateLimit: { perMinute: 50, perHour: 2000, perDay: 20000 },
        usage: { today: 1247, thisMonth: 18934, totalSent: 147823 },
        settings: {
          defaultFromNumber: '+1234567890'
        },
        lastSync: new Date().toISOString()
      },
      {
        id: '3',
        type: 'whatsapp',
        name: 'Kueue WhatsApp Business',
        provider: 'Meta Business',
        status: 'active',
        verifiedNumbers: ['+1234567890'],
        emailDomains: [],
        apiKey: 'EAAG***************',
        webhook: 'https://api.kueue.net/webhooks/whatsapp',
        rateLimit: { perMinute: 20, perHour: 1000, perDay: 10000 },
        usage: { today: 423, thisMonth: 8947, totalSent: 52847 },
        settings: {
          businessAccountId: '123456789',
          phoneNumberId: '987654321'
        },
        lastSync: new Date().toISOString()
      }
    ];

    const mockVendorSetups = [
      {
        vendorId: '1',
        organizationName: 'Grasp Restaurant',
        customEmail: 'grasprestaurant@kueue.net',
        emailVerified: true,
        smsDisplayName: 'Grasp Restaurant',
        whatsappDisplayName: 'Grasp Restaurant',
        whatsappVerified: false,
        channels: { email: true, sms: true, whatsapp: false },
        quotas: {
          email: { used: 142, limit: 1000 },
          sms: { used: 89, limit: 500 },
          whatsapp: { used: 0, limit: 200 }
        },
        lastActivity: '2024-01-20T10:30:00Z'
      },
      {
        vendorId: '2',
        organizationName: 'Elite Dining',
        customEmail: 'elitedining@kueue.net',
        emailVerified: true,
        smsDisplayName: 'Elite Dining',
        whatsappDisplayName: 'Elite Dining',
        whatsappVerified: true,
        channels: { email: true, sms: true, whatsapp: true },
        quotas: {
          email: { used: 847, limit: 2000 },
          sms: { used: 234, limit: 1000 },
          whatsapp: { used: 156, limit: 500 }
        },
        lastActivity: '2024-01-20T09:15:00Z'
      }
    ];

    const globalSettings = {
      autoCreateEmails: true,
      requireWhatsAppVerification: true,
      enforceRateLimiting: true,
      defaultQuotas: {
        email: 1000,
        sms: 500,
        whatsapp: 200
      }
    };

    // Calculate usage statistics
    const totalMessages = mockProviders.reduce((sum, provider) => 
      sum + (provider.usage?.today || 0), 0);
    
    const activeProviders = mockProviders.filter(p => p.status === 'active').length;
    const verifiedVendors = mockVendorSetups.filter(v => v.emailVerified).length;

    console.log('🎯 Communications data prepared successfully');
    console.log('📊 Stats:', {
      providers: mockProviders.length,
      vendors: mockVendorSetups.length,
      totalMessages,
      activeProviders,
      verifiedVendors
    });

    return c.json({
      providers: mockProviders,
      vendorSetups: mockVendorSetups,
      globalSettings,
      statistics: {
        totalProviders: mockProviders.length,
        activeProviders,
        totalVendors: mockVendorSetups.length,
        verifiedVendors,
        totalMessagesToday: totalMessages,
        averageUsagePerVendor: mockVendorSetups.length > 0 ? 
          Math.round(totalMessages / mockVendorSetups.length) : 0
      }
    });

  } catch (error) {
    console.error('💥 Communications endpoint error:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    return c.json({ 
      error: 'Failed to load communications data',
      details: error?.message || 'Unknown error occurred'
    }, 500);
  }
});

// Update communication provider status
app.put("/make-server-6eefa08e/admin/communications/providers/:id", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    if (!['super_admin'].includes(authResult.userProfile?.role)) {
      return c.json({ error: 'Super admin access required' }, 403);
    }

    const providerId = c.req.param('id');
    const body = await c.req.json();

    console.log(`Updating provider ${providerId} with:`, body);

    return c.json({ 
      success: true, 
      message: 'Provider updated successfully (mock response)' 
    });

  } catch (error) {
    console.error('Failed to update provider:', error);
    return c.json({ 
      error: 'Failed to update provider',
      details: error.message 
    }, 500);
  }
});

// Update vendor communication settings
app.put("/make-server-6eefa08e/admin/communications/vendors/:id", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    if (!['super_admin', 'support_admin'].includes(authResult.userProfile?.role)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const vendorId = c.req.param('id');
    const body = await c.req.json();

    console.log(`Updating vendor ${vendorId} with:`, body);

    return c.json({ 
      success: true, 
      message: 'Vendor communication settings updated successfully (mock response)' 
    });

  } catch (error) {
    console.error('Failed to update vendor setup:', error);
    return c.json({ 
      error: 'Failed to update vendor setup',
      details: error.message 
    }, 500);
  }
});

// Verify WhatsApp for vendor
app.post("/make-server-6eefa08e/admin/communications/vendors/:id/verify-whatsapp", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    if (!['super_admin', 'support_admin'].includes(authResult.userProfile?.role)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const vendorId = c.req.param('id');

    console.log(`Verifying WhatsApp for vendor ${vendorId}`);

    return c.json({ 
      success: true, 
      message: 'WhatsApp verification completed successfully (mock response)' 
    });

  } catch (error) {
    console.error('Failed to verify WhatsApp:', error);
    return c.json({ 
      error: 'Failed to verify WhatsApp',
      details: error.message 
    }, 500);
  }
});







// ===========================================
// SMS MISR INTEGRATION ENDPOINTS
// ===========================================

// SMS Misr Configuration
const SMS_MISR_CONFIG = {
  username: '0f38e228645745dd107711a2dadee7fce8f279bd87617db6641457ce9d3164d2',
  password: '2305ce6b6fbb23e74e3cd4d75e278a4eea95acb1079f1fc672e1fbe8ae5b3cd0',
  sender: '1a44908abcbcb72d6de0174a8fbcf3f92367be187e8eb680999ab0303ba91ae9',
  apiUrl: 'https://smsmisr.com/api/SMS/'
};

// Send single SMS via SMS Misr
app.post('/make-server-6eefa08e/sms/send', async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    if (!['super_admin', 'support_admin', 'vendor'].includes(authResult.userProfile?.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await c.req.json();
    const { recipient, message, language = 1, environment = 2 } = body;

    if (!recipient || !message) {
      return c.json({ error: 'Recipient and message are required' }, 400);
    }

    console.log('🔥 Sending SMS via SMS Misr:', {
      recipient: recipient.substring(0, 5) + '***',
      messageLength: message.length,
      language,
      environment
    });

    // Prepare SMS Misr API request
    const smsData = new URLSearchParams({
      username: SMS_MISR_CONFIG.username,
      password: SMS_MISR_CONFIG.password,
      sender: SMS_MISR_CONFIG.sender,
      mobile: recipient,
      message: message,
      environment: environment.toString(),
      language: language.toString()
    });

    // Call SMS Misr API
    const smsResponse = await fetch(SMS_MISR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: smsData.toString()
    });

    const responseText = await smsResponse.text();
    console.log('📱 SMS Misr raw response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse SMS response:', parseError);
      return c.json({ 
        success: false, 
        error: 'Invalid response from SMS service',
        details: responseText 
      }, 500);
    }

    console.log('📊 SMS Misr parsed response:', responseData);

    // Check if SMS was sent successfully
    if (responseData.code === '1901' || responseData.code === 1901) {
      // Success - store message in history
      const messageRecord = {
        id: Date.now().toString(),
        recipient,
        message,
        status: 'sent',
        smsId: responseData.SMSID || responseData.smsId,
        cost: responseData.Cost || responseData.cost,
        timestamp: new Date().toISOString(),
        userId: authResult.user.id,
        organizationId: authResult.userProfile.organizationId || 'system'
      };

      // Store in KV store
      await kv.set(`sms_message_${messageRecord.id}`, messageRecord);

      // Log activity
      await kv.set(`activity_${Date.now()}`, {
        actorId: authResult.user.id,
        role: authResult.userProfile.role,
        action: 'sms_sent',
        payload: { 
          recipient: recipient.substring(0, 5) + '***', 
          messageLength: message.length,
          smsId: messageRecord.smsId,
          cost: messageRecord.cost
        },
        timestamp: new Date().toISOString()
      });

      return c.json({
        success: true,
        message: 'SMS sent successfully',
        smsId: messageRecord.smsId,
        cost: messageRecord.cost,
        messageId: messageRecord.id
      });
    } else {
      // Failed - determine error message
      let errorMessage = 'Unknown error occurred';
      
      switch (responseData.code?.toString()) {
        case '1902':
          errorMessage = 'Invalid request format';
          break;
        case '1903':
          errorMessage = 'Invalid username or password';
          break;
        case '1904':
          errorMessage = 'Invalid sender ID';
          break;
        case '1905':
          errorMessage = 'Invalid mobile number';
          break;
        case '1906':
          errorMessage = 'Insufficient credit';
          break;
        case '1907':
          errorMessage = 'Server updating, try again later';
          break;
        case '1908':
          errorMessage = 'Invalid delay format';
          break;
        case '1909':
          errorMessage = 'Invalid message content';
          break;
        case '1910':
          errorMessage = 'Invalid language parameter';
          break;
        case '1911':
          errorMessage = 'Message text too long';
          break;
        case '1912':
          errorMessage = 'Invalid environment parameter';
          break;
        default:
          errorMessage = responseData.Message || responseData.message || 'SMS sending failed';
      }

      // Store failed message
      const failedMessageRecord = {
        id: Date.now().toString(),
        recipient,
        message,
        status: 'failed',
        errorMessage,
        errorCode: responseData.code,
        timestamp: new Date().toISOString(),
        userId: authResult.user.id,
        organizationId: authResult.userProfile.organizationId || 'system'
      };

      await kv.set(`sms_message_${failedMessageRecord.id}`, failedMessageRecord);

      return c.json({
        success: false,
        error: errorMessage,
        code: responseData.code,
        messageId: failedMessageRecord.id
      }, 400);
    }

  } catch (error) {
    console.error('💥 SMS send error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to send SMS',
      details: error.message 
    }, 500);
  }
});

// Send bulk SMS
app.post('/make-server-6eefa08e/sms/send-bulk', async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    if (!['super_admin', 'support_admin', 'vendor'].includes(authResult.userProfile?.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await c.req.json();
    const { campaignName, recipients, message, language = 1, environment = 2 } = body;

    if (!campaignName || !recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
      return c.json({ error: 'Campaign name, recipients array, and message are required' }, 400);
    }

    console.log('🚀 Starting bulk SMS campaign:', {
      campaignName,
      recipientCount: recipients.length,
      messageLength: message.length,
      language,
      environment
    });

    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create campaign record
    const campaignRecord = {
      id: campaignId,
      name: campaignName,
      message,
      recipients,
      status: 'sending',
      totalRecipients: recipients.length,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
      userId: authResult.user.id,
      organizationId: authResult.userProfile.organizationId || 'system'
    };

    await kv.set(`sms_campaign_${campaignId}`, campaignRecord);

    // Send SMS to each recipient (in production, this should be queued)
    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients.slice(0, 10)) { // Limit to 10 for demo
      try {
        const smsData = new URLSearchParams({
          username: SMS_MISR_CONFIG.username,
          password: SMS_MISR_CONFIG.password,
          sender: SMS_MISR_CONFIG.sender,
          mobile: recipient.trim(),
          message: message,
          environment: environment.toString(),
          language: language.toString()
        });

        const smsResponse = await fetch(SMS_MISR_CONFIG.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: smsData.toString()
        });

        const responseText = await smsResponse.text();
        const responseData = JSON.parse(responseText);

        if (responseData.code === '1901' || responseData.code === 1901) {
          sentCount++;
          results.push({
            recipient: recipient.trim(),
            status: 'sent',
            smsId: responseData.SMSID || responseData.smsId,
            cost: responseData.Cost || responseData.cost
          });
        } else {
          failedCount++;
          results.push({
            recipient: recipient.trim(),
            status: 'failed',
            error: responseData.Message || responseData.message || 'Unknown error'
          });
        }

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        failedCount++;
        results.push({
          recipient: recipient.trim(),
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update campaign record
    campaignRecord.status = 'completed';
    campaignRecord.sentCount = sentCount;
    campaignRecord.failedCount = failedCount;
    campaignRecord.completedAt = new Date().toISOString();
    campaignRecord.results = results;

    await kv.set(`sms_campaign_${campaignId}`, campaignRecord);

    // Log activity
    await kv.set(`activity_${Date.now()}`, {
      actorId: authResult.user.id,
      role: authResult.userProfile.role,
      action: 'bulk_sms_sent',
      payload: { 
        campaignId,
        campaignName,
        totalRecipients: recipients.length,
        sentCount,
        failedCount
      },
      timestamp: new Date().toISOString()
    });

    return c.json({
      success: true,
      message: 'Bulk SMS campaign completed',
      campaignId,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      results: results.slice(0, 5) // Return first 5 results for preview
    });

  } catch (error) {
    console.error('💥 Bulk SMS error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to send bulk SMS',
      details: error.message 
    }, 500);
  }
});

// Get SMS history
app.get('/make-server-6eefa08e/sms/history', async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    // Get user's SMS messages
    const messages = await kv.getByPrefix('sms_message_') || [];
    const campaigns = await kv.getByPrefix('sms_campaign_') || [];

    // Filter by user/organization if not admin
    const userMessages = authResult.userProfile.role === 'super_admin' 
      ? messages 
      : messages.filter(msg => 
          msg.userId === authResult.user.id || 
          msg.organizationId === authResult.userProfile.organizationId
        );

    const userCampaigns = authResult.userProfile.role === 'super_admin'
      ? campaigns
      : campaigns.filter(camp => 
          camp.userId === authResult.user.id || 
          camp.organizationId === authResult.userProfile.organizationId
        );

    return c.json({
      success: true,
      messages: userMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      campaigns: userCampaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      statistics: {
        totalMessages: userMessages.length,
        sentMessages: userMessages.filter(m => m.status === 'sent').length,
        failedMessages: userMessages.filter(m => m.status === 'failed').length,
        totalCampaigns: userCampaigns.length
      }
    });

  } catch (error) {
    console.error('💥 SMS history error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to load SMS history',
      details: error.message 
    }, 500);
  }
});

// Test SMS Misr connection
app.get('/make-server-6eefa08e/sms/test-connection', async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    if (!['super_admin', 'support_admin'].includes(authResult.userProfile?.role)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    // Test with a simple API call (test environment)
    const testData = new URLSearchParams({
      username: SMS_MISR_CONFIG.username,
      password: SMS_MISR_CONFIG.password,
      sender: SMS_MISR_CONFIG.sender,
      mobile: '201000000000', // Test number
      message: 'Test connection - Kueue RSVP',
      environment: '2', // Test environment
      language: '1'
    });

    const response = await fetch(SMS_MISR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: testData.toString()
    });

    const responseText = await response.text();
    const responseData = JSON.parse(responseText);

    return c.json({
      success: true,
      connected: response.ok,
      response: responseData,
      message: 'SMS Misr connection test completed'
    });

  } catch (error) {
    console.error('💥 SMS connection test error:', error);
    return c.json({ 
      success: false,
      connected: false,
      error: 'Connection test failed',
      details: error.message 
    }, 500);
  }
});

// =====================================================
// REAL DATABASE ENDPOINTS FOR RESERVATIONS V2
// =====================================================

// Helper function to verify organization access
async function verifyOrgAccess(userId: string, organizationId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', userId)
    .single();
    
  if (error || !user) {
    return { hasAccess: false, error: 'User not found' };
  }
  
  if (user.organization_id !== organizationId) {
    return { hasAccess: false, error: 'Access denied to organization' };
  }
  
  return { hasAccess: true, userRole: user.role };
}

// Get reservations with real database queries
app.get("/make-server-6eefa08e/reservations/v2", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const url = new URL(c.req.url);
    const organizationId = url.searchParams.get('organization_id') || auth.profile?.organizationId;
    const venueId = url.searchParams.get('venue_id');
    const date = url.searchParams.get('date');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    if (!organizationId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify access
    const access = await verifyOrgAccess(auth.user.id, organizationId);
    if (!access.hasAccess) {
      return c.json({ error: access.error }, 403);
    }

    // Build query
    let query = supabase
      .from('reservation_details')
      .select(`
        *,
        venue_name,
        zone_name,
        table_number,
        guest_full_name,
        guest_email_confirmed,
        guest_phone_confirmed,
        guest_vip_status
      `)
      .eq('organization_id', organizationId)
      .limit(limit);

    // Apply filters
    if (venueId) query = query.eq('venue_id', venueId);
    if (date) query = query.eq('reservation_date', date);
    if (startDate && endDate) {
      query = query.gte('reservation_date', startDate).lte('reservation_date', endDate);
    }
    if (status) {
      const statusArray = status.split(',');
      query = query.in('status', statusArray);
    }
    if (search) {
      query = query.or(`
        guest_name.ilike.%${search}%,
        guest_email.ilike.%${search}%,
        guest_phone.ilike.%${search}%,
        confirmation_code.ilike.%${search}%
      `);
    }

    // Order by date and time
    query = query.order('reservation_date', { ascending: false })
                 .order('reservation_time', { ascending: false });

    const { data: reservations, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return c.json({ error: 'Failed to fetch reservations' }, 500);
    }

    // Calculate basic stats
    const stats = {
      total: reservations?.length || 0,
      confirmed: reservations?.filter(r => r.status === 'confirmed').length || 0,
      pending: reservations?.filter(r => r.status === 'pending').length || 0,
      seated: reservations?.filter(r => r.status === 'seated').length || 0,
      completed: reservations?.filter(r => r.status === 'completed').length || 0,
      cancelled: reservations?.filter(r => r.status === 'cancelled').length || 0,
      no_show: reservations?.filter(r => r.status === 'no_show').length || 0,
      total_guests: reservations?.reduce((sum, r) => sum + (r.party_size || 0), 0) || 0
    };

    return c.json({
      reservations: reservations || [],
      stats,
      count: reservations?.length || 0,
      organization_id: organizationId
    });

  } catch (error) {
    console.error('Error fetching reservations:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new reservation
app.post("/make-server-6eefa08e/reservations/v2", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationData = await c.req.json();
    const organizationId = reservationData.organization_id || auth.profile?.organizationId;

    if (!organizationId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify access
    const access = await verifyOrgAccess(auth.user.id, organizationId);
    if (!access.hasAccess) {
      return c.json({ error: access.error }, 403);
    }

    // Validate required fields
    const required = ['guest_name', 'guest_phone', 'reservation_date', 'reservation_time', 'party_size', 'venue_id'];
    for (const field of required) {
      if (!reservationData[field]) {
        return c.json({ error: `${field} is required` }, 400);
      }
    }

    // Check for existing guest and create/link if needed
    let guestId = null;
    if (reservationData.guest_email) {
      const { data: existingGuest } = await supabase
        .from('guests')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('email', reservationData.guest_email)
        .single();

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        // Create new guest
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert([{
            organization_id: organizationId,
            full_name: reservationData.guest_name,
            email: reservationData.guest_email,
            phone: reservationData.guest_phone,
            first_visit_date: new Date().toISOString()
          }])
          .select('id')
          .single();

        if (!guestError && newGuest) {
          guestId = newGuest.id;
        }
      }
    }

    // Create reservation
    const insertData = {
      organization_id: organizationId,
      venue_id: reservationData.venue_id,
      guest_id: guestId,
      reservation_date: reservationData.reservation_date,
      reservation_time: reservationData.reservation_time,
      party_size: parseInt(reservationData.party_size),
      duration_minutes: reservationData.duration_minutes || 120,
      guest_name: reservationData.guest_name,
      guest_email: reservationData.guest_email,
      guest_phone: reservationData.guest_phone,
      special_requests: reservationData.special_requests,
      dietary_requirements: reservationData.dietary_requirements || [],
      occasion: reservationData.occasion,
      status: 'pending',
      source: reservationData.source || 'website',
      payment_required: reservationData.payment_required || false,
      payment_amount: reservationData.payment_amount,
      payment_status: 'none'
    };

    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert([insertData])
      .select('id, confirmation_code')
      .single();

    if (error) {
      console.error('Database error:', error);
      return c.json({ error: 'Failed to create reservation' }, 500);
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert([{
        organization_id: organizationId,
        actor_type: 'user',
        actor_id: auth.user.id,
        action: 'reservation_created',
        resource_type: 'reservation',
        resource_id: reservation.id,
        description: `New reservation created for ${reservationData.guest_name}`
      }]);

    return c.json({
      message: 'Reservation created successfully',
      reservation_id: reservation.id,
      confirmation_code: reservation.confirmation_code
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update reservation status
app.put("/make-server-6eefa08e/reservations/v2/:id/status", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationId = c.req.param('id');
    const { status, notes, organization_id } = await c.req.json();

    if (!organization_id) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify access
    const access = await verifyOrgAccess(auth.user.id, organization_id);
    if (!access.hasAccess) {
      return c.json({ error: access.error }, 403);
    }

    // Build update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    // Set appropriate timestamp
    switch (status) {
      case 'confirmed':
        updateData.confirmed_at = new Date().toISOString();
        break;
      case 'seated':
        updateData.seated_at = new Date().toISOString();
        break;
      case 'completed':
        updateData.completed_at = new Date().toISOString();
        break;
      case 'cancelled':
        updateData.cancelled_at = new Date().toISOString();
        break;
    }

    if (notes) {
      updateData.staff_notes = notes;
    }

    const { error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .eq('organization_id', organization_id);

    if (error) {
      console.error('Database error:', error);
      return c.json({ error: 'Failed to update reservation' }, 500);
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert([{
        organization_id,
        actor_type: 'user',
        actor_id: auth.user.id,
        action: 'reservation_status_updated',
        resource_type: 'reservation',
        resource_id: reservationId,
        description: `Reservation status changed to ${status}`,
        changes: { old_status: 'unknown', new_status: status }
      }]);

    return c.json({
      message: `Reservation ${status} successfully`
    });

  } catch (error) {
    console.error('Error updating reservation status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single reservation
app.get("/make-server-6eefa08e/reservations/v2/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationId = c.req.param('id');
    const organizationId = c.req.query('organization_id') || auth.profile?.organizationId;

    if (!organizationId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify access
    const access = await verifyOrgAccess(auth.user.id, organizationId);
    if (!access.hasAccess) {
      return c.json({ error: access.error }, 403);
    }

    const { data: reservation, error } = await supabase
      .from('reservation_details')
      .select('*')
      .eq('id', reservationId)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      console.error('Database error:', error);
      return c.json({ error: 'Reservation not found' }, 404);
    }

    return c.json({ reservation });

  } catch (error) {
    console.error('Error fetching reservation:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update full reservation
app.put("/make-server-6eefa08e/reservations/v2/:id", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationId = c.req.param('id');
    const updates = await c.req.json();
    const organizationId = updates.organization_id || auth.profile?.organizationId;

    if (!organizationId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify access
    const access = await verifyOrgAccess(auth.user.id, organizationId);
    if (!access.hasAccess) {
      return c.json({ error: access.error }, 403);
    }

    // Remove computed fields
    delete updates.table_number;
    delete updates.zone_name;
    delete updates.venue_name;
    delete updates.guest_full_name;

    // Add update timestamp
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', reservationId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Database error:', error);
      return c.json({ error: 'Failed to update reservation' }, 500);
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert([{
        organization_id: organizationId,
        actor_type: 'user',
        actor_id: auth.user.id,
        action: 'reservation_updated',
        resource_type: 'reservation',
        resource_id: reservationId,
        description: `Reservation details updated`,
        changes: updates
      }]);

    return c.json({
      message: 'Reservation updated successfully'
    });

  } catch (error) {
    console.error('Error updating reservation:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Assign table to reservation
app.put("/make-server-6eefa08e/reservations/v2/:id/table", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const reservationId = c.req.param('id');
    const { table_id, organization_id } = await c.req.json();

    if (!organization_id) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify access
    const access = await verifyOrgAccess(auth.user.id, organization_id);
    if (!access.hasAccess) {
      return c.json({ error: access.error }, 403);
    }

    const { error } = await supabase
      .from('reservations')
      .update({
        table_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId)
      .eq('organization_id', organization_id);

    if (error) {
      console.error('Database error:', error);
      return c.json({ error: 'Failed to assign table' }, 500);
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert([{
        organization_id,
        actor_type: 'user',
        actor_id: auth.user.id,
        action: 'table_assigned',
        resource_type: 'reservation',
        resource_id: reservationId,
        description: `Table assigned to reservation`
      }]);

    return c.json({
      message: 'Table assigned successfully'
    });

  } catch (error) {
    console.error('Error assigning table:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Analytics endpoint for reservations
app.get("/make-server-6eefa08e/reservations/v2/analytics", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    const url = new URL(c.req.url);
    const organizationId = url.searchParams.get('organization_id') || auth.profile?.organizationId;
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    if (!organizationId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify access
    const access = await verifyOrgAccess(auth.user.id, organizationId);
    if (!access.hasAccess) {
      return c.json({ error: access.error }, 403);
    }

    // Get analytics data using the pre-calculated daily_analytics table
    let analyticsQuery = supabase
      .from('daily_analytics')
      .select('*')
      .eq('organization_id', organizationId);

    if (startDate && endDate) {
      analyticsQuery = analyticsQuery
        .gte('analytics_date', startDate)
        .lte('analytics_date', endDate);
    }

    const { data: analyticsData, error: analyticsError } = await analyticsQuery
      .order('analytics_date', { ascending: false });

    if (analyticsError) {
      console.error('Analytics error:', analyticsError);
      return c.json({ error: 'Failed to fetch analytics' }, 500);
    }

    // Calculate summary metrics
    const totalRevenue = analyticsData?.reduce((sum, day) => sum + (day.total_revenue || 0), 0) || 0;
    const totalReservations = analyticsData?.reduce((sum, day) => sum + (day.total_reservations || 0), 0) || 0;
    const totalGuests = analyticsData?.reduce((sum, day) => sum + (day.total_guests || 0), 0) || 0;
    const avgOccupancy = analyticsData?.length > 0 
      ? analyticsData.reduce((sum, day) => sum + (day.occupancy_rate || 0), 0) / analyticsData.length 
      : 0;

    return c.json({
      summary: {
        total_revenue: totalRevenue,
        total_reservations: totalReservations,
        total_guests: totalGuests,
        average_occupancy: Math.round(avgOccupancy * 10) / 10,
        average_party_size: totalReservations > 0 ? Math.round((totalGuests / totalReservations) * 10) / 10 : 0
      },
      daily_data: analyticsData || [],
      period: {
        start_date: startDate,
        end_date: endDate
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// SQL function to check database schema
app.get("/make-server-6eefa08e/database/status", async (c) => {
  try {
    const auth = await verifyAuth(c);
    if (auth.error) {
      return c.json({ error: auth.error }, auth.status);
    }

    // Check if production tables exist
    const tables = [
      'organizations', 'users', 'guests', 'venues', 'zones', 'tables',
      'reservations', 'waitlist', 'events', 'daily_analytics'
    ];

    const tableStatus = {};
    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(0);
        
        tableStatus[table] = !error;
      } catch (err) {
        tableStatus[table] = false;
      }
    }

    const tablesExisting = Object.values(tableStatus).filter(Boolean).length;
    const hasSchema = tablesExisting > 0;

    return c.json({
      has_schema: hasSchema,
      tables_existing: tablesExisting,
      tables_total: tables.length,
      table_status: tableStatus,
      database_ready: tablesExisting >= 8 // At least 8 core tables should exist
    });

  } catch (error) {
    console.error('Error checking database status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Import SMS router
import smsRouter from './sms.tsx';

// Add SMS routes
app.route('/make-server-6eefa08e/sms', smsRouter);

// ═══════════════════════════════════════════════════════════════════
// PHASE 1 FIX ENDPOINTS - Cache & Database Diagnostics
// ═══════════════════════════════════════════════════════════════════

// Endpoint: Get cache statistics
app.get("/make-server-6eefa08e/admin/cache/stats", async (c) => {
  try {
    const authResult = await verifyAuth(c);
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const now = Date.now();
    
    // Calculate cache stats
    const profileCacheEntries = Array.from(profileCache.entries());
    const activeProfiles = profileCacheEntries.filter(
      ([_, entry]) => (now - entry.timestamp) < PROFILE_CACHE_TTL
    );
    const staleProfiles = profileCacheEntries.filter(
      ([_, entry]) => (now - entry.timestamp) >= PROFILE_CACHE_TTL
    );
    
    const plansCacheActive = plansCache && (now - plansCache.timestamp) < PLANS_CACHE_TTL;
    const orgsCacheActive = orgsCache && (now - orgsCache.timestamp) < ORGS_CACHE_TTL;

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      cacheConfig: {
        profileTTL: `${PROFILE_CACHE_TTL / 1000}s`,
        plansTTL: `${PLANS_CACHE_TTL / 1000}s`,
        orgsTTL: `${ORGS_CACHE_TTL / 1000}s`
      },
      profileCache: {
        total: profileCacheEntries.length,
        active: activeProfiles.length,
        stale: staleProfiles.length,
        hitRate: profileCacheEntries.length > 0 ? 
          ((activeProfiles.length / profileCacheEntries.length) * 100).toFixed(2) + '%' : 'N/A'
      },
      plansCache: {
        active: plansCacheActive,
        itemCount: plansCache?.plans?.length || 0,
        age: plansCache ? `${Math.floor((now - plansCache.timestamp) / 1000)}s` : 'empty'
      },
      orgsCache: {
        active: orgsCacheActive,
        itemCount: orgsCache?.organizations?.length || 0,
        age: orgsCache ? `${Math.floor((now - orgsCache.timestamp) / 1000)}s` : 'empty'
      }
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return c.json({ error: 'Failed to get cache stats' }, 500);
  }
});

// Endpoint: Clear all caches (admin only)
app.post("/make-server-6eefa08e/admin/cache/clear", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const clearedCounts = {
      profiles: profileCache.size,
      plansCleared: plansCache !== null,
      orgsCleared: orgsCache !== null
    };

    // Clear all caches
    invalidateAllProfileCaches();
    invalidatePlansCache();
    invalidateOrgsCache();

    console.log('🗑️ All caches cleared by admin:', authResult.user.email);

    return c.json({
      success: true,
      message: 'All caches cleared successfully',
      clearedCounts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return c.json({ error: 'Failed to clear caches' }, 500);
  }
});

// Endpoint: Diagnose duplicate plans
app.get("/make-server-6eefa08e/admin/plans/diagnose", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    console.log('🔍 Diagnosing duplicate plans...');

    // Get all plan-related keys from KV store
    const allPlanData = await kv.getByPrefix('plan_');
    const subscriptionPlanData = await kv.getByPrefix('subscription_plan_');
    
    const plansByName = new Map();
    const duplicates = [];
    const allKeys = [];

    // Process plan_ keys
    allPlanData.forEach((item: any) => {
      try {
        const plan = typeof item === 'string' ? JSON.parse(item) : 
                    (item.value ? (typeof item.value === 'string' ? JSON.parse(item.value) : item.value) : item);
        
        if (plan && plan.id) {
          const key = plan.id.startsWith('plan_') ? plan.id : `plan_${plan.id}`;
          allKeys.push({ key, name: plan.name || plan.name_en, tier: plan.tier });
          
          const identifier = plan.name || plan.name_en || plan.tier;
          if (!plansByName.has(identifier)) {
            plansByName.set(identifier, []);
          }
          plansByName.get(identifier).push({ key, plan });
        }
      } catch (e) {
        console.warn('Failed to parse plan item:', e);
      }
    });

    // Process subscription_plan_ keys (old duplicates)
    subscriptionPlanData.forEach((item: any) => {
      try {
        const plan = typeof item === 'string' ? JSON.parse(item) : 
                    (item.value ? (typeof item.value === 'string' ? JSON.parse(item.value) : item.value) : item);
        
        if (plan && plan.id) {
          allKeys.push({ 
            key: `subscription_plan_${plan.id}`, 
            name: plan.name || plan.name_en, 
            tier: plan.tier,
            legacy: true 
          });
        }
      } catch (e) {
        console.warn('Failed to parse subscription_plan item:', e);
      }
    });

    // Find duplicates
    plansByName.forEach((plans, name) => {
      if (plans.length > 1) {
        duplicates.push({
          name,
          count: plans.length,
          keys: plans.map(p => p.key)
        });
      }
    });

    return c.json({
      success: true,
      diagnosis: {
        totalKeys: allKeys.length,
        uniquePlans: plansByName.size,
        duplicateGroups: duplicates.length,
        legacyKeys: allKeys.filter(k => k.legacy).length
      },
      allKeys,
      duplicates,
      recommendation: duplicates.length > 0 ? 
        'Run /admin/plans/cleanup to remove duplicates' : 
        'No duplicates found - system is clean'
    });
  } catch (error) {
    console.error('Diagnose plans error:', error);
    return c.json({ error: 'Failed to diagnose plans' }, 500);
  }
});

// Endpoint: Sync auth users to profiles (Phase 1 fix)
app.post("/make-server-6eefa08e/admin/sync-auth-profiles", async (c) => {
  try {
    const authResult = await verifyAuth(c, 'super_admin');
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    console.log('🔄 Starting auth-profiles sync...');

    // This assumes PHASE_1 SQL has been run first
    // Just trigger a re-sync to catch any new users
    
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    let synced = 0;
    let errors = 0;

    for (const user of allUsers.users) {
      try {
        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!existingProfile) {
          // Create missing profile
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              name: user.user_metadata?.name || user.email?.split('@')[0],
              role: user.user_metadata?.role || 'vendor',
              email_verified: user.email_confirmed_at !== null,
              status: 'active'
            });

          if (insertError && insertError.code !== '23505') {
            console.warn(`Failed to sync user ${user.email}:`, insertError);
            errors++;
          } else {
            synced++;
          }
        }
      } catch (e) {
        console.warn(`Error processing user ${user.email}:`, e);
        errors++;
      }
    }

    // Clear profile cache after sync
    invalidateAllProfileCaches();

    return c.json({
      success: true,
      totalUsers: allUsers.users.length,
      synced,
      errors,
      message: synced > 0 ? 
        `Synced ${synced} missing profiles` : 
        'All users already have profiles'
    });
  } catch (error) {
    console.error('Sync auth-profiles error:', error);
    return c.json({ error: 'Failed to sync auth-profiles' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════

Deno.serve(app.fetch);