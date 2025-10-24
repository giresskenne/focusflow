-- Row Level Security policies for FocusFlow user data tables
-- Apply these in your Supabase project when enabling cloud sync (Phase 9)

-- Enable RLS
alter table if exists user_reminders enable row level security;
alter table if exists user_apps enable row level security;
alter table if exists user_analytics enable row level security;
alter table if exists user_settings enable row level security;

-- Reminders: per-row access by owner
drop policy if exists own_reminders_select on user_reminders;
create policy own_reminders_select
on user_reminders for select
using (auth.uid() = user_id);

drop policy if exists own_reminders_insert on user_reminders;
create policy own_reminders_insert
on user_reminders for insert
with check (auth.uid() = user_id);

drop policy if exists own_reminders_update on user_reminders;
create policy own_reminders_update
on user_reminders for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists own_reminders_delete on user_reminders;
create policy own_reminders_delete
on user_reminders for delete
using (auth.uid() = user_id);

-- Apps: single row per user
drop policy if exists own_apps_all on user_apps;
create policy own_apps_all
on user_apps for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Analytics: per-row access by owner
drop policy if exists own_analytics_all on user_analytics;
create policy own_analytics_all
on user_analytics for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Settings: 1 row per user
drop policy if exists own_settings_all on user_settings;
create policy own_settings_all
on user_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
