import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import GradientButton from '../components/Ui/GradientButton';
import { getSupabase } from '../lib/supabase';
import { setAuthUser } from '../storage';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, AppleIcon, UserIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/GlassCard';

export default function SignInScreen({ navigation }) {
  const { colors: navColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      
      if (error) throw error;

      const user = data?.user || data?.session?.user;
      if (user) {
        await setAuthUser({ id: user.id, email: user.email });
        Alert.alert('Welcome Back', 'You are now signed in.');
        navigation.navigate('MainTabs');
      } else {
        Alert.alert('Sign In Failed', 'Unable to sign in with these credentials.');
      }
    } catch (e) {
      Alert.alert('Sign In Failed', e?.message || 'Unable to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    Alert.alert('Coming Soon', 'Sign in with Apple will be available soon.');
  };

  const handleGoogleSignIn = () => {
    Alert.alert('Coming Soon', 'Sign in with Google will be available soon.');
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address first.');
      return;
    }

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert('Reset Link Sent', 'Check your email for password reset instructions.');
    } catch (e) {
      Alert.alert('Reset Failed', e?.message || 'Unable to send reset email');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: spacing.lg,
      justifyContent: 'flex-start',
      paddingTop: insets.top + spacing.lg,
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
      marginTop: spacing.xl,
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
    forgotButton: {
      alignSelf: 'flex-end',
      marginBottom: spacing.lg,
    },
    forgotText: {
      fontSize: typography.sm,
      color: colors.primary,
      fontWeight: typography.medium,
    },
    signInButton: {
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
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue your focus journey</Text>
            </View>

            <GlassCard style={styles.card}>
              <View style={styles.form}>
                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.inputWrapper}>
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
                      autoComplete="current-password"
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

                {/* Forgot Password */}
                <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>

                {/* Sign In Button */}
                <GradientButton
                  title={isLoading ? 'Signing In...' : 'Sign In'}
                  onPress={handleSignIn}
                  disabled={isLoading}
                  style={styles.signInButton}
                />

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social Sign In */}
                <View style={styles.socialButtons}>
                  <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                    <UserIcon size={20} color={colors.foreground} />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
                    <AppleIcon size={20} color={colors.foreground} />
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>

            {/* Sign Up Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.footerLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
