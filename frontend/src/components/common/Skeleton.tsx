import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  const backgroundColor = colors.skeletonBase;

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor, opacity },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <View>
          <Skeleton width={120} height={24} style={{ marginBottom: 8 }} />
          <Skeleton width={180} height={16} />
        </View>
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>

      {/* ScoreCard Skeleton */}
      <Skeleton width="100%" height={220} borderRadius={20} style={{ marginBottom: 24 }} />

      {/* TodaysWins Skeleton */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <Skeleton width={100} height={40} borderRadius={20} />
        <Skeleton width={120} height={40} borderRadius={20} />
        <Skeleton width={90} height={40} borderRadius={20} />
      </View>

      {/* Progress Section Skeleton */}
      <Skeleton width={120} height={20} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={60} borderRadius={16} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={60} borderRadius={16} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={60} borderRadius={16} style={{ marginBottom: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  }
});
