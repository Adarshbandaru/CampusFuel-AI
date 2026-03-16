import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';

interface AIInsightProps {
  summaryMsg: string;
}

export function AIInsight({ summaryMsg }: AIInsightProps) {
  const { colors, theme } = useTheme();
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!summaryMsg) return;
    
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < summaryMsg.length) {
        // Use a functional state update and functional closure to avoid stale state issues,
        // though `i` correctly tracks the index.
        const char = summaryMsg.charAt(i);
        setDisplayedText(prev => prev + char);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [summaryMsg]);

  if (!summaryMsg) return null;

  return (
    <View style={[
      styles.insightCard, 
      { 
        backgroundColor: theme === 'dark' ? '#1E1B4B' : '#EEF2FF', 
        borderColor: theme === 'dark' ? '#312E81' : '#E0E7FF' 
      }
    ]}>
      <View style={styles.insightHeader}>
        <Ionicons name="sparkles" size={18} color={colors.primary} />
        <Text style={[styles.insightTitle, { color: colors.primary }]}>AI Insight</Text>
      </View>
      <Text style={[
        styles.insightText, 
        { color: theme === 'dark' ? '#C7D2FE' : '#3730A3' }
      ]}>
        "{displayedText}"
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  insightCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
