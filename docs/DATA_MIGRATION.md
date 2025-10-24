# Guest-to-Auth Data Migration Strategy

## Overview
When a user signs up or signs in for the first time, we need to migrate their locally stored data (reminders, selected apps, analytics, settings) to be associated with their authenticated account.

## Current Local Storage Keys
- `ff:selectedApps` - App selection map
- `ff:reminders` - Reminder configurations
- `ff:analytics` - Session history
- `ff:settings` - User preferences
- `ff:premium` - Premium status (local testing only)

## Migration Strategy

### 1. Migration Trigger
- **When**: First successful sign-in after guest usage
- **Detection**: Check if local data exists when auth state changes to authenticated
- **One-time**: Use migration flag to prevent repeated migrations

### 2. Migration Process
```javascript
// Pseudo-code for migration flow
async function migrateGuestData(userId) {
  const migrationKey = `ff:migrated:${userId}`;
  const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
  
  if (alreadyMigrated) return; // Skip if already migrated
  
  // Check for existing local data
  const localReminders = await getReminders();
  const localApps = await getSelectedApps();
  const localAnalytics = await getAnalyticsHistory();
  const localSettings = await getSettings();
  
  if (localReminders.length > 0 || Object.keys(localApps).length > 0) {
    // Show migration prompt to user
    const shouldMigrate = await showMigrationPrompt();
    
    if (shouldMigrate) {
      // Upload data to user's cloud storage (future: Supabase tables)
      await uploadUserData(userId, {
        reminders: localReminders,
        apps: localApps,
        analytics: localAnalytics,
        settings: localSettings
      });
      
      // Mark as migrated
      await AsyncStorage.setItem(migrationKey, 'true');
    }
  }
}
```

### 3. Cloud Storage Schema (Future Phase 9)
When implementing real cloud sync, create Supabase tables:

```sql
-- User reminders
CREATE TABLE user_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  reminder_data jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

-- User app selections
CREATE TABLE user_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  app_data jsonb NOT NULL,
  updated_at timestamp DEFAULT now()
);

-- User analytics
CREATE TABLE user_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  session_data jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

-- User settings
CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  settings_data jsonb NOT NULL,
  updated_at timestamp DEFAULT now()
);
```

### 4. Implementation Phases

#### Phase 8 (Current)
- ✅ Basic auth implemented
- ⏳ Migration prompt UI
- ⏳ Local data detection
- ⏳ Migration flag storage

#### Phase 9 (Next)
- Cloud storage tables
- Real data upload/download
- Conflict resolution (local vs cloud)
- Cross-device sync

### 5. User Experience
1. **Guest Usage**: User creates reminders/selections locally
2. **First Sign-In**: App detects local data and shows prompt:
   ```
   "Welcome! We found some reminders and settings on this device. 
   Would you like to save them to your account?"
   [Keep Local] [Save to Account]
   ```
3. **Migration**: Data moves to cloud, local data remains as backup
4. **Future Sign-Ins**: Data loads from cloud, merges with any new local data

### 6. Edge Cases
- **No local data**: No migration needed, start fresh
- **Already has cloud data**: Offer to merge or replace
- **Migration failure**: Keep local data, retry option
- **Sign out**: Keep local data separate from cloud data

## Next Steps
1. Implement migration detection in auth listener
2. Create migration prompt UI component  
3. Add migration flag storage
4. Plan cloud storage schema for Phase 9