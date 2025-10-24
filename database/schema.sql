-- =====================================================
-- KUEUE RSVP DATABASE SCHEMA
-- Complete PostgreSQL schema for production database
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Organizations table (Restaurant/Business entities)
CREATE TABLE organizations (
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
    
    -- Business settings
    logo_url TEXT,
    cover_image_url TEXT,
    website_url TEXT,
    description TEXT,
    business_type VARCHAR(50) DEFAULT 'restaurant',
    
    -- Operational settings
    default_reservation_duration INTEGER DEFAULT 120, -- minutes
    advance_booking_days INTEGER DEFAULT 30,
    cancellation_policy TEXT,
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, inactive
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    subscription_status VARCHAR(20) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (All system users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- For custom auth if needed
    
    -- Profile information
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    
    -- User role and permissions
    role VARCHAR(50) NOT NULL DEFAULT 'guest', -- super_admin, support_admin, billing_admin, vendor, staff, guest
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    
    -- User preferences
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": false}',
    
    -- Authentication metadata
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, pending_verification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guests table (Customer profiles)
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic information
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    
    -- Personal details
    date_of_birth DATE,
    gender VARCHAR(20),
    occupation VARCHAR(100),
    profile_image_url TEXT,
    
    -- Contact preferences
    preferred_contact_method VARCHAR(20) DEFAULT 'email', -- email, phone, sms, whatsapp
    
    -- VIP and membership
    vip_status BOOLEAN DEFAULT FALSE,
    membership_code VARCHAR(50),
    membership_tier VARCHAR(50) DEFAULT 'standard', -- standard, bronze, silver, gold, platinum
    
    -- Preferences and restrictions
    preferred_zones TEXT[],
    dietary_restrictions TEXT[],
    allergies TEXT[],
    special_requests TEXT[],
    
    -- Social and external links
    facebook_url TEXT,
    instagram_url TEXT,
    
    -- Guest analytics
    total_reservations INTEGER DEFAULT 0,
    completed_reservations INTEGER DEFAULT 0,
    cancelled_reservations INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    total_spend DECIMAL(10,2) DEFAULT 0,
    average_spend DECIMAL(10,2) DEFAULT 0,
    average_party_size DECIMAL(3,1) DEFAULT 1,
    
    -- Classification
    spending_tier VARCHAR(20) DEFAULT 'low', -- low, medium, high, vip
    visit_frequency VARCHAR(20) DEFAULT 'new', -- new, occasional, regular, frequent
    guest_score INTEGER DEFAULT 0, -- 0-100 loyalty score
    
    -- Important notes
    notes TEXT,
    internal_notes TEXT, -- Staff-only notes
    
    -- Metadata
    first_visit_date TIMESTAMP WITH TIME ZONE,
    last_visit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_guest_org_email UNIQUE (organization_id, email),
    CONSTRAINT unique_guest_org_phone UNIQUE (organization_id, phone)
);

-- Guest tags (for flexible categorization)
CREATE TABLE guest_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color
    category VARCHAR(50) DEFAULT 'custom', -- status, behavior, preference, custom
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tag_org_name UNIQUE (organization_id, name)
);

-- Junction table for guest tags
CREATE TABLE guest_tag_assignments (
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES guest_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    PRIMARY KEY (guest_id, tag_id)
);

-- =====================================================
-- VENUE AND FLOOR PLAN TABLES
-- =====================================================

-- Venues/Locations (for multi-location businesses)
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Location details
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Contact information
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Venue settings
    capacity INTEGER DEFAULT 0,
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_venue_org_slug UNIQUE (organization_id, slug)
);

-- Floor plan zones
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3b82f6',
    
    -- Zone properties
    capacity INTEGER DEFAULT 0,
    min_party_size INTEGER DEFAULT 1,
    max_party_size INTEGER DEFAULT 10,
    
    -- Positioning (for floor plan)
    x_position INTEGER DEFAULT 0,
    y_position INTEGER DEFAULT 0,
    width INTEGER DEFAULT 100,
    height INTEGER DEFAULT 100,
    
    -- Pricing and rules
    pricing_tier VARCHAR(50) DEFAULT 'standard',
    advance_booking_required BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tables
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    
    -- Table identification
    table_number VARCHAR(20) NOT NULL,
    table_name VARCHAR(100),
    
    -- Table properties
    seats INTEGER NOT NULL DEFAULT 2,
    min_party_size INTEGER DEFAULT 1,
    max_party_size INTEGER DEFAULT NULL, -- NULL means use seats count
    
    -- Positioning (for floor plan)
    x_position INTEGER DEFAULT 0,
    y_position INTEGER DEFAULT 0,
    rotation INTEGER DEFAULT 0,
    
    -- Table type and properties
    table_type VARCHAR(50) DEFAULT 'regular', -- regular, high_top, booth, private, outdoor
    shape VARCHAR(20) DEFAULT 'round', -- round, square, rectangular
    
    -- Features and amenities
    has_view BOOLEAN DEFAULT FALSE,
    is_accessible BOOLEAN DEFAULT TRUE,
    features TEXT[], -- ['window_view', 'quiet', 'private', 'tv_nearby']
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, maintenance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_table_venue_number UNIQUE (venue_id, table_number)
);

-- =====================================================
-- RESERVATIONS AND BOOKINGS
-- =====================================================

-- Reservations
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    
    -- Reservation details
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    duration_minutes INTEGER DEFAULT 120,
    
    -- Guest information (even if guest_id is null)
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),
    
    -- Table assignment
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    
    -- Special requests and notes
    special_requests TEXT,
    dietary_requirements TEXT[],
    occasion VARCHAR(100), -- birthday, anniversary, business, date, etc.
    
    -- Internal notes
    staff_notes TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, seated, completed, cancelled, no_show
    confirmation_code VARCHAR(20) UNIQUE,
    
    -- Timestamps for status changes
    confirmed_at TIMESTAMP WITH TIME ZONE,
    seated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Reservation source
    source VARCHAR(50) DEFAULT 'website', -- website, phone, walk_in, app, social
    referrer TEXT,
    
    -- Payment information
    payment_required BOOLEAN DEFAULT FALSE,
    payment_amount DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'none', -- none, pending, paid, refunded
    payment_method VARCHAR(50),
    
    -- Staff assignment
    assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_reservations_date (reservation_date),
    INDEX idx_reservations_status (status),
    INDEX idx_reservations_guest (guest_id),
    INDEX idx_reservations_venue_date (venue_id, reservation_date)
);

-- Waitlist
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    
    -- Waitlist details
    requested_date DATE NOT NULL,
    requested_time TIME,
    party_size INTEGER NOT NULL,
    flexible_timing BOOLEAN DEFAULT TRUE,
    
    -- Guest information
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50) NOT NULL,
    
    -- Preferences
    preferred_zones TEXT[],
    special_requests TEXT,
    
    -- Waitlist management
    priority_level INTEGER DEFAULT 0, -- Higher number = higher priority
    estimated_wait_time INTEGER, -- minutes
    
    -- Status
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, contacted, confirmed, expired, cancelled
    
    -- Notifications
    notification_preferences JSONB DEFAULT '{"sms": true, "email": true, "call": false}',
    notified_at TIMESTAMP WITH TIME ZONE,
    
    -- Conversion tracking
    converted_to_reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    converted_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_waitlist_date (requested_date),
    INDEX idx_waitlist_status (status)
);

-- =====================================================
-- EVENTS AND CAMPAIGNS
-- =====================================================

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    
    -- Event details
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    
    -- Event timing
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
    
    -- Event type and properties
    event_type VARCHAR(50) DEFAULT 'special', -- special, recurring, private, public
    category VARCHAR(100),
    
    -- Capacity and pricing
    max_capacity INTEGER,
    price_per_person DECIMAL(10,2),
    requires_payment BOOLEAN DEFAULT FALSE,
    
    -- Registration settings
    registration_required BOOLEAN DEFAULT TRUE,
    registration_deadline TIMESTAMP WITH TIME ZONE,
    allow_waitlist BOOLEAN DEFAULT TRUE,
    
    -- Event media
    cover_image_url TEXT,
    gallery_images TEXT[],
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, cancelled, completed
    visibility VARCHAR(20) DEFAULT 'public', -- public, private, unlisted
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_events_date (event_date),
    INDEX idx_events_slug (slug),
    INDEX idx_events_status (status)
);

-- Event registrations
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    
    -- Registration details
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50),
    party_size INTEGER DEFAULT 1,
    
    -- Special requirements
    dietary_requirements TEXT[],
    special_requests TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'registered', -- registered, confirmed, cancelled, attended, no_show
    
    -- Payment
    payment_required BOOLEAN DEFAULT FALSE,
    payment_amount DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'none',
    
    -- Metadata
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    attended_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- STAFF AND TEAM MANAGEMENT
-- =====================================================

-- Staff profiles (extends users table)
CREATE TABLE staff_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Job details
    job_title VARCHAR(100),
    department VARCHAR(100),
    employment_type VARCHAR(50) DEFAULT 'full_time', -- full_time, part_time, contract, temporary
    
    -- Contact and emergency
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    
    -- Work schedule
    work_schedule JSONB, -- {"monday": {"start": "09:00", "end": "17:00"}, ...}
    hourly_rate DECIMAL(8,2),
    
    -- Permissions and access
    permissions JSONB DEFAULT '{}',
    access_level VARCHAR(50) DEFAULT 'basic', -- basic, advanced, manager, admin
    
    -- Performance tracking
    hire_date DATE,
    last_performance_review DATE,
    performance_score INTEGER, -- 1-100
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, on_leave, terminated
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- COMMUNICATIONS AND NOTIFICATIONS
-- =====================================================

-- Communication templates
CREATE TABLE communication_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template type and trigger
    template_type VARCHAR(50) NOT NULL, -- email, sms, whatsapp, push
    trigger_event VARCHAR(100) NOT NULL, -- reservation_confirmed, reminder_24h, etc.
    
    -- Template content
    subject VARCHAR(255), -- For email
    content TEXT NOT NULL,
    content_html TEXT, -- For email
    
    -- Template variables available
    available_variables TEXT[], -- ['guest_name', 'reservation_date', etc.]
    
    -- Settings
    send_delay_minutes INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    
    -- Usage statistics
    sent_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communication logs
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Recipient information
    recipient_type VARCHAR(20) NOT NULL, -- guest, staff, admin
    recipient_id UUID, -- guest_id, user_id, etc.
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    
    -- Communication details
    communication_type VARCHAR(20) NOT NULL, -- email, sms, whatsapp, push
    template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
    
    -- Content
    subject VARCHAR(255),
    content TEXT NOT NULL,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed, opened, clicked
    
    -- External service details
    external_id VARCHAR(255), -- SMS ID, Email ID, etc.
    external_status VARCHAR(100),
    error_message TEXT,
    
    -- Timing
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    
    -- Cost tracking
    cost_amount DECIMAL(8,4),
    cost_currency VARCHAR(3) DEFAULT 'EGP',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_comm_logs_recipient (recipient_type, recipient_id),
    INDEX idx_comm_logs_status (status),
    INDEX idx_comm_logs_type (communication_type)
);

-- =====================================================
-- ANALYTICS AND REPORTING
-- =====================================================

-- Daily analytics summary
CREATE TABLE daily_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    
    analytics_date DATE NOT NULL,
    
    -- Reservation metrics
    total_reservations INTEGER DEFAULT 0,
    confirmed_reservations INTEGER DEFAULT 0,
    cancelled_reservations INTEGER DEFAULT 0,
    no_show_reservations INTEGER DEFAULT 0,
    walk_in_reservations INTEGER DEFAULT 0,
    
    -- Guest metrics
    total_guests INTEGER DEFAULT 0,
    new_guests INTEGER DEFAULT 0,
    returning_guests INTEGER DEFAULT 0,
    vip_guests INTEGER DEFAULT 0,
    
    -- Revenue metrics
    total_revenue DECIMAL(12,2) DEFAULT 0,
    average_party_size DECIMAL(4,2) DEFAULT 0,
    average_spend_per_guest DECIMAL(8,2) DEFAULT 0,
    
    -- Operational metrics
    table_turnover_rate DECIMAL(4,2) DEFAULT 0,
    average_wait_time INTEGER DEFAULT 0, -- minutes
    occupancy_rate DECIMAL(5,2) DEFAULT 0, -- percentage
    
    -- Communication metrics
    emails_sent INTEGER DEFAULT 0,
    sms_sent INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_daily_analytics UNIQUE (organization_id, venue_id, analytics_date)
);

-- =====================================================
-- ACTIVITY LOGS AND AUDIT TRAIL
-- =====================================================

-- Activity logs for audit trail
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Actor information
    actor_type VARCHAR(20) NOT NULL, -- user, system, guest, api
    actor_id UUID, -- user_id, guest_id, etc.
    actor_name VARCHAR(255),
    actor_email VARCHAR(255),
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- create, update, delete, login, etc.
    resource_type VARCHAR(50), -- reservation, guest, table, etc.
    resource_id UUID,
    
    -- Change details
    changes JSONB, -- Before/after values
    description TEXT,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_activity_logs_actor (actor_type, actor_id),
    INDEX idx_activity_logs_resource (resource_type, resource_id),
    INDEX idx_activity_logs_date (created_at)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Basic examples - need to be customized based on requirements)

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view own organization" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM users 
            WHERE users.id = auth.uid()
        )
    );

-- Guests: Users can only see guests from their organization
CREATE POLICY "Users can view organization guests" ON guests
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE users.id = auth.uid()
        )
    );

-- Reservations: Users can only see reservations from their organization
CREATE POLICY "Users can view organization reservations" ON reservations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE users.id = auth.uid()
        )
    );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional indexes for better query performance
CREATE INDEX idx_guests_organization_email ON guests(organization_id, email);
CREATE INDEX idx_guests_organization_phone ON guests(organization_id, phone);
CREATE INDEX idx_guests_vip_status ON guests(vip_status) WHERE vip_status = true;
CREATE INDEX idx_guests_spending_tier ON guests(spending_tier);
CREATE INDEX idx_guests_visit_frequency ON guests(visit_frequency);

CREATE INDEX idx_reservations_org_date_status ON reservations(organization_id, reservation_date, status);
CREATE INDEX idx_reservations_guest_status ON reservations(guest_id, status);
CREATE INDEX idx_reservations_confirmation_code ON reservations(confirmation_code);

CREATE INDEX idx_waitlist_org_date_status ON waitlist(organization_id, requested_date, status);
CREATE INDEX idx_waitlist_phone ON waitlist(guest_phone);

CREATE INDEX idx_events_org_date ON events(organization_id, event_date);
CREATE INDEX idx_event_registrations_event_status ON event_registrations(event_id, status);

CREATE INDEX idx_comm_logs_org_date ON communication_logs(organization_id, created_at);
CREATE INDEX idx_comm_logs_external_id ON communication_logs(external_id);

CREATE INDEX idx_activity_logs_org_date ON activity_logs(organization_id, created_at);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE ON waitlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_profiles_updated_at BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communication_templates_updated_at BEFORE UPDATE ON communication_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate confirmation codes
CREATE OR REPLACE FUNCTION generate_confirmation_code()
RETURNS TEXT AS $$
BEGIN
    RETURN upper(substring(md5(random()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate confirmation codes for reservations
CREATE OR REPLACE FUNCTION set_reservation_confirmation_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.confirmation_code IS NULL THEN
        NEW.confirmation_code := generate_confirmation_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_reservation_confirmation_code_trigger 
    BEFORE INSERT ON reservations 
    FOR EACH ROW 
    EXECUTE FUNCTION set_reservation_confirmation_code();

-- Function to update guest statistics when reservations change
CREATE OR REPLACE FUNCTION update_guest_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update guest statistics
        UPDATE guests SET
            total_reservations = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = NEW.guest_id
            ),
            completed_reservations = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = NEW.guest_id AND status = 'completed'
            ),
            cancelled_reservations = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = NEW.guest_id AND status = 'cancelled'
            ),
            no_show_count = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = NEW.guest_id AND status = 'no_show'
            ),
            last_visit_date = (
                SELECT MAX(reservation_date) FROM reservations 
                WHERE guest_id = NEW.guest_id AND status = 'completed'
            ),
            updated_at = NOW()
        WHERE id = NEW.guest_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        -- Update guest statistics after deletion
        UPDATE guests SET
            total_reservations = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = OLD.guest_id
            ),
            completed_reservations = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = OLD.guest_id AND status = 'completed'
            ),
            cancelled_reservations = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = OLD.guest_id AND status = 'cancelled'
            ),
            no_show_count = (
                SELECT COUNT(*) FROM reservations 
                WHERE guest_id = OLD.guest_id AND status = 'no_show'
            ),
            updated_at = NOW()
        WHERE id = OLD.guest_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guest_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_stats();

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert default guest tags
INSERT INTO guest_tags (id, organization_id, name, color, category, description) VALUES
(uuid_generate_v4(), (SELECT id FROM organizations LIMIT 1), 'VIP', '#ff3131', 'status', 'VIP guest with special privileges'),
(uuid_generate_v4(), (SELECT id FROM organizations LIMIT 1), 'High Spender', '#22c55e', 'behavior', 'Guest who spends above average'),
(uuid_generate_v4(), (SELECT id FROM organizations LIMIT 1), 'Regular', '#3b82f6', 'behavior', 'Frequent returning guest'),
(uuid_generate_v4(), (SELECT id FROM organizations LIMIT 1), 'Birthday Club', '#a855f7', 'preference', 'Guest enrolled in birthday celebrations'),
(uuid_generate_v4(), (SELECT id FROM organizations LIMIT 1), 'Business Diner', '#f59e0b', 'preference', 'Guest who frequently dines for business'),
(uuid_generate_v4(), (SELECT id FROM organizations LIMIT 1), 'Family Friendly', '#06b6d4', 'preference', 'Guest who typically brings family');

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for guest summary with statistics
CREATE VIEW guest_summary AS
SELECT 
    g.*,
    ARRAY_AGG(DISTINCT gt.name) FILTER (WHERE gt.name IS NOT NULL) as tag_names,
    COALESCE(r.avg_party_size, 1) as average_party_size,
    COALESCE(r.total_spend, 0) as calculated_total_spend
FROM guests g
LEFT JOIN guest_tag_assignments gta ON g.id = gta.guest_id
LEFT JOIN guest_tags gt ON gta.tag_id = gt.id
LEFT JOIN (
    SELECT 
        guest_id,
        AVG(party_size) as avg_party_size,
        SUM(COALESCE(payment_amount, 0)) as total_spend
    FROM reservations 
    WHERE status = 'completed'
    GROUP BY guest_id
) r ON g.id = r.guest_id
GROUP BY g.id, r.avg_party_size, r.total_spend;

-- View for reservation details with guest info
CREATE VIEW reservation_details AS
SELECT 
    r.*,
    g.full_name as guest_full_name,
    g.email as guest_email_confirmed,
    g.phone as guest_phone_confirmed,
    g.vip_status,
    v.name as venue_name,
    t.table_number,
    z.name as zone_name
FROM reservations r
LEFT JOIN guests g ON r.guest_id = g.id
LEFT JOIN venues v ON r.venue_id = v.id
LEFT JOIN tables t ON r.table_id = t.id
LEFT JOIN zones z ON r.zone_id = z.id;

-- View for daily reservation summary
CREATE VIEW daily_reservation_summary AS
SELECT 
    organization_id,
    venue_id,
    reservation_date,
    COUNT(*) as total_reservations,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
    COUNT(*) FILTER (WHERE status = 'no_show') as no_show_count,
    SUM(party_size) as total_guests,
    AVG(party_size) as avg_party_size,
    SUM(COALESCE(payment_amount, 0)) as total_revenue
FROM reservations
GROUP BY organization_id, venue_id, reservation_date;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE organizations IS 'Restaurant/business entities in the system';
COMMENT ON TABLE users IS 'All system users including admins, staff, and guests';
COMMENT ON TABLE guests IS 'Customer profiles with preferences and analytics';
COMMENT ON TABLE reservations IS 'Restaurant reservations with full lifecycle tracking';
COMMENT ON TABLE waitlist IS 'Waitlist entries for when tables are not available';
COMMENT ON TABLE events IS 'Special events and campaigns';
COMMENT ON TABLE venues IS 'Physical locations/restaurants';
COMMENT ON TABLE tables IS 'Individual tables with positioning and properties';
COMMENT ON TABLE zones IS 'Dining areas/zones within venues';
COMMENT ON TABLE communication_logs IS 'Log of all communications sent to guests';
COMMENT ON TABLE activity_logs IS 'Audit trail of all system activities';
COMMENT ON TABLE daily_analytics IS 'Pre-calculated daily metrics for reporting';

-- End of schema