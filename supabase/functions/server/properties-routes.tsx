/**
 * Property Management Routes
 * Handles CRUD operations for properties with KV store and admin user creation
 */

import { Hono } from 'npm:hono@4';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const propertiesRouter = new Hono();

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const KV_PREFIX = 'property:';

// Helper function to get all properties
async function getAllProperties() {
  try {
    const properties = await kv.getByPrefix(KV_PREFIX);
    return properties.map(p => p.value).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error loading properties:', error);
    return [];
  }
}

// GET /properties - List all properties
propertiesRouter.get('/', async (c) => {
  try {
    const properties = await getAllProperties();
    
    return c.json({
      success: true,
      properties,
      count: properties.length,
    });
  } catch (error: any) {
    console.error('Error fetching properties:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch properties',
      message: error.message
    }, 500);
  }
});

// GET /properties/:id - Get single property
propertiesRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const property = await kv.get(`${KV_PREFIX}${id}`);
    
    if (!property) {
      return c.json({
        success: false,
        error: 'Property not found',
      }, 404);
    }
    
    return c.json({
      success: true,
      property,
    });
  } catch (error: any) {
    console.error('Error fetching property:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch property',
      message: error.message
    }, 500);
  }
});

// POST /properties - Create new property (with optional admin user creation)
propertiesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { adminUserEmail, adminUserPassword, adminUserName, ...propertyData } = body;
    
    const property = {
      ...propertyData,
      createdAt: propertyData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Validate required fields
    if (!property.id || !property.propertyCode || !property.name) {
      return c.json({
        success: false,
        error: 'Missing required fields: id, propertyCode, name',
      }, 400);
    }
    
    // Check if property code is unique
    const existingProperties = await getAllProperties();
    const codeExists = existingProperties.some(
      p => p.propertyCode.toLowerCase() === property.propertyCode.toLowerCase()
    );
    
    if (codeExists) {
      return c.json({
        success: false,
        error: 'Property code already exists',
      }, 409);
    }
    
    // Create admin user if credentials provided
    let adminUserId = null;
    if (adminUserEmail && adminUserPassword) {
      try {
        console.log('📝 Creating property admin user:', adminUserEmail);
        
        const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
          email: adminUserEmail,
          password: adminUserPassword,
          user_metadata: {
            name: adminUserName || property.name + ' Admin',
            role: 'property_admin',
            propertyId: property.id,
            propertyCode: property.propertyCode,
          },
          email_confirm: true, // Auto-confirm email since email server isn't configured
        });

        if (adminError) {
          console.error('❌ Failed to create admin user:', adminError);
          return c.json({
            success: false,
            error: 'Failed to create property admin user: ' + adminError.message,
          }, 400);
        }

        if (adminData.user) {
          adminUserId = adminData.user.id;
          property.adminUserId = adminUserId;
          property.adminUserEmail = adminUserEmail;
          property.adminUserName = adminUserName || property.name + ' Admin';
          
          console.log('✅ Property admin user created:', adminUserId);
        }
      } catch (error: any) {
        console.error('❌ Error creating admin user:', error);
        return c.json({
          success: false,
          error: 'Failed to create admin user: ' + error.message,
        }, 500);
      }
    }
    
    // Save property
    await kv.set(`${KV_PREFIX}${property.id}`, property);
    
    console.log('✅ Property created:', property.propertyCode);
    
    return c.json({
      success: true,
      property,
      adminUserId,
      message: adminUserId 
        ? 'Property and admin user created successfully' 
        : 'Property created successfully',
    }, 201);
  } catch (error: any) {
    console.error('Error creating property:', error);
    return c.json({
      success: false,
      error: 'Failed to create property',
      message: error.message
    }, 500);
  }
});

// PUT /properties/:id - Update property
propertiesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Get existing property
    const existing = await kv.get(`${KV_PREFIX}${id}`);
    
    if (!existing) {
      return c.json({
        success: false,
        error: 'Property not found',
      }, 404);
    }
    
    // Merge with existing, keeping propertyCode and createdAt
    const updatedProperty = {
      ...existing,
      ...body,
      id: existing.id, // Keep original ID
      propertyCode: existing.propertyCode, // Don't allow code change
      createdAt: existing.createdAt, // Keep original creation date
      updatedAt: new Date().toISOString(),
    };
    
    // Save updated property
    await kv.set(`${KV_PREFIX}${id}`, updatedProperty);
    
    console.log('✅ Property updated:', updatedProperty.propertyCode);
    
    return c.json({
      success: true,
      property: updatedProperty,
      message: 'Property updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating property:', error);
    return c.json({
      success: false,
      error: 'Failed to update property',
      message: error.message
    }, 500);
  }
});

// DELETE /properties/:id - Delete property
propertiesRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Check if property exists
    const existing = await kv.get(`${KV_PREFIX}${id}`);
    
    if (!existing) {
      return c.json({
        success: false,
        error: 'Property not found',
      }, 404);
    }
    
    // Delete property
    await kv.del(`${KV_PREFIX}${id}`);
    
    console.log('✅ Property deleted:', existing.propertyCode);
    
    return c.json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting property:', error);
    return c.json({
      success: false,
      error: 'Failed to delete property',
      message: error.message
    }, 500);
  }
});

// GET /properties/by-code/:code - Get property by code
propertiesRouter.get('/by-code/:code', async (c) => {
  try {
    const code = c.req.param('code');
    const properties = await getAllProperties();
    
    const property = properties.find(
      p => p.propertyCode.toLowerCase() === code.toLowerCase()
    );
    
    if (!property) {
      return c.json({
        success: false,
        error: 'Property not found',
      }, 404);
    }
    
    return c.json({
      success: true,
      property,
    });
  } catch (error: any) {
    console.error('Error fetching property by code:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch property',
      message: error.message
    }, 500);
  }
});

// GET /properties/by-slug/:slug - Get property by slug
propertiesRouter.get('/by-slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const properties = await getAllProperties();
    
    const property = properties.find(
      p => p.slug.toLowerCase() === slug.toLowerCase()
    );
    
    if (!property) {
      return c.json({
        success: false,
        error: 'Property not found',
      }, 404);
    }
    
    return c.json({
      success: true,
      property,
    });
  } catch (error: any) {
    console.error('Error fetching property by slug:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch property',
      message: error.message
    }, 500);
  }
});

// POST /properties/validate-code - Validate property code uniqueness
propertiesRouter.post('/validate-code', async (c) => {
  try {
    const { code, excludeId } = await c.req.json();
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Code is required',
      }, 400);
    }
    
    const properties = await getAllProperties();
    const codeExists = properties.some(
      p => p.propertyCode.toLowerCase() === code.toLowerCase() && 
           p.id !== excludeId
    );
    
    return c.json({
      success: true,
      isUnique: !codeExists,
      code,
    });
  } catch (error: any) {
    console.error('Error validating property code:', error);
    return c.json({
      success: false,
      error: 'Failed to validate code',
      message: error.message
    }, 500);
  }
});

// GET /properties/:id/stats - Get property statistics
propertiesRouter.get('/:id/stats', async (c) => {
  try {
    const propertyId = c.req.param('id');
    
    // Get property
    const property = await kv.get(`${KV_PREFIX}${propertyId}`);
    
    if (!property) {
      return c.json({
        success: false,
        error: 'Property not found',
      }, 404);
    }
    
    // Get users count from profiles table (use vendor_id for backward compatibility)
    const { data: allUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, status, created_at, vendor_id')
      .eq('vendor_id', propertyId);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      // Return zeros if profiles table doesn't exist
      return c.json({
        success: true,
        stats: {
          totalUsers: 0,
          activeUsers: 0,
          usersTrend: 'No users yet',
          monthlyRevenue: 0.00,
          revenueTrend: '+0% vs last month',
          totalSales: 0.00,
          todaySales: 0.00,
          thisWeekSales: 0.00,
        },
      });
    }
    
    const users = allUsers || [];
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    
    // Calculate users added this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const usersThisWeek = users.filter(u => new Date(u.created_at) >= oneWeekAgo).length;
    
    const usersTrend = usersThisWeek > 0 
      ? `+${usersThisWeek} this week`
      : 'No new users this week';
    
    // TODO: Add revenue and sales data from reservations/orders when implemented
    const stats = {
      totalUsers,
      activeUsers,
      usersTrend,
      monthlyRevenue: 0.00,
      revenueTrend: '+0% vs last month',
      totalSales: 0.00,
      todaySales: 0.00,
      thisWeekSales: 0.00,
    };
    
    return c.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching property stats:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch property stats',
      message: error.message
    }, 500);
  }
});

export { propertiesRouter };
