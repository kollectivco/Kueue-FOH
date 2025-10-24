import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

// Seed default data for organization
async function seedDefaultMenuData(orgId: string) {
  try {
    // Check if already seeded
    const existing = await kv.get(`menu_seeded_${orgId}`);
    if (existing) {
      return;
    }

    // Create default categories
    const categories = [
      { id: crypto.randomUUID(), name: 'Burger', nameAr: 'برجر', active: true, displayOrder: 1 },
      { id: crypto.randomUUID(), name: 'Pizza', nameAr: 'بيتزا', active: true, displayOrder: 2 },
      { id: crypto.randomUUID(), name: 'Beverage', nameAr: 'مشروبات', active: true, displayOrder: 3 },
      { id: crypto.randomUUID(), name: 'Dessert', nameAr: 'حلويات', active: true, displayOrder: 4 },
    ];

    for (const cat of categories) {
      const category = {
        ...cat,
        organizationId: orgId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await kv.set(`category_${orgId}_${cat.id}`, JSON.stringify(category));
    }

    // Create default menu
    const menuId = crypto.randomUUID();
    const menu = {
      id: menuId,
      name: 'Main Menu',
      nameAr: 'القائمة الرئيسية',
      description: 'Our delicious menu items',
      descriptionAr: 'أطباقنا الشهية',
      organizationId: orgId,
      active: true,
      categories: categories.map(c => c.id),
      displayOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await kv.set(`menu_${orgId}_${menuId}`, JSON.stringify(menu));

    // Mark as seeded
    await kv.set(`menu_seeded_${orgId}`, 'true');
    console.log(`Seeded default menu data for organization ${orgId}`);
  } catch (error) {
    console.log('Error seeding menu data:', error);
  }
}

export function registerDigitalMenuRoutes(app: Hono, verifyAuth: any) {
  
  // ===== MENUS =====
  
  // Get all menus for organization
  app.get("/make-server-6eefa08e/digital-menu/menus", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      
      // Seed default data if needed
      await seedDefaultMenuData(orgId);
      
      const menusData = await kv.getByPrefix(`menu_${orgId}_`);
      const menus = menusData.map(m => JSON.parse(m));

      return c.json({ menus });
    } catch (error) {
      console.log('Get menus error:', error);
      return c.json({ error: 'Failed to fetch menus' }, 500);
    }
  });

  // Create menu
  app.post("/make-server-6eefa08e/digital-menu/menus", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const menuData = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const menuId = crypto.randomUUID();

      const menu = {
        id: menuId,
        organizationId: orgId,
        ...menuData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`menu_${orgId}_${menuId}`, JSON.stringify(menu));

      return c.json({ menu });
    } catch (error) {
      console.log('Create menu error:', error);
      return c.json({ error: 'Failed to create menu' }, 500);
    }
  });

  // Update menu
  app.put("/make-server-6eefa08e/digital-menu/menus/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const menuId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const menuData = await kv.get(`menu_${orgId}_${menuId}`);
      if (!menuData) {
        return c.json({ error: 'Menu not found' }, 404);
      }

      const menu = JSON.parse(menuData);
      const updatedMenu = {
        ...menu,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`menu_${orgId}_${menuId}`, JSON.stringify(updatedMenu));

      return c.json({ menu: updatedMenu });
    } catch (error) {
      console.log('Update menu error:', error);
      return c.json({ error: 'Failed to update menu' }, 500);
    }
  });

  // Delete menu
  app.delete("/make-server-6eefa08e/digital-menu/menus/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const menuId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`menu_${orgId}_${menuId}`);

      return c.json({ message: 'Menu deleted successfully' });
    } catch (error) {
      console.log('Delete menu error:', error);
      return c.json({ error: 'Failed to delete menu' }, 500);
    }
  });

  // ===== CATEGORIES =====

  // Get all categories
  app.get("/make-server-6eefa08e/digital-menu/categories", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const categoriesData = await kv.getByPrefix(`category_${orgId}_`);
      const categories = categoriesData.map(cat => JSON.parse(cat));

      return c.json({ categories });
    } catch (error) {
      console.log('Get categories error:', error);
      return c.json({ error: 'Failed to fetch categories' }, 500);
    }
  });

  // Create category
  app.post("/make-server-6eefa08e/digital-menu/categories", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const categoryData = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const categoryId = crypto.randomUUID();

      const category = {
        id: categoryId,
        organizationId: orgId,
        ...categoryData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`category_${orgId}_${categoryId}`, JSON.stringify(category));

      return c.json({ category });
    } catch (error) {
      console.log('Create category error:', error);
      return c.json({ error: 'Failed to create category' }, 500);
    }
  });

  // Update category
  app.put("/make-server-6eefa08e/digital-menu/categories/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const categoryId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const categoryData = await kv.get(`category_${orgId}_${categoryId}`);
      if (!categoryData) {
        return c.json({ error: 'Category not found' }, 404);
      }

      const category = JSON.parse(categoryData);
      const updatedCategory = {
        ...category,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`category_${orgId}_${categoryId}`, JSON.stringify(updatedCategory));

      return c.json({ category: updatedCategory });
    } catch (error) {
      console.log('Update category error:', error);
      return c.json({ error: 'Failed to update category' }, 500);
    }
  });

  // Delete category
  app.delete("/make-server-6eefa08e/digital-menu/categories/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const categoryId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`category_${orgId}_${categoryId}`);

      return c.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.log('Delete category error:', error);
      return c.json({ error: 'Failed to delete category' }, 500);
    }
  });

  // ===== MENU ITEMS =====

  // Get all menu items
  app.get("/make-server-6eefa08e/digital-menu/items", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const itemsData = await kv.getByPrefix(`menuitem_${orgId}_`);
      const items = itemsData.map(item => JSON.parse(item));

      return c.json({ items });
    } catch (error) {
      console.log('Get menu items error:', error);
      return c.json({ error: 'Failed to fetch menu items' }, 500);
    }
  });

  // Create menu item
  app.post("/make-server-6eefa08e/digital-menu/items", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const itemData = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const itemId = crypto.randomUUID();

      const item = {
        id: itemId,
        organizationId: orgId,
        ...itemData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`menuitem_${orgId}_${itemId}`, JSON.stringify(item));

      return c.json({ item });
    } catch (error) {
      console.log('Create menu item error:', error);
      return c.json({ error: 'Failed to create menu item' }, 500);
    }
  });

  // Update menu item
  app.put("/make-server-6eefa08e/digital-menu/items/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const itemId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const itemData = await kv.get(`menuitem_${orgId}_${itemId}`);
      if (!itemData) {
        return c.json({ error: 'Menu item not found' }, 404);
      }

      const item = JSON.parse(itemData);
      const updatedItem = {
        ...item,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`menuitem_${orgId}_${itemId}`, JSON.stringify(updatedItem));

      return c.json({ item: updatedItem });
    } catch (error) {
      console.log('Update menu item error:', error);
      return c.json({ error: 'Failed to update menu item' }, 500);
    }
  });

  // Delete menu item
  app.delete("/make-server-6eefa08e/digital-menu/items/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const itemId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`menuitem_${orgId}_${itemId}`);

      return c.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
      console.log('Delete menu item error:', error);
      return c.json({ error: 'Failed to delete menu item' }, 500);
    }
  });

  // ===== QR LINKS =====

  // Generate QR link
  app.post("/make-server-6eefa08e/digital-menu/qr-links", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const { menuId, tableId, tableNumber, hidePrices } = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      
      const signature = `qr-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const linkId = crypto.randomUUID();

      const qrLink = {
        id: linkId,
        signature,
        menuId,
        tableId,
        tableNumber,
        hidePrices: hidePrices || false,
        active: true,
        organizationId: orgId,
        createdAt: new Date().toISOString()
      };

      await kv.set(`qrlink_${orgId}_${linkId}`, JSON.stringify(qrLink));
      await kv.set(`qrsig_${signature}`, JSON.stringify(qrLink));

      return c.json({ qrLink });
    } catch (error) {
      console.log('Generate QR link error:', error);
      return c.json({ error: 'Failed to generate QR link' }, 500);
    }
  });

  // Get QR links
  app.get("/make-server-6eefa08e/digital-menu/qr-links", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const linksData = await kv.getByPrefix(`qrlink_${orgId}_`);
      const links = linksData.map(link => JSON.parse(link));

      return c.json({ links });
    } catch (error) {
      console.log('Get QR links error:', error);
      return c.json({ error: 'Failed to fetch QR links' }, 500);
    }
  });

  // Get menu by QR signature (public route - no auth required)
  app.get("/make-server-6eefa08e/digital-menu/public/:signature", async (c) => {
    try {
      const signature = c.req.param('signature');
      
      const qrLinkData = await kv.get(`qrsig_${signature}`);
      if (!qrLinkData) {
        return c.json({ error: 'QR code not found' }, 404);
      }

      const qrLink = JSON.parse(qrLinkData);
      const orgId = qrLink.organizationId;

      // Get menu
      const menuData = await kv.get(`menu_${orgId}_${qrLink.menuId}`);
      const menu = menuData ? JSON.parse(menuData) : null;

      // Get categories
      const categoriesData = await kv.getByPrefix(`category_${orgId}_`);
      const categories = categoriesData.map(cat => JSON.parse(cat)).filter(cat => cat.active);

      // Get menu items
      const itemsData = await kv.getByPrefix(`menuitem_${orgId}_`);
      const items = itemsData.map(item => JSON.parse(item)).filter(item => item.available);

      return c.json({ 
        menu,
        categories,
        items,
        qrLink
      });
    } catch (error) {
      console.log('Get public menu error:', error);
      return c.json({ error: 'Failed to fetch menu' }, 500);
    }
  });

  // ===== ORDERS =====

  // Create order (public route for guests)
  app.post("/make-server-6eefa08e/digital-menu/orders", async (c) => {
    try {
      const orderData = await c.req.json();
      const orderId = crypto.randomUUID();
      const orgId = orderData.organizationId || 'demo-org';

      const order = {
        id: orderId,
        ...orderData,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`order_${orgId}_${orderId}`, JSON.stringify(order));

      return c.json({ order });
    } catch (error) {
      console.log('Create order error:', error);
      return c.json({ error: 'Failed to create order' }, 500);
    }
  });

  // Get orders for organization
  app.get("/make-server-6eefa08e/digital-menu/orders", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const ordersData = await kv.getByPrefix(`order_${orgId}_`);
      const orders = ordersData.map(order => JSON.parse(order));

      return c.json({ orders });
    } catch (error) {
      console.log('Get orders error:', error);
      return c.json({ error: 'Failed to fetch orders' }, 500);
    }
  });

  // Update order status
  app.put("/make-server-6eefa08e/digital-menu/orders/:id/status", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orderId = c.req.param('id');
      const { status, statusNotes } = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const orderData = await kv.get(`order_${orgId}_${orderId}`);
      if (!orderData) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = JSON.parse(orderData);
      const updatedOrder = {
        ...order,
        status,
        statusNotes,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`order_${orgId}_${orderId}`, JSON.stringify(updatedOrder));

      return c.json({ order: updatedOrder });
    } catch (error) {
      console.log('Update order status error:', error);
      return c.json({ error: 'Failed to update order status' }, 500);
    }
  });
}
