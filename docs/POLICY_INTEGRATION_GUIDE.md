# Policy & Compliance Integration Guide

**Doovine** - Focus & Productivity App  
**Version 1.0** | **October 26, 2025**

---

## Overview

This document explains how to integrate Doovine's Privacy Policy and Terms of Service into the mobile app, including user acceptance flows, storage, and legal compliance.

## Table of Contents

1. [Files Overview](#files-overview)
2. [Policy Manager Usage](#policy-manager-usage)
3. [Integration Steps](#integration-steps)
4. [User Acceptance Flow](#user-acceptance-flow)
5. [Storage and Verification](#storage-and-verification)
6. [Legal Compliance](#legal-compliance)
7. [Testing](#testing)

---

## Files Overview

### Policy Documents

**File:** `PRIVACY_POLICY.md`
- Full privacy policy for Doovine
- Covers data collection, usage, security, user rights
- Includes CCPA and PIPEDA compliance sections
- **Company:** Giress Kenne Tsasse
- **Contact:** info@doovine.com

**File:** `TERMS_OF_SERVICE.md`
- Complete terms of service for Doovine
- Covers license, prohibited activities, subscriptions
- Includes limitation of liability and dispute resolution
- References company information and jurisdiction (Ontario, Canada)

### Integration Components

**File:** `src/lib/policyManager.js`
- `PolicyManager` class for managing policy acceptance
- `PolicyDocuments` configuration object
- `CompanyInfo` object with business details
- Hooks and utility functions for policy management

**File:** `src/screens/PolicyScreen.js`
- Standalone screen for displaying full policy documents
- Shows company information
- Allows users to accept/reject policies
- Provides contact support functionality

**File:** `src/components/PolicyAcceptanceFlow.js`
- Multi-step policy acceptance flow component
- Progress tracking across required policies
- Shows acceptance status and allows navigation
- Completes when all policies are accepted

---

## Policy Manager Usage

### Basic Setup

```javascript
import { PolicyManager, CompanyInfo } from './src/lib/policyManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize the policy manager
const policyManager = new PolicyManager(AsyncStorage);
```

### Checking Policy Acceptance

```javascript
// Check if user accepted specific policy
const hasAcceptedPrivacy = await policyManager.hasAcceptedPolicy('privacy_policy');

// Check if user accepted all required policies
const allAccepted = await policyManager.hasAcceptedAllPolicies();

// Get detailed status
const status = await policyManager.getPolicyAcceptanceStatus();
// Returns: { privacyPolicy: boolean, termsOfService: boolean, allAccepted: boolean }
```

### Recording Policy Acceptance

```javascript
// Record user acceptance
await policyManager.acceptPolicy('privacy_policy', '1.0');

// This stores acceptance with timestamp
// Returns: boolean (success/failure)
```

### Loading Policy Content

```javascript
// Get full policy content
const policy = await policyManager.getPolicyContent('privacy_policy');
// Returns: { id, title, content, version, lastUpdated, fileName }

// Get all policies
const allPolicies = await policyManager.getAllPoliciesContent();
```

### Exporting Policies

```javascript
// Export all policies as text
const exportedText = await policyManager.exportPoliciesAsText();
// Useful for sharing via email or saving to device
```

---

## Integration Steps

### Step 1: Add Navigation Routes

In `App.js`, add policy screens to navigation:

```javascript
import PolicyScreen from './src/screens/PolicyScreen';
import PolicyAcceptanceFlow from './src/components/PolicyAcceptanceFlow';

<Stack.Screen 
  name="Privacy" 
  component={PolicyScreen} 
  options={{ title: 'Privacy Policy' }} 
/>
<Stack.Screen 
  name="Terms" 
  component={PolicyScreen} 
  options={{ title: 'Terms of Service' }} 
/>
<Stack.Screen 
  name="PolicyAcceptance" 
  component={PolicyAcceptanceFlow} 
/>
```

### Step 2: Initialize Policy Manager

In your app's root component or context:

```javascript
import { PolicyManager } from './src/lib/policyManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const policyManager = new PolicyManager(AsyncStorage);

// Make it accessible via context or props
export const PolicyContext = React.createContext(policyManager);
```

### Step 3: Check Policies on App Start

In `App.js` or your auth initialization:

```javascript
useEffect(() => {
  const checkPolicies = async () => {
    const allAccepted = await policyManager.hasAcceptedAllPolicies();
    
    if (!allAccepted) {
      // Show policy acceptance flow
      navigation.navigate('PolicyAcceptance', {
        policyManager,
        requiredPolicies: ['privacy_policy', 'terms_of_service'],
        onComplete: () => {
          // Proceed with normal app flow
        }
      });
    }
  };
  
  checkPolicies();
}, []);
```

### Step 4: Add Links to Policy Screens

In Settings or Account screens:

```javascript
import { Linking } from 'react-native';

const handleViewPrivacy = () => {
  navigation.navigate('Privacy', {
    policyId: 'privacy_policy',
    title: 'Privacy Policy'
  });
};

const handleViewTerms = () => {
  navigation.navigate('Terms', {
    policyId: 'terms_of_service',
    title: 'Terms of Service'
  });
};

// Add buttons in your UI
<TouchableOpacity onPress={handleViewPrivacy}>
  <Text>Privacy Policy</Text>
</TouchableOpacity>

<TouchableOpacity onPress={handleViewTerms}>
  <Text>Terms of Service</Text>
</TouchableOpacity>
```

---

## User Acceptance Flow

### Flow Diagram

```
App Start
    ↓
Check Policy Acceptance
    ↓
All Accepted? ──Yes→ Continue to App
    ↓ No
Show Policy Acceptance Flow
    ↓
User Reviews Privacy Policy
    ↓
User Accepts ──or→ User Rejects
    ↓              ↓
Next Policy    Show Error/Exit
    ↓
User Reviews Terms of Service
    ↓
User Accepts ──or→ User Rejects
    ↓              ↓
All Accepted  Show Error/Exit
    ↓
Continue to App
```

### PolicyAcceptanceFlow Component Props

```javascript
<PolicyAcceptanceFlow
  navigation={navigation}
  policyManager={policyManager}
  requiredPolicies={['privacy_policy', 'terms_of_service']}
  onComplete={() => {
    // Called when all policies are accepted
    navigateToMainApp();
  }}
/>
```

### Policy-Specific Screens

```javascript
<PolicyScreen
  navigation={navigation}
  policyId="privacy_policy"
  title="Privacy Policy"
  onAccept={() => {
    policyManager.acceptPolicy('privacy_policy');
    navigation.goBack();
  }}
/>
```

---

## Storage and Verification

### Storage Format

Policies are stored in AsyncStorage with keys:
- `privacy_policy_accepted` - Privacy policy acceptance status
- `terms_of_service_accepted` - Terms of service acceptance status

### Stored Data Structure

```javascript
{
  "privacy_policy_accepted": {
    "accepted": true,
    "version": "1.0",
    "timestamp": 1729963200000,
    "date": "2025-10-26T12:00:00.000Z"
  }
}
```

### Verification Methods

```javascript
// Method 1: Direct check
const status = await policyManager.hasAcceptedPolicy('privacy_policy');

// Method 2: Full status check
const { allAccepted } = await policyManager.getPolicyAcceptanceStatus();

// Method 3: Display to user
const status = await policyManager.getPolicyAcceptanceStatus();
if (!status.privacyPolicy) {
  // Show policy acceptance
}
```

### Policy Update Handling

When policies are updated (new version), require re-acceptance:

```javascript
// In your policy manager
const POLICY_VERSION = '1.1'; // Updated version

// Check if accepted version matches current version
async function needsReacceptance(policyId) {
  const acceptanceData = await storage.getItem(
    `${policyId}_accepted`
  );
  
  if (!acceptanceData) return true;
  
  const { version } = JSON.parse(acceptanceData);
  return version !== POLICY_VERSION;
}
```

---

## Legal Compliance

### Required Elements

✅ **Company Information**
- Company: Giress Kenne Tsasse
- Address: 7 - 198 Lavergne St, Vanier, ON K1L 5E5, Canada
- Email: info@doovine.com

✅ **Privacy Policy Sections**
- Information collection practices
- Data usage and sharing
- Security measures
- User rights (access, correction, deletion)
- CCPA compliance (California residents)
- PIPEDA compliance (Canadian residents)

✅ **Terms of Service Sections**
- Use license and restrictions
- Account responsibility
- Subscription terms
- Intellectual property rights
- Limitation of liability
- Dispute resolution

✅ **User Acceptance Tracking**
- Record timestamp of acceptance
- Store acceptance status in device storage
- Prevent app use without acceptance

### Jurisdiction

- **Primary:** Ontario, Canada
- **Governed by:** Ontario laws
- **Applicable Regulations:**
  - Personal Information Protection and Electronic Documents Act (PIPEDA)
  - California Consumer Privacy Act (CCPA) - if applicable to users
  - Apple App Store Terms
  - Google Play Store Terms

### Annual Review

It is recommended to review and update policies annually:
- Privacy regulations change
- App features evolve
- Company practices update
- Legal requirements update

---

## Testing

### Unit Tests for PolicyManager

```javascript
// Example tests for policy manager
describe('PolicyManager', () => {
  let policyManager;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    policyManager = new PolicyManager(mockStorage);
  });

  test('should accept a policy', async () => {
    mockStorage.setItem.mockResolvedValue(true);
    const result = await policyManager.acceptPolicy('privacy_policy');
    expect(result).toBe(true);
  });

  test('should check if policy is accepted', async () => {
    mockStorage.getItem.mockResolvedValue('true');
    const result = await policyManager.hasAcceptedPolicy('privacy_policy');
    expect(result).toBe(true);
  });

  test('should get all policies acceptance status', async () => {
    mockStorage.getItem.mockResolvedValue('true');
    const status = await policyManager.getPolicyAcceptanceStatus();
    expect(status.allAccepted).toBe(true);
  });
});
```

### Integration Tests

```javascript
// Test full flow
describe('PolicyAcceptanceFlow', () => {
  test('should complete flow when all policies accepted', async () => {
    // Render component
    // Accept first policy
    // Accept second policy
    // Verify onComplete is called
  });

  test('should block app without policy acceptance', async () => {
    // Start app
    // Verify policies not accepted
    // Verify policy screen shown
  });
});
```

### Manual Testing Checklist

- [ ] App shows policy acceptance flow on first launch
- [ ] User can view full policy documents
- [ ] User can accept individual policies
- [ ] User cannot proceed without accepting all
- [ ] Policy acceptance is persisted
- [ ] User sees accepted status on subsequent launches
- [ ] User can access policies from Settings
- [ ] Contact support link works
- [ ] Policy content loads correctly
- [ ] Navigation works between policies
- [ ] Progress indicator updates
- [ ] All acceptance data stored correctly

---

## Implementation Examples

### Example 1: Settings Screen with Policy Links

```javascript
import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

export default function SettingsScreen({ navigation, policyManager }) {
  const [acceptanceStatus, setAcceptanceStatus] = React.useState(null);

  React.useEffect(() => {
    const loadStatus = async () => {
      const status = await policyManager.getPolicyAcceptanceStatus();
      setAcceptanceStatus(status);
    };
    loadStatus();
  }, []);

  return (
    <View>
      <Text>Legal & Privacy</Text>
      
      <TouchableOpacity 
        onPress={() => navigation.navigate('Privacy', {
          policyId: 'privacy_policy',
          title: 'Privacy Policy'
        })}
      >
        <Text>Privacy Policy</Text>
        <Text>{acceptanceStatus?.privacyPolicy ? '✓' : 'Not accepted'}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => navigation.navigate('Terms', {
          policyId: 'terms_of_service',
          title: 'Terms of Service'
        })}
      >
        <Text>Terms of Service</Text>
        <Text>{acceptanceStatus?.termsOfService ? '✓' : 'Not accepted'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Example 2: App Startup Initialization

```javascript
import React, { useEffect } from 'react';
import { PolicyManager } from './src/lib/policyManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [policyManager] = React.useState(() => 
    new PolicyManager(AsyncStorage)
  );

  useEffect(() => {
    checkPoliciesOnStartup();
  }, []);

  const checkPoliciesOnStartup = async () => {
    const allAccepted = await policyManager.hasAcceptedAllPolicies();
    
    if (!allAccepted) {
      // Show policy acceptance flow
      // This should happen before showing main app
      navigateToPolicyAcceptance();
    } else {
      // Continue normal app flow
      navigateToMainApp();
    }
  };

  return (
    // Your app navigation logic
  );
}
```

---

## Updates and Maintenance

### When to Update Policies

- [ ] App adds new data collection
- [ ] Subscription model changes
- [ ] Feature set expands significantly
- [ ] Legal requirements change
- [ ] Privacy practices evolve
- [ ] Company information updates

### Update Process

1. **Update the markdown files**
   - Edit `PRIVACY_POLICY.md` or `TERMS_OF_SERVICE.md`
   - Increment version number (e.g., 1.0 → 1.1)
   - Update "Last Updated" date

2. **Implement version check**
   - Update `POLICY_VERSION` in policyManager
   - Require users to re-accept

3. **Notify users**
   - Show in-app notification
   - Highlight changes summary
   - Allow viewing full policy

4. **Track acceptance**
   - Store new version with acceptance
   - Maintain acceptance history

---

## Support and Questions

For support or policy-related questions:

**Email:** info@doovine.com

**Mailing Address:**
```
Giress Kenne Tsasse
7 - 198 Lavergne St
Vanier, ON K1L 5E5
Canada
```

---

**Document Version:** 1.0  
**Last Updated:** October 26, 2025  
**Next Review:** October 26, 2026