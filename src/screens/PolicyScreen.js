import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator,
  Linking,
  TouchableOpacity
} from 'react-native';

export default function PolicyScreen({ route }) {
  const [policyContent, setPolicyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const { policyType = 'privacy' } = route.params || {};
  
  useEffect(() => {
    loadPolicyContent();
  }, [policyType]);
  
  const loadPolicyContent = async () => {
    try {
      setLoading(true);
      // Load policy content based on type
      if (policyType === 'privacy') {
        setPolicyContent(getPrivacyPolicyContent());
      } else {
        setPolicyContent(getTermsOfServiceContent());
      }
    } catch (error) {
      console.error('Error loading policy:', error);
      setPolicyContent('Unable to load policy content. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getPrivacyPolicyContent = () => {
    return `Privacy Policy for Doovine

Effective Date: October 26, 2025
Last Updated: October 26, 2025

This Privacy Policy describes how Giress Kenne Tsasse, located at 7-198 Lavergne St, Vanier, ON K1L 5E5, Canada ("we," "our," or "us") collects, uses, and protects your information when you use the Doovine mobile application (the "App").

1. Information We Collect

Information You Provide:
- Account information (email address, password)
- Focus session preferences and settings
- App selections for blocking/monitoring
- Custom reminders and notifications

Automatically Collected Information:
- App usage patterns and session data
- Device information and operating system
- Analytics data for app improvement
- Crash reports and performance metrics

Screen Time Data:
- When you enable app blocking features, we access your device's Screen Time/Digital Wellbeing data
- This data is processed locally on your device and only stored with your explicit consent
- Usage statistics are aggregated and anonymized

2. How We Use Your Information

We use your information to:
- Provide and maintain the App's core functionality
- Sync your data across your devices (when signed in)
- Send you focus reminders and notifications
- Analyze app performance and user engagement
- Provide customer support and respond to inquiries
- Improve our services and develop new features

3. Data Storage and Security

Local Storage: Most of your data is stored locally on your device using secure storage methods.

Cloud Storage: When you create an account, we store your data securely using industry-standard encryption. Our cloud services are provided by Supabase, which maintains SOC 2 Type II compliance and uses encryption both in transit and at rest.

Security Measures:
- All data transmission is encrypted using TLS 1.3
- Passwords are hashed using industry-standard algorithms
- Regular security audits and monitoring
- Limited access controls for our team members

4. Data Sharing and Disclosure

We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:

- With your consent: When you explicitly agree to share information
- Service providers: With trusted third-party services that help us operate the App
- Legal requirements: When required by law, court order, or government regulation
- Business transfers: In connection with a merger, acquisition, or sale of assets

5. Your Privacy Rights

Access and Control:
- View and download your personal data
- Correct inaccurate information
- Delete your account and associated data
- Opt out of non-essential communications

California Residents (CCPA):
- Right to know what personal information we collect
- Right to delete your personal information
- Right to opt-out of the sale of personal information (we don't sell data)
- Right to non-discrimination for exercising your privacy rights

Canadian Residents (PIPEDA):
- Right to access your personal information
- Right to request correction of inaccurate data
- Right to withdraw consent for data processing
- Right to file complaints with privacy commissioners

6. Data Retention

- Account data: Retained until you delete your account
- Usage analytics: Aggregated data retained for up to 2 years
- Support communications: Retained for up to 1 year
- Deleted accounts: All personal data permanently deleted within 30 days

7. Third-Party Services

The App integrates with:
- Supabase: For cloud data storage and user authentication
- Apple/Google Services: For app distribution and in-app purchases
- Analytics Services: For app performance monitoring (anonymized data only)

Each service has its own privacy policy governing their data practices.

8. Children's Privacy

Doovine is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at info@doovine.com.

9. International Data Transfers

Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your privacy rights in accordance with applicable laws.

10. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy in the App and updating the "Last Updated" date. Your continued use of the App after changes become effective constitutes acceptance of the revised Privacy Policy.

11. Contact Information

If you have questions about this Privacy Policy or our data practices, please contact us at info@doovine.com or write to us at Giress Kenne Tsasse, 7-198 Lavergne St, Vanier, ON K1L 5E5, Canada.

For privacy-related complaints or concerns, you may also contact:
- Privacy Commissioner of Canada: www.priv.gc.ca
- California Attorney General: oag.ca.gov (for California residents)

This Privacy Policy was last updated on October 26, 2025, and is governed by the laws of Ontario, Canada.`;
  };

  const getTermsOfServiceContent = () => {
    return `Terms of Service for Doovine

Effective Date: October 26, 2025
Last Updated: October 26, 2025

These Terms of Service ("Terms") govern your use of the Doovine mobile application ("App") operated by Giress Kenne Tsasse, located at 7-198 Lavergne St, Vanier, ON K1L 5E5, Canada ("we," "our," or "us").

1. Acceptance of Terms

By downloading, accessing, or using Doovine, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, do not use the App.

2. Description of Service

Doovine is a productivity application that helps users:
- Block distracting apps and websites during focus sessions
- Set and manage productivity reminders
- Track and analyze focus patterns and habits
- Sync data across devices (with account registration)

3. Account Registration and Security

Account Creation:
- You must provide accurate and complete information
- You are responsible for maintaining account confidentiality
- You must be at least 13 years old to create an account
- One account per person; sharing accounts is prohibited

Account Security:
- Use a strong, unique password
- Notify us immediately of any unauthorized access
- You are liable for all activities under your account
- We reserve the right to suspend accounts for security reasons

4. Acceptable Use Policy

Permitted Uses:
- Personal productivity and focus improvement
- Educational and professional development
- Sharing anonymous usage statistics (opt-in)

Prohibited Activities:
- Violating any laws or regulations
- Harassing, threatening, or harming others
- Attempting to breach security or access unauthorized data
- Reverse engineering or copying the App's functionality
- Using the App for commercial purposes without permission
- Distributing malware or harmful content

5. Subscription and Payment Terms

Free Version:
- Basic focus sessions and app blocking
- Limited reminder capabilities
- Local data storage only

Premium Subscription:
- Unlimited focus sessions and advanced features
- Cloud data sync across devices
- Detailed analytics and insights
- Priority customer support

Billing:
- Subscriptions are billed through your device's app store
- Prices are displayed in your local currency
- Automatic renewal unless cancelled 24 hours before renewal
- Refunds are subject to app store policies (Apple App Store, Google Play)

Cancellation:
- Cancel anytime through your device's subscription settings
- Access to premium features continues until the end of the billing period
- No refunds for partial periods unless required by law

6. Privacy and Data Protection

Your privacy is important to us. Please review our Privacy Policy, which explains how we collect, use, and protect your information. By using Doovine, you consent to our data practices as described in the Privacy Policy.

7. Intellectual Property Rights

Our Rights:
- Doovine and all related content are owned by Giress Kenne Tsasse
- All trademarks, logos, and service marks are our property
- The App's source code and algorithms are proprietary

Your Rights:
- You retain ownership of your personal data and user-generated content
- You grant us a license to use your data to provide the App's services
- You may export your data at any time through the App's settings

8. Device Permissions and App Blocking

Required Permissions:
- Screen Time/Digital Wellbeing access for app blocking features
- Notification permissions for reminders and alerts
- Storage access for local data management

App Blocking Disclaimer:
- App blocking features depend on your device's built-in parental controls
- We cannot guarantee 100% effectiveness of blocking features
- Some system apps may not be blockable due to device restrictions
- Blocking features may not work in safe mode or with device administration changes

9. Disclaimer of Warranties

THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO:

- Merchantability and fitness for a particular purpose
- Non-infringement of third-party rights
- Accuracy, reliability, or completeness of information
- Uninterrupted or error-free operation

10. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, GIRESS KENNE TSASSE SHALL NOT BE LIABLE FOR:

- Any indirect, incidental, or consequential damages
- Loss of data, profits, or business opportunities  
- Damages exceeding the amount paid for premium subscriptions in the last 12 months
- Issues arising from third-party services or device limitations

Some jurisdictions do not allow certain warranty disclaimers or liability limitations, so some of the above may not apply to you.

11. Indemnification

You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from:
- Your use of the App in violation of these Terms
- Your violation of any third-party rights
- Any content you submit or share through the App

12. Termination

By You: You may stop using the App and delete your account at any time through the App's settings.

By Us: We may suspend or terminate your access if you violate these Terms or engage in harmful activities.

Effect of Termination:
- Your right to use the App immediately ceases
- We will delete your account data within 30 days
- Sections 6-15 of these Terms survive termination

13. Updates and Modifications

App Updates:
- We may release updates to improve functionality and security
- Some updates may be required to continue using the App
- New features may be added to premium subscriptions

Terms Updates:
- We may modify these Terms with 30 days' notice
- Continued use after changes constitutes acceptance
- Material changes will be prominently announced in the App

14. Dispute Resolution and Governing Law

Governing Law: These Terms are governed by the laws of Ontario, Canada, without regard to conflict of law principles.

Jurisdiction: Any disputes shall be resolved in the courts of Ontario, Canada. However, we may seek injunctive relief in any jurisdiction.

Alternative Dispute Resolution: Before filing a lawsuit, you agree to attempt resolution through:
1. Direct communication with our support team at info@doovine.com
2. Mediation through a mutually agreed mediator
3. If resolution cannot be reached, litigation in Ontario courts

15. Severability and Waiver

If any provision of these Terms is found unenforceable, the remainder shall remain in full effect. Our failure to enforce any right or provision does not constitute a waiver of such right or provision.

16. Entire Agreement

These Terms, together with our Privacy Policy, constitute the entire agreement between you and Giress Kenne Tsasse regarding the use of Doovine.

17. Contact Information

For questions about these Terms or to report violations, contact us at info@doovine.com or write to us at Giress Kenne Tsasse, 7-198 Lavergne St, Vanier, ON K1L 5E5, Canada.

Support Hours: Monday-Friday, 9 AM - 5 PM EST
Emergency Security Issues: Contact us immediately at info@doovine.com

These Terms of Service were last updated on October 26, 2025, and are governed by the laws of Ontario, Canada.`;
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:info@doovine.com?subject=Policy Question');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2f6bff" />
        <Text style={styles.loadingText}>Loading policy content...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {policyType === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
          </Text>
          <Text style={styles.version}>Version 1.0 • Last Updated Oct 26, 2025</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.policyText}>{policyContent}</Text>
        </View>

        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>Questions or Concerns?</Text>
          <TouchableOpacity onPress={handleContactSupport} style={styles.contactButton}>
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    padding: 20,
  },
  policyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  supportSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  contactButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  contactButtonText: {
    fontSize: 16,
    color: '#2f6bff',
    fontWeight: '500',
  },
});