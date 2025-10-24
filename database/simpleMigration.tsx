import { supabase } from '../utils/supabase/client';

/**
 * Simple Database Migration Tool
 * Uses direct SQL execution without RPC dependencies
 */

export async function runSimpleMigration(): Promise<{
  success: boolean;
  message: string;
  tablesCreated?: number;
  errors?: string[];
}> {
  console.log('🚀 Starting simple database migration...');
  
  const errors: string[] = [];
  let tablesCreated = 0;

  try {
    // Test 1: Check if we can connect to database
    console.log('1️⃣ Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('organizations')
      .select('id')
      .limit(0);
    
    // If organizations table doesn't exist, we need to create schema
    if (testError && testError.message.includes('does not exist')) {
      console.log('📋 No schema found - need to create tables');
      
      // For now, return instructions since direct SQL execution requires special permissions
      return {
        success: false,
        message: 'Schema creation requires SQL Editor access in Supabase Dashboard',
        errors: [
          'Please follow these steps:',
          '1. Go to Supabase Dashboard → SQL Editor',
          '2. Copy the SQL from /database/schema.sql',
          '3. Execute it in the SQL Editor',
          '4. Return here and check status again'
        ]
      };
    }

    // If we can query organizations, check what tables exist
    console.log('2️⃣ Checking existing tables...');
    
    const tablesToCheck = [
      'organizations',
      'users', 
      'guests',
      'guest_tags',
      'venues',
      'zones',
      'tables',
      'reservations',
      'waitlist',
      'events',
      'event_registrations',
      'staff_profiles',
      'communication_templates',
      'communication_logs',
      'daily_analytics',
      'activity_logs'
    ];

    const existingTables: string[] = [];
    
    for (const table of tablesToCheck) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (!error) {
        existingTables.push(table);
        tablesCreated++;
      }
    }

    console.log(`✅ Found ${existingTables.length} existing tables`);

    if (existingTables.length === 0) {
      return {
        success: false,
        message: 'No production tables found. Manual SQL execution required.',
        tablesCreated: 0,
        errors: [
          'Database schema not initialized',
          'Please run schema.sql in Supabase SQL Editor',
          'See /database/schema.sql for complete schema'
        ]
      };
    }

    if (existingTables.length < tablesToCheck.length) {
      return {
        success: true,
        message: `Partial schema found: ${existingTables.length}/${tablesToCheck.length} tables exist`,
        tablesCreated: existingTables.length,
        errors: [
          `Missing tables: ${tablesToCheck.filter(t => !existingTables.includes(t)).join(', ')}`,
          'Some tables may need to be created manually'
        ]
      };
    }

    return {
      success: true,
      message: `✅ Complete schema found: ${existingTables.length}/${tablesToCheck.length} tables exist`,
      tablesCreated: existingTables.length
    };

  } catch (error: any) {
    console.error('Migration check error:', error);
    return {
      success: false,
      message: 'Migration check failed: ' + error.message,
      errors: [error.message]
    };
  }
}

/**
 * Create sample data for testing
 */
export async function createSampleOrganization(): Promise<{
  success: boolean;
  message: string;
  organizationId?: string;
}> {
  try {
    // Check if organizations table exists
    const { error: checkError } = await supabase
      .from('organizations')
      .select('id')
      .limit(0);

    if (checkError) {
      return {
        success: false,
        message: 'Organizations table not found. Run migration first.'
      };
    }

    // Create sample organization
    const { data, error } = await supabase
      .from('organizations')
      .insert([{
        name: 'Demo Restaurant',
        slug: 'demo-restaurant',
        email: 'info@demo.com',
        phone: '+201234567890',
        city: 'Cairo',
        country: 'Egypt'
      }])
      .select('id')
      .single();

    if (error) {
      if (error.message.includes('duplicate key')) {
        return {
          success: true,
          message: 'Demo organization already exists'
        };
      }
      throw error;
    }

    return {
      success: true,
      message: 'Sample organization created successfully',
      organizationId: data.id
    };

  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to create sample data: ' + error.message
    };
  }
}

/**
 * Check database status
 */
export async function checkDatabaseStatus(): Promise<{
  hasSchema: boolean;
  tables: string[];
  totalTables: number;
  existingTables: number;
  errors?: string[];
}> {
  const tables = [
    'organizations',
    'users', 
    'guests',
    'guest_tags',
    'venues',
    'zones',
    'tables',
    'reservations',
    'waitlist',
    'events',
    'event_registrations',
    'staff_profiles',
    'communication_templates',
    'communication_logs',
    'daily_analytics',
    'activity_logs',
    'guest_tag_assignments'
  ];

  const existingTables: string[] = [];

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (!error) {
        existingTables.push(table);
      }
    } catch (err) {
      // Table doesn't exist
    }
  }

  return {
    hasSchema: existingTables.length > 0,
    tables: existingTables,
    totalTables: tables.length,
    existingTables: existingTables.length,
    errors: []
  };
}
