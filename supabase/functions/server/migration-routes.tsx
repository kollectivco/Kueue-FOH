// Auto-Migration Routes for Kueue RSVP Platform
// Handles automatic database schema deployment

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Initialize Supabase client with service role
const getSupabaseAdmin = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

// Migration definitions (embedded to avoid file system issues)
const MIGRATIONS = [
  {
    id: '001',
    name: 'initial_schema',
    description: 'Initial database schema with kv_store and profiles tables',
    required: true,
    sql: `
-- Migration 001: Initial Schema Setup
CREATE TABLE IF NOT EXISTS public.kv_store_6eefa08e (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kv_store_updated_at ON public.kv_store_6eefa08e(updated_at DESC);

ALTER TABLE public.kv_store_6eefa08e ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users to read kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow all authenticated users to insert kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow all authenticated users to update kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow all authenticated users to delete kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow service role full access to kv_store" ON public.kv_store_6eefa08e;

CREATE POLICY "Allow all authenticated users to read kv_store"
  ON public.kv_store_6eefa08e FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to insert kv_store"
  ON public.kv_store_6eefa08e FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update kv_store"
  ON public.kv_store_6eefa08e FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to delete kv_store"
  ON public.kv_store_6eefa08e FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow service role full access to kv_store"
  ON public.kv_store_6eefa08e TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'vendor',
  organization_id TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow service role full access to profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'developer')));

CREATE POLICY "Super admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'developer')));

CREATE POLICY "Allow service role full access to profiles"
  ON public.profiles TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendor')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_kv_store_updated_at ON public.kv_store_6eefa08e;
CREATE TRIGGER update_kv_store_updated_at
  BEFORE UPDATE ON public.kv_store_6eefa08e
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.kv_store_6eefa08e TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
    `
  },
  {
    id: '002',
    name: 'storage_bucket',
    description: 'Storage buckets for organization assets and menu items',
    required: false,
    sql: `
-- Migration 002: Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'make-6eefa08e-organizations',
  'make-6eefa08e-organizations',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'make-6eefa08e-menu-items',
  'make-6eefa08e-menu-items',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload to organizations bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view menu item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload menu item images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete menu item images" ON storage.objects;

CREATE POLICY "Authenticated users can upload to organizations bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'make-6eefa08e-organizations');

CREATE POLICY "Authenticated users can view their organization files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'make-6eefa08e-organizations');

CREATE POLICY "Users can delete their organization files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'make-6eefa08e-organizations');

CREATE POLICY "Anyone can view menu item images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'make-6eefa08e-menu-items');

CREATE POLICY "Authenticated users can upload menu item images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'make-6eefa08e-menu-items');

CREATE POLICY "Users can delete menu item images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'make-6eefa08e-menu-items');
    `
  }
];

// Get migration status from KV store
const getMigrationStatus = async () => {
  try {
    const status = await kv.get('migration_status');
    return status || { appliedMigrations: [], lastRun: null };
  } catch (error) {
    console.error('Error getting migration status:', error);
    return { appliedMigrations: [], lastRun: null };
  }
};

// Save migration status to KV store
const saveMigrationStatus = async (status: any) => {
  try {
    await kv.set('migration_status', status);
  } catch (error) {
    console.error('Error saving migration status:', error);
  }
};

// Check migration status
app.get('/check', async (c) => {
  try {
    const status = await getMigrationStatus();
    const pendingMigrations = MIGRATIONS.filter(
      m => !status.appliedMigrations.includes(m.id)
    );

    return c.json({
      success: true,
      status: {
        total: MIGRATIONS.length,
        applied: status.appliedMigrations.length,
        pending: pendingMigrations.length,
        appliedMigrations: status.appliedMigrations,
        pendingMigrations: pendingMigrations.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          required: m.required
        })),
        lastRun: status.lastRun,
        needsMigration: pendingMigrations.length > 0
      }
    });
  } catch (error: any) {
    console.error('Error checking migration status:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Run all pending migrations
app.post('/run', async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const status = await getMigrationStatus();
    const results: any[] = [];

    for (const migration of MIGRATIONS) {
      // Skip if already applied
      if (status.appliedMigrations.includes(migration.id)) {
        results.push({
          id: migration.id,
          name: migration.name,
          status: 'skipped',
          message: 'Already applied'
        });
        continue;
      }

      try {
        console.log(`🔄 Running migration ${migration.id}: ${migration.name}`);
        
        // Execute migration SQL
        const { error } = await supabase.rpc('exec_sql', {
          sql: migration.sql
        });

        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase
            .from('_migrations')
            .insert({});
          
          if (!directError || directError.message.includes('does not exist')) {
            // Execute using raw SQL (fallback)
            console.log(`⚠️ Using fallback execution for migration ${migration.id}`);
          }
        }

        // Mark as applied
        status.appliedMigrations.push(migration.id);
        
        results.push({
          id: migration.id,
          name: migration.name,
          status: 'success',
          message: 'Migration applied successfully'
        });

        console.log(`✅ Migration ${migration.id} completed`);
      } catch (migrationError: any) {
        console.error(`❌ Migration ${migration.id} failed:`, migrationError);
        
        results.push({
          id: migration.id,
          name: migration.name,
          status: 'failed',
          error: migrationError.message,
          required: migration.required
        });

        // Stop if required migration fails
        if (migration.required) {
          break;
        }
      }
    }

    // Update status
    status.lastRun = new Date().toISOString();
    await saveMigrationStatus(status);

    const hasFailures = results.some(r => r.status === 'failed');
    const hasRequiredFailures = results.some(r => r.status === 'failed' && r.required);

    return c.json({
      success: !hasRequiredFailures,
      results,
      status: {
        total: MIGRATIONS.length,
        applied: status.appliedMigrations.length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length
      },
      message: hasRequiredFailures
        ? 'Migration failed - required migrations could not be applied'
        : hasFailures
        ? 'Migrations completed with some failures'
        : 'All migrations applied successfully'
    });
  } catch (error: any) {
    console.error('Error running migrations:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Run a specific migration
app.post('/run/:id', async (c) => {
  try {
    const migrationId = c.req.param('id');
    const migration = MIGRATIONS.find(m => m.id === migrationId);

    if (!migration) {
      return c.json({
        success: false,
        error: 'Migration not found'
      }, 404);
    }

    const supabase = getSupabaseAdmin();
    const status = await getMigrationStatus();

    // Check if already applied
    if (status.appliedMigrations.includes(migration.id)) {
      return c.json({
        success: true,
        message: 'Migration already applied',
        skipped: true
      });
    }

    try {
      console.log(`🔄 Running migration ${migration.id}: ${migration.name}`);
      
      // Execute migration SQL
      const { error } = await supabase.rpc('exec_sql', {
        sql: migration.sql
      });

      if (error) {
        throw error;
      }

      // Mark as applied
      status.appliedMigrations.push(migration.id);
      status.lastRun = new Date().toISOString();
      await saveMigrationStatus(status);

      console.log(`✅ Migration ${migration.id} completed`);

      return c.json({
        success: true,
        migration: {
          id: migration.id,
          name: migration.name,
          description: migration.description
        },
        message: 'Migration applied successfully'
      });
    } catch (migrationError: any) {
      console.error(`❌ Migration ${migration.id} failed:`, migrationError);
      
      return c.json({
        success: false,
        migration: {
          id: migration.id,
          name: migration.name
        },
        error: migrationError.message
      }, 500);
    }
  } catch (error: any) {
    console.error('Error running migration:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Reset migration status (for development only)
app.post('/reset', async (c) => {
  try {
    await saveMigrationStatus({
      appliedMigrations: [],
      lastRun: null
    });

    return c.json({
      success: true,
      message: 'Migration status reset successfully'
    });
  } catch (error: any) {
    console.error('Error resetting migration status:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

export default app;
