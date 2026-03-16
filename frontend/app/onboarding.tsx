import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { userStorage, logStorage } from '../src/storage';
import { secureStorage } from '../src/storage/secureStorage';
import { auth } from '../src/firebaseConfig';

const { width } = Dimensions.get('window');

type GoalType = 'bulking' | 'maintenance' | 'fat_loss';

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('maintenance');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -50, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    let newErrors: { [key: string]: string } = {};

    if (step === 0 && !displayName.trim()) {
      newErrors.name = 'Please enter your name to continue.';
    }

    if (step === 1) {
      if (!weight.trim()) newErrors.weight = 'Weight is required.';
      else {
        const w = parseFloat(weight);
        if (isNaN(w) || w < 20 || w > 300) newErrors.weight = 'Weight must be between 20-300 kg.';
      }

      if (!height.trim()) newErrors.height = 'Height is required.';
      else {
        const h = parseFloat(height);
        if (isNaN(h) || h < 100 || h > 250) newErrors.height = 'Height must be between 100-250 cm.';
      }

      if (!age.trim()) newErrors.age = 'Age is required.';
      else {
        const a = parseInt(age);
        if (isNaN(a) || a < 10 || a > 80) newErrors.age = 'Age must be between 10-80 years.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    animateTransition(step + 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const w = parseFloat(weight);
      const h = parseFloat(height);
      const a = parseInt(age);

      // Calculate personalized goals using ML-based BMR formula
      const goals = userStorage.calculateGoalsFromProfile(w, h, a, goalType);
      await userStorage.saveHealthGoals(goals);

      // Update user profile with name
      const user = auth.currentUser;
      if (user) {
        const profile = {
          uid: user.uid,
          name: displayName.trim(),
          email: user.email || '',
          avatarUrl: user.photoURL || '',
          createdAt: new Date().toISOString(),
        };
        await userStorage.saveUserProfile(profile);
        await secureStorage.setItem('user_profile', JSON.stringify(profile));
      }

      // Mark onboarding as complete
      await userStorage.setOnboardingComplete();

      // Save initial weight log
      await logStorage.saveWeightLog(w);

      router.replace('/(tabs)/dashboard');
    } catch (e) {
      console.error('Onboarding error:', e);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goalOptions: { type: GoalType; label: string; desc: string; emoji: string; color: string }[] = [
    { type: 'fat_loss', label: 'Fat Loss', desc: 'Calorie deficit + high protein', emoji: '🔥', color: '#EF4444' },
    { type: 'maintenance', label: 'Maintain', desc: 'Stay at current weight', emoji: '⚖️', color: '#0EA5E9' },
    { type: 'bulking', label: 'Bulk Up', desc: 'Calorie surplus for gains', emoji: '💪', color: '#8B5CF6' },
  ];

  const stepIndicators = [0, 1, 2, 3];

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Decorative */}
      <View style={[styles.circle1, { backgroundColor: colors.primary + '15' }]} />
      <View style={[styles.circle2, { backgroundColor: colors.secondary + '12' }]} />

      {/* Step Dots */}
      <View style={styles.stepRow}>
        {stepIndicators.map((s) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              {
                backgroundColor: s <= step ? colors.primary : colors.border,
                width: s === step ? 28 : 8,
              },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* 🎉 Step 0: Welcome */}
            {step === 0 && (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.stepHeader}>
                  <Text style={{ fontSize: 48 }}>👋</Text>
                  <Text style={[styles.title, { color: colors.text }]}>Welcome to CampusFuel AI</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Let's personalize your health journey. What should we call you?
                  </Text>
                </View>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: errors.name ? colors.danger : colors.border }]}>
                  <Ionicons name="person-outline" size={18} color={errors.name ? colors.danger : colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Your Name"
                    placeholderTextColor={colors.textSecondary}
                    value={displayName}
                    onChangeText={(text) => { setDisplayName(text); setErrors(prev => ({ ...prev, name: '' })); }}
                    autoFocus
                  />
                </View>
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
                
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={handleNext} activeOpacity={0.85}>
                  <Text style={styles.btnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            )}

            {/* 📏 Step 1: Body Stats */}
            {step === 1 && (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.stepHeader}>
                  <Text style={{ fontSize: 48 }}>📏</Text>
                  <Text style={[styles.title, { color: colors.text }]}>Your Body Stats</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    We use this to calculate your ideal daily intake using the Mifflin-St Jeor equation.
                  </Text>
                </View>

                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: errors.weight ? colors.danger : colors.border }]}>
                  <MaterialCommunityIcons name="weight-kilogram" size={20} color={errors.weight ? colors.danger : colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput style={[styles.input, { color: colors.text }]} placeholder="Weight (kg)" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={weight} onChangeText={(text) => { setWeight(text); setErrors(prev => ({ ...prev, weight: '' })); }} />
                </View>
                {errors.weight ? <Text style={styles.errorText}>{errors.weight}</Text> : null}

                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: errors.height ? colors.danger : colors.border }]}>
                  <MaterialCommunityIcons name="human-male-height" size={20} color={errors.height ? colors.danger : colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput style={[styles.input, { color: colors.text }]} placeholder="Height (cm)" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={height} onChangeText={(text) => { setHeight(text); setErrors(prev => ({ ...prev, height: '' })); }} />
                </View>
                {errors.height ? <Text style={styles.errorText}>{errors.height}</Text> : null}

                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: errors.age ? colors.danger : colors.border }]}>
                  <Ionicons name="calendar-outline" size={18} color={errors.age ? colors.danger : colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput style={[styles.input, { color: colors.text }]} placeholder="Age (years)" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={age} onChangeText={(text) => { setAge(text); setErrors(prev => ({ ...prev, age: '' })); }} />
                </View>
                {errors.age ? <Text style={styles.errorText}>{errors.age}</Text> : null}

                <View style={[styles.btnRow, { marginTop: 16 }]}>
                  <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => animateTransition(0)}>
                    <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, flex: 1, marginLeft: 12 }]} onPress={handleNext} activeOpacity={0.85}>
                    <Text style={styles.btnText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 🎯 Step 2: Goal Selection */}
            {step === 2 && (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.stepHeader}>
                  <Text style={{ fontSize: 48 }}>🎯</Text>
                  <Text style={[styles.title, { color: colors.text }]}>Your Fitness Goal</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    This determines your AI-calculated calorie and protein targets.
                  </Text>
                </View>

                {goalOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.type}
                    style={[
                      styles.goalCard,
                      {
                        backgroundColor: goalType === opt.type
                          ? (theme === 'dark' ? opt.color + '25' : opt.color + '12')
                          : colors.inputBg,
                        borderColor: goalType === opt.type ? opt.color : colors.border,
                        borderWidth: goalType === opt.type ? 2 : 1,
                      },
                    ]}
                    onPress={() => setGoalType(opt.type)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 28 }}>{opt.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: goalType === opt.type ? opt.color : colors.text }}>{opt.label}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>{opt.desc}</Text>
                    </View>
                    {goalType === opt.type && (
                      <View style={[styles.checkCircle, { backgroundColor: opt.color }]}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                <View style={styles.btnRow}>
                  <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => animateTransition(1)}>
                    <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, flex: 1, marginLeft: 12 }]} onPress={() => animateTransition(3)} activeOpacity={0.85}>
                    <Text style={styles.btnText}>See My Plan</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ✅ Step 3: Summary */}
            {step === 3 && (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.stepHeader}>
                  <Text style={{ fontSize: 48 }}>🚀</Text>
                  <Text style={[styles.title, { color: colors.text }]}>Your AI-Powered Plan</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Calculated using the Mifflin-St Jeor equation with your body stats.
                  </Text>
                </View>

                {(() => {
                  const w = parseFloat(weight) || 70;
                  const h = parseFloat(height) || 170;
                  const a = parseInt(age) || 20;
                  const goals = userStorage.calculateGoalsFromProfile(w, h, a, goalType);
                  
                  return (
                    <View style={[styles.summaryGrid]}>
                      <View style={[styles.summaryItem, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]}>
                        <Text style={{ fontSize: 22 }}>🔥</Text>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 }}>{goals.caloriesGoal}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>kcal/day</Text>
                      </View>
                      <View style={[styles.summaryItem, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]}>
                        <Text style={{ fontSize: 22 }}>💪</Text>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 }}>{goals.proteinGoal}g</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>protein/day</Text>
                      </View>
                      <View style={[styles.summaryItem, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]}>
                        <Text style={{ fontSize: 22 }}>💧</Text>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 }}>{goals.waterGoalLiters}L</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>water/day</Text>
                      </View>
                      <View style={[styles.summaryItem, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]}>
                        <Text style={{ fontSize: 22 }}>😴</Text>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 }}>{goals.sleepGoalHours}h</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>sleep/night</Text>
                      </View>
                    </View>
                  );
                })()}

                <View style={[styles.aiBadge, { backgroundColor: colors.cardHighlight }]}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 6 }}>
                    AI will adapt these goals as you log more data
                  </Text>
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => animateTransition(2)}>
                    <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.primary, flex: 1, marginLeft: 12 }]}
                    onPress={handleComplete}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnText}>{loading ? 'Setting Up...' : "Let's Go!"}</Text>
                    {!loading && <Ionicons name="rocket" size={18} color="#fff" style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  circle1: { position: 'absolute', top: -80, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(79,70,229,0.12)' },
  circle2: { position: 'absolute', bottom: -40, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(139,92,246,0.10)' },
  stepRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 60, marginBottom: 20 },
  stepDot: { height: 8, borderRadius: 4 },
  inner: { flex: 1, justifyContent: 'center', padding: 20 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  card: {
    padding: 28,
    borderRadius: 28,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  stepHeader: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 12, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, fontWeight: '500' },
  btn: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  btnRow: { flexDirection: 'row', marginTop: 8 },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  checkCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  summaryItem: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  aiBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginBottom: 16 },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600', marginTop: -10, marginBottom: 12, marginLeft: 4 },
});
