// Advanced shield customization experiments
// Note: These are experimental approaches to enhance shield appearance

export function createAdvancedShield(sessionMinutes, blockedCounts) {
  const { appCount = 0, categoryCount = 0, websiteCount = 0 } = blockedCounts;
  const totalBlocked = appCount + categoryCount + websiteCount;
  
  // Rich text subtitle with blocking stats
  const statsLine = totalBlocked > 0 ? 
    `${appCount} apps • ${categoryCount} categories • ${websiteCount} websites blocked` : 
    'Focus mode is active';
  
  // Multi-line subtitle attempt (some iOS versions support \n)
  const richSubtitle = `${getContextualQuote(sessionMinutes)}\n\n${statsLine}`;
  
  return {
    // Try enhanced title with emoji and branding
    title: '🎯 FocusFlow Active',
    
    // Rich subtitle with quote and stats
    subtitle: richSubtitle,
    
    // Custom button text matching the design
    primaryButtonLabel: 'Work It!',
    
    // Secondary button if supported
    secondaryButtonLabel: 'End Session',
    
    // Experimental properties that might be supported
    headerText: 'Work On Success, Not Distraction',
    footerText: `${totalBlocked} items blocked today`,
    backgroundColor: '#1a1a1a', // Dark theme
    foregroundColor: '#ffffff', // White text
    accentColor: '#0072ff', // Brand blue
    cornerRadius: 20,
    
    // Custom icon attempts
    iconName: 'target',
    iconColor: '#0072ff',
    
    // Layout customizations
    layout: 'detailed', // vs 'minimal'
    style: 'modern', // vs 'classic'
    
    // Animation effects
    presentationStyle: 'slide',
    dismissBehavior: 'swipe',
  };
}

// Shield configuration for different iOS versions
export function getShieldForIOSVersion(iosVersion, sessionData) {
  const baseConfig = createAdvancedShield(sessionData.minutes, sessionData.blockedCounts);
  
  if (iosVersion >= 17) {
    // iOS 17+ might support more customization
    return {
      ...baseConfig,
      // Enhanced iOS 17 features
      customView: true,
      interactiveElements: ['progress', 'stats'],
      animations: true,
    };
  } else if (iosVersion >= 16) {
    // iOS 16 baseline
    return {
      title: baseConfig.title,
      subtitle: baseConfig.subtitle,
      primaryButtonLabel: baseConfig.primaryButtonLabel,
    };
  } else {
    // Fallback for older versions
    return {
      title: 'Stay Focused',
      subtitle: 'Apps are blocked during this session',
      primaryButtonLabel: 'OK',
    };
  }
}

// Attempt to create a custom shield view component (if DeviceActivity supports it)
export function createCustomShieldComponent() {
  return {
    type: 'custom',
    component: 'FocusFlowShield',
    props: {
      brandColor: '#0072ff',
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      showProgress: true,
      showStats: true,
      showQuote: true,
    }
  };
}