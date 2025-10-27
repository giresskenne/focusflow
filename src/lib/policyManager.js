import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import React from 'react';

// Policy and Terms documents configuration
export const PolicyDocuments = {
  PRIVACY_POLICY: {
    id: 'privacy_policy',
    title: 'Privacy Policy',
    version: '1.0',
    effectiveDate: '2025-10-26',
    lastUpdated: '2025-10-26',
    fileName: 'PRIVACY_POLICY.md',
    storageKey: 'privacy_policy_accepted',
  },
  
  TERMS_OF_SERVICE: {
    id: 'terms_of_service',
    title: 'Terms of Service',
    version: '1.0',
    effectiveDate: '2025-10-26',
    lastUpdated: '2025-10-26',
    fileName: 'TERMS_OF_SERVICE.md',
    storageKey: 'terms_of_service_accepted',
  },
};

// Company information for policy references
export const CompanyInfo = {
  name: 'Giress Kenne Tsasse',
  appName: 'Doovine',
  address: '7 - 198 Lavergne St, Vanier, ON K1L 5E5, Canada',
  email: 'info@doovine.com',
  country: 'Canada',
  province: 'Ontario',
  jurisdiction: 'Ontario',
};

// Policy acceptance tracking
export class PolicyManager {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Check if user has accepted a specific policy
   */
  async hasAcceptedPolicy(policyId) {
    try {
      const storageKey = this.getPolicyStorageKey(policyId);
      const accepted = await this.storage.getItem(storageKey);
      return accepted === 'true';
    } catch (error) {
      console.error(`[PolicyManager] Error checking acceptance for ${policyId}:`, error);
      return false;
    }
  }

  /**
   * Record user acceptance of a policy
   */
  async acceptPolicy(policyId, version = '1.0') {
    try {
      const storageKey = this.getPolicyStorageKey(policyId);
      const acceptanceData = {
        accepted: true,
        version,
        timestamp: Date.now(),
        date: new Date().toISOString(),
      };
      
      await this.storage.setItem(storageKey, JSON.stringify(acceptanceData));
      console.log(`[PolicyManager] Policy accepted: ${policyId} (v${version})`);
      return true;
    } catch (error) {
      console.error(`[PolicyManager] Error accepting policy ${policyId}:`, error);
      return false;
    }
  }

  /**
   * Check if all required policies have been accepted
   */
  async hasAcceptedAllPolicies() {
    try {
      const privacyAccepted = await this.hasAcceptedPolicy('privacy_policy');
      const termsAccepted = await this.hasAcceptedPolicy('terms_of_service');
      return privacyAccepted && termsAccepted;
    } catch (error) {
      console.error('[PolicyManager] Error checking all policies:', error);
      return false;
    }
  }

  /**
   * Get acceptance status for all policies
   */
  async getPolicyAcceptanceStatus() {
    try {
      return {
        privacyPolicy: await this.hasAcceptedPolicy('privacy_policy'),
        termsOfService: await this.hasAcceptedPolicy('terms_of_service'),
        allAccepted: await this.hasAcceptedAllPolicies(),
      };
    } catch (error) {
      console.error('[PolicyManager] Error getting policy status:', error);
      return {
        privacyPolicy: false,
        termsOfService: false,
        allAccepted: false,
      };
    }
  }

  /**
   * Get policy document content by ID
   */
  async getPolicyContent(policyId) {
    try {
      const policy = this.getPolicyConfig(policyId);
      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      // Return default policy content (loaded from bundle at compile time)
      return this.getDefaultPolicyContent(policyId);
    } catch (error) {
      console.error(`[PolicyManager] Error loading policy content for ${policyId}:`, error);
      return null;
    }
  }

  /**
   * Get all policies content
   */
  async getAllPoliciesContent() {
    const policies = {};
    
    for (const [key, policy] of Object.entries(PolicyDocuments)) {
      const content = await this.getPolicyContent(policy.id);
      if (content) {
        policies[policy.id] = content;
      }
    }

    return policies;
  }

  /**
   * Export policies as text for sharing
   */
  async exportPoliciesAsText() {
    try {
      const policies = await this.getAllPoliciesContent();
      let exportText = '# Doovine - Policies and Terms\n\n';
      exportText += `Generated: ${new Date().toISOString()}\n`;
      exportText += `Company: ${CompanyInfo.name}\n`;
      exportText += `Contact: ${CompanyInfo.email}\n\n`;
      exportText += '---\n\n';

      for (const [id, policy] of Object.entries(policies)) {
        exportText += `## ${policy.title}\n`;
        exportText += `Version: ${policy.version}\n`;
        exportText += `Last Updated: ${policy.lastUpdated}\n\n`;
        exportText += policy.content;
        exportText += '\n\n---\n\n';
      }

      return exportText;
    } catch (error) {
      console.error('[PolicyManager] Error exporting policies:', error);
      return null;
    }
  }

  /**
   * Private helper to get policy configuration
   */
  getPolicyConfig(policyId) {
    for (const policy of Object.values(PolicyDocuments)) {
      if (policy.id === policyId) {
        return policy;
      }
    }
    return null;
  }

  /**
   * Private helper to get storage key for a policy
   */
  getPolicyStorageKey(policyId) {
    const policy = this.getPolicyConfig(policyId);
    return policy ? policy.storageKey : null;
  }

  /**
   * Private helper to get default policy content (fallback)
   */
  getDefaultPolicyContent(policyId) {
    const defaultContent = {
      privacy_policy: {
        id: 'privacy_policy',
        title: 'Privacy Policy',
        version: '1.0',
        lastUpdated: '2025-10-26',
        fileName: 'PRIVACY_POLICY.md',
        content: `# Privacy Policy - ${CompanyInfo.appName}

${CompanyInfo.name} is committed to protecting your privacy.

**Company Information:**
- Name: ${CompanyInfo.name}
- Address: ${CompanyInfo.address}
- Email: ${CompanyInfo.email}

Please read our full privacy policy available at info@doovine.com or in the app.

**Key Points:**
1. We collect information you provide and automatically collected data
2. We use information to deliver services and improve the app
3. Your data is protected with industry-standard security
4. You have rights to access, correct, and delete your data
5. Contact us at ${CompanyInfo.email} with questions`,
      },
      
      terms_of_service: {
        id: 'terms_of_service',
        title: 'Terms of Service',
        version: '1.0',
        lastUpdated: '2025-10-26',
        fileName: 'TERMS_OF_SERVICE.md',
        content: `# Terms of Service - ${CompanyInfo.appName}

By using ${CompanyInfo.appName}, you agree to these terms and conditions.

**Company Information:**
- Name: ${CompanyInfo.name}
- Address: ${CompanyInfo.address}
- Email: ${CompanyInfo.email}

**Key Points:**
1. Limited license for personal, non-commercial use
2. Prohibited activities including hacking, spam, and illegal use
3. Account security is your responsibility
4. Premium subscription includes unlimited features
5. We are not liable for indirect damages
6. Governed by the laws of ${CompanyInfo.province}, ${CompanyInfo.country}

For full terms, contact ${CompanyInfo.email}`,
      },
    };

    return defaultContent[policyId] || null;
  }

  /**
   * Reset policy acceptance (for testing)
   */
  async resetPolicyAcceptance(policyId) {
    try {
      if (__DEV__) {
        const storageKey = this.getPolicyStorageKey(policyId);
        await this.storage.removeItem(storageKey);
        console.log(`[PolicyManager] Reset acceptance for ${policyId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[PolicyManager] Error resetting policy:`, error);
      return false;
    }
  }

  /**
   * Show policy acceptance alert
   */
  showPolicyAlert(policyId, onAccept, onReject) {
    const policy = this.getPolicyConfig(policyId);
    
    if (!policy) {
      console.error(`[PolicyManager] Policy not found: ${policyId}`);
      return;
    }

    Alert.alert(
      `Accept ${policy.title}`,
      `You must accept the ${policy.title} to continue using ${CompanyInfo.appName}.`,
      [
        {
          text: 'Read',
          onPress: () => onReject?.(),
          style: 'default',
        },
        {
          text: 'Accept',
          onPress: () => {
            this.acceptPolicy(policy.id);
            onAccept?.();
          },
          style: 'default',
        },
        {
          text: 'Reject',
          onPress: () => onReject?.(),
          style: 'destructive',
        },
      ]
    );
  }
}

/**
 * Hook for policy management in React components
 */
export function usePolicyManager(storage) {
  const [manager] = React.useState(() => new PolicyManager(storage));
  const [policies, setPolicies] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const status = await manager.getPolicyAcceptanceStatus();
      setPolicies(status);
      setLoading(false);
    })();
  }, [manager]);

  return { manager, policies, loading };
}

export default PolicyManager;