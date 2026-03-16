import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';

interface WeeklyTrackerProps {
  streakCounters: Record<string, number>;
}

export function WeeklyTracker({ streakCounters = {} }: WeeklyTrackerProps) {
  const { colors, theme } = useTheme();

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const totalStreak = Math.max(...Object.values(streakCounters).map(v => Number(v) || 0), 0);
  const activeCategories = Object.values(streakCounters).filter(v => Number(v) > 0).length;

  // Pulse animation for today
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={{ marginBottom: 20 }}>
      {/* <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>This Week</Text> */}
      <View style={[styles.weeklyStripCard, { backgroundColor: colors.card }]}>
        <View style={styles.weeklyDaysRow}>
          {dayLabels.map((label, idx) => {
            const dayDate = new Date(today);
            dayDate.setDate(today.getDate() + mondayOffset + idx);
            const isToday = dayDate.toDateString() === today.toDateString();
            const isPast = dayDate < today && !isToday;
            const isFuture = dayDate > today;
            
            // Simulate completion based on streaks (past days within streak range are filled)
            const daysAgo = Math.floor((today.getTime() - dayDate.getTime()) / 86400000);
            const isCompleted = isPast && daysAgo <= totalStreak;
            
            const fillColor = isCompleted ? colors.primary : (isToday && activeCategories >= 2 ? colors.success : 'transparent');
            const borderColor = isToday ? colors.primary : (isCompleted ? colors.primary + '40' : colors.border);

            const circleStyle = [
              styles.weeklyDayCircle,
              {
                backgroundColor: fillColor,
                borderColor: borderColor,
                borderWidth: isToday ? 2.5 : 1,
              }
            ];

            return (
              <View key={idx} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isToday ? colors.primary : colors.textSecondary, marginBottom: 6 }}>{label}</Text>
                
                {isToday ? (
                  <Animated.View style={[circleStyle, { transform: [{ scale: pulseAnim }], shadowColor: colors.primary, shadowOpacity: 0.6, shadowRadius: 8, elevation: 4 }]}>
                    {!isCompleted && activeCategories >= 2 && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    {activeCategories < 2 && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}
                  </Animated.View>
                ) : (
                  <View style={circleStyle}>
                    {isCompleted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    {isFuture && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border }} />}
                  </View>
                )}
                
                {isToday && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 }} />}
              </View>
            );
          })}
        </View>
        <View style={[styles.weeklyStripSummary, { borderTopColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16 }}>🔥</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text, marginLeft: 6 }}>
              {totalStreak} day streak
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {Object.entries(streakCounters).filter(([_, v]) => Number(v) > 0).slice(0, 3).map(([habit, streak]) => (
              <View key={habit} style={[styles.miniStreakPill, { backgroundColor: theme === 'dark' ? '#1E293B' : '#F8FAFC' }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' }}>{habit}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, marginLeft: 4 }}>{String(streak)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 20,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  weeklyStripCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  weeklyDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  weeklyDayCircle: {
    width: 36, // Increased to 36px as per plan
    height: 36, // Increased to 36px as per plan
    borderRadius: 18, // Adjusted borderRadius for 36px size
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyStripSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 16,
  },
  miniStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
