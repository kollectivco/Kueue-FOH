import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export function registerReservationRoutes(app: Hono, verifyAuth: any) {
  
  // ===== RESERVATIONS =====
  
  // Get all reservations for organization
  app.get("/make-server-6eefa08e/reservations", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const reservationsData = await kv.getByPrefix(`reservation_${orgId}_`);
      const reservations = reservationsData.map(r => JSON.parse(r));

      return c.json({ reservations });
    } catch (error) {
      console.log('Get reservations error:', error);
      return c.json({ error: 'Failed to fetch reservations' }, 500);
    }
  });

  // Create reservation (can be public or authenticated)
  app.post("/make-server-6eefa08e/reservations", async (c) => {
    try {
      const reservationData = await c.req.json();
      const reservationId = crypto.randomUUID();
      
      // Try to get org from auth, fallback to provided organizationId
      let orgId = reservationData.organizationId || 'demo-org';
      try {
        const authResult = await verifyAuth(c);
        if (!authResult.error) {
          orgId = authResult.profile?.orgId || authResult.profile?.organizationId || orgId;
        }
      } catch (e) {
        // Not authenticated - use provided orgId
      }

      const reservation = {
        id: reservationId,
        organizationId: orgId,
        ...reservationData,
        status: reservationData.status || 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`reservation_${orgId}_${reservationId}`, JSON.stringify(reservation));

      return c.json({ reservation });
    } catch (error) {
      console.log('Create reservation error:', error);
      return c.json({ error: 'Failed to create reservation' }, 500);
    }
  });

  // Update reservation
  app.put("/make-server-6eefa08e/reservations/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const reservationId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const reservationData = await kv.get(`reservation_${orgId}_${reservationId}`);
      if (!reservationData) {
        return c.json({ error: 'Reservation not found' }, 404);
      }

      const reservation = JSON.parse(reservationData);
      const updatedReservation = {
        ...reservation,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`reservation_${orgId}_${reservationId}`, JSON.stringify(updatedReservation));

      return c.json({ reservation: updatedReservation });
    } catch (error) {
      console.log('Update reservation error:', error);
      return c.json({ error: 'Failed to update reservation' }, 500);
    }
  });

  // Delete reservation
  app.delete("/make-server-6eefa08e/reservations/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const reservationId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`reservation_${orgId}_${reservationId}`);

      return c.json({ message: 'Reservation deleted successfully' });
    } catch (error) {
      console.log('Delete reservation error:', error);
      return c.json({ error: 'Failed to delete reservation' }, 500);
    }
  });

  // ===== WAITLIST =====

  // Get waitlist entries
  app.get("/make-server-6eefa08e/waitlist", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const waitlistData = await kv.getByPrefix(`waitlist_${orgId}_`);
      const waitlist = waitlistData.map(w => JSON.parse(w));

      return c.json({ waitlist });
    } catch (error) {
      console.log('Get waitlist error:', error);
      return c.json({ error: 'Failed to fetch waitlist' }, 500);
    }
  });

  // Create waitlist entry (public)
  app.post("/make-server-6eefa08e/waitlist", async (c) => {
    try {
      const entryData = await c.req.json();
      const entryId = crypto.randomUUID();
      
      let orgId = entryData.organizationId || 'demo-org';
      try {
        const authResult = await verifyAuth(c);
        if (!authResult.error) {
          orgId = authResult.profile?.orgId || authResult.profile?.organizationId || orgId;
        }
      } catch (e) {
        // Not authenticated
      }

      const entry = {
        id: entryId,
        organizationId: orgId,
        ...entryData,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`waitlist_${orgId}_${entryId}`, JSON.stringify(entry));

      return c.json({ entry });
    } catch (error) {
      console.log('Create waitlist entry error:', error);
      return c.json({ error: 'Failed to create waitlist entry' }, 500);
    }
  });

  // Update waitlist entry
  app.put("/make-server-6eefa08e/waitlist/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const entryId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const entryData = await kv.get(`waitlist_${orgId}_${entryId}`);
      if (!entryData) {
        return c.json({ error: 'Waitlist entry not found' }, 404);
      }

      const entry = JSON.parse(entryData);
      const updatedEntry = {
        ...entry,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`waitlist_${orgId}_${entryId}`, JSON.stringify(updatedEntry));

      return c.json({ entry: updatedEntry });
    } catch (error) {
      console.log('Update waitlist entry error:', error);
      return c.json({ error: 'Failed to update waitlist entry' }, 500);
    }
  });

  // Delete waitlist entry
  app.delete("/make-server-6eefa08e/waitlist/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const entryId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`waitlist_${orgId}_${entryId}`);

      return c.json({ message: 'Waitlist entry deleted successfully' });
    } catch (error) {
      console.log('Delete waitlist entry error:', error);
      return c.json({ error: 'Failed to delete waitlist entry' }, 500);
    }
  });

  // ===== TABLES & FLOOR PLAN =====

  // Get tables
  app.get("/make-server-6eefa08e/tables", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const tablesData = await kv.getByPrefix(`table_${orgId}_`);
      const tables = tablesData.map(t => JSON.parse(t));

      return c.json({ tables });
    } catch (error) {
      console.log('Get tables error:', error);
      return c.json({ error: 'Failed to fetch tables' }, 500);
    }
  });

  // Create table
  app.post("/make-server-6eefa08e/tables", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const tableData = await c.req.json();
      const tableId = crypto.randomUUID();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const table = {
        id: tableId,
        organizationId: orgId,
        ...tableData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`table_${orgId}_${tableId}`, JSON.stringify(table));

      return c.json({ table });
    } catch (error) {
      console.log('Create table error:', error);
      return c.json({ error: 'Failed to create table' }, 500);
    }
  });

  // Update table
  app.put("/make-server-6eefa08e/tables/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const tableId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const tableData = await kv.get(`table_${orgId}_${tableId}`);
      if (!tableData) {
        return c.json({ error: 'Table not found' }, 404);
      }

      const table = JSON.parse(tableData);
      const updatedTable = {
        ...table,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`table_${orgId}_${tableId}`, JSON.stringify(updatedTable));

      return c.json({ table: updatedTable });
    } catch (error) {
      console.log('Update table error:', error);
      return c.json({ error: 'Failed to update table' }, 500);
    }
  });

  // Delete table
  app.delete("/make-server-6eefa08e/tables/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const tableId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`table_${orgId}_${tableId}`);

      return c.json({ message: 'Table deleted successfully' });
    } catch (error) {
      console.log('Delete table error:', error);
      return c.json({ error: 'Failed to delete table' }, 500);
    }
  });

  // Get zones
  app.get("/make-server-6eefa08e/zones", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const zonesData = await kv.getByPrefix(`zone_${orgId}_`);
      const zones = zonesData.map(z => JSON.parse(z));

      return c.json({ zones });
    } catch (error) {
      console.log('Get zones error:', error);
      return c.json({ error: 'Failed to fetch zones' }, 500);
    }
  });

  // Create zone
  app.post("/make-server-6eefa08e/zones", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const zoneData = await c.req.json();
      const zoneId = crypto.randomUUID();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const zone = {
        id: zoneId,
        organizationId: orgId,
        ...zoneData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`zone_${orgId}_${zoneId}`, JSON.stringify(zone));

      return c.json({ zone });
    } catch (error) {
      console.log('Create zone error:', error);
      return c.json({ error: 'Failed to create zone' }, 500);
    }
  });

  // Update zone
  app.put("/make-server-6eefa08e/zones/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const zoneId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const zoneData = await kv.get(`zone_${orgId}_${zoneId}`);
      if (!zoneData) {
        return c.json({ error: 'Zone not found' }, 404);
      }

      const zone = JSON.parse(zoneData);
      const updatedZone = {
        ...zone,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`zone_${orgId}_${zoneId}`, JSON.stringify(updatedZone));

      return c.json({ zone: updatedZone });
    } catch (error) {
      console.log('Update zone error:', error);
      return c.json({ error: 'Failed to update zone' }, 500);
    }
  });

  // Delete zone
  app.delete("/make-server-6eefa08e/zones/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const zoneId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`zone_${orgId}_${zoneId}`);

      return c.json({ message: 'Zone deleted successfully' });
    } catch (error) {
      console.log('Delete zone error:', error);
      return c.json({ error: 'Failed to delete zone' }, 500);
    }
  });
}