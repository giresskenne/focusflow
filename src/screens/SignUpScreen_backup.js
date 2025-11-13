import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
// import UIButton from '../components/Ui/Button';
import GradientButton from '../components/Ui/GradientButton';
import { getSupabase } from '../lib/supabase';
import { setAuthUser } from '../storage';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, AppleIcon, UserIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/GlassCard';

export default function SignUpScreen({ navigation }) {
  const { colors: navColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (!agreeToTerms) {
      Alert.alert('Terms Required', 'Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    try {
      setIsLoading(true);
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      const user = data?.user || data?.session?.user;
      if (data?.user && !data.session) {
        Alert.alert('Check your email', 'We sent you a confirmation link to complete your registration.');
        navigation.goBack();
        return;
      }
      if (user) {
        await setAuthUser({ id: user.id, email: user.email });
        Alert.alert('Account Created', 'You are now signed in.');
        navigation.navigate('Home');
      } else {
        Alert.alert('Sign Up', 'Please check your email to continue.');
      }
    } catch (e) {
      Alert.alert('Sign Up Failed', e?.message || 'Unable to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignUp = () => {
    Alert.alert('Coming Soon', 'Sign up with Apple will be available soon.');
  };

  const handleGoogleSignUp = () => {
    Alert.alert('Coming Soon', 'Sign up with Google will be available soon.');
  };

  const isValidEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const getPasswordStrength = (password) => {
    if (password.length < 6) return { strength: 'Weak', color: colors.destructive };
    if (password.length < 8) return { strength: 'Fair', color: '#f59e0b' };
    if (password.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return { strength: 'Strong', color: '#10b981' };
    }
    return { strength: 'Good', color: colors.primary };
  };

  const passwordStrength = password ? getPasswordStrength(password) : null;

  const styles = StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: spacing.lg,
      justifyContent: 'flex-start',
      paddingTop: insets.top + spacing.lg, // Add safe area top inset
    },
    backButton: {
      position: 'absolute',
      top: insets.top + spacing.md,
      left: spacing.lg,
      zIndex: 10,
      paddingVertical: spacing.sm,
    },
    backText: {
      color: colors.mutedForeground,
      fontSize: typography.base,
      fontWeight: typography.medium,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.lg,
      marginTop: spacing.xl, // Add space for the absolute positioned back button
    },
    card: {
      marginBottom: spacing.md,
    },
    title: {
      fontSize: typography['2xl'],
      fontWeight: typography.bold,
      color: colors.foreground,
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: typography.base,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 24,
    },
    lockBadge: {
      height: 60,
      width: 60,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      backgroundColor: '#8900f5',
    },
    form: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    inputLabel: {
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: colors.foreground,
      marginBottom: spacing.md,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      height: 56,
    },
    inputError: {
      borderColor: colors.destructive,
      borderWidth: 2,
    },
    inputIcon: {
      marginRight: spacing.md,
    },
    textInput: {
      flex: 1,
      fontSize: typography.base,
      color: colors.foreground,
      height: '100%',
    },
    eyeButton: {
      padding: spacing.xs,
      marginLeft: spacing.sm,
    },
    errorText: {
      fontSize: typography.sm,
      color: colors.destructive,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    passwordStrength: {
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    strengthText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing['2xl'],
      paddingHorizontal: spacing.sm,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    termsText: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.mutedForeground,
      lineHeight: 20,
    },
    termsLink: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    signUpButton: {
      marginBottom: spacing.lg,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.3,
    },
    dividerText: {
      fontSize: typography.sm,
      color: colors.mutedForeground,
      paddingHorizontal: spacing.md,
    },
    socialButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    socialButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    socialButtonText: {
      fontSize: typography.base,
      color: colors.foreground,
      fontWeight: typography.medium,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
    },
    footerText: {
      fontSize: typography.base,
      color: colors.mutedForeground,
    },
    footerLink: {
      fontSize: typography.base,
      color: colors.primary,
      fontWeight: typography.medium,
    },
  });

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.lockBadge}>
              <LockIcon size={20} color="#fff" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start your focus journey today</Text>
          </View>

          <GlassCard style={styles.card}>
            <View style={styles.form}>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={[
                  styles.inputWrapper,
                  email && !isValidEmail(email) && styles.inputError
                ]}>
                  <MailIcon size={20} color={colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                  />
                </View>
                {email && !isValidEmail(email) && (
                  <Text style={styles.errorText}>Please enter a valid email address</Text>
                )}
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <LockIcon size={20} color={colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.mutedForeground}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    autoCorrect={false}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    {showPassword ? (
                      <EyeOffIcon size={20} color={colors.mutedForeground} />
                    ) : (
                      <EyeIcon size={20} color={colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={[
                  styles.inputWrapper,
                  confirmPassword && password !== confirmPassword && styles.inputError
                ]}>
                  <LockIcon size={20} color={colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.mutedForeground}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                    autoCorrect={false}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon size={20} color={colors.mutedForeground} />
                    ) : (
                      <EyeIcon size={20} color={colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                </View>
                {confirmPassword && password !== confirmPassword && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </View>

              {/* Terms Agreement */}
              <TouchableOpacity 
                style={styles.termsRow} 
                onPress={() => setAgreeToTerms(!agreeToTerms)}
              >
                <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                  {agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.focusflow.cc/terms')}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.focusflow.cc/privacy')}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

              {/* Sign Up Button */}
              <GradientButton
                title={isLoading ? 'Creating Account...' : 'Create Account'}
                onPress={handleSignUp}
                disabled={isLoading}
                style={styles.signUpButton}
              />

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Sign Up */}
              <View style={styles.socialButtons}>
                <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignUp}>
                  <UserIcon size={20} color={colors.foreground} />
                  <Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignUp}>
                  <AppleIcon size={20} color={colors.foreground} />
                  <Text style={styles.socialButtonText}>Apple</Text>
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>

          {/* Sign In Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'flex-start',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.mutedForeground,
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.foreground,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
  },
  lockBadge: {
    height: 60,
    width: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: '#8900f5',
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 56,
  },
  inputError: {
    borderColor: colors.destructive,
    borderWidth: 2,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  textInput: {
    flex: 1,
    fontSize: typography.base,
    color: colors.foreground,
    height: '100%',
  },
  eyeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.destructive,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  passwordStrength: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  strengthText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: typography.bold,
  },
  termsText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: typography.medium,
  },
  signUpButton: {
    marginBottom: spacing['2xl'],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  dividerText: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    marginHorizontal: spacing.lg,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  socialButtonText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.foreground,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  footerText: {
    fontSize: typography.base,
    color: colors.mutedForeground,
  },
  footerLink: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.semibold,
  },
});
