import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';

// Skeleton placeholder for content that's loading
export function SkeletonItem({ height = 20, width = '100%', style }) {
  const { colors } = useTheme();
  
  return (
    <View 
      style={[
        styles.skeleton, 
        { 
          height, 
          width, 
          backgroundColor: colors.border 
        }, 
        style
      ]} 
    />
  );
}

// Skeleton for list items
export function SkeletonListItem({ showAvatar = false }) {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.listItem, { borderBottomColor: colors.border }]}>
      {showAvatar && (
        <SkeletonItem height={40} width={40} style={styles.avatar} />
      )}
      <View style={styles.content}>
        <SkeletonItem height={16} width="70%" style={styles.title} />
        <SkeletonItem height={12} width="40%" style={styles.subtitle} />
      </View>
    </View>
  );
}

// Skeleton for analytics cards
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonItem height={20} width="60%" style={styles.cardTitle} />
      <SkeletonItem height={60} width="100%" style={styles.cardContent} />
      <SkeletonItem height={14} width="80%" style={styles.cardSubtitle} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: 4,
    opacity: 0.3,
  },
  listItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  avatar: {
    borderRadius: 20,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    marginBottom: 6,
  },
  subtitle: {
  },
  card: {
    padding: 16,
    margin: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  cardTitle: {
    marginBottom: 12,
  },
  cardContent: {
    marginBottom: 8,
  },
  cardSubtitle: {
  },
});