# Supabase Database Setup Guide

This guide walks you through setting up the Supabase backend for FocusFlow.

## 📋 Prerequisites

- [ ] Supabase account (free tier works for development)
- [ ] Node.js installed for running scripts
- [ ] Git repository access

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `focusflow` (or your preferred name)
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
4. Wait 2-3 minutes for project provisioning

### 2. Get Your API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xyzabc123.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Never commit `.env` to git!** (It's already in `.gitignore`)

### 4. Run Database Migrations

1. Go to your Supabase dashboard → **SQL Editor**
2. Open the migration file: `supabase/migrations/001_add_rls_policies_and_indexes.sql`
3. Copy the entire SQL content
4. Paste into the Supabase SQL Editor
5. Click **Run** (bottom right)

You should see: ✅ Success. No rows returned

### 5. Verify Setup

Run the verification queries at the bottom of the migration file to confirm:

```sql
-- Verify RLS is enabled (should return true for all)
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_data', 'user_reminders', 'user_analytics')
ORDER BY tablename;
```

Expected output:
```
tablename        | rls_enabled
-----------------+-------------
user_analytics   | true
user_data        | true
user_reminders   | true
```

### 6. Test Authentication

1. Start your app:
   ```bash
   npm start
   ```

2. Go to **Settings** → **Sign In**
3. Create a test account
4. Verify you can sign in/out successfully

---

## 📊 Database Schema

### Tables

#### `user_reminders`
Stores user-created reminders (one row per reminder).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `reminder_data` | JSONB | Reminder details (title, fire_at, etc.) |
| `created_at` | TIMESTAMPTZ | Creation time |

#### `user_apps`
Stores user's app blocking preferences (single row per user).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` (unique) |
| `app_data` | JSONB | App blocking configuration |
| `updated_at` | TIMESTAMPTZ | Last update time (auto-updated) |

#### `user_analytics`
Stores session tracking for analytics (one row per session).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `session_data` | JSONB | Session details (duration, apps blocked, etc.) |
| `created_at` | TIMESTAMPTZ | Session timestamp |

#### `user_settings`
Stores user preferences (exactly one row per user).

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Primary key, foreign key to `auth.users` |
| `settings_data` | JSONB | User preferences (notifications, voice, etc.) |
| `updated_at` | TIMESTAMPTZ | Last update time (auto-updated) |
| `schema_version` | INT | Settings format version (added by migration) |

---

## 🔒 Security (Row Level Security)

All tables have RLS policies that ensure users can only access their own data.

### Policies Applied

Each table has 4 policies:
- **SELECT**: Users can read their own records
- **INSERT**: Users can create records for themselves
- **UPDATE**: Users can modify their own records
- **DELETE**: Users can delete their own records

### Example Policy

```sql
CREATE POLICY "Users can read their own reminders"
  ON user_reminders
  FOR SELECT
  USING (auth.uid() = user_id);
```

This ensures `user_id` must match the authenticated user's ID.

---

## ⚡ Performance Indexes

The migration adds these indexes for faster queries:

| Index | Purpose | Impact |
|-------|---------|--------|
| `idx_user_reminders_created` | Speed up finding recent reminders | 10-100x faster |
| `idx_user_analytics_created` | Speed up analytics date range queries | 10-100x faster |

Note: `user_settings` and `user_apps` already have efficient lookups via primary key (`user_id`) and unique constraint.

---

## 🔄 Sync Logic

### How It Works

1. **Local-first**: All data stored in AsyncStorage by default
2. **Optional cloud sync**: Users can sign in to sync across devices
3. **Conflict resolution**: Last-write-wins (cloud timestamp checked)

### Sync Functions

Located in `src/lib/sync.js`:

```javascript
// Upload local data to cloud
await performMigrationUpload(userId);

// Download cloud data to local
await pullCloudToLocal(userId);

// Check if user has cloud data
const hasData = await hasCloudData(userId);
```

### When Sync Happens

- **Manual**: User taps "Sync to Cloud" in Settings
- **On Sign In**: Checks for cloud data and prompts to sync
- **On Sign Out**: Local data remains, cloud data untouched

---

## 🧪 Testing

### Create a Test User (Optional)

For automated testing, you can create a test user:

1. Get your **service_role** key from Supabase (Settings → API)
2. Add to `.env` (NEVER commit this):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. Run the script:
   ```bash
   node scripts/createTestUser.js
   ```

### Integration Tests

Run Supabase integration tests:

```bash
npm test -- supabase.int.test.js
```

---

## 🚨 Troubleshooting

### "No rows returned" or "permission denied"

**Problem**: RLS policies not applied or user not authenticated.

**Fix**:
1. Verify RLS policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```
2. Check if user is signed in:
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Session:', session);
   ```

### "relation does not exist"

**Problem**: Tables not created or migration not run.

**Fix**: Run the migration SQL in Supabase SQL Editor.

### Slow queries

**Problem**: Indexes not created.

**Fix**: Verify indexes exist:
```sql
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
```

### Data not syncing

**Problem**: Network error or auth issue.

**Fix**:
1. Check environment variables are set correctly
2. Verify Supabase URL is accessible
3. Check network logs in app for errors

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth with React Native](https://supabase.com/docs/guides/auth/auth-helpers/react-native)
- [Performance Tuning](https://supabase.com/docs/guides/database/performance)

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] `.env` file is in `.gitignore` (already done)
- [ ] No API keys committed to git
- [ ] RLS policies enabled on all tables
- [ ] Service role key (if used) is server-side only
- [ ] HTTPS enforced for Supabase URL
- [ ] Database backups enabled in Supabase dashboard
- [ ] Monitor suspicious activity in Supabase logs

---

## 🎯 Production Configuration

Update these in `.env` for production:

```bash
# Environment
EXPO_PUBLIC_ENV=production

# Enable cloud sync
EXPO_PUBLIC_ENABLE_MIGRATION_UPLOAD=true

# Disable dev features
EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV=false
EXPO_PUBLIC_ENABLE_STOREKIT_TEST=false

# Enable production IAP
EXPO_PUBLIC_ENABLE_IAP=true
REVENUECAT_IOS_API_KEY=appl_your_real_key

# Reduce logging
LOG_LEVEL=warn
EXPO_PUBLIC_LOG_LEVEL=warn
```

---

## 📞 Support

If you encounter issues not covered here:

1. Check Supabase dashboard logs (Logs → Postgres Logs)
2. Review app console logs for error messages
3. Check Supabase Status: [status.supabase.com](https://status.supabase.com)
4. Join Supabase Discord for community support

---

**Last Updated**: November 2025  
**Migration Version**: 001
