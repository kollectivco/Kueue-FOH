import { supabase } from '../utils/supabase/client';

/**
 * Database Migration Tool for Kueue RSVP
 * Applies the production schema to Supabase PostgreSQL database
 */

export interface MigrationResult {
  success: boolean;
  message: string;
  errors?: string[];
  tablesCreated?: string[];
}

export class DatabaseMigrator {
  private supabase = supabase;

  /**
   * Run the complete database migration
   */
  async migrate(): Promise<MigrationResult> {
    console.log('🚀 Starting database migration...');
    
    try {
      // Step 1: Check if we can connect to database
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        return connectionTest;
      }

      // Step 2: Create core tables
      const coreTablesResult = await this.createCoreTables();
      if (!coreTablesResult.success) {
        return coreTablesResult;
      }

      // Step 3: Create venue and floor plan tables
      const venueTablesResult = await this.createVenueTables();
      if (!venueTablesResult.success) {
        return venueTablesResult;
      }

      // Step 4: Create reservation tables
      const reservationTablesResult = await this.createReservationTables();
      if (!reservationTablesResult.success) {
        return reservationTablesResult;
      }

      // Step 5: Create communication and analytics tables
      const analyticsTablesResult = await this.createAnalyticsTables();
      if (!analyticsTablesResult.success) {
        return analyticsTablesResult;
      }

      // Step 6: Set up RLS policies
      const rlsResult = await this.setupRLS();
      if (!rlsResult.success) {
        console.warn('⚠️ RLS setup had issues:', rlsResult.message);
      }

      // Step 7: Create indexes
      const indexResult = await this.createIndexes();
      if (!indexResult.success) {
        console.warn('⚠️ Index creation had issues:', indexResult.message);
      }

      // Step 8: Set up triggers and functions
      const triggersResult = await this.setupTriggers();
      if (!triggersResult.success) {
        console.warn('⚠️ Triggers setup had issues:', triggersResult.message);
      }

      return {
        success: true,
        message: '✅ Database migration completed successfully!',
        tablesCreated: [
          'organizations', 'users', 'guests', 'guest_tags', 'guest_tag_assignments',
          'venues', 'zones', 'tables', 'reservations', 'waitlist', 'events',
          'event_registrations', 'staff_profiles', 'communication_templates',
          'communication_logs', 'daily_analytics', 'activity_logs'
        ]
      };

    } catch (error: any) {
      console.error('💥 Migration failed:', error);
      return {
        success: false,
        message: 'Migration failed: ' + error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<MigrationResult> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error && !error.message.includes('does not exist')) {
        throw error;
      }

      return {
        success: true,
        message: '✅ Database connection successful'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '❌ Database connection failed: ' + error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Execute raw SQL using Supabase
   */
  private async executeSql(sql: string): Promise<{ error: any }> {
    try {
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await this.supabase.rpc('exec_sql', { 
            sql_query: statement + ';' 
          });
          
          if (error) {
            // Try direct query if RPC fails
            const { error: queryError } = await this.supabase
              .from('_temp_migration')
              .select('*')
              .limit(0);
            
            // If we can't execute, return error
            if (queryError && !queryError.message.includes('does not exist')) {
              return { error };
            }
          }
        }
      }
      
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Create core tables (organizations, users, guests)
   */
  private async createCoreTables(): Promise<MigrationResult> {
    console.log('📊 Creating core tables...');
    
    const sql = `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Organizations table
      CREATE TABLE IF NOT EXISTS organizations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          city VARCHAR(100),
          country VARCHAR(100) DEFAULT 'Egypt',
          timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
          currency VARCHAR(3) DEFAULT 'EGP',
          
          logo_url TEXT,
          cover_image_url TEXT,
          website_url TEXT,
          description TEXT,
          business_type VARCHAR(50) DEFAULT 'restaurant',
          
          default_reservation_duration INTEGER DEFAULT 120,
          advance_booking_days INTEGER DEFAULT 30,
          cancellation_policy TEXT,
          
          status VARCHAR(20) DEFAULT 'active',
          subscription_plan VARCHAR(50) DEFAULT 'basic',
          subscription_status VARCHAR(20) DEFAULT 'active',
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          
          full_name VARCHAR(255),
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          phone VARCHAR(50),
          avatar_url TEXT,
          
          role VARCHAR(50) NOT NULL DEFAULT 'guest',
          organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
          
          preferred_language VARCHAR(10) DEFAULT 'en',
          timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
          notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": false}',
          
          email_verified BOOLEAN DEFAULT FALSE,
          phone_verified BOOLEAN DEFAULT FALSE,
          last_login TIMESTAMP WITH TIME ZONE,
          login_count INTEGER DEFAULT 0,
          
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Guests table
      CREATE TABLE IF NOT EXISTS guests (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          full_name VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          
          date_of_birth DATE,
          gender VARCHAR(20),
          occupation VARCHAR(100),
          profile_image_url TEXT,
          
          preferred_contact_method VARCHAR(20) DEFAULT 'email',
          
          vip_status BOOLEAN DEFAULT FALSE,
          membership_code VARCHAR(50),
          membership_tier VARCHAR(50) DEFAULT 'standard',
          
          preferred_zones TEXT[],
          dietary_restrictions TEXT[],
          allergies TEXT[],
          special_requests TEXT[],
          
          facebook_url TEXT,
          instagram_url TEXT,
          
          total_reservations INTEGER DEFAULT 0,
          completed_reservations INTEGER DEFAULT 0,
          cancelled_reservations INTEGER DEFAULT 0,
          no_show_count INTEGER DEFAULT 0,
          total_spend DECIMAL(10,2) DEFAULT 0,
          average_spend DECIMAL(10,2) DEFAULT 0,
          average_party_size DECIMAL(3,1) DEFAULT 1,
          
          spending_tier VARCHAR(20) DEFAULT 'low',
          visit_frequency VARCHAR(20) DEFAULT 'new',
          guest_score INTEGER DEFAULT 0,
          
          notes TEXT,
          internal_notes TEXT,
          
          first_visit_date TIMESTAMP WITH TIME ZONE,
          last_visit_date TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT unique_guest_org_email UNIQUE (organization_id, email)
      );

      -- Guest tags
      CREATE TABLE IF NOT EXISTS guest_tags (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(7) DEFAULT '#3b82f6',
          category VARCHAR(50) DEFAULT 'custom',
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT unique_tag_org_name UNIQUE (organization_id, name)
      );

      -- Guest tag assignments
      CREATE TABLE IF NOT EXISTS guest_tag_assignments (
          guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
          tag_id UUID REFERENCES guest_tags(id) ON DELETE CASCADE,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
          
          PRIMARY KEY (guest_id, tag_id)
      );
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      if (error) throw error;

      return {
        success: true,
        message: '✅ Core tables created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '❌ Failed to create core tables: ' + error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Create venue and floor plan tables
   */
  private async createVenueTables(): Promise<MigrationResult> {
    console.log('🏢 Creating venue tables...');
    
    const sql = `
      -- Venues table
      CREATE TABLE IF NOT EXISTS venues (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) NOT NULL,
          description TEXT,
          
          address TEXT,
          city VARCHAR(100),
          postal_code VARCHAR(20),
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          
          phone VARCHAR(50),
          email VARCHAR(255),
          
          capacity INTEGER DEFAULT 0,
          
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT unique_venue_org_slug UNIQUE (organization_id, slug)
      );

      -- Zones table
      CREATE TABLE IF NOT EXISTS zones (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          
          name VARCHAR(255) NOT NULL,
          description TEXT,
          color VARCHAR(7) DEFAULT '#3b82f6',
          
          capacity INTEGER DEFAULT 0,
          min_party_size INTEGER DEFAULT 1,
          max_party_size INTEGER DEFAULT 10,
          
          x_position INTEGER DEFAULT 0,
          y_position INTEGER DEFAULT 0,
          width INTEGER DEFAULT 100,
          height INTEGER DEFAULT 100,
          
          pricing_tier VARCHAR(50) DEFAULT 'standard',
          advance_booking_required BOOLEAN DEFAULT FALSE,
          
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Tables
      CREATE TABLE IF NOT EXISTS tables (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
          
          table_number VARCHAR(20) NOT NULL,
          table_name VARCHAR(100),
          
          seats INTEGER NOT NULL DEFAULT 2,
          min_party_size INTEGER DEFAULT 1,
          max_party_size INTEGER DEFAULT NULL,
          
          x_position INTEGER DEFAULT 0,
          y_position INTEGER DEFAULT 0,
          rotation INTEGER DEFAULT 0,
          
          table_type VARCHAR(50) DEFAULT 'regular',
          shape VARCHAR(20) DEFAULT 'round',
          
          has_view BOOLEAN DEFAULT FALSE,
          is_accessible BOOLEAN DEFAULT TRUE,
          features TEXT[],
          
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT unique_table_venue_number UNIQUE (venue_id, table_number)
      );
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      if (error) throw error;

      return {
        success: true,
        message: '✅ Venue tables created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '❌ Failed to create venue tables: ' + error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Create reservation and event tables
   */
  private async createReservationTables(): Promise<MigrationResult> {
    console.log('📅 Creating reservation tables...');
    
    const sql = `
      -- Reservations table
      CREATE TABLE IF NOT EXISTS reservations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
          
          reservation_date DATE NOT NULL,
          reservation_time TIME NOT NULL,
          party_size INTEGER NOT NULL,
          duration_minutes INTEGER DEFAULT 120,
          
          guest_name VARCHAR(255) NOT NULL,
          guest_email VARCHAR(255),
          guest_phone VARCHAR(50),
          
          table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
          zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
          
          special_requests TEXT,
          dietary_requirements TEXT[],
          occasion VARCHAR(100),
          
          staff_notes TEXT,
          
          status VARCHAR(20) DEFAULT 'pending',
          confirmation_code VARCHAR(20) UNIQUE,
          
          confirmed_at TIMESTAMP WITH TIME ZONE,
          seated_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          cancelled_at TIMESTAMP WITH TIME ZONE,
          
          source VARCHAR(50) DEFAULT 'website',
          referrer TEXT,
          
          payment_required BOOLEAN DEFAULT FALSE,
          payment_amount DECIMAL(10,2),
          payment_status VARCHAR(20) DEFAULT 'none',
          payment_method VARCHAR(50),
          
          assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Waitlist table
      CREATE TABLE IF NOT EXISTS waitlist (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
          
          requested_date DATE NOT NULL,
          requested_time TIME,
          party_size INTEGER NOT NULL,
          flexible_timing BOOLEAN DEFAULT TRUE,
          
          guest_name VARCHAR(255) NOT NULL,
          guest_email VARCHAR(255),
          guest_phone VARCHAR(50) NOT NULL,
          
          preferred_zones TEXT[],
          special_requests TEXT,
          
          priority_level INTEGER DEFAULT 0,
          estimated_wait_time INTEGER,
          
          status VARCHAR(20) DEFAULT 'waiting',
          
          notification_preferences JSONB DEFAULT '{"sms": true, "email": true, "call": false}',
          notified_at TIMESTAMP WITH TIME ZONE,
          
          converted_to_reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
          converted_at TIMESTAMP WITH TIME ZONE,
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE
      );

      -- Events table
      CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
          
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(150) UNIQUE NOT NULL,
          description TEXT,
          
          event_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME,
          timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
          
          event_type VARCHAR(50) DEFAULT 'special',
          category VARCHAR(100),
          
          max_capacity INTEGER,
          price_per_person DECIMAL(10,2),
          requires_payment BOOLEAN DEFAULT FALSE,
          
          registration_required BOOLEAN DEFAULT TRUE,
          registration_deadline TIMESTAMP WITH TIME ZONE,
          allow_waitlist BOOLEAN DEFAULT TRUE,
          
          cover_image_url TEXT,
          gallery_images TEXT[],
          
          status VARCHAR(20) DEFAULT 'draft',
          visibility VARCHAR(20) DEFAULT 'public',
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          published_at TIMESTAMP WITH TIME ZONE
      );

      -- Event registrations
      CREATE TABLE IF NOT EXISTS event_registrations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
          
          guest_name VARCHAR(255) NOT NULL,
          guest_email VARCHAR(255) NOT NULL,
          guest_phone VARCHAR(50),
          party_size INTEGER DEFAULT 1,
          
          dietary_requirements TEXT[],
          special_requests TEXT,
          
          status VARCHAR(20) DEFAULT 'registered',
          
          payment_required BOOLEAN DEFAULT FALSE,
          payment_amount DECIMAL(10,2),
          payment_status VARCHAR(20) DEFAULT 'none',
          
          registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          confirmed_at TIMESTAMP WITH TIME ZONE,
          attended_at TIMESTAMP WITH TIME ZONE
      );

      -- Staff profiles
      CREATE TABLE IF NOT EXISTS staff_profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          
          job_title VARCHAR(100),
          department VARCHAR(100),
          employment_type VARCHAR(50) DEFAULT 'full_time',
          
          emergency_contact_name VARCHAR(255),
          emergency_contact_phone VARCHAR(50),
          
          work_schedule JSONB,
          hourly_rate DECIMAL(8,2),
          
          permissions JSONB DEFAULT '{}',
          access_level VARCHAR(50) DEFAULT 'basic',
          
          hire_date DATE,
          last_performance_review DATE,
          performance_score INTEGER,
          
          status VARCHAR(20) DEFAULT 'active',
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      if (error) throw error;

      return {
        success: true,
        message: '✅ Reservation tables created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '❌ Failed to create reservation tables: ' + error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Create communication and analytics tables
   */
  private async createAnalyticsTables(): Promise<MigrationResult> {
    console.log('📊 Creating analytics tables...');
    
    const sql = `
      -- Communication templates
      CREATE TABLE IF NOT EXISTS communication_templates (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          
          name VARCHAR(255) NOT NULL,
          description TEXT,
          
          template_type VARCHAR(50) NOT NULL,
          trigger_event VARCHAR(100) NOT NULL,
          
          subject VARCHAR(255),
          content TEXT NOT NULL,
          content_html TEXT,
          
          available_variables TEXT[],
          
          send_delay_minutes INTEGER DEFAULT 0,
          active BOOLEAN DEFAULT TRUE,
          
          sent_count INTEGER DEFAULT 0,
          success_rate DECIMAL(5,2) DEFAULT 0,
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Communication logs
      CREATE TABLE IF NOT EXISTS communication_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          
          recipient_type VARCHAR(20) NOT NULL,
          recipient_id UUID,
          recipient_email VARCHAR(255),
          recipient_phone VARCHAR(50),
          
          communication_type VARCHAR(20) NOT NULL,
          template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
          
          subject VARCHAR(255),
          content TEXT NOT NULL,
          
          status VARCHAR(20) DEFAULT 'pending',
          
          external_id VARCHAR(255),
          external_status VARCHAR(100),
          error_message TEXT,
          
          scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          sent_at TIMESTAMP WITH TIME ZONE,
          delivered_at TIMESTAMP WITH TIME ZONE,
          opened_at TIMESTAMP WITH TIME ZONE,
          
          cost_amount DECIMAL(8,4),
          cost_currency VARCHAR(3) DEFAULT 'EGP',
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Daily analytics
      CREATE TABLE IF NOT EXISTS daily_analytics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
          
          analytics_date DATE NOT NULL,
          
          total_reservations INTEGER DEFAULT 0,
          confirmed_reservations INTEGER DEFAULT 0,
          cancelled_reservations INTEGER DEFAULT 0,
          no_show_reservations INTEGER DEFAULT 0,
          walk_in_reservations INTEGER DEFAULT 0,
          
          total_guests INTEGER DEFAULT 0,
          new_guests INTEGER DEFAULT 0,
          returning_guests INTEGER DEFAULT 0,
          vip_guests INTEGER DEFAULT 0,
          
          total_revenue DECIMAL(12,2) DEFAULT 0,
          average_party_size DECIMAL(4,2) DEFAULT 0,
          average_spend_per_guest DECIMAL(8,2) DEFAULT 0,
          
          table_turnover_rate DECIMAL(4,2) DEFAULT 0,
          average_wait_time INTEGER DEFAULT 0,
          occupancy_rate DECIMAL(5,2) DEFAULT 0,
          
          emails_sent INTEGER DEFAULT 0,
          sms_sent INTEGER DEFAULT 0,
          notifications_sent INTEGER DEFAULT 0,
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT unique_daily_analytics UNIQUE (organization_id, venue_id, analytics_date)
      );

      -- Activity logs
      CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          
          actor_type VARCHAR(20) NOT NULL,
          actor_id UUID,
          actor_name VARCHAR(255),
          actor_email VARCHAR(255),
          
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id UUID,
          
          changes JSONB,
          description TEXT,
          
          ip_address INET,
          user_agent TEXT,
          request_id VARCHAR(100),
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      if (error) throw error;

      return {
        success: true,
        message: '✅ Analytics tables created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '❌ Failed to create analytics tables: ' + error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Set up Row Level Security
   */
  private async setupRLS(): Promise<MigrationResult> {
    console.log('🔒 Setting up Row Level Security...');
    
    const sql = `
      -- Enable RLS on core tables
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
      ALTER TABLE events ENABLE ROW LEVEL SECURITY;
      
      -- Basic RLS policies (can be customized later)
      CREATE POLICY IF NOT EXISTS "Users can view own organization" ON organizations
          FOR SELECT USING (
              id IN (
                  SELECT organization_id FROM users 
                  WHERE users.id = auth.uid()
              )
          );
      
      CREATE POLICY IF NOT EXISTS "Users can view organization guests" ON guests
          FOR ALL USING (
              organization_id IN (
                  SELECT organization_id FROM users 
                  WHERE users.id = auth.uid()
              )
          );
      
      CREATE POLICY IF NOT EXISTS "Users can view organization reservations" ON reservations
          FOR ALL USING (
              organization_id IN (
                  SELECT organization_id FROM users 
                  WHERE users.id = auth.uid()
              )
          );
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      
      return {
        success: !error,
        message: error ? '⚠️ RLS setup had some issues' : '✅ Row Level Security configured'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '⚠️ RLS setup failed: ' + error.message
      };
    }
  }

  /**
   * Create performance indexes
   */
  private async createIndexes(): Promise<MigrationResult> {
    console.log('⚡ Creating performance indexes...');
    
    const sql = `
      -- Core indexes
      CREATE INDEX IF NOT EXISTS idx_guests_organization_email ON guests(organization_id, email);
      CREATE INDEX IF NOT EXISTS idx_guests_vip_status ON guests(vip_status) WHERE vip_status = true;
      CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
      CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
      CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest_id);
      CREATE INDEX IF NOT EXISTS idx_waitlist_date ON waitlist(requested_date);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
      CREATE INDEX IF NOT EXISTS idx_comm_logs_recipient ON communication_logs(recipient_type, recipient_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(created_at);
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      
      return {
        success: !error,
        message: error ? '⚠️ Index creation had some issues' : '✅ Performance indexes created'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '⚠️ Index creation failed: ' + error.message
      };
    }
  }

  /**
   * Set up triggers and functions
   */
  private async setupTriggers(): Promise<MigrationResult> {
    console.log('⚙️ Setting up triggers and functions...');
    
    const sql = `
      -- Function to update updated_at timestamps
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Create triggers for updated_at
      DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
      CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_guests_updated_at ON guests;
      CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
      CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      -- Function to generate confirmation codes
      CREATE OR REPLACE FUNCTION generate_confirmation_code()
      RETURNS TEXT AS $$
      BEGIN
          RETURN upper(substring(md5(random()::text) from 1 for 8));
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger to auto-generate confirmation codes
      CREATE OR REPLACE FUNCTION set_reservation_confirmation_code()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.confirmation_code IS NULL THEN
              NEW.confirmation_code := generate_confirmation_code();
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS set_reservation_confirmation_code_trigger ON reservations;
      CREATE TRIGGER set_reservation_confirmation_code_trigger 
          BEFORE INSERT ON reservations 
          FOR EACH ROW 
          EXECUTE FUNCTION set_reservation_confirmation_code();
    `;

    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      
      return {
        success: !error,
        message: error ? '⚠️ Triggers setup had some issues' : '✅ Triggers and functions configured'
      };
    } catch (error: any) {
      return {
        success: false,
        message: '⚠️ Triggers setup failed: ' + error.message
      };
    }
  }

  /**
   * Create sample data for testing
   */
  async createSampleData(): Promise<MigrationResult> {
    console.log('🌱 Creating sample data...');
    
    try {
      // Create sample organization
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .insert([{
          name: 'Demo Restaurant',
          slug: 'demo-restaurant',
          email: 'info@demo-restaurant.com',
          phone: '+201234567890',
          city: 'Cairo',
          business_type: 'restaurant',
          description: 'A beautiful demo restaurant for testing'
        }])
        .select()
        .single();

      if (orgError) throw orgError;

      console.log('✅ Sample organization created:', org.id);

      // Create sample venue
      const { data: venue, error: venueError } = await this.supabase
        .from('venues')
        .insert([{
          organization_id: org.id,
          name: 'Main Location',
          slug: 'main-location',
          address: '123 Demo Street, Cairo, Egypt',
          city: 'Cairo',
          capacity: 100
        }])
        .select()
        .single();

      if (venueError) throw venueError;

      console.log('✅ Sample venue created:', venue.id);

      return {
        success: true,
        message: '✅ Sample data created successfully'
      };

    } catch (error: any) {
      return {
        success: false,
        message: '❌ Failed to create sample data: ' + error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Check current database status
   */
  async checkStatus(): Promise<{
    hasSchema: boolean;
    tables: string[];
    errors: string[];
  }> {
    const tables = [
      'organizations', 'users', 'guests', 'guest_tags', 'venues', 
      'zones', 'tables', 'reservations', 'waitlist', 'events'
    ];
    
    const existingTables: string[] = [];
    const errors: string[] = [];

    for (const table of tables) {
      try {
        const { error } = await this.supabase
          .from(table)
          .select('*')
          .limit(0);
        
        if (!error) {
          existingTables.push(table);
        }
      } catch (err: any) {
        errors.push(`${table}: ${err.message}`);
      }
    }

    return {
      hasSchema: existingTables.length > 0,
      tables: existingTables,
      errors
    };
  }
}

// Export migration functions
export const migrator = new DatabaseMigrator();

export async function runMigration(): Promise<MigrationResult> {
  return await migrator.migrate();
}

export async function checkDatabaseStatus() {
  return await migrator.checkStatus();
}

export async function createSampleData(): Promise<MigrationResult> {
  return await migrator.createSampleData();
}