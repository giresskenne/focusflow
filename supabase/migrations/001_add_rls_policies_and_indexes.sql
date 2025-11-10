-- Migration: Add RLS policies for user_analytics, performance indexes, and schema versioning
-- Created: 2025-11-09
-- Purpose: Fix critical production readiness issues
-- Instructions: Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- ============================================================================
-- 1. VERIFY RLS POLICIES FOR user_analytics TABLE
-- ============================================================================
-- Note: Your existing policies.sql already sets up RLS for all tables
-- This section verifies user_analytics has proper policies
-- The existing policy "own_analytics_all" covers SELECT, INSERT, UPDATE, DELETE
-- No changes needed if policies.sql was already applied

-- If you haven't run policies.sql yet, uncomment these lines:
/*
CREATE POLICY "Users can read their own analytics"
  ON user_analytics 
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics"
  ON user_analytics 
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics"
  ON user_analytics 
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analytics"
  ON user_analytics 
  FOR DELETE
  USING (auth.uid() = user_id);
*/

-- ============================================================================
-- 2. ADD PERFORMANCE INDEXES
-- ============================================================================
-- Problem: No indexes on frequently queried columns causing slow queries
-- Impact: Poor performance when querying reminders and analytics by date
-- Fix: Add indexes on commonly filtered/sorted columns

-- Speed up reminder queries by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_user_reminders_created 
  ON user_reminders(user_id, created_at DESC);

-- Speed up analytics queries by creation date (recent events first)
CREATE INDEX IF NOT EXISTS idx_user_analytics_created 
  ON user_analytics(user_id, created_at DESC);

-- Speed up settings lookups (already indexed by primary key user_id)
-- No additional index needed for user_settings

-- Speed up apps lookups (already has unique constraint on user_id)
-- No additional index needed for user_apps

-- ============================================================================
-- 3. ADD SCHEMA VERSIONING TO user_settings TABLE
-- ============================================================================
-- Problem: No way to track settings structure version, risky for schema migrations
-- Impact: Future schema changes could break old settings without versioning
-- Fix: Add schema_version column to track settings format changes

ALTER TABLE user_settings 
  ADD COLUMN IF NOT EXISTS schema_version INT DEFAULT 1;

-- Add comment to document versioning strategy
COMMENT ON COLUMN user_settings.schema_version IS 
  'Tracks the structure version of the settings_data jsonb field. Increment when changing format.';

-- ============================================================================
-- 4. ADD AUTOMATIC TIMESTAMP UPDATE TRIGGERS
-- ============================================================================
-- Problem: updated_at is only updated manually in application code
-- Impact: Inconsistent timestamps if code forgets to update
-- Fix: Automatic triggers to update timestamps on every UPDATE

-- Create or replace the trigger function for user_settings
CREATE OR REPLACE FUNCTION update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger function for user_apps
CREATE OR REPLACE FUNCTION update_user_apps_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (safe to re-run)
DROP TRIGGER IF EXISTS update_user_settings_timestamp_trigger ON user_settings;
DROP TRIGGER IF EXISTS update_user_apps_timestamp_trigger ON user_apps;

-- Create triggers on UPDATE operations
CREATE TRIGGER update_user_settings_timestamp_trigger
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_timestamp();

CREATE TRIGGER update_user_apps_timestamp_trigger
  BEFORE UPDATE ON user_apps
  FOR EACH ROW
  EXECUTE FUNCTION update_user_apps_timestamp();

-- ============================================================================
-- 5. VERIFICATION QUERIES
-- ============================================================================
-- Run these after applying the migration to verify everything is correct

-- Verify RLS is enabled on all tables (should return true for all)
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_reminders', 'user_apps', 'user_analytics', 'user_settings')
ORDER BY tablename;

-- Count policies per table (user_analytics should now have 4)
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_reminders', 'user_apps', 'user_analytics', 'user_settings')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- List all policies with their allowed operations
SELECT 
  tablename,
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_reminders', 'user_apps', 'user_analytics', 'user_settings')
ORDER BY tablename, operation;

-- Verify indexes were created successfully
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_user_reminders_created',
    'idx_user_analytics_created'
  )
ORDER BY tablename;

-- Verify schema_version column was added to user_settings
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_settings'
  AND column_name = 'schema_version';

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- Run this section ONLY if you need to undo the migration
-- Uncomment and run each statement individually if rollback is needed

/*
-- Drop RLS policies (only if you created the separate policies above)
DROP POLICY IF EXISTS "Users can read their own analytics" ON user_analytics;
DROP POLICY IF EXISTS "Users can insert their own analytics" ON user_analytics;
DROP POLICY IF EXISTS "Users can update their own analytics" ON user_analytics;
DROP POLICY IF EXISTS "Users can delete their own analytics" ON user_analytics;

-- Drop indexes
DROP INDEX IF EXISTS idx_user_reminders_created;
DROP INDEX IF EXISTS idx_user_analytics_created;

-- Drop schema_version column
ALTER TABLE user_settings DROP COLUMN IF EXISTS schema_version;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS update_user_settings_timestamp_trigger ON user_settings;
DROP TRIGGER IF EXISTS update_user_apps_timestamp_trigger ON user_apps;
DROP FUNCTION IF EXISTS update_user_settings_timestamp();
DROP FUNCTION IF EXISTS update_user_apps_timestamp();
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Expected results after applying this migration:
-- ✅ RLS policies verified (already set up via policies.sql)
-- ✅ 2 new indexes improve query performance on reminders and analytics
-- ✅ user_settings.schema_version column tracks settings format version
-- ✅ Automatic timestamp updates via triggers on user_settings and user_apps
-- ✅ All verification queries pass successfully
