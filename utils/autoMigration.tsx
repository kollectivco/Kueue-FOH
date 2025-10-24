// Auto-Migration System for Kueue RSVP Platform
// Automatically checks and applies database migrations on app startup

import { projectId, publicAnonKey } from './supabase/info';

export interface MigrationStatus {
  needsMigration: boolean;
  total: number;
  applied: number;
  pending: number;
  lastRun: string | null;
  appliedMigrations: string[];
  pendingMigrations: Array<{
    id: string;
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface MigrationResult {
  success: boolean;
  results?: Array<{
    id: string;
    name: string;
    status: 'success' | 'failed' | 'skipped';
    message?: string;
    error?: string;
  }>;
  status?: {
    total: number;
    applied: number;
    failed: number;
    skipped: number;
  };
  message?: string;
  error?: string;
}

/**
 * Check if database migrations are needed
 */
export async function checkMigrationStatus(): Promise<MigrationStatus | null> {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/migrations/check`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    );

    if (!response.ok) {
      console.error('❌ Migration check failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.status) {
      console.log('✅ Migration status:', data.status);
      return data.status;
    }

    return null;
  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    return null;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<MigrationResult> {
  try {
    console.log('🔄 Running database migrations...');
    
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/migrations/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout for migrations
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Migration failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Migrations completed successfully:', data.status);
    } else {
      console.warn('⚠️ Migrations completed with errors:', data.message);
    }

    return data;
  } catch (error: any) {
    console.error('❌ Error running migrations:', error);
    return {
      success: false,
      error: error.message || 'Failed to run migrations'
    };
  }
}

/**
 * Run a specific migration by ID
 */
export async function runMigration(migrationId: string): Promise<MigrationResult> {
  try {
    console.log(`🔄 Running migration ${migrationId}...`);
    
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/migrations/run/${migrationId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000)
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Migration failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Migration ${migrationId} completed successfully`);
    } else {
      console.warn(`⚠️ Migration ${migrationId} failed:`, data.error);
    }

    return data;
  } catch (error: any) {
    console.error(`❌ Error running migration ${migrationId}:`, error);
    return {
      success: false,
      error: error.message || `Failed to run migration ${migrationId}`
    };
  }
}

/**
 * Auto-check and run migrations if needed (silent mode for app startup)
 */
export async function autoMigrate(options?: {
  silent?: boolean;
  onProgress?: (message: string) => void;
}): Promise<{ success: boolean; needsManualIntervention?: boolean }> {
  const { silent = true, onProgress } = options || {};

  try {
    // Check migration status
    if (onProgress && !silent) onProgress('Checking database migrations...');
    
    const status = await checkMigrationStatus();
    
    if (!status) {
      // Server not available or migration check failed
      if (!silent) {
        console.log('⚠️ Migration check unavailable - server may not be deployed');
      }
      return { success: true }; // Continue without blocking
    }

    if (!status.needsMigration) {
      if (!silent) {
        console.log('✅ Database is up to date');
      }
      return { success: true };
    }

    // Migrations needed
    if (!silent) {
      console.log(`📋 Found ${status.pending} pending migrations`);
      if (onProgress) onProgress(`Applying ${status.pending} migrations...`);
    }

    // Run migrations
    const result = await runMigrations();

    if (!result.success) {
      console.error('❌ Auto-migration failed:', result.error);
      return {
        success: false,
        needsManualIntervention: true
      };
    }

    if (!silent) {
      console.log('✅ Auto-migration completed successfully');
      if (onProgress) onProgress('Database updated successfully');
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Auto-migration error:', error);
    // Don't block app startup on migration failures
    return { success: true };
  }
}

/**
 * Reset migration status (for development only)
 */
export async function resetMigrations(): Promise<boolean> {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e/migrations/reset`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      throw new Error(`Reset failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error resetting migrations:', error);
    return false;
  }
}
