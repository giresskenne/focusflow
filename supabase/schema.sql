-- FocusFlow Application Tables (run this BEFORE policies.sql)
-- Creates per-user data tables used for sync/backup. Users live in auth.users.

-- UUID generator (Supabase usually has pgcrypto, but ensure it):
create extension if not exists pgcrypto;

-- Reminders: one row per reminder
create table if not exists public.user_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_data jsonb not null,
  created_at timestamp with time zone not null default now()
);

-- Apps: single aggregated row per user
create table if not exists public.user_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_data jsonb not null,
  updated_at timestamp with time zone not null default now(),
  unique(user_id)
);

-- Analytics: one row per session record
create table if not exists public.user_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_data jsonb not null,
  created_at timestamp with time zone not null default now()
);

-- Settings: exactly one row per user
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings_data jsonb not null,
  updated_at timestamp with time zone not null default now()
);

-- Helpful indexes for per-user access patterns
create index if not exists idx_user_reminders_user on public.user_reminders(user_id);
create index if not exists idx_user_analytics_user on public.user_analytics(user_id);
