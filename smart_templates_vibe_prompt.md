# Implementation: Smart Reusable Templates for FocusFlow

## Product Vision
FocusFlow is a **minimalist focus app** with zero friction. Users should understand features instantly without tutorials. Every interaction should feel smooth, modern, and purposeful.

---

## Feature: Transform Template Buttons into Reusable Saved Selections

### Problem
Current template buttons (Social Media, Gaming, Entertainment, Block All) all open the same picker with no pre-filtering. This is redundant and misleading.

### Solution
Templates become **user-created saved selections** that can be reused instantly after first setup.

**User Flow:**
1. **First time:** Tap template → Opens picker → User selects apps → Selection saved
2. **Every time after:** Tap template → Session starts immediately (no picker)
3. **Edit anytime:** Long-press or tap edit icon → Opens picker to modify

---

## Implementation Tasks

### Task 1: Create Template Data Service

**File:** `focusflow-app/services/TemplateService.ts`

**Requirements:**
- Store template selections in AsyncStorage with key `app_templates`
- Each template has: id, name, icon, description, selection (base64 encoded), appCount, createdAt, lastUsedAt
- Default templates: Social Media, Gaming, Entertainment, Block All
- Methods: getTemplates(), getTemplate(id), saveTemplate(id, selection, appCount), isConfigured(id), deleteTemplate(id)
- Use TypeScript with proper interfaces

**Code Structure:**
```typescript
interface Template {
  id: string;
  name: string;
  icon: string; // Emoji
  description: string;
  selection: string | null; // Base64 encoded FamilyActivitySelection
  appCount: number;
  categoryCount: number;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const DEFAULT_TEMPLATES = [
  { id: 'social', name: 'Social Media', icon: '💬', description: 'Instagram, TikTok, Snapchat, Facebook' },
  { id: 'gaming', name: 'Gaming', icon: '🎮', description: 'Mobile games and platforms' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', description: 'YouTube, Netflix, streaming' },
  { id: 'blockall', name: 'Block All', icon: '🌐', description: 'Everything except emergency calls' }
];

// Implement singleton pattern
class TemplateService { ... }
export const templateService = TemplateService.getInstance();
```

---

### Task 2: Update App Blocking Service

**File:** `focusflow-app/services/AppBlockingService.ts`

**Add New Methods:**

```typescript
// Open native picker and return selection with metadata
async showActivityPicker(): Promise<{
  encoded: string;      // Base64 encoded selection
  appCount: number;
  categoryCount: number;
} | null>

// Start session using saved template selection
async startSessionWithSelection(
  encodedSelection: string,
  durationMinutes: number
): Promise<{ success: boolean; error?: string }>
```

**Native Module Bridge Updates:**

Add to `AppBlocker.swift` or equivalent:
```swift
@objc func showActivityPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
)

@objc func startSessionWithSelection(
    _ encodedSelection: String,
    duration: Int,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
)
```

**Important:** Use `JSONEncoder().encode()` for FamilyActivitySelection (NOT PropertyListEncoder)

---

### Task 3: Redesign Focus Session Screen UI

**File:** `focusflow-app/screens/FocusSession.tsx`

**Design Principles:**
- Minimalist, modern, clean
- Zero friction - no tutorials needed
- Visual feedback for every state
- Smooth animations (use React Native Animated or Reanimated)
- Dark mode friendly

**Layout Structure:**

```
┌─────────────────────────────────────┐
│  ⚡ Quick Start                     │ ← Section header (subtle)
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │ 💬       │  │ 🎮       │        │
│  │ Social   │  │ Gaming   │        │
│  │ Media    │  │          │        │
│  │          │  │ Not set  │        │
│  │ 8 apps   │  │          │        │
│  │ [Use] ⚙️ │  │ [Set Up] │        │ ← Configured vs Not Configured
│  └──────────┘  └──────────┘        │
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │ 🎬       │  │ 🌐       │        │
│  │ Entertain│  │ Block    │        │
│  │ ment     │  │ All      │        │
│  │          │  │          │        │
│  │ 3 apps   │  │ Not set  │        │
│  │ [Use] ⚙️ │  │ [Set Up] │        │
│  └──────────┘  └──────────┘        │
│                                      │
│  ─────── or ───────                 │ ← Subtle divider
│                                      │
│  ┌──────────────────────────────┐  │
│  │  📱 Custom Selection          │  │ ← Secondary action
│  └──────────────────────────────┘  │
│                                      │
│  SESSION DURATION                   │
│  [15] [30] [45] [60] Custom         │
│                                      │
└─────────────────────────────────────┘
```

**Card States:**

**State 1: Not Configured**
```
┌──────────────┐
│ 💬           │
│ Social Media │
│              │
│ Not set up   │ ← Gray text
│              │
│ [Set Up]     │ ← Primary button style
└──────────────┘
```

**State 2: Configured**
```
┌──────────────┐
│ 💬           │
│ Social Media │
│              │
│ 8 apps       │ ← Bold, accent color
│              │
│ [Use]    ⚙️  │ ← Use button + settings icon
└──────────────┘
```

**State 3: Recently Used** (optional polish)
```
┌──────────────┐
│ 💬     ✨    │ ← Sparkle or checkmark
│ Social Media │
│              │
│ 8 apps       │
│ Last: 2h ago │ ← Subtle timestamp
│ [Use]    ⚙️  │
└──────────────┘
```

---

### Task 4: Implement Template Interactions

**File:** `focusflow-app/screens/FocusSession.tsx`

**Interaction Patterns:**

#### Pattern 1: Tap Not Configured Template
```typescript
const handleTemplatePress = async (template: Template) => {
  if (!template.selection) {
    // Show brief explainer (first time only, use AsyncStorage flag)
    if (await isFirstTimeUser()) {
      showTooltip('Pick apps once, reuse instantly next time ⚡');
    }
    
    // Open picker
    await setupTemplate(template);
  } else {
    // Template configured - show action sheet
    showTemplateActions(template);
  }
};
```

#### Pattern 2: Action Sheet for Configured Templates
```typescript
const showTemplateActions = (template: Template) => {
  // Use React Native ActionSheet or custom bottom sheet
  ActionSheet.show({
    options: [
      {
        title: `Use ${template.name}`,
        icon: '▶️',
        subtitle: `Start session with ${template.appCount} apps blocked`,
        onPress: () => useTemplate(template)
      },
      {
        title: 'Edit Apps',
        icon: '⚙️',
        subtitle: 'Change which apps are blocked',
        onPress: () => editTemplate(template)
      },
      {
        title: 'Reset Template',
        icon: '🗑️',
        destructive: true,
        onPress: () => confirmDeleteTemplate(template)
      },
      {
        title: 'Cancel',
        cancel: true
      }
    ]
  });
};
```

#### Pattern 3: Settings Icon (Alternative to Action Sheet)
Add small settings icon (⚙️) to configured templates:
```typescript
<TouchableOpacity 
  style={styles.settingsIcon}
  onPress={() => editTemplate(template)}
>
  <Text>⚙️</Text>
</TouchableOpacity>
```

---

### Task 5: Block All Template - Special Logic

**Requirement:** "Block All" should block ALL apps except emergency services and phone calls

**Implementation Options:**

#### Option A: Use "All Apps & Categories" from Native Picker
```typescript
const setupBlockAllTemplate = async () => {
  // Open picker
  const selection = await appBlockingService.showActivityPicker();
  
  if (selection) {
    // Check if user selected "All Apps & Categories"
    if (selection.categoryCount > 0) {
      // Save as Block All template
      await templateService.saveTemplate('blockall', selection.encoded, selection.appCount);
      
      showTooltip('Block All configured! Emergency calls will still work ✅');
    } else {
      // User selected specific apps, not categories
      Alert.alert(
        'Select All Apps',
        'For "Block All", please select "All Apps & Categories" from the picker.',
        [{ text: 'Try Again', onPress: () => setupBlockAllTemplate() }]
      );
    }
  }
};
```

#### Option B: Guide User to Select All Categories
```typescript
// Before opening picker for Block All:
Alert.alert(
  '🌐 Block All Setup',
  'In the next screen, tap "All Apps & Categories" to block everything except emergency services.',
  [
    { text: 'Got it', onPress: () => openPicker() },
    { text: 'Cancel', style: 'cancel' }
  ]
);
```

**Apple Documentation Reference:**
Per Apple's FamilyActivityPicker docs, selecting "All Apps & Categories" is the recommended way to block everything while preserving emergency functionality.

---

### Task 6: First-Time User Onboarding (Minimal)

**Design Principle:** No tutorials, just contextual tooltips

**Implementation:**

#### Tooltip Component
```typescript
// components/Tooltip.tsx
interface TooltipProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  position?: 'top' | 'bottom';
}

// Show animated tooltip (fade in, auto-dismiss after 3 seconds)
// Use Animated API for smooth entrance/exit
// Tap anywhere to dismiss
```

#### Show Tooltips at Key Moments

**Moment 1: First Template Tap**
```
┌────────────────────────────────┐
│ 💬 Tap to set up this template │
│ You'll pick apps once, then    │
│ reuse instantly ⚡              │
└────────────────────────────────┘
```

**Moment 2: After First Setup**
```
┌────────────────────────────────┐
│ ✅ Template saved!             │
│ Next time, just tap "Use" to   │
│ start blocking instantly       │
└────────────────────────────────┘
```

**Moment 3: Template Card Hover** (optional)
Small info icon (ⓘ) that shows description on press:
```
Social Media
Instagram, TikTok, Snapchat, Facebook, Twitter, and more
```

**Storage:** Use AsyncStorage flag `has_seen_template_tooltip` to show once

---

### Task 7: Visual Polish & Animations

**Animation Requirements:**

1. **Template Card Tap:** Scale down slightly (0.95) with haptic feedback
2. **State Change:** Fade transition when switching between "Not set" and "X apps"
3. **Action Sheet:** Slide up from bottom with backdrop fade
4. **Tooltip:** Fade in with slight upward movement
5. **Use Button:** Loading spinner while starting session

**Code Example:**
```typescript
import { Animated, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

const TemplateCard = ({ template, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true
    }).start();
  };
  
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        {/* Card content */}
      </TouchableOpacity>
    </Animated.View>
  );
};
```

---

### Task 8: Error Handling & Edge Cases

**Handle These Scenarios:**

#### Scenario 1: User Cancels Picker
```typescript
const setupTemplate = async (template: Template) => {
  const selection = await appBlockingService.showActivityPicker();
  
  if (!selection) {
    // User cancelled - do nothing, no error message needed
    console.log('User cancelled picker');
    return;
  }
  
  // Continue with setup...
};
```

#### Scenario 2: User Selects 0 Apps
```typescript
if (selection.appCount === 0 && selection.categoryCount === 0) {
  Alert.alert(
    'No Apps Selected',
    'Please select at least one app or category to block.',
    [{ text: 'Try Again', onPress: () => setupTemplate(template) }]
  );
  return;
}
```

#### Scenario 3: Selection Becomes Invalid (apps uninstalled)
```typescript
const useTemplate = async (template: Template) => {
  try {
    const result = await appBlockingService.startSessionWithSelection(
      template.selection,
      duration
    );
    
    if (!result.success) {
      // Selection might be invalid
      Alert.alert(
        'Template Needs Update',
        'Some apps may have been uninstalled. Would you like to update this template?',
        [
          { text: 'Update Now', onPress: () => editTemplate(template) },
          { text: 'Delete Template', onPress: () => deleteTemplate(template), style: 'destructive' },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  } catch (error) {
    // Handle error
  }
};
```

#### Scenario 4: Template Sync (Premium Feature - Future)
```typescript
// Store template selections in Supabase for premium users
// Use App Groups to share between device activity extensions
// Handle conflicts if user edits template on multiple devices
```

---

### Task 9: Analytics Tracking

**Track These Events:**

```typescript
// analytics/events.ts
export const trackTemplateCreated = (templateId: string, appCount: number) => {
  analytics.track('template_created', { template_id: templateId, app_count: appCount });
};

export const trackTemplateUsed = (templateId: string) => {
  analytics.track('template_used', { template_id: templateId });
};

export const trackTemplateEdited = (templateId: string) => {
  analytics.track('template_edited', { template_id: templateId });
};

export const trackTemplateDeleted = (templateId: string) => {
  analytics.track('template_deleted', { template_id: templateId });
};

export const trackCustomSelection = () => {
  analytics.track('custom_selection_used');
};
```

**Key Metrics to Monitor:**
- Which templates are most popular?
- How many users set up templates vs use custom selection?
- Average time between template creation and first reuse
- Template edit frequency (indicates selection becoming stale)

---

### Task 10: Accessibility

**Requirements:**

1. **Screen Reader Support:**
```typescript
<TouchableOpacity
  accessible={true}
  accessibilityLabel={`${template.name} template. ${
    template.selection 
      ? `Configured with ${template.appCount} apps. Double tap to use.`
      : 'Not configured. Double tap to set up.'
  }`}
  accessibilityHint="Opens app picker to select apps to block"
>
```

2. **Haptic Feedback:**
- Light impact on button press
- Success haptic after template save
- Warning haptic before deletion

3. **Color Contrast:**
- Ensure text meets WCAG AA standards (4.5:1 for normal text)
- Test in light and dark mode

4. **Touch Targets:**
- Minimum 44x44 points for all buttons
- Adequate spacing between template cards (16pt minimum)

---

## Testing Checklist

### Functional Tests
- [ ] First-time user: All 4 templates show "Not set up"
- [ ] Tap "Set Up" → Opens FamilyActivityPicker
- [ ] Select apps in picker → Returns to screen → Template shows app count
- [ ] Tap configured template → Shows "Use" and settings options
- [ ] Tap "Use" → Session starts immediately (no picker)
- [ ] Tap settings → Opens picker with current selection
- [ ] Edit template → Picker shows previous selection, can modify
- [ ] Delete template → Resets to "Not set up" state
- [ ] "Block All" template → Guides user to select all categories
- [ ] Custom selection button → Opens picker, starts session, does NOT save as template
- [ ] Templates persist after app restart
- [ ] Templates persist after app update

### Edge Cases
- [ ] Cancel picker → No error, returns to screen normally
- [ ] Select 0 apps → Shows error, prompts to try again
- [ ] Use template with uninstalled apps → Shows error, offers to update
- [ ] Multiple rapid taps → No duplicate sessions or crashes
- [ ] Switch duration while template selected → Uses new duration
- [ ] Background app during picker → No crash on return

### UI/UX Tests
- [ ] Animations smooth at 60fps
- [ ] Haptic feedback feels appropriate
- [ ] Tooltip appears on first template tap only
- [ ] Action sheet slides smoothly
- [ ] Dark mode looks good
- [ ] Works on small screens (iPhone SE)
- [ ] Works on large screens (iPhone Pro Max)
- [ ] Text doesn't overflow on any device
- [ ] Icons render correctly

### Performance Tests
- [ ] Template list loads instantly (<100ms)
- [ ] No lag when opening picker
- [ ] No memory leaks after multiple template creations
- [ ] AsyncStorage operations don't block UI

---

## Code Quality Requirements


### Error Handling
- All async operations wrapped in try-catch
- User-friendly error messages (no technical jargon)
- Log errors to console for debugging
- Never crash the app


### Documentation
- JSDoc comments for public methods
- Inline comments for complex logic
- README update with template feature explanation

---

## Design Tokens (Use Existing from Theme)

## Success Criteria

**Implementation is complete when:**
1. ✅ User can set up 4 default templates by selecting apps in picker
2. ✅ Configured templates show app count and "Use" button
3. ✅ Tapping "Use" starts session instantly without picker
4. ✅ User can edit templates to change app selection
5. ✅ "Block All" template works correctly (blocks everything except emergency)
6. ✅ Custom selection bypasses templates (one-time use)
7. ✅ First-time tooltip explains feature naturally
8. ✅ Animations smooth and delightful
9. ✅ No crashes or errors in any scenario
10. ✅ Works on iOS 16+, all device sizes

**User Experience Goal:**
- First-time user understands templates within 5 seconds
- Setting up a template takes <30 seconds
- Using a configured template takes <2 seconds (faster than custom selection)
- Feature feels native, not bolted-on

---

## Implementation Priority

**(Core Functionality):**
1. TemplateService with AsyncStorage
2. Update AppBlockingService with picker and selection methods
3. Basic UI (cards, states)
4. Template setup and use flows

**(Polish):**
5. Action sheet / settings menu
6. Block All special logic
7. Animations and haptics
8. First-time tooltip

**(Edge Cases):**
9. Error handling
10. Edge case scenarios
11. Analytics
12. Testing

**(Final Polish):**
13. Accessibility
14. Performance optimization
15. Documentation
16. Beta testing

---

## Official Documentation References

**Apple FamilyActivityPicker:**
https://developer.apple.com/documentation/familycontrols/familyactivitypicker

**Apple FamilyActivitySelection:**
https://developer.apple.com/documentation/familycontrols/familyactivityselection

**Apple ManagedSettings:**
https://developer.apple.com/documentation/managedsettings

**Expo AsyncStorage:**
https://docs.expo.dev/versions/latest/sdk/async-storage/

**React Native Animated:**
https://reactnative.dev/docs/animated

---

## Notes

- Templates are stored locally (AsyncStorage), not in cloud by default
- Premium users can sync templates via Supabase (future feature)
- Template selections are opaque tokens from iOS - we cannot inspect contents
- Use JSONEncoder for FamilyActivitySelection (PropertyListEncoder causes bugs)
- Block All requires user to select "All Apps & Categories" in picker
- Emergency services (phone, FaceTime) are never blocked per iOS design