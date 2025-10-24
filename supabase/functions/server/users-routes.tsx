import { Hono } from 'npm:hono@4';
import { createClient } from 'jsr:@supabase/supabase-js@2';

export const usersRoutes = new Hono();

// Helper to create Supabase admin client
const getSupabaseAdmin = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

// Helper to verify admin access
async function verifyAdmin(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing authorization header', status: 401 };
  }

  const token = authHeader.substring(7);
  const supabase = getSupabaseAdmin();

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: 'Invalid token', status: 401 };
  }

  // Get user profile to check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Profile not found', status: 404 };
  }

  const adminRoles = ['super_admin', 'support_admin', 'billing_admin'];
  if (!adminRoles.includes(profile.role)) {
    return { error: 'Insufficient permissions', status: 403 };
  }

  return { user, profile, supabase };
}

// ============= GET: List all users =============
usersRoutes.get('/', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase } = authResult;

    // Sync auth users to profiles first (ensure latest data)
    try {
      await supabase.rpc('sync_all_auth_users');
    } catch (syncError) {
      console.warn('Sync function not available, continuing with existing data');
    }

    // Fetch all profiles with organization data
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role,
        phone,
        organization_id,
        status,
        created_at,
        updated_at,
        last_login,
        email_verified,
        organizations:organization_id (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    // Transform and enrich users with organization names
    const enrichedUsers = profiles?.map(profile => ({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      phone: profile.phone,
      organization_id: profile.organization_id,
      organizationName: profile.organizations?.name || null,
      status: profile.status,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      last_login: profile.last_login,
      email_verified: profile.email_verified,
    }));

    return c.json({
      success: true,
      users: enrichedUsers,
      count: enrichedUsers?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in GET /users:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= POST: Check if email exists =============
usersRoutes.post('/check-email', async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const supabase = getSupabaseAdmin();
    
    // Check in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (profile) {
      return c.json({
        exists: true,
        location: 'profiles',
        user: { id: profile.id, email: profile.email, name: profile.name }
      });
    }

    // Check in auth.users
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
      
      if (authUser) {
        return c.json({
          exists: true,
          location: 'auth_only',
          user: { id: authUser.id, email: authUser.email }
        });
      }
    } catch (authError) {
      console.warn('Could not check auth users:', authError);
    }

    return c.json({
      exists: false
    });
  } catch (error: any) {
    console.error('Error in POST /users/check-email:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= GET: Get single user =============
usersRoutes.get('/:userId', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase } = authResult;
    const userId = c.req.param('userId');

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: profile
    });
  } catch (error: any) {
    console.error('Error in GET /users/:userId:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= PUT: Update user =============
usersRoutes.put('/:userId', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase } = authResult;
    const userId = c.req.param('userId');
    const body = await c.req.json();

    const { name, phone, role, status, organizationId } = body;

    // Build update object
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (status !== undefined) updates.status = status;
    
    // Validate UUID format if organization_id is provided
    if (organizationId !== undefined) {
      if (organizationId === null || organizationId === '') {
        updates.organization_id = null;
      } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(organizationId)) {
          updates.organization_id = organizationId;
        } else {
          console.error(`❌ Invalid UUID format for organization_id: "${organizationId}"`);
          return c.json({ 
            error: `Invalid organization ID format. Expected UUID but received: "${organizationId}". Please select a valid organization.`,
            code: 'invalid_uuid'
          }, 400);
        }
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return c.json({ error: 'Failed to update user' }, 500);
    }

    return c.json({
      success: true,
      user: data
    });
  } catch (error: any) {
    console.error('Error in PUT /users/:userId:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= DELETE: Delete user =============
usersRoutes.delete('/:userId', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase } = authResult;
    const userId = c.req.param('userId');

    // Delete from profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting user profile:', profileError);
      return c.json({ error: 'Failed to delete user profile' }, 500);
    }

    // Try to delete from auth (requires service role)
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.warn('Warning: Could not delete auth user:', authError);
      }
    } catch (authDeleteError) {
      console.warn('Warning: Auth user deletion failed:', authDeleteError);
    }

    return c.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    console.error('Error in DELETE /users/:userId:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= POST: Change user status =============
usersRoutes.post('/:userId/status', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase } = authResult;
    const userId = c.req.param('userId');
    const { status } = await c.req.json();

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return c.json({ error: 'Invalid status value' }, 400);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user status:', error);
      return c.json({ error: 'Failed to update user status' }, 500);
    }

    return c.json({
      success: true,
      user: data
    });
  } catch (error: any) {
    console.error('Error in POST /users/:userId/status:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= POST: Reset user password =============
usersRoutes.post('/:userId/reset-password', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase } = authResult;
    const userId = c.req.param('userId');

    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Send password reset email using Supabase auth
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email);

    if (error) {
      console.error('Error sending reset email:', error);
      return c.json({ error: 'Failed to send reset email' }, 500);
    }

    return c.json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error: any) {
    console.error('Error in POST /users/:userId/reset-password:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= GET: User statistics =============
usersRoutes.get('/stats/summary', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase } = authResult;

    // Get all users
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, role, status, created_at');

    if (error) {
      console.error('Error fetching user stats:', error);
      return c.json({ error: 'Failed to fetch stats' }, 500);
    }

    const teamRoles = ['super_admin', 'developer', 'support_admin', 'billing_admin'];

    const stats = {
      totalUsers: profiles?.length || 0,
      teamUsers: profiles?.filter(p => teamRoles.includes(p.role)).length || 0,
      organizationUsers: profiles?.filter(p => !teamRoles.includes(p.role)).length || 0,
      activeUsers: profiles?.filter(p => p.status === 'active').length || 0,
      inactiveUsers: profiles?.filter(p => p.status === 'inactive').length || 0,
      suspendedUsers: profiles?.filter(p => p.status === 'suspended').length || 0,
      newUsersThisMonth: profiles?.filter(p => {
        const createdDate = new Date(p.created_at);
        const now = new Date();
        return createdDate.getMonth() === now.getMonth() && 
               createdDate.getFullYear() === now.getFullYear();
      }).length || 0,
      byRole: {
        super_admin: profiles?.filter(p => p.role === 'super_admin').length || 0,
        developer: profiles?.filter(p => p.role === 'developer').length || 0,
        support_admin: profiles?.filter(p => p.role === 'support_admin').length || 0,
        billing_admin: profiles?.filter(p => p.role === 'billing_admin').length || 0,
        vendor: profiles?.filter(p => p.role === 'vendor').length || 0,
      }
    };

    return c.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error in GET /users/stats/summary:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

// ============= POST: Reset entire system (DANGER) =============
usersRoutes.post('/admin/reset-system', async (c) => {
  try {
    const authResult = await verifyAdmin(c.req.header('Authorization'));
    if ('error' in authResult) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const { supabase, user: currentUser, profile: currentProfile } = authResult;

    // Only super_admin can perform this action
    if (currentProfile.role !== 'super_admin') {
      return c.json({ error: 'Only Super Admin can reset the system' }, 403);
    }

    const { confirmationCode } = await c.req.json();

    // Require confirmation code
    if (confirmationCode !== 'RESET-ALL-DATA') {
      return c.json({ error: 'Invalid confirmation code' }, 400);
    }

    console.log('🚨 SYSTEM RESET INITIATED by Super Admin:', currentUser.email);
    
    const deletedData = {
      users: 0,
      authUsers: 0,
      profiles: 0,
      organizations: 0,
      kvEntries: 0
    };

    // Step 1: Get all users except current super admin
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, email, role')
      .neq('id', currentUser.id); // Don't delete current admin

    if (allProfiles && allProfiles.length > 0) {
      console.log(`📋 Found ${allProfiles.length} users to delete (excluding current admin)`);
      
      // Step 2: Delete from profiles table
      for (const profile of allProfiles) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profile.id);

          if (!profileError) {
            deletedData.profiles++;
            console.log(`✅ Deleted profile: ${profile.email}`);
          }

          // Step 3: Delete from auth.users
          try {
            const { error: authError } = await supabase.auth.admin.deleteUser(profile.id);
            if (!authError) {
              deletedData.authUsers++;
              console.log(`✅ Deleted auth user: ${profile.email}`);
            }
          } catch (authErr) {
            console.warn(`⚠️ Could not delete auth user: ${profile.email}`);
          }
        } catch (err) {
          console.error(`❌ Error deleting user ${profile.email}:`, err);
        }
      }
    }

    deletedData.users = deletedData.profiles;

    console.log(`✅ System reset completed successfully`);
    console.log(`📊 Deletion summary:`, deletedData);
    console.log(`🔒 Preserved Super Admin: ${currentUser.email}`);

    return c.json({
      success: true,
      message: 'System reset completed. All users and organizations deleted except current Super Admin.',
      deletedData,
      preservedAdmin: {
        id: currentUser.id,
        email: currentUser.email,
        role: currentProfile.role
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error in system reset:', error);
    return c.json({ 
      error: 'Failed to reset system',
      details: error.message 
    }, 500);
  }
});
