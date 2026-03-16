import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';
import { NUTRITION_DATABASE } from '../../../utils/nutritionData';

const AVAILABLE_FOODS = Object.keys(NUTRITION_DATABASE);

// Basic emoji mapping for available foods
const FOOD_ICONS: Record<string, string> = {
  'Oats': '🥣', 'Milk': '🥛', 'Banana': '🍌', 'Egg': '🥚', 'Bread': '🍞',
  'Rice': '🍚', 'Dal': '🍲', 'Chapati': '🫓', 'Chicken Breast': '🍗',
  'Paneer': '🧀', 'Apple': '🍎', 'Whey Protein': '🥤', 'Idli': '🍘', 'Dosa': '🌮'
};

interface PlateBuilderProps {
  plate: Record<string, number>;
  setPlate: (plate: Record<string, number>) => void;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export function PlateBuilder({ plate, setPlate, totals }: PlateBuilderProps) {
  const { colors, theme } = useTheme();

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Plate Builder</Text>
        <View style={[styles.liveCalorieBadge, { backgroundColor: theme === 'dark' ? '#2D1B13' : '#FFEDD5' }]}>
          <Ionicons name="flame" size={16} color="#F97316" />
          <Text style={[styles.liveCalorieText, { color: '#F97316' }]}>
            {Math.round(totals.calories)} kcal
          </Text>
        </View>
      </View>

      <View style={styles.plateGrid}>
        {AVAILABLE_FOODS.map(f => (
          <View key={f} style={[styles.plateItem, { 
            backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF',
            borderColor: colors.border
          }]}>
            <View style={styles.plateItemHeader}>
              <View style={styles.foodTitleRow}>
                <Text style={styles.foodEmoji}>{FOOD_ICONS[f] || '🍽️'}</Text>
                <Text style={[styles.plateItemName, { color: colors.text }]} numberOfLines={1}>{f}</Text>
              </View>
              <Text style={[styles.plateItemSub, { color: colors.textSecondary }]}>
                {NUTRITION_DATABASE[f].calories} kcal / {NUTRITION_DATABASE[f].unit}
              </Text>
            </View>
            <View style={[styles.qtyBox, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC' }]}>
              <TouchableOpacity 
                style={styles.qtyBtn}
                onPress={() => setPlate({...plate, [f]: Math.max((plate[f]||0)-1, 0)})}
              >
                <Ionicons name="remove-circle" size={28} color={plate[f] ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
              
              <Text style={[styles.qtyText, { color: colors.text }]}>{plate[f] || 0}</Text>
              
              <TouchableOpacity 
                style={styles.qtyBtn}
                onPress={() => setPlate({...plate, [f]: (plate[f]||0)+1})}
              >
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {totals.calories > 0 && (
        <View style={[styles.totalsCard, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
          <Text style={[styles.totalsTitle, { color: colors.textSecondary }]}>Plate Summary</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalItem}>
              <Text style={[styles.totalVal, { color: colors.text }]}>{Math.round(totals.calories)}</Text>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>kcal</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalVal, { color: '#8B5CF6' }]}>{totals.protein.toFixed(1)}g</Text>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Protein</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalVal, { color: '#F59E0B' }]}>{totals.carbs.toFixed(1)}g</Text>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Carbs</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalVal, { color: '#EC4899' }]}>{totals.fat.toFixed(1)}g</Text>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Fat</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
  },
  liveCalorieBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  liveCalorieText: {
    fontSize: 14,
    fontWeight: '800',
  },
  plateGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  plateItem: { 
    width: '48%', 
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  plateItemHeader: { 
    marginBottom: 12,
  },
  foodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  foodEmoji: {
    fontSize: 18,
  },
  plateItemName: { 
    fontSize: 14, 
    fontWeight: '800',
    flex: 1,
  },
  plateItemSub: { 
    fontSize: 11, 
    fontWeight: '600' 
  },
  qtyBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 4, 
    borderRadius: 12,
  },
  qtyBtn: {
    width: 44, // 44px touch target
    height: 44, // 44px touch target
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { 
    flex: 1, 
    textAlign: 'center', 
    fontSize: 16, 
    fontWeight: '800' 
  },
  totalsCard: { 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1 
  },
  totalsTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    marginBottom: 16, 
    textAlign: 'center', 
    letterSpacing: 0.5 
  },
  totalsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around' 
  },
  totalItem: { 
    alignItems: 'center' 
  },
  totalVal: { 
    fontSize: 18, 
    fontWeight: '800' 
  },
  totalLabel: { 
    fontSize: 11, 
    fontWeight: '700', 
    marginTop: 4 
  },
});
