import React from 'react';
import { View, Text, ScrollView, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';

interface TodaysWinsProps {
  cardFade2: Animated.Value;
  cardSlide2: Animated.Value;
  waterDone: boolean;
  caloriesDone: boolean;
  proteinDone: boolean;
  sleepDone: boolean;
}

export function TodaysWins({
  cardFade2,
  cardSlide2,
  waterDone,
  caloriesDone,
  proteinDone,
  sleepDone
}: TodaysWinsProps) {
  const { colors } = useTheme();

  const wins = [
    { label: 'Water', done: waterDone, icon: 'water' as const, color: '#0EA5E9' },
    { label: 'Calories', done: caloriesDone, icon: 'flame' as const, color: '#F59E0B' },
    { label: 'Protein', done: proteinDone, icon: 'barbell' as const, color: '#8B5CF6' },
    { label: 'Sleep', done: sleepDone, icon: 'moon' as const, color: '#6366F1' },
  ];

  return (
    <Animated.View style={{ opacity: cardFade2, transform: [{ translateY: cardSlide2 }], marginBottom: 20 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Wins</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {wins.map((w, i) => (
          <View key={i} style={[
            styles.winPill, 
            { 
              backgroundColor: w.done ? w.color + '18' : colors.card, 
              borderColor: w.done ? w.color + '40' : colors.border 
            }
          ]}>
            <Ionicons name={w.done ? 'checkmark-circle' : w.icon} size={18} color={w.done ? w.color : colors.textSecondary} />
            <Text style={[styles.winPillText, { color: w.done ? w.color : colors.textSecondary }]}>{w.label}</Text>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
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
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  winPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  winPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
