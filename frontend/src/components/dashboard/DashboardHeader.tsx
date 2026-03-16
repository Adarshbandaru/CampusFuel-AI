import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';

interface DashboardHeaderProps {
  userName: string;
  level: number;
  onMenuPress: () => void;
}

export function DashboardHeader({
  userName,
  level,
  onMenuPress
}: DashboardHeaderProps) {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={{ backgroundColor: colors.headerBg }}>
      <View style={[styles.appBar, { backgroundColor: colors.headerBg, borderBottomColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIconWrap, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
            <Text style={{ fontSize: 16 }}>🔥</Text>
          </View>
          <View>
            <Text style={[styles.appName, { color: colors.text }]}>CampusFuel</Text>
            <Text style={[styles.appSubtitle, { color: colors.primary }]}>AI Health Tracker</Text>
          </View>
        </View>
        
        <View style={styles.rightActions}>
          <TouchableOpacity style={[styles.levelBadge, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: isDark ? '#3730A3' : '#C7D2FE' }]}>
            <Ionicons name="flash" size={12} color={colors.primary} style={{ marginRight: 3 }} />
            <Text style={[styles.levelText, { color: colors.primary }]}>Lv{level}</Text>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarLetter}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onMenuPress} style={styles.menuIconButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
    zIndex: 100,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  appSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: -1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 16,
    paddingLeft: 10,
    paddingRight: 4,
    borderWidth: 1,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '800',
    marginRight: 6,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  menuIconButton: {
    padding: 4,
  },
});

