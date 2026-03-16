import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Animated, Dimensions, Modal, Alert, TextInput, Easing } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../../src/context/ThemeContext';
import { useToast } from '../../src/context/ToastContext';
import { auth } from '../../src/firebaseConfig';
import { secureStorage } from '../../src/storage/secureStorage';

// Logic & Data Layers
import { healthEngine, scoreEngine, nutritionEngine, timelineEngine, coachEngine } from '../../src/services';
import { logStorage, userStorage } from '../../src/storage';

const { width } = Dimensions.get('window');

import { ScoreCard } from '../../src/components/dashboard/ScoreCard';
import { DashboardHeader } from '../../src/components/dashboard/DashboardHeader';
import { TodaysWins } from '../../src/components/dashboard/TodaysWins';
import { ProgressSection } from '../../src/components/dashboard/ProgressSection';
import { WeeklyTracker } from '../../src/components/dashboard/WeeklyTracker';
import { QuickActions } from '../../src/components/dashboard/QuickActions';
import { AIInsight } from '../../src/components/dashboard/AIInsight';
import { DashboardSkeleton } from '../../src/components/common/Skeleton';
import { StudentRoutineCard } from '../../src/components/dashboard/StudentRoutineCard';

// Components extracted

export default function Dashboard() {
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [campusModeEnabled, setCampusModeEnabled] = useState(false);
  const [customFoodVisible, setCustomFoodVisible] = useState(false);
  const [scoreDetailsVisible, setScoreDetailsVisible] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCals, setNewFoodCals] = useState('');
  const [newFoodPro, setNewFoodPro] = useState('');
  const [userName, setUserName] = useState('User');
  const [mealPickerVisible, setMealPickerVisible] = useState(false);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [sleepModalVisible, setSleepModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [sleepInput, setSleepInput] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scoreGlow = useRef(new Animated.Value(0.3)).current;
  const cardSlide1 = useRef(new Animated.Value(60)).current;
  const cardSlide2 = useRef(new Animated.Value(60)).current;
  const cardSlide3 = useRef(new Animated.Value(60)).current;
  const cardFade1 = useRef(new Animated.Value(0)).current;
  const cardFade2 = useRef(new Animated.Value(0)).current;
  const cardFade3 = useRef(new Animated.Value(0)).current;
  const pulseAnimFAB = useRef(new Animated.Value(1)).current;

  // Load user name from storage
  useEffect(() => {
    const loadUserName = async () => {
      try {
        const profileStr = await secureStorage.getItem('user_profile');
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          if (profile.name) setUserName(profile.name.split(' ')[0]);
        }
      } catch (e) { }
    };
    loadUserName();
  }, []);

  // Entrance animations
  useEffect(() => {
    if (!loading && data) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      ]).start();

      // Staggered card animations
      Animated.stagger(120, [
        Animated.parallel([
          Animated.timing(cardFade1, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(cardSlide1, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        ]),
        Animated.parallel([
          Animated.timing(cardFade2, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(cardSlide2, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        ]),
        Animated.parallel([
          Animated.timing(cardFade3, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(cardSlide3, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        ]),
      ]).start();

      // Pulsing glow on score
      Animated.loop(
        Animated.sequence([
          Animated.timing(scoreGlow, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(scoreGlow, { toValue: 0.3, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();

      // Pulsing FAB
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimFAB, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnimFAB, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading, data]);

  const loadDashboard = async () => {
    try {
      if (!auth.currentUser) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Update daily summary for today
      try {
        await logStorage.saveDailySummary();
      } catch (sumErr) {
        console.warn("Failed to save daily summary:", sumErr);
      }

      // 1. Fetch Real User Data & Goals from Firestore
      console.log("[Dashboard] Starting data fetch for UID:", auth.currentUser?.uid);
      
      let todaySum, goals, prefs, xp, streaks, timetable, yesterdayLog;
      
      try { todaySum = await logStorage.getTodaysSummary(today); } 
      catch (e) { console.error("Error fetching Today Summary:", e); throw e; }
      
      try { goals = await userStorage.getHealthGoals(); } 
      catch (e) { console.error("Error fetching Health Goals:", e); throw e; }
      
      try { prefs = await userStorage.getPreferences(); } 
      catch (e) { console.error("Error fetching Preferences:", e); throw e; }
      
      try { xp = await userStorage.getXP(); } 
      catch (e) { console.error("Error fetching XP:", e); throw e; }
      
      try { streaks = await userStorage.getStreaks(); } 
      catch (e) { console.error("Error fetching Streaks:", e); throw e; }
      
      try { timetable = await userStorage.getTimetable(); } 
      catch (e) { console.error("Error fetching Timetable:", e); throw e; }
      
      try { yesterdayLog = await logStorage.getDailyLog(new Date(Date.now() - 86400000)); } 
      catch (e) { console.error("Error fetching Yesterday Log:", e); throw e; }

      const isCampusMode = prefs?.notificationsEnabled || false; 
      setCampusModeEnabled(isCampusMode);

      // 2. Calculate Health Metrics using healthEngine
      const mappedGoals = {
        waterLiters: goals?.waterGoalLiters || 3,
        calories: goals?.caloriesGoal || 2000,
        protein: goals?.proteinGoal || 150,
        sleepHours: goals?.sleepGoalHours || 8,
      };

      const waterProg = healthEngine.getWaterProgress(todaySum?.totalWaterMl || 0, mappedGoals.waterLiters);
      const nutriProg = healthEngine.getNutritionProgress(todaySum?.totalCalories || 0, todaySum?.totalProtein || 0, mappedGoals);
      const sleepMetrics = healthEngine.getSleepMetrics(todaySum?.sleepMinutes || 0, mappedGoals.sleepHours);
      const mealStatus = healthEngine.getMealStatus(todaySum?.mealsCount || 0, new Date().getHours());

      // 3. Calculate Consistency Score using scoreEngine
      const scoreInputs = {
        calories: todaySum?.totalCalories || 0,
        caloriesGoal: goals?.caloriesGoal || 2000,
        protein: todaySum?.totalProtein || 0,
        proteinGoal: goals?.proteinGoal || 150,
        mealsLogged: todaySum?.mealsCount || 0,
        waterLiters: (todaySum?.totalWaterMl || 0) / 1000,
        waterGoalLiters: goals?.waterGoalLiters || 3,
        sleepHours: (todaySum?.sleepMinutes || 0) / 60,
        sleepGoalHours: goals?.sleepGoalHours || 8,
        streaks: {
          water: streaks?.water || 0,
          protein: streaks?.protein || 0,
          calories: streaks?.calories || 0,
          sleep: streaks?.sleep || 0,
        },
      };

      const scoreBreakdownResult = scoreEngine.calculateConsistencyScore(scoreInputs);
      const xpLevel = scoreEngine.getLevelFromXP(xp);
      const scoreLabel = scoreEngine.getScoreLabel(scoreBreakdownResult.total);

      // 4. Build Smart Daily Timeline using timelineEngine
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
      const classes: any[] = isCampusMode ? (timetable[dayName] || []) : [];
      
      const timelineData = timelineEngine.buildDailyTimeline(classes, prefs?.sleepTargetHour || 23);
      const nextAction = timelineEngine.getNextAction(timelineData);

      // 5. Final Data Assemble
      const freshData = {
        water_drunk_liters: (todaySum?.totalWaterMl || 0) / 1000,
        water_goal_liters: mappedGoals.waterLiters,
        calories_consumed: todaySum?.totalCalories || 0,
        calories_goal: mappedGoals.calories,
        protein_consumed: todaySum?.totalProtein || 0,
        protein_goal: mappedGoals.protein,
        life_consistency_score: scoreBreakdownResult.total,
        score_label: scoreLabel.label,
        score_color: scoreLabel.color,
        score_breakdown: {
          "Nutrition": scoreBreakdownResult.percentages.nutrition,
          "Hydration": scoreBreakdownResult.percentages.hydration,
          "Sleep": scoreBreakdownResult.percentages.sleep,
          "Habits": scoreBreakdownResult.percentages.habits,
          "Discipline": scoreBreakdownResult.percentages.discipline
        },
        sleep_hours_actual: (todaySum?.sleepMinutes || 0) / 60,
        sleep_hours_goal: mappedGoals.sleepHours,
        sleep_quality_score: sleepMetrics.qualityScore,
        sleep_consistency: 0, 
        streak_counters: streaks,
        meals_tracker: mealStatus,
        xp_level: xpLevel,
        daily_challenge: {
          title: "Today's Challenge",
          tasks: [
            `Drink ${mappedGoals.waterLiters}L water`,
            `Eat ${mappedGoals.protein}g protein`,
            `Consistency check-in`
          ],
          reward: "+20 Consistency XP"
        },
        habit_recovery: [] as any[],
        detailed_analysis: [
            `Nutrition: ${scoreBreakdownResult.nutrition} / 30`,
            `Hydration: ${scoreBreakdownResult.hydration} / 20`,
            `Sleep: ${scoreBreakdownResult.sleep} / 20`,
            `Habits: ${scoreBreakdownResult.habits} / 15`,
            `Discipline: ${scoreBreakdownResult.discipline} / 15`,
            `Current Title: ${xpLevel.title} (Level ${xpLevel.level})`,
            waterProg.percentage >= 100 ? "Great job on hydration!" : "Keep drinking water to reach your goal."
        ],
        timelineData,
        nextAction,
        summary: { greeting: getGreetingString(), summary_msg: scoreLabel.label }
      };

      // 4.5 Gentle Habit Recovery logic
      const recovery: any[] = [];
      if (yesterdayLog) {
        if ((yesterdayLog.totalWaterMl || 0) < mappedGoals.waterLiters * 1000) {
          recovery.push({
            type: 'Hydration',
            message: "You missed your hydration goal yesterday. Try drinking water regularly throughout the day.",
            icon: 'water',
            color: '#0EA5E9'
          });
        }
        if ((yesterdayLog.totalProtein || 0) < mappedGoals.protein) {
          recovery.push({
            type: 'Protein',
            message: "Protein intake was slightly low yesterday. Consider adding milk, paneer, or peanut butter today.",
            icon: 'arm-flex',
            color: '#8B5CF6'
          });
        }
        if ((yesterdayLog.sleepMinutes || 0) < mappedGoals.sleepHours * 60) {
          recovery.push({
            type: 'Sleep',
            message: "You slept less than your target. Try sleeping 30 minutes earlier tonight.",
            icon: 'bed',
            color: '#6366F1'
          });
        }
      }
      freshData.habit_recovery = recovery;

      const coachInput = {
        nutrition: {
          calories: todaySum?.totalCalories || 0,
          protein: todaySum?.totalProtein || 0,
          goalCalories: goals?.caloriesGoal || 2000,
          goalProtein: goals?.proteinGoal || 150,
        },
        hydration: {
          liters: (todaySum?.totalWaterMl || 0) / 1000,
          goalLiters: goals?.waterGoalLiters || 3,
        },
        sleep: {
          hours: (todaySum?.sleepMinutes || 0) / 60,
          goalHours: goals?.sleepGoalHours || 8,
          qualityScore: sleepMetrics.qualityScore,
        },
        score: scoreBreakdownResult,
        timetable: classes,
      };

      const coachInsight = coachEngine.generateDailyInsight(coachInput);
      freshData.summary = { greeting: getGreetingString(), summary_msg: coachInsight };

      setData(freshData);

    } catch (e) {
      console.error("Dashboard Load Error:", e);
      setError(true);
      showToast("Failed to load dashboard. Please try again.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getGreetingString = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning";
    if (hr < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const handleLogSleep = async () => {
    setSleepModalVisible(true);
  };

  const submitSleepLog = async () => {
    const hours = parseFloat(sleepInput);
    if (isNaN(hours) || hours < 1 || hours > 16) {
      showToast('Enter sleep hours between 1-16.', 'error');
      return;
    }
    try {
      const now = new Date();
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      await logStorage.saveSleepLog({
        date: new Date().toISOString().split('T')[0],
        startTime: new Date(yesterday.setHours(24 - Math.floor(hours), 0)).toISOString(),
        endTime: now.toISOString(),
        durationMinutes: hours * 60
      });
      showToast(`${hours}h sleep logged! 🌙`, 'success');
      setSleepModalVisible(false);
      setSleepInput('');
      loadDashboard();
    } catch (e) {
      showToast('Could not log sleep session.', 'error');
    }
  };

  const handleLogWater = async () => {
    try {
      await logStorage.saveWaterLog(250);
      showToast('Added 250ml water 💧', 'success');
      loadDashboard();
    } catch (e) { showToast('Failed to add water', 'error'); }
  };

  const handleLogWeight = async () => {
    setWeightModalVisible(true);
  };

  const submitWeightLog = async () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val < 20 || val > 300) {
      showToast('Enter weight between 20-300 kg.', 'error');
      return;
    }
    try {
      await logStorage.saveWeightLog(val);
      showToast(val + 'kg saved ⚖️', 'success');
      setWeightModalVisible(false);
      setWeightInput('');
      loadDashboard();
    } catch (e) {
      showToast('Failed to log weight.', 'error');
    }
  };

  const handleAddCustomFood = async () => {
    if (!newFoodName || !newFoodCals || !newFoodPro) {
      showToast("Please fill all fields", "error");
      return;
    }
    try {
      await logStorage.saveMealLog({
        date: new Date().toISOString().split('T')[0],
        name: newFoodName,
        calories: parseInt(newFoodCals),
        protein: parseInt(newFoodPro),
        carbs: 0,
        fat: 0,
        loggedAt: new Date().toISOString()
      });
      
      showToast("Custom food logged! 🍲", "success");
      setNewFoodName('');
      setNewFoodCals('');
      setNewFoodPro('');
      setCustomFoodVisible(false);
      loadDashboard();
    } catch (e) { showToast("Failed to add custom food", "error"); }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setError(false);
        loadDashboard();
      } else {
        setLoading(false);
        // Optionally redirect to login if no guest mode
      }
    });
    return () => unsubscribe();
  }, []);

  // 10-second loading timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError(true);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [loading]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const waterDrunk = data?.water_drunk_liters || 0;
    const waterGoal = data?.water_goal_liters || 4.0;
    const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

    if (hour < 12) {
      return { 
        title: `Good morning, ${capitalizedName}!`, 
        sub: "Let's make today count 👍",
        emoji: '🌤'
      };
    } else if (hour < 17) {
      const isHalfway = waterDrunk >= (waterGoal / 2);
      return { 
        title: `Hey ${capitalizedName}!`, 
        sub: isHalfway ? "You're crushing it today! Keep going." : "Stay on track — you've got this!",
        emoji: '🔥'
      };
    } else {
      const remainingMl = Math.round(Math.max(0, (waterGoal - waterDrunk) * 1000));
      return { 
        title: `Evening, ${capitalizedName}!`, 
        sub: remainingMl > 0 ? `Almost there — ${remainingMl}ml water left` : "All goals crushed today! 🌟",
        emoji: '🌙'
      };
    }
  };

  const greetingStatus = getGreeting();

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data || error) {
    return (
        <View style={[styles.center, { backgroundColor: colors.pageBg, padding: 20 }]}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, margin: 16, alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12 }}>
              Could not load data
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
              Make sure the backend server is running at port 8000, then tap retry.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, marginTop: 16 }}
              onPress={() => { setError(false); setLoading(true); loadDashboard(); }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Layer 1 — App Bar (Sticky) */}
      <DashboardHeader
        userName={userName}
        level={data.xp_level.level}
        onMenuPress={() => setMenuVisible(true)}
      />

      {/* Layer 2 — Hero Section */}
      <View style={[styles.heroSection, { backgroundColor: colors.heroBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.heroGreeting, { color: colors.text }]}>
          {greetingStatus.title} {greetingStatus.emoji}
        </Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
          {greetingStatus.sub}
        </Text>
      </View>

      {/* Layer 3 — Scrollable Content */}
      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.pageBg }]}
      >

        {/* ℹ️ Info/About Menu Modal */}
        <Modal visible={menuVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={[styles.infoMenu, { backgroundColor: colors.card }]}>
              {[
                { icon: 'information-circle-outline' as const, label: 'About', color: colors.primary, msg: 'About CampusFuel AI', body: 'CampusFuel AI v2.0.0\n\nAn AI-powered campus health & nutrition tracker that uses the Mifflin-St Jeor equation for personalized targets, EWMA pattern detection, and smart food recommendations.\n\nBuilt with React Native + Firebase + FastAPI.' },
                { icon: 'document-text-outline' as const, label: 'Terms & Conditions', color: '#8B5CF6', msg: 'Terms & Conditions', body: 'By using CampusFuel AI, you agree to:\n\n1. Your health data is stored securely on Firebase.\n2. AI recommendations are advisory only.\n3. We do not share your data with third parties.\n4. You may delete your account at any time.\n5. App provided "as is" for educational purposes.\n\nLast updated: March 2026' },
                { icon: 'shield-checkmark-outline' as const, label: 'Privacy Policy', color: '#10B981', msg: 'Privacy Policy', body: '• We collect only health metrics you voluntarily log.\n• All data is encrypted on Google Firebase.\n• We do not serve ads or sell your data.\n• Contact us for full account deletion.\n\nEffective: March 2026' },
                { icon: 'mail-outline' as const, label: 'Contact Developer', color: '#F59E0B', msg: 'Contact', body: 'Developer: Adarsh Bandaru\n\n📱 Phone: 8885006708\n📧 Email: adarshbandaru05@gmail.com\n🌐 GitHub: github.com/Adarshbandaru\n📱 App: CampusFuel AI v2.0.0\n\nFor bugs, features, or feedback!' },
                { icon: 'code-slash-outline' as const, label: 'Version 2.0.0', color: '#64748B', msg: 'Version Info', body: 'CampusFuel AI v2.0.0-Gold\n\n• AI Coach with EWMA pattern detection\n• Mifflin-St Jeor personalized nutrition\n• Smart food recommendations\n• Weekly trend analysis\n• Campus schedule integration' },
              ].map((item, idx) => (
                <React.Fragment key={item.label}>
                  {idx > 0 && <View style={[styles.infoMenuDivider, { backgroundColor: colors.border }]} />}
                  <TouchableOpacity style={styles.infoMenuItem} onPress={() => { setMenuVisible(false); Alert.alert(item.msg, item.body); }}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                    <Text style={[styles.infoMenuText, { color: colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 🏆 Life Consistency Score */}
        <ScoreCard
          cardFade1={cardFade1}
          cardSlide1={cardSlide1}
          scoreGlow={scoreGlow}
          lifeConsistencyScore={data.life_consistency_score}
          scoreLabel={data.score_label}
          scoreBreakdown={data.score_breakdown}
          onPress={() => setScoreDetailsVisible(true)}
        />

        {/* 🎯 Today's Wins */}
        <TodaysWins
          cardFade2={cardFade2}
          cardSlide2={cardSlide2}
          waterDone={data.water_drunk_liters >= data.water_goal_liters}
          caloriesDone={data.calories_consumed >= data.calories_goal}
          proteinDone={data.protein_consumed >= data.protein_goal}
          sleepDone={data.sleep_hours_actual >= data.sleep_hours_goal}
        />

        {/* 🔥 Weekly Activity Strip */}
        <WeeklyTracker streakCounters={data.streak_counters} />

        {/* 🤖 Student Routine AI */}
        {auth.currentUser?.uid && (
          <StudentRoutineCard uid={auth.currentUser.uid} />
        )}

        {/* ⚡ Quick Actions */}
        <QuickActions
          onLogMeal={() => setMealPickerVisible(true)}
          onLogWater={handleLogWater}
          onLogWeight={handleLogWeight}
          onLogSleep={handleLogSleep}
        />

        {/* 🍽 Meal Category Picker */}
        <Modal visible={mealPickerVisible} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMealPickerVisible(false)}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Log a Meal</Text>
                <TouchableOpacity onPress={() => setMealPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 16 }}>What are you logging?</Text>
              <View style={styles.actionGrid}>
                {[
                  { label: 'Breakfast', emoji: '☕', color: '#F59E0B', bg: theme === 'dark' ? '#451A03' : '#FFFBEB' },
                  { label: 'Lunch', emoji: '🍛', color: '#10B981', bg: theme === 'dark' ? '#064E3B' : '#ECFDF5' },
                  { label: 'Snack', emoji: '🍪', color: '#8B5CF6', bg: theme === 'dark' ? '#2E1065' : '#F5F3FF' },
                  { label: 'Dinner', emoji: '🍝', color: '#EF4444', bg: theme === 'dark' ? '#450A0A' : '#FFF1F2' },
                ].map((meal, idx) => (
                  <TouchableOpacity key={idx} style={styles.actionItem} onPress={() => {
                    setMealPickerVisible(false);
                    // Navigate to Log tab
                    Alert.alert(`${meal.label} ✅`, `Go to the Log tab to add your ${meal.label.toLowerCase()} items!\n\nYour plate builder has all the foods ready.`);
                  }}>
                    <View style={[styles.actionIconCircle, { backgroundColor: meal.bg }]}>
                      <Text style={{ fontSize: 28 }}>{meal.emoji}</Text>
                    </View>
                    <Text style={[styles.actionLabelText, { color: colors.textSecondary }]}>{meal.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ⚖️ Weight Input Modal */}
        <Modal visible={weightModalVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setWeightModalVisible(false)}>
            <View style={[styles.weightSleepModal, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 }}>⚖️ Log Weight</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>Enter your current weight in kg</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme === 'dark' ? '#1E293B' : '#F8FAFC', color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. 47"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={weightInput}
                onChangeText={setWeightInput}
                autoFocus
              />
              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]} onPress={submitWeightLog}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 🌙 Sleep Input Modal */}
        <Modal visible={sleepModalVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSleepModalVisible(false)}>
            <View style={[styles.weightSleepModal, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 }}>🌙 Log Sleep</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>How many hours did you sleep last night?</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme === 'dark' ? '#1E293B' : '#F8FAFC', color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. 7.5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={sleepInput}
                onChangeText={setSleepInput}
                autoFocus
              />
              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]} onPress={submitSleepLog}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 🥗 Meal Tracking — Horizontal Cards */}
        {data?.meals_tracker && (
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Meals</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Breakfast', 'Lunch', 'Protein Shake', 'Dinner'].map((meal, idx) => {
                const status = data.meals_tracker[meal];
                const isDone = status === 'Completed';
                const isMissed = status === 'Missed';
                const mealIcons: Record<string, string> = { 'Breakfast': '🥣', 'Lunch': '🍱', 'Protein Shake': '🥤', 'Dinner': '🍽️' };
                const statusColor = isDone ? colors.success : isMissed ? colors.danger : colors.warning;
                const statusBg = isDone ? (theme === 'dark' ? '#064E3B' : '#ECFDF5') : isMissed ? (theme === 'dark' ? '#450A0A' : '#FEF2F2') : (theme === 'dark' ? '#451A03' : '#FEF3C7');

                return (
                  <View key={idx} style={[styles.mealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 24, marginBottom: 6 }}>{mealIcons[meal]}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 4 }}>{meal.length > 10 ? meal.substring(0,8)+'..' : meal}</Text>
                    <View style={[styles.mealStatusBadge, { backgroundColor: statusBg }]}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor, marginRight: 4 }} />
                      <Text style={{ fontSize: 9, fontWeight: '800', color: statusColor, textTransform: 'uppercase' }}>{status}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 🏆 Daily Challenge Section */}
        {data?.daily_challenge && (
          <View style={{ marginBottom: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Challenge</Text>
            <View style={[styles.challengeCard, { backgroundColor: theme === 'dark' ? '#312E81' : '#EEF2FF', borderColor: theme === 'dark' ? '#3730A3' : '#E0E7FF' }]}>
              <View style={styles.challengeHeader}>
                <Ionicons name="flame" size={20} color={colors.primary} />
                <Text style={[styles.challengeTitle, { color: colors.primary }]}>{data.daily_challenge.title}</Text>
              </View>
              <View style={styles.challengeTasks}>
                {data.daily_challenge.tasks.map((task: string, idx: number) => (
                  <View key={idx} style={styles.challengeTaskRow}>
                    <View style={[styles.taskDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.taskText, { color: theme === 'dark' ? '#C7D2FE' : '#3730A3' }]}>{task}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.rewardBadge, { backgroundColor: theme === 'dark' ? '#064E3B' : '#ECFDF5' }]}>
                <Ionicons name="star" size={14} color={colors.success} style={{marginRight: 4}} />
                <Text style={[styles.rewardText, { color: colors.success }]}>Reward: {data.daily_challenge.reward}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 📊 Today's Progress Section */}
        <ProgressSection
          cardFade3={cardFade3}
          cardSlide3={cardSlide3}
          caloriesConsumed={data.calories_consumed}
          caloriesGoal={data.calories_goal}
          proteinConsumed={data.protein_consumed}
          proteinGoal={data.protein_goal}
          waterDrunkLiters={data.water_drunk_liters}
          waterGoalLiters={data.water_goal_liters}
          sleepHoursActual={data.sleep_hours_actual}
          sleepHoursGoal={data.sleep_hours_goal}
        />

        {/* 🌙 Sleep — Compact Inline Metrics */}
        <View style={[styles.sleepInlineCard, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="moon" size={16} color="#6366F1" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginLeft: 8 }}>Sleep</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: data.sleep_quality_score > 70 ? colors.success : colors.warning }}>{data.sleep_quality_score}</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>Quality</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{Number(data.sleep_hours_actual).toFixed(1)}h</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>Duration</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{data.sleep_consistency}%</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>Consistency</Text>
            </View>
          </View>
        </View>

        {/* 💙 Gentle Habit Recovery */}
        {data?.habit_recovery && data.habit_recovery.length > 0 && (
          <View style={{ marginBottom: 24, marginTop: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Gentle Reminders</Text>
            {data.habit_recovery.map((rec: any, idx: number) => (
              <View key={idx} style={[styles.recoveryCard, { backgroundColor: rec.color + '1A', borderColor: rec.color + '33' }]}>
                <View style={[styles.recoveryIconWrap, { backgroundColor: rec.color + '33' }]}>
                  <Ionicons name={rec.icon} size={20} color={rec.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recoveryTitle, { color: rec.color }]}>{rec.type} Recovery</Text>
                  <Text style={[styles.recoveryDesc, { color: theme === 'dark' ? '#E2E8F0' : '#475569' }]}>{rec.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ⏰ Smart Daily Timeline Section */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12 }]}>Smart Daily Timeline</Text>
        
        {data.nextAction && (
          <View style={[styles.nextActionCard, { backgroundColor: theme === 'dark' ? '#1E1B4B' : '#EEF2FF', borderColor: theme === 'dark' ? '#312E81' : '#E0E7FF' }]}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
              <Ionicons name="time" size={16} color={colors.primary} />
              <Text style={{color: colors.primary, fontSize: 13, fontWeight: '800', marginLeft: 6, textTransform: 'uppercase'}}>Next Action</Text>
            </View>
            <Text style={{color: theme === 'dark' ? '#C7D2FE' : '#3730A3', fontSize: 18, fontWeight: '700'}}>
              {data.nextAction.label} <Text style={{fontWeight: '400'}}>{data.nextAction.time_remaining}</Text>
            </Text>
          </View>
        )}

        <View style={[styles.scheduleCard, { backgroundColor: colors.card, paddingVertical: 8 }]}>
          {(data.timelineData || []).map((t: any, idx: number) => (
            <View key={idx} style={[styles.scheduleItem, idx === (data.timelineData || []).length - 1 && { borderBottomWidth: 0 }, { borderBottomColor: colors.border }]}>
              <View style={styles.scheduleLeft}>
                <View style={[styles.scheduleIcon, { backgroundColor: theme === 'dark' ? '#1E293B' : '#F8FAFC' }]}>
                  <MaterialCommunityIcons 
                    name={t.icon as any} 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </View>
                <View>
                  <Text style={[styles.scheduleLabel, { color: colors.text }]}>{t.label}</Text>
                </View>
              </View>
              <Text style={[styles.scheduleTime, { color: colors.textSecondary }]}>{t.time}</Text>
            </View>
          ))}
        </View>

        {/* ✨ AI Insight Section */}
        <AIInsight summaryMsg={data.summary?.summary_msg} />

        {/* 🥩 Protein Recovery Suggestions */}
        {data.protein_consumed < data.protein_goal && (
          <View style={[styles.suggestionSection, { backgroundColor: theme === 'dark' ? '#2E1065' : '#F5F3FF', borderColor: theme === 'dark' ? '#4C1D95' : '#DDD6FE' }]}>
            <View style={styles.suggestionHeader}>
              <MaterialCommunityIcons name="arm-flex" size={20} color={colors.secondary} />
              <Text style={[styles.suggestionTitle, { color: colors.secondary }]}>Protein Boost Needed</Text>
            </View>
            <Text style={[styles.suggestionSub, { color: theme === 'dark' ? '#DDD6FE' : '#6D28D9' }]}>You need {Math.round(data.protein_goal - data.protein_consumed)}g more protein today. Try:</Text>
            
            <View style={styles.suggestionGrid}>
              {[
                { label: 'Add Milk', icon: 'cup' },
                { label: 'Add Paneer', icon: 'cheese' },
                { label: 'Add Peanut Butter', icon: 'nut' },
                { label: 'Protein Shake', icon: 'bottle-tonic' }
              ].map((item, idx) => (
                <TouchableOpacity key={idx} style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={16} color={colors.secondary} />
                  <Text style={[styles.suggestionChipText, { color: colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 🔥 Evening Calorie Boost Suggestions */}
        {new Date().getHours() >= 18 && data.calories_consumed < data.calories_goal * 0.9 && (
          <View style={[styles.suggestionSection, { backgroundColor: theme === 'dark' ? '#431407' : '#FFF7ED', borderColor: theme === 'dark' ? '#7C2D12' : '#FED7AA' }]}>
            <View style={styles.suggestionHeader}>
              <MaterialCommunityIcons name="flash" size={20} color={colors.warning} />
              <Text style={[styles.suggestionTitle, { color: theme === 'dark' ? '#FDBA74' : '#C2410C' }]}>Fuel Up: Low Calories</Text>
            </View>
            <Text style={[styles.suggestionSub, { color: theme === 'dark' ? '#FFEDD5' : '#9A3412' }]}>It's evening and you're under your calorie goal. Grab a quick snack:</Text>
            
            <View style={styles.suggestionGrid}>
              {[
                { label: 'Banana', icon: 'food-apple' },
                { label: 'Milk', icon: 'cup' },
                { label: 'Peanut Butter', icon: 'nut' },
                { label: 'Oats', icon: 'bowl-mix' }
              ].map((item, idx) => (
                <TouchableOpacity key={idx} style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={16} color={colors.warning} />
                  <Text style={[styles.suggestionChipText, { color: colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ➕ Floating Action Button */}
      <Animated.View style={[
        styles.fab, 
        { 
          backgroundColor: colors.primary, 
          shadowColor: colors.primary,
          transform: [{ scale: pulseAnimFAB }]
        }
      ]}>
        <TouchableOpacity 
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }} 
          onPress={() => setQuickActionsVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* 📋 Quick Action Sheet */}
      <Modal
        visible={quickActionsVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setQuickActionsVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setQuickActionsVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Quick Actions</Text>
              <TouchableOpacity onPress={() => setQuickActionsVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionGrid}>
              {[
                { label: 'Log Food', icon: 'food-apple', color: colors.primary, bg: theme === 'dark' ? '#312E81' : '#EEF2FF' },
                { label: 'Add Water', icon: 'water', color: colors.info, bg: theme === 'dark' ? '#0C4A6E' : '#F0F9FF' },
                { label: 'Log Weight', icon: 'scale-bathroom', color: colors.success, bg: theme === 'dark' ? '#064E3B' : '#ECFDF5' },
                { label: 'Upload Label', icon: 'scan', color: colors.warning, bg: theme === 'dark' ? '#451A03' : '#FFFBEB' },
                { label: 'Custom Food', icon: 'plus-circle', color: colors.secondary, bg: theme === 'dark' ? '#2E1065' : '#F5F3FF' }
              ].map((action, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.actionItem} 
                  onPress={() => {
                    setQuickActionsVisible(false);
                    if (action.label === 'Custom Food') setCustomFoodVisible(true);
                  }}
                >
                  <View style={[styles.actionIconCircle, { backgroundColor: action.bg }]}>
                    {action.icon === 'scan' ? (
                      <Ionicons name="scan" size={28} color={action.color} />
                    ) : (
                      <MaterialCommunityIcons name={action.icon as any} size={28} color={action.color} />
                    )}
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.textSecondary }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* 🍲 Custom Food Modal */}
      <Modal
        visible={customFoodVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomFoodVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderRadius: 24, marginBottom: 100, marginHorizontal: 20, backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Custom Food</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} 
              placeholder="Food Name (e.g. Mass Gainer)" 
              placeholderTextColor={colors.textSecondary}
              value={newFoodName} 
              onChangeText={setNewFoodName} 
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TextInput 
                style={[styles.input, { width: '48%', backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} 
                placeholder="Calories" 
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={newFoodCals} 
                onChangeText={setNewFoodCals} 
              />
              <TextInput 
                style={[styles.input, { width: '48%', backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} 
                placeholder="Protein (g)" 
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={newFoodPro} 
                onChangeText={setNewFoodPro} 
              />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAddCustomFood}>
              <Text style={styles.saveBtnText}>Save Food</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setCustomFoodVisible(false)}>
              <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 📊 Score Analysis Modal */}
      <Modal
        visible={scoreDetailsVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setScoreDetailsVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setScoreDetailsVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card, minHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Detailed Analysis</Text>
              <TouchableOpacity onPress={() => setScoreDetailsVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {data?.detailed_analysis?.map((text: string, idx: number) => (
                <View key={idx} style={{flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingRight: 20}}>
                   <Ionicons name={text.includes("goal") || text.includes("excellent") || text.includes("Great") ? "checkmark-circle" : "warning"} size={20} color={text.includes("goal") || text.includes("excellent") || text.includes("Great") ? colors.success : colors.warning} style={{marginRight: 12, marginTop: 2}} />
                   <Text style={{color: colors.text, fontSize: 14, lineHeight: 22}}>{text}</Text>
                </View>
              ))}
              
              <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 16, width: '100%', marginLeft: 0 }]} />
              
              <Text style={{fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8}}>Suggestion:</Text>
              <Text style={{color: colors.textSecondary, fontSize: 14, lineHeight: 22}}>
                 {data?.protein_consumed < data?.protein_goal ? "Add paneer or milk to improve protein intake." : (data?.water_drunk_liters < data?.water_goal_liters ? "Drink 500ml water immediately." : "Keep up the great work maintaining your goals!")}
              </Text>
              <View style={{height: 40}} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 80 },

  // ─── Header & Hero ────────────────────────────────────
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  heroGreeting: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    opacity: 0.7,
  },
  topBar: { marginBottom: 4 },
  appName: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.5 },
  profileAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  summaryMsg: { fontSize: 13, fontWeight: '500', marginTop: 4, marginBottom: 16, opacity: 0.7 },
  profileBtn: { height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },

  // ─── Info Menu ────────────────────────────────────────
  infoMenu: { position: 'absolute', top: 100, right: 16, borderRadius: 16, padding: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, width: 210 },
  infoMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10 },
  infoMenuText: { fontSize: 13, fontWeight: '700', marginLeft: 10 },
  infoMenuDivider: { height: 1, marginHorizontal: 6, opacity: 0.3 },

  // ─── Score Section ────────────────────────────────────
  scoreSection: { borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#6366F1', shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase', opacity: 0.5 },
  scoreCircleBox: { marginVertical: 8 },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginTop: 16 },
  breakdownItem: { width: '30%', marginBottom: 12 },
  breakdownLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', opacity: 0.6 },
  breakdownVal: { fontSize: 11, fontWeight: '800' },
  miniProgressBack: { height: 4, borderRadius: 2, marginTop: 4, overflow: 'hidden', opacity: 0.3 },
  miniProgressFill: { height: '100%', borderRadius: 2 },
  divider: { height: 1, opacity: 0.15 },

  // ─── Quick Actions ────────────────────────────────────
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  quickActionItem: { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  quickActionEmoji: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  quickActionGridItem: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center' },

  // ─── Weekly Strip ─────────────────────────────────────
  weeklyStripCard: { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  weeklyDaysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 8 },
  weeklyDayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  weeklyStripSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 12, marginTop: 10 },
  miniStreakPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  actionText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  // ─── Section Titles ───────────────────────────────────
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },

  // ─── Progress Cards ───────────────────────────────────
  progressCard: { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  progressItem: { marginBottom: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: '700' },
  progressText: { fontSize: 13, fontWeight: '800' },
  progressGoal: { fontWeight: '500', opacity: 0.5 },
  progressBarBack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  // ─── Insight Card ─────────────────────────────────────
  insightCard: { borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  insightTitle: { fontSize: 13, fontWeight: '800', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightText: { fontSize: 14, fontWeight: '500', fontStyle: 'italic', lineHeight: 22, opacity: 0.85 },

  // ─── FAB ──────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },

  // ─── Modals ───────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionItem: { width: '45%', alignItems: 'center', marginBottom: 20 },
  actionIconCircle: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionLabelText: { fontSize: 13, fontWeight: '700' },

  // ─── Suggestions ──────────────────────────────────────
  suggestionSection: { borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  suggestionTitle: { fontSize: 14, fontWeight: '800', marginLeft: 8 },
  suggestionSub: { fontSize: 12, fontWeight: '500', marginBottom: 12, opacity: 0.8 },
  suggestionGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginRight: 8, marginBottom: 8, borderWidth: 1 },
  suggestionChipText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },

  // ─── Schedule/Timeline ────────────────────────────────
  scheduleCard: { borderRadius: 16, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  mealTrackerCard: { borderRadius: 16, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  mealTrackerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, paddingHorizontal: 8 },
  mealTrackerLabel: { fontSize: 14, fontWeight: '700' },
  mealTrackerStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  mealTrackerStatusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  // ─── Challenge ────────────────────────────────────────
  challengeCard: { borderRadius: 16, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  challengeTitle: { fontSize: 15, fontWeight: '800', marginLeft: 8 },
  challengeTasks: { marginBottom: 12, paddingLeft: 4 },
  challengeTaskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  taskDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  taskText: { fontSize: 13, fontWeight: '600' },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  rewardText: { fontSize: 11, fontWeight: '800' },

  scheduleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, paddingHorizontal: 8 },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center' },
  scheduleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  scheduleLabel: { fontSize: 14, fontWeight: '700' },
  scheduleTime: { fontSize: 14, fontWeight: '800', opacity: 0.6 },
  adaptiveBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adaptiveText: { fontSize: 9, fontWeight: '700', marginLeft: 4 },
  nextActionCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },

  // ─── Streak Badges ────────────────────────────────────
  streakRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, minWidth: '45%', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  streakIconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  streakCount: { fontSize: 13, fontWeight: '800' },
  streakLabel: { fontSize: 10, fontWeight: '600' },

  motivationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginTop: 8 },
  motivationText: { fontSize: 11, fontWeight: '700', marginLeft: 6 },

  // ─── Wins ─────────────────────────────────────────────
  winsCard: { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  winItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  winText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  winPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  winPillText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },

  // ─── Meal Cards ───────────────────────────────────────
  mealCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, marginRight: 8, minWidth: 88, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  mealStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },

  // ─── Recovery ─────────────────────────────────────────
  recoveryCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  recoveryIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  recoveryTitle: { fontSize: 12, fontWeight: '800', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  recoveryDesc: { fontSize: 12, fontWeight: '500', lineHeight: 18 },

  // ─── Sleep ────────────────────────────────────────────
  sleepMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sleepCard: { borderRadius: 16, padding: 16, width: '48%', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  sleepMetricLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, opacity: 0.5 },
  sleepMetricValue: { fontSize: 22, fontWeight: '800' },
  sleepMetricSub: { fontSize: 10, fontWeight: '500', marginTop: 2, opacity: 0.6 },
  sleepInlineCard: { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },

  // ─── Inputs ───────────────────────────────────────────
  input: { borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 14, fontWeight: '600', borderWidth: 1 },
  saveBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelLink: { alignItems: 'center', marginTop: 12 },
  cancelLinkText: { fontWeight: '600', fontSize: 13 },

  // ─── Weight/Sleep Modals ──────────────────────────────
  weightSleepModal: { width: '85%', alignSelf: 'center', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, elevation: 12, marginTop: 'auto', marginBottom: 'auto' },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  modalSubmitBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },
});
