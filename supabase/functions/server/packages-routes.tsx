/**
 * Packages Management Routes
 * Handles CRUD operations for subscription packages with KV store
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

const packagesRouter = new Hono();

const KV_PREFIX = 'package:';

// Helper function to get all packages
async function getAllPackages() {
  try {
    const packages = await kv.getByPrefix(KV_PREFIX);
    return packages.map(p => p.value).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error loading packages:', error);
    return [];
  }
}

// GET /packages - List all packages
packagesRouter.get('/', async (c) => {
  try {
    const packages = await getAllPackages();
    
    return c.json({
      success: true,
      packages,
      count: packages.length,
    });
  } catch (error: any) {
    console.error('Error fetching packages:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch packages',
      message: error.message
    }, 500);
  }
});

// GET /packages/:id - Get single package
packagesRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const packageData = await kv.get(`${KV_PREFIX}${id}`);
    
    if (!packageData) {
      return c.json({
        success: false,
        error: 'Package not found',
      }, 404);
    }
    
    return c.json({
      success: true,
      package: packageData,
    });
  } catch (error: any) {
    console.error('Error fetching package:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch package',
      message: error.message
    }, 500);
  }
});

// POST /packages - Create new package
packagesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const packageData = {
      ...body,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Validate required fields
    if (!packageData.id || !packageData.name) {
      return c.json({
        success: false,
        error: 'Missing required fields: id, name',
      }, 400);
    }
    
    // Save package
    await kv.set(`${KV_PREFIX}${packageData.id}`, packageData);
    
    console.log('✅ Package created:', packageData.name);
    
    return c.json({
      success: true,
      package: packageData,
      message: 'Package created successfully',
    }, 201);
  } catch (error: any) {
    console.error('Error creating package:', error);
    return c.json({
      success: false,
      error: 'Failed to create package',
      message: error.message
    }, 500);
  }
});

// PUT /packages/:id - Update package
packagesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Get existing package
    const existing = await kv.get(`${KV_PREFIX}${id}`);
    
    if (!existing) {
      return c.json({
        success: false,
        error: 'Package not found',
      }, 404);
    }
    
    // Merge with existing, keeping createdAt
    const updatedPackage = {
      ...existing,
      ...body,
      id: existing.id, // Keep original ID
      createdAt: existing.createdAt, // Keep original creation date
      updatedAt: new Date().toISOString(),
    };
    
    // Save updated package
    await kv.set(`${KV_PREFIX}${id}`, updatedPackage);
    
    console.log('✅ Package updated:', updatedPackage.name);
    
    return c.json({
      success: true,
      package: updatedPackage,
      message: 'Package updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating package:', error);
    return c.json({
      success: false,
      error: 'Failed to update package',
      message: error.message
    }, 500);
  }
});

// DELETE /packages/:id - Delete package
packagesRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Check if package exists
    const existing = await kv.get(`${KV_PREFIX}${id}`);
    
    if (!existing) {
      return c.json({
        success: false,
        error: 'Package not found',
      }, 404);
    }
    
    // Check if any properties are using this package
    const properties = await kv.getByPrefix('property:');
    const propertiesUsingPackage = properties.filter(
      (p: any) => p.value?.packageId === id
    );
    
    if (propertiesUsingPackage.length > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete package',
        message: `This package is currently assigned to ${propertiesUsingPackage.length} propert${propertiesUsingPackage.length === 1 ? 'y' : 'ies'}`,
        propertiesCount: propertiesUsingPackage.length,
      }, 409);
    }
    
    // Delete package
    await kv.del(`${KV_PREFIX}${id}`);
    
    console.log('✅ Package deleted:', existing.name);
    
    return c.json({
      success: true,
      message: 'Package deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting package:', error);
    return c.json({
      success: false,
      error: 'Failed to delete package',
      message: error.message
    }, 500);
  }
});

// GET /packages/by-category/:category - Get packages by category
packagesRouter.get('/by-category/:category', async (c) => {
  try {
    const category = c.req.param('category');
    const packages = await getAllPackages();
    
    const filteredPackages = packages.filter(
      (p: any) => p.category?.toLowerCase() === category.toLowerCase()
    );
    
    return c.json({
      success: true,
      packages: filteredPackages,
      count: filteredPackages.length,
    });
  } catch (error: any) {
    console.error('Error fetching packages by category:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch packages',
      message: error.message
    }, 500);
  }
});

// GET /packages/active - Get all active packages
packagesRouter.get('/active', async (c) => {
  try {
    const packages = await getAllPackages();
    
    const activePackages = packages.filter(
      (p: any) => p.status === 'active'
    );
    
    return c.json({
      success: true,
      packages: activePackages,
      count: activePackages.length,
    });
  } catch (error: any) {
    console.error('Error fetching active packages:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch packages',
      message: error.message
    }, 500);
  }
});

export { packagesRouter };
