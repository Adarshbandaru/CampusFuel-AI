import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useTheme } from '../../context/ThemeContext';
import Config from '../../constants/Config';
import { Skeleton } from '../common/Skeleton';
import * as NotificationService from '../../services/NotificationService';

export interface StudentRoutineCardProps {
  uid: string;
}

export function StudentRoutineCard({ uid }: StudentRoutineCardProps) {
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Entrance Anim
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await axios.get(`${Config.API_BASE_URL}/api/v1/users/${uid}/routine-plan`);
      if (res.data && res.data.status !== "error") {
        setData(res.data);
        if (!res.data.is_cached) {
          NotificationService.scheduleRoutineNotifications(res.data);
        }
      } else {
        // Fallback tip handling for graceful degradation 
        setData(res.data); // data has the graceful fallback built by backend
      }
    } catch (err) {
      console.error("[StudentRoutineCard] Failed to fetch:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      fetchData();
    }
  }, [uid]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        })
      ]).start();
    }
  }, [loading]);

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 2,
    },
    badge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(129, 140, 248, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    tipText: {
      color: colors.textSecondary,
      fontSize: 14,
      flex: 1,
      lineHeight: 20,
    },
    errorText: {
      color: colors.danger || '#F87171',
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 12,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      alignSelf: 'center',
    },
    retryText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
    }
  });

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Skeleton width={150} height={20} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton width={100} height={14} borderRadius={4} />
          </View>
        </View>
        <Skeleton width="100%" height={24} borderRadius={4} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={24} borderRadius={4} style={{ marginBottom: 12 }} />
        <Skeleton width="80%" height={24} borderRadius={4} />
      </View>
    );
  }

  if (error || !data) {
    // Silently hide when backend is unavailable — this is a non-essential feature
    return null;
  }

  const tips = [
    { key: 'morning_tip', icon: 'sunny-outline', text: data.morning_tip },
    { key: 'hydration_tip', icon: 'water-outline', text: data.hydration_tip },
    { key: 'workout_window', icon: 'barbell-outline', text: data.workout_window },
    { key: 'sleep_tip', icon: 'moon-outline', text: data.sleep_tip },
  ];

  if (data.exam_mode && data.focus_tip) {
    tips.push({ key: 'focus_tip', icon: 'school-outline', text: data.focus_tip });
  }

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Student Routine AI</Text>
          <Text style={styles.subtitle}>Today's Plan</Text>
        </View>
        {data.exam_mode && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🎯 Exam Mode</Text>
          </View>
        )}
      </View>
      
      {tips.filter(t => !!t.text).map((tip, idx) => (
        <View 
          key={tip.key} 
          style={[styles.row, idx === tips.filter(t => !!t.text).length - 1 && { marginBottom: 0 }]}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={tip.icon as any} size={18} color={colors.primary} />
          </View>
          <Text style={styles.tipText}>{tip.text}</Text>
        </View>
      ))}
    </Animated.View>
  );
}
