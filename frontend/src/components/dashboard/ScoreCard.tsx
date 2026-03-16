import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../../../src/context/ThemeContext';

const { width = 400 } = Dimensions.get('window');

const CircularProgress = ({ size = 200, strokeWidth = 15, progress = 0, color = '#4F46E5' }) => {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 40, fontWeight: '800', color: colors.text }}>{Math.round(progress)}</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '600' }}>/ 100</Text>
      </View>
    </View>
  );
};

const AnimatedBar = ({ value, color }: { value: number; color: string }) => {
  const { colors } = useTheme();
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: value,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View style={[styles.miniProgressBack, { backgroundColor: colors.border }]}>
      <Animated.View 
        style={[
          styles.miniProgressFill, 
          { 
            width: animWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), 
            backgroundColor: color 
          }
        ]} 
      />
    </View>
  );
};

interface ScoreCardProps {
  cardFade1: Animated.Value;
  cardSlide1: Animated.Value;
  scoreGlow: Animated.Value;
  lifeConsistencyScore: number;
  scoreLabel: string;
  scoreBreakdown: Record<string, number>;
  onPress: () => void;
}

export function ScoreCard({
  cardFade1,
  cardSlide1,
  scoreGlow,
  lifeConsistencyScore,
  scoreLabel,
  scoreBreakdown,
  onPress
}: ScoreCardProps) {
  const { colors } = useTheme();
  
  // Color palette for breakdowns
  const breakdownColors = [colors.primary, colors.success, colors.warning, colors.danger];

  return (
    <Animated.View style={[styles.scoreSection, { 
      backgroundColor: colors.card, 
      opacity: cardFade1, 
      transform: [{ translateY: cardSlide1 }],
      shadowColor: colors.primary,
      shadowRadius: 20,
      shadowOpacity: scoreGlow.interpolate({ inputRange: [0.3, 1], outputRange: [0.15, 0.4] }) as any,
      elevation: 8,
    }]}>
      <TouchableOpacity 
        style={{ alignItems: 'center' }} 
        activeOpacity={0.8} 
        onPress={onPress}
      >
        <Text style={[styles.sectionLabel, { marginBottom: 6, color: colors.primary }]}>CONSISTENCY SCORE</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 24 }}>{scoreLabel} • Tap for details</Text>
        
        <View style={{ position: 'relative', marginBottom: 32 }}>
          {/* subtle glow around the ring */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, borderRadius: 100, opacity: scoreGlow.interpolate({ inputRange: [0.3, 1], outputRange: [0.05, 0.2] }) }]} />
          <CircularProgress progress={lifeConsistencyScore} size={Math.min(width * 0.4, 180)} strokeWidth={14} color={colors.primary} />
        </View>

        <View style={{ width: '100%' }}>
          {Object.entries(scoreBreakdown || {}).slice(0, 3).map(([key, val], i) => (
            <View key={key} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>{key}</Text>
                <Text style={[styles.breakdownVal, { color: colors.text }]}>{String(val)}%</Text>
              </View>
              <AnimatedBar value={val} color={breakdownColors[i % breakdownColors.length]} />
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scoreSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24, // increased border radius
    padding: 24,     // more padding for full-width feel
    shadowOffset: { width: 0, height: 8 },
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  miniProgressBack: {
    height: 8, // thicker bars
    borderRadius: 4,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
});
