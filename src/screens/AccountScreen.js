import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import UIButton from '../components/Ui/Button';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, UserIcon } from '../components/Icons';
import { colors, spacing, radius, typography } from '../theme';
import { getSupabase } from '../lib/supabase';
import { getAuthUser, clearAuthUser } from '../storage';

export default function AccountScreen({ navigation }) {
  const { colors: navColors } = useTheme();
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
      Alert.alert('Update Failed', e?.message || 'Unable to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
      await clearAuthUser();
      Alert.alert('Signed Out', 'You have been signed out.');
      navigation.navigate('MainTabs');
    } catch (e) {
      console.warn('[Account] Sign out error:', e);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Coming Soon', 'Account deletion will be implemented in a future update.');
          }
        }
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Please sign in to manage your account.</Text>
          <UIButton
            title="Sign In"
            onPress={() => navigation.navigate('SignIn')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <UserIcon size={32} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>Account</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        </View>

        {/* Change Password Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NEW PASSWORD</Text>
            <View style={styles.inputWrapper}>
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

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
            <View style={styles.inputWrapper}>
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
          </View>

          <UIButton
            title={isLoading ? "Updating..." : "Update Password"}
            onPress={handleChangePassword}
            disabled={isLoading || !newPassword || !confirmPassword}
            style={{ marginTop: spacing.lg }}
          />
        </View>

        {/* Account Actions */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
            <Text style={[styles.actionText, { color: colors.primary }]}>Sign Out</Text>
          </TouchableOpacity>
          
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.actionButton} onPress={handleDeleteAccount}>
            <Text style={[styles.actionText, { color: colors.destructive }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
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
});