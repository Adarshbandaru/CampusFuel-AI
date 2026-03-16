import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Circle, G, Path, Defs, ClipPath } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';

interface WaterProgressCircleProps {
  size?: number;
  strokeWidth?: number;
  progress?: number;
}

export function WaterProgressCircle({ size = 180, strokeWidth = 12, progress = 0 }: WaterProgressCircleProps) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  
  const waveAnim = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const AnimatedG = Animated.createAnimatedComponent(G) as any;

  // Improved filling range: 0% at size (bottom), 100% at -10 (completely filled)
  const translateY = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [size, -10], 
  });

  const translateX1 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -size],
  });

  const translateX2 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-size, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id="waterClip">
            <Circle cx={size/2} cy={size/2} r={radius} />
          </ClipPath>
        </Defs>

        {/* Outer definition ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill={colors.pageBg}
        />

        {/* Waves Container */}
        <G clipPath="url(#waterClip)">
          {/* Back Wave */}
          <AnimatedG style={({ transform: [{ translateY }, { translateX: translateX2 }] } as any)}>
            <Path
              d={`M 0 10 Q ${size/4} 0 ${size/2} 10 T ${size} 10 T ${size*1.5} 10 T ${size*2} 10 V ${size*2} H 0 Z`}
              fill={colors.info}
              opacity={0.3}
            />
          </AnimatedG>

          {/* Front Wave */}
          <AnimatedG style={({ transform: [{ translateY }, { translateX: translateX1 }] } as any)}>
            <Path
              d={`M 0 10 Q ${size/4} 20 ${size/2} 10 T ${size} 10 T ${size*1.5} 10 T ${size*2} 10 V ${size*2} H 0 Z`}
              fill={colors.info}
              opacity={0.6}
            />
          </AnimatedG>
        </G>

        {/* Accent Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.info}
          strokeWidth={1.5}
          fill="none"
          opacity={0.5}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <MaterialCommunityIcons 
          name="water" 
          size={40} 
          color={progress > 60 ? "#FFFFFF" : colors.info} 
        />
      </View>
    </View>
  );
}
