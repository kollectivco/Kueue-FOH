-- Migration 001: Initial Schema Setup
-- This migration creates the core database structure for Kueue RSVP

-- ============================================================
-- 1. Create kv_store_6eefa08e table for key-value storage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kv_store_6eefa08e (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kv_store_updated_at ON public.kv_store_6eefa08e(updated_at DESC);

-- Enable RLS
ALTER TABLE public.kv_store_6eefa08e ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all authenticated users to read kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow all authenticated users to insert kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow all authenticated users to update kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow all authenticated users to delete kv_store" ON public.kv_store_6eefa08e;
DROP POLICY IF EXISTS "Allow service role full access to kv_store" ON public.kv_store_6eefa08e;

-- Create new policies
CREATE POLICY "Allow all authenticated users to read kv_store"
  ON public.kv_store_6eefa08e FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all authenticated users to insert kv_store"
  ON public.kv_store_6eefa08e FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update kv_store"
  ON public.kv_store_6eefa08e FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to delete kv_store"
  ON public.kv_store_6eefa08e FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to kv_store"
  ON public.kv_store_6eefa08e
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. Create profiles table
-- ============================================================
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow service role full access to profiles" ON public.profiles;

-- Create new policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'developer')
    )
  );

CREATE POLICY "Super admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'developer')
    )
  );

CREATE POLICY "Allow service role full access to profiles"
  ON public.profiles
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. Create function to sync auth.users with profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. Create updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to kv_store
DROP TRIGGER IF EXISTS update_kv_store_updated_at ON public.kv_store_6eefa08e;
CREATE TRIGGER update_kv_store_updated_at
  BEFORE UPDATE ON public.kv_store_6eefa08e
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Grant necessary permissions
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.kv_store_6eefa08e TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Migration complete
SELECT 'Migration 001 completed successfully' AS status;
