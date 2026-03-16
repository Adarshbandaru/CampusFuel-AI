import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../../src/context/ThemeContext';

interface QuickActionsProps {
  onLogMeal: () => void;
  onLogWater: () => void;
  onLogWeight: () => void;
  onLogSleep: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const QuickActionCard = ({ action, onPress, colors, bg }: any) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedPressable
      style={[
        styles.quickActionItem, 
        { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          shadowColor: '#000',
        },
        animatedStyle
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <View style={[styles.quickActionEmoji, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 22 }}>{action.emoji}</Text>
      </View>
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>{action.label}</Text>
    </AnimatedPressable>
  );
};

export function QuickActions({
  onLogMeal,
  onLogWater,
  onLogWeight,
  onLogSleep
}: QuickActionsProps) {
  const { colors, theme } = useTheme();

  const actions = [
    { label: 'Meal', emoji: '🍽️', onPress: onLogMeal, bg: theme === 'dark' ? '#312E81' : '#EEF2FF' },
    { label: 'Water', emoji: '💧', onPress: onLogWater, bg: theme === 'dark' ? '#064E3B' : '#ECFDF5' },
    { label: 'Weight', emoji: '⚖️', onPress: onLogWeight, bg: theme === 'dark' ? '#451A03' : '#FEF3C7' },
    { label: 'Sleep', emoji: '🌙', onPress: onLogSleep, bg: theme === 'dark' ? '#2E1065' : '#F5F3FF' },
  ];

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.quickActionsRow}>
        {actions.map((action, i) => (
          <QuickActionCard 
            key={i} 
            action={action} 
            onPress={action.onPress} 
            colors={colors} 
            bg={action.bg} 
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 20,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  quickActionItem: {
    flex: 1,
    aspectRatio: 1, // Make them square
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 4,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  quickActionEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
