import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { userStorage } from '../src/storage';
import { calculateGoalsFromProfile } from '../src/storage/userStorage';

export default function CalorieCalculator() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  
  const [age, setAge] = useState('21');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');
  const [goal, setGoal] = useState<'bulk' | 'maintain' | 'cut'>('maintain');
  const [result, setResult] = useState<{ calories: number; protein: number; water: number } | null>(null);

  const calculate = () => {
    const a = parseInt(age);
    const h = parseInt(height);
    const w = parseInt(weight);

    if (isNaN(a) || isNaN(h) || isNaN(w)) {
      return Alert.alert("Invalid Input", "Please enter valid numbers for age, height, and weight.");
    }

    const goalTypeMap: Record<string, any> = { bulk: 'bulking', maintain: 'maintenance', cut: 'fat_loss' };
    const calculated = calculateGoalsFromProfile(w, h, a, goalTypeMap[goal]);

    setResult({
      calories: calculated.caloriesGoal,
      protein: calculated.proteinGoal,
      water: calculated.waterGoalLiters
    });
  };

  const applyGoals = async () => {
    if (!result) return;
    try {
      const goalTypeMap: Record<string, any> = { bulk: 'bulking', maintain: 'maintenance', cut: 'fat_loss' };
      await userStorage.saveHealthGoals({
        caloriesGoal: result.calories,
        proteinGoal: result.protein,
        waterGoalLiters: result.water,
        goalType: goalTypeMap[goal],
        weightKg: parseInt(weight),
        heightCm: parseInt(height)
      });
      Alert.alert("Goals Updated 🎯", "Your new daily targets have been applied across the app.");
      router.back();
    } catch {
      Alert.alert("Error", "Could not save goals.");
    }
  };

  const bg = colors.pageBg;
  const card = colors.card;
  const text = colors.text;

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: bg }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: text }]}>Calorie Calculator</Text>
        </View>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Based on your metrics, we'll calculate your ideal daily intake.</Text>

        <View style={[styles.formCard, { backgroundColor: card }]}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age (years)</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: bg, color: text, borderColor: colors.border }]} 
              keyboardType="numeric" 
              value={age} 
              onChangeText={setAge} 
              placeholder="e.g. 21"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: bg, color: text, borderColor: colors.border }]} 
              keyboardType="numeric" 
              value={height} 
              onChangeText={setHeight} 
              placeholder="e.g. 175"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Weight (kg)</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: bg, color: text, borderColor: colors.border }]} 
              keyboardType="numeric" 
              value={weight} 
              onChangeText={setWeight} 
              placeholder="e.g. 70"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Text style={styles.label}>Your Goal</Text>
          <View style={styles.goalRow}>
            {[
              { id: 'cut', label: 'Fat Loss', icon: 'trending-down' },
              { id: 'maintain', label: 'Maintain', icon: 'remove' },
              { id: 'bulk', label: 'Bulking', icon: 'trending-up' }
            ].map((g) => (
              <TouchableOpacity 
                key={g.id} 
                style={[styles.goalBtn, { backgroundColor: bg, borderColor: colors.border }, goal === g.id && { backgroundColor: colors.primary, borderColor: colors.primary }]} 
                onPress={() => setGoal(g.id as any)}
              >
                <Ionicons 
                  name={g.icon as any} 
                  size={20} 
                  color={goal === g.id ? '#fff' : colors.textSecondary} 
                />
                <Text style={[styles.goalLabel, { color: colors.textSecondary }, goal === g.id && { color: '#fff' }]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.calcBtn, { backgroundColor: colors.primary }]} onPress={calculate}>
            <Text style={styles.calcBtnText}>Calculate Targets</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.heroBg, borderColor: colors.primary }]}>
            <View style={styles.resultHeader}>
              <MaterialCommunityIcons name="target" size={24} color={colors.primary} />
              <Text style={[styles.resultTitle, { color: colors.primary }]}>Recommended Daily Intake</Text>
            </View>

            <View style={styles.resultGrid}>
              <View style={styles.resultItem}>
                <Text style={[styles.resultVal, { color: text }]}>{result.calories}</Text>
                <Text style={[styles.resultUnit, { color: colors.textSecondary }]}>kcal</Text>
                <Text style={[styles.resultLabel, { color: colors.primary }]}>Calories</Text>
              </View>
              <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
              <View style={styles.resultItem}>
                <Text style={[styles.resultVal, { color: text }]}>{result.protein}</Text>
                <Text style={[styles.resultUnit, { color: colors.textSecondary }]}>grams</Text>
                <Text style={[styles.resultLabel, { color: colors.primary }]}>Protein</Text>
              </View>
              <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
              <View style={styles.resultItem}>
                <Text style={[styles.resultVal, { color: text }]}>{result.water}</Text>
                <Text style={[styles.resultUnit, { color: colors.textSecondary }]}>liters</Text>
                <Text style={[styles.resultLabel, { color: colors.primary }]}>Water</Text>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.cardHighlight }]}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: text }]}>
                We assume a "Light Activity" level for typical campus commutes. Adjust as needed if you train intensely.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.setGoalBtn, { backgroundColor: card, borderColor: colors.primary }]} 
              onPress={applyGoals}
            >
              <Text style={[styles.setGoalText, { color: colors.primary }]}>Apply to my Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 24, fontWeight: '800', marginLeft: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 30 },
  
  formCard: { borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 2 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  input: { borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1 },
  
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, marginTop: 8 },
  goalBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, marginRight: 8, borderWidth: 1 },
  goalLabel: { fontSize: 12, fontWeight: '700', marginTop: 6 },

  calcBtn: { borderRadius: 16, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  resultCard: { borderRadius: 24, padding: 24, marginTop: 24, borderWidth: 1 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  resultTitle: { fontSize: 18, fontWeight: '800', marginLeft: 10 },
  resultGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginVertical: 10 },
  resultItem: { alignItems: 'center' },
  resultVal: { fontSize: 28, fontWeight: '800' },
  resultUnit: { fontSize: 10, fontWeight: '700', marginTop: -2 },
  resultLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  dividerVertical: { width: 1, height: 40 },

  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, marginTop: 24 },
  infoText: { flex: 1, fontSize: 12, marginLeft: 10, lineHeight: 18, fontWeight: '500' },

  setGoalBtn: { borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 20, borderWidth: 1 },
  setGoalText: { fontSize: 15, fontWeight: '800' },
});
