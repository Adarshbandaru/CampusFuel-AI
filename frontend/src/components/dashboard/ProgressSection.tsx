import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../../src/context/ThemeContext';

const ProgressBar = ({ label, current, goal, unit, color }: any) => {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const progressPercent = Math.min(100, (current / goal) * 100);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progressPercent,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.progressText, { color: colors.text }]}>
          {current}{unit} <Text style={styles.progressGoal}>/ {goal}{unit}</Text>
        </Text>
      </View>
      <View style={[styles.progressBarBack, { backgroundColor: colors.border }]}>
        <Animated.View 
          style={[
            styles.progressBarFill, 
            { 
              width: animatedValue.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: color 
            }
          ]} 
        />
      </View>
    </View>
  );
};

interface ProgressSectionProps {
  cardFade3: Animated.Value;
  cardSlide3: Animated.Value;
  caloriesConsumed: number;
  caloriesGoal: number;
  proteinConsumed: number;
  proteinGoal: number;
  waterDrunkLiters: number;
  waterGoalLiters: number;
  sleepHoursActual: number;
  sleepHoursGoal: number;
}

export function ProgressSection({
  cardFade3,
  cardSlide3,
  caloriesConsumed,
  caloriesGoal,
  proteinConsumed,
  proteinGoal,
  waterDrunkLiters,
  waterGoalLiters,
  sleepHoursActual,
  sleepHoursGoal
}: ProgressSectionProps) {
  const { colors } = useTheme();

  return (
    <Animated.View style={{ opacity: cardFade3, transform: [{ translateY: cardSlide3 }] }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Progress</Text>
      <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
        <ProgressBar 
          label="Calories" 
          current={caloriesConsumed} 
          goal={caloriesGoal} 
          unit=" kcal" 
          color="#F59E0B" 
        />
        <ProgressBar 
          label="Protein" 
          current={proteinConsumed} 
          goal={proteinGoal} 
          unit="g" 
          color="#8B5CF6" 
        />
        <ProgressBar 
          label="Water" 
          current={waterDrunkLiters} 
          goal={waterGoalLiters} 
          unit="L" 
          color="#0EA5E9" 
        />
        <ProgressBar 
          label="Sleep" 
          current={sleepHoursActual} 
          goal={sleepHoursGoal} 
          unit="h" 
          color="#6366F1" 
        />
      </View>
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
  progressCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  progressItem: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressGoal: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  progressBarBack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
