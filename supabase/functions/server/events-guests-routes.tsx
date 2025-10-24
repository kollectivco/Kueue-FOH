import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export function registerEventsAndGuestsRoutes(app: Hono, verifyAuth: any) {
  
  // ===== EVENTS =====
  
  // Get all events
  app.get("/make-server-6eefa08e/events", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const eventsData = await kv.getByPrefix(`event_${orgId}_`);
      const events = eventsData.map(e => JSON.parse(e));

      return c.json({ events });
    } catch (error) {
      console.log('Get events error:', error);
      return c.json({ error: 'Failed to fetch events' }, 500);
    }
  });

  // Get public event by slug (no auth required)
  app.get("/make-server-6eefa08e/events/public/:slug", async (c) => {
    try {
      const slug = c.req.param('slug');
      
      const eventData = await kv.get(`event_slug_${slug}`);
      if (!eventData) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const event = JSON.parse(eventData);
      return c.json({ event });
    } catch (error) {
      console.log('Get public event error:', error);
      return c.json({ error: 'Failed to fetch event' }, 500);
    }
  });

  // Create event
  app.post("/make-server-6eefa08e/events", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const eventData = await c.req.json();
      const eventId = crypto.randomUUID();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const event = {
        id: eventId,
        organizationId: orgId,
        ...eventData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`event_${orgId}_${eventId}`, JSON.stringify(event));
      
      // Also store by slug for public access
      if (eventData.slug) {
        await kv.set(`event_slug_${eventData.slug}`, JSON.stringify(event));
      }

      return c.json({ event });
    } catch (error) {
      console.log('Create event error:', error);
      return c.json({ error: 'Failed to create event' }, 500);
    }
  });

  // Update event
  app.put("/make-server-6eefa08e/events/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const eventId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const eventData = await kv.get(`event_${orgId}_${eventId}`);
      if (!eventData) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const event = JSON.parse(eventData);
      const updatedEvent = {
        ...event,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`event_${orgId}_${eventId}`, JSON.stringify(updatedEvent));
      
      // Update slug mapping if slug changed
      if (updates.slug && updates.slug !== event.slug) {
        await kv.del(`event_slug_${event.slug}`);
        await kv.set(`event_slug_${updates.slug}`, JSON.stringify(updatedEvent));
      } else if (event.slug) {
        await kv.set(`event_slug_${event.slug}`, JSON.stringify(updatedEvent));
      }

      return c.json({ event: updatedEvent });
    } catch (error) {
      console.log('Update event error:', error);
      return c.json({ error: 'Failed to update event' }, 500);
    }
  });

  // Delete event
  app.delete("/make-server-6eefa08e/events/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const eventId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const eventData = await kv.get(`event_${orgId}_${eventId}`);
      if (eventData) {
        const event = JSON.parse(eventData);
        if (event.slug) {
          await kv.del(`event_slug_${event.slug}`);
        }
      }

      await kv.del(`event_${orgId}_${eventId}`);

      return c.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.log('Delete event error:', error);
      return c.json({ error: 'Failed to delete event' }, 500);
    }
  });

  // ===== GUESTS =====

  // Get all guests
  app.get("/make-server-6eefa08e/guests", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const guestsData = await kv.getByPrefix(`guest_${orgId}_`);
      const guests = guestsData.map(g => JSON.parse(g));

      return c.json({ guests });
    } catch (error) {
      console.log('Get guests error:', error);
      return c.json({ error: 'Failed to fetch guests' }, 500);
    }
  });

  // Create guest
  app.post("/make-server-6eefa08e/guests", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const guestData = await c.req.json();
      const guestId = crypto.randomUUID();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const guest = {
        id: guestId,
        organizationId: orgId,
        ...guestData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`guest_${orgId}_${guestId}`, JSON.stringify(guest));

      return c.json({ guest });
    } catch (error) {
      console.log('Create guest error:', error);
      return c.json({ error: 'Failed to create guest' }, 500);
    }
  });

  // Update guest
  app.put("/make-server-6eefa08e/guests/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const guestId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const guestData = await kv.get(`guest_${orgId}_${guestId}`);
      if (!guestData) {
        return c.json({ error: 'Guest not found' }, 404);
      }

      const guest = JSON.parse(guestData);
      const updatedGuest = {
        ...guest,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`guest_${orgId}_${guestId}`, JSON.stringify(updatedGuest));

      return c.json({ guest: updatedGuest });
    } catch (error) {
      console.log('Update guest error:', error);
      return c.json({ error: 'Failed to update guest' }, 500);
    }
  });

  // Delete guest
  app.delete("/make-server-6eefa08e/guests/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const guestId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`guest_${orgId}_${guestId}`);

      return c.json({ message: 'Guest deleted successfully' });
    } catch (error) {
      console.log('Delete guest error:', error);
      return c.json({ error: 'Failed to delete guest' }, 500);
    }
  });

  // ===== TEAM MEMBERS =====

  // Get team members
  app.get("/make-server-6eefa08e/team", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const teamData = await kv.getByPrefix(`team_${orgId}_`);
      const team = teamData.map(t => JSON.parse(t));

      return c.json({ team });
    } catch (error) {
      console.log('Get team error:', error);
      return c.json({ error: 'Failed to fetch team' }, 500);
    }
  });

  // Create team member
  app.post("/make-server-6eefa08e/team", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const memberData = await c.req.json();
      const memberId = crypto.randomUUID();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const member = {
        id: memberId,
        organizationId: orgId,
        ...memberData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`team_${orgId}_${memberId}`, JSON.stringify(member));

      return c.json({ member });
    } catch (error) {
      console.log('Create team member error:', error);
      return c.json({ error: 'Failed to create team member' }, 500);
    }
  });

  // Update team member
  app.put("/make-server-6eefa08e/team/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const memberId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const memberData = await kv.get(`team_${orgId}_${memberId}`);
      if (!memberData) {
        return c.json({ error: 'Team member not found' }, 404);
      }

      const member = JSON.parse(memberData);
      const updatedMember = {
        ...member,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`team_${orgId}_${memberId}`, JSON.stringify(updatedMember));

      return c.json({ member: updatedMember });
    } catch (error) {
      console.log('Update team member error:', error);
      return c.json({ error: 'Failed to update team member' }, 500);
    }
  });

  // Delete team member
  app.delete("/make-server-6eefa08e/team/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const memberId = c.req.param('id');
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      await kv.del(`team_${orgId}_${memberId}`);

      return c.json({ message: 'Team member deleted successfully' });
    } catch (error) {
      console.log('Delete team member error:', error);
      return c.json({ error: 'Failed to delete team member' }, 500);
    }
  });

  // ===== SUPPORT TICKETS =====

  // Get support tickets
  app.get("/make-server-6eefa08e/support/tickets", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';
      const ticketsData = await kv.getByPrefix(`ticket_${orgId}_`);
      const tickets = ticketsData.map(t => JSON.parse(t));

      return c.json({ tickets });
    } catch (error) {
      console.log('Get tickets error:', error);
      return c.json({ error: 'Failed to fetch tickets' }, 500);
    }
  });

  // Create support ticket
  app.post("/make-server-6eefa08e/support/tickets", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const ticketData = await c.req.json();
      const ticketId = crypto.randomUUID();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const ticket = {
        id: ticketId,
        organizationId: orgId,
        ...ticketData,
        status: ticketData.status || 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`ticket_${orgId}_${ticketId}`, JSON.stringify(ticket));

      return c.json({ ticket });
    } catch (error) {
      console.log('Create ticket error:', error);
      return c.json({ error: 'Failed to create ticket' }, 500);
    }
  });

  // Update support ticket
  app.put("/make-server-6eefa08e/support/tickets/:id", async (c) => {
    try {
      const authResult = await verifyAuth(c);
      if (authResult.error) {
        return c.json({ error: authResult.error }, authResult.status);
      }

      const ticketId = c.req.param('id');
      const updates = await c.req.json();
      const orgId = authResult.profile?.orgId || authResult.profile?.organizationId || 'demo-org';

      const ticketData = await kv.get(`ticket_${orgId}_${ticketId}`);
      if (!ticketData) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      const ticket = JSON.parse(ticketData);
      const updatedTicket = {
        ...ticket,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`ticket_${orgId}_${ticketId}`, JSON.stringify(updatedTicket));

      return c.json({ ticket: updatedTicket });
    } catch (error) {
      console.log('Update ticket error:', error);
      return c.json({ error: 'Failed to update ticket' }, 500);
    }
  });
}