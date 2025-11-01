import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import GradientButton from '../components/Ui/GradientButton';
import GlassCard from '../components/GlassCard';
import GradientBackground from '../components/GradientBackground';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, UserIcon } from '../components/Icons';
import { colors, spacing, radius, typography } from '../theme';
import { getSupabase } from '../lib/supabase';
import { getAuthUser, clearAuthUser } from '../storage';

export default function AccountScreen({ navigation }) {
  const { colors: navColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    (async () => {
      const authUser = await getAuthUser();
      setUser(authUser);
    })();
  }, []);

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      Alert.alert('Success', 'Your password has been updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('Network request failed')) {
        Alert.alert('No Connection', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Update Failed', msg || 'Unable to update password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const supabase = getSupabase();
              await supabase.auth.signOut();
              await clearAuthUser();
              Alert.alert('Signed Out', 'You have been signed out.');
              navigation.navigate('MainTabs');
            } catch (e) {
              const msg = String(e?.message || '');
              if (msg.includes('Network request failed')) {
                Alert.alert('No Connection', 'Unable to sign out while offline. Please try again when you are online.');
              } else {
                Alert.alert('Sign Out Failed', msg || 'Unable to sign out.');
              }
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    const perform = () => {
      Alert.alert('Coming Soon', 'Account deletion will be implemented in a future update.');
    };

    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'Delete Account',
        'Type DELETE to confirm. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: (val) => {
              if ((val || '').trim().toUpperCase() === 'DELETE') perform();
              else Alert.alert('Confirmation Required', 'Please type DELETE to confirm account deletion.');
            }
          }
        ],
        'plain-text'
      );
    } else {
      Alert.alert(
        'Delete Account',
        'Please confirm you want to permanently delete your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: perform }
        ]
      );
    }
  };

  const containerStyle = {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: insets.top + spacing.lg,
    paddingBottom: spacing['3xl'],
  };

  if (!user) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <ScrollView contentContainerStyle={[containerStyle, { justifyContent: 'center' }]}> 
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <GlassCard>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: typography.base, color: colors.mutedForeground, textAlign: 'center' }}>
                  Please sign in to manage your account.
                </Text>
                <GradientButton 
                  title="Sign In"
                  onPress={() => navigation.navigate('SignIn')}
                  style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
                />
              </View>
            </GlassCard>
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={containerStyle} showsVerticalScrollIndicator={false}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          {/* Header Card */}
          <GlassCard style={{ marginBottom: spacing.md }}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <UserIcon size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>Account</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
              </View>
            </View>
          </GlassCard>

          {/* Change Password */}
          <GlassCard style={{ marginBottom: spacing.md }}>
            <Text style={styles.sectionTitle}>Change Password</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NEW PASSWORD</Text>
              <View style={styles.inputWrapperAlt}>
                <LockIcon size={20} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Enter new password"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? (
                    <EyeOffIcon size={20} color={colors.mutedForeground} />
                  ) : (
                    <EyeIcon size={20} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
              <View style={styles.inputWrapperAlt}>
                <LockIcon size={20} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.mutedForeground}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                  {showConfirmPassword ? (
                    <EyeOffIcon size={20} color={colors.mutedForeground} />
                  ) : (
                    <EyeIcon size={20} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <GradientButton
              title={isLoading ? 'Updating...' : 'Update Password'}
              onPress={handleChangePassword}
              disabled={isLoading || !newPassword || !confirmPassword}
            />
          </GlassCard>

          {/* Account Actions */}
          <GlassCard>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
              <Text style={[styles.actionText, { color: colors.primary }]}>Sign Out</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.actionButton} onPress={handleDeleteAccount}>
              <Text style={[styles.actionText, { color: colors.destructive }]}>Delete Account</Text>
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: 'rgba(137, 0, 245, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  profileName: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  profileEmail: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 56,
  },
  // Alternate wrapper to avoid breaking any other references
  inputWrapperAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 56,
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
  actionButton: {
    paddingVertical: spacing.md,
  },
  actionText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    opacity: 0.3,
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
});
