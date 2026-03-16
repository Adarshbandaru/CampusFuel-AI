// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { logStorage, userStorage } from '../../src/storage';
import { coachEngine, healthEngine, scoreEngine, nutritionEngine, timelineEngine } from '../../src/services';
import axios from 'axios';
import Config from '../../src/constants/Config';
import { auth } from '../../src/firebaseConfig';


interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const INITIAL_PROMPTS = [
  "How's my consistency today?",
  "Analyze my sleep trends",
  "Protein-rich snack ideas",
  "Am I drinking enough water?"
];

export default function AICoachScreen() {
  const { colors, theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [dashData, setDashData] = useState<any>(null);
  const [contextError, setContextError] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Fetch today's data to give context to the coach
  const loadCtx = async () => {
    try {
      const today = new Date();
      const [logs, goals, profile, timetable] = await Promise.all([
        logStorage.getDailyLog(today),
        userStorage.getHealthGoals(),
        userStorage.getUserProfile(),
        userStorage.getTimetable()
      ]);

      if (logs && goals) {
        const scoreResult = scoreEngine.calculateConsistencyScore({
          calories: logs.totalCalories,
          caloriesGoal: goals.caloriesGoal,
          protein: logs.totalProtein,
          proteinGoal: goals.proteinGoal,
          mealsLogged: logs.mealsCount,
          waterLiters: logs.totalWaterMl / 1000,
          waterGoalLiters: goals.waterGoalLiters,
          sleepHours: logs.sleepMinutes / 60,
          sleepGoalHours: goals.sleepGoalHours,
          streaks: { water: 0, protein: 0, calories: 0, sleep: 0 } // Mocked
        });
        const sleepMetrics = healthEngine.getSleepMetrics(logs.sleepMinutes, goals.sleepGoalHours);
        
    setDashData({
          calories_consumed: logs.totalCalories,
          calories_goal: goals.caloriesGoal,
          protein_consumed: logs.totalProtein,
          protein_goal: goals.proteinGoal,
          water_drunk_liters: logs.totalWaterMl / 1000,
          water_goal_liters: goals.waterGoalLiters,
          life_consistency_score: scoreResult.total,
          sleep_hours: logs.sleepMinutes / 60,
          sleep_goal: goals.sleepGoalHours,
          sleep_quality: sleepMetrics.qualityScore,
          timetable: timetable || []
        });
      }
    } catch (e) {
      console.error("Coach Context Error:", e);
      setContextError(true);
    }
  };

  useEffect(() => {
    loadCtx();

    // Initial greeting
    setMessages([{
      id: '1',
      role: 'ai',
      text: "👋 Hi! I'm your AI Coach. I've analyzed your cloud health data and campus schedule.\n\nAsk me about your consistency, hydration, or protein goals!",
      timestamp: new Date()
    }]);

  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const emptyGoals = { waterGoalLiters: 4, caloriesGoal: 2000, proteinGoal: 100, sleepGoalHours: 8 };
      const currentDashData = dashData || {
        calories_consumed: 0,
        calories_goal: emptyGoals.caloriesGoal,
        protein_consumed: 0,
        protein_goal: emptyGoals.proteinGoal,
        water_drunk_liters: 0,
        water_goal_liters: emptyGoals.waterGoalLiters,
        life_consistency_score: 0,
        sleep_hours: 0,
        sleep_goal: emptyGoals.sleepGoalHours,
        sleep_quality: 0,
        timetable: []
      };

      let systemContext = "";
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes("today") ||
        lowerText.includes("routine") ||
        lowerText.includes("plan") ||
        lowerText.includes("schedule") ||
        lowerText.includes("what should i")
      ) {
        if (auth.currentUser?.uid) {
          try {
            const res = await axios.get(`${Config.API_BASE_URL}/api/v1/users/${auth.currentUser.uid}/routine-plan`);
            if (res.data && res.data.status !== "error") {
              const plan = res.data;
              systemContext = `Here's your plan for today:\n☀️ ${plan.morning_tip}\n💧 ${plan.hydration_tip}\n🏋️ ${plan.workout_window}\n🌙 ${plan.sleep_tip}\n\n`;
            }
          } catch (err) {
            console.warn("Failed to fetch routine plan for coach:", err);
          }
        }
      }

      const reply = coachEngine.generateDailyInsight({
        nutrition: { 
          calories: currentDashData.calories_consumed, 
          protein: currentDashData.protein_consumed, 
          goalCalories: currentDashData.calories_goal, 
          goalProtein: currentDashData.protein_goal 
        },
        hydration: { 
          liters: currentDashData.water_drunk_liters, 
          goalLiters: currentDashData.water_goal_liters 
        },
        sleep: { 
          hours: currentDashData.sleep_hours, 
          goalHours: currentDashData.sleep_goal, 
          qualityScore: currentDashData.sleep_quality 
        },
        score: { 
          total: currentDashData.life_consistency_score, 
          nutrition: 0, sleep: 0, habits: 0, discipline: 0, hydration: 0, 
          percentages: { nutrition: 0, hydration: 0, sleep: 0, habits: 0, discipline: 0 },
          analysis: []
        },
        timetable: currentDashData.timetable,
        userQuery: systemContext + text 
      });

      await new Promise(r => setTimeout(r, 1200));

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: reply,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: "I'm having trouble connecting to your cloud brain right now. Please try again!",
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const cardBg = colors.card;
  const border = colors.border;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Layer 1 — App Bar (Sticky) */}
      <View style={{ backgroundColor: colors.headerBg }}>
        <View style={[styles.appBar, { backgroundColor: colors.headerBg, shadowColor: colors.shadow }]}>
          <Text style={[styles.appBarTitle, { color: colors.text }]}>Coach</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={[styles.chatArea, { backgroundColor: colors.pageBg }]}
          contentContainerStyle={[styles.chatContent, Platform.OS === 'web' && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Quick Stats Header */}
          {dashData && (
            <View style={[styles.floatingBanner, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]}>
               <View style={styles.bannerHeader}>
                  <MaterialCommunityIcons name="lightning-bolt" size={16} color={colors.primary} />
                  <Text style={[styles.bannerTitle, { color: colors.primary }]}>DAILY SNAPSHOT</Text>
               </View>
               <View style={styles.bannerRow}>
                  <View style={styles.bannerItem}>
                    <Text style={[styles.bannerVal, { color: colors.text }]}>{dashData.calories_consumed}</Text>
                    <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>Kcal</Text>
                  </View>
                  <View style={styles.bannerDivider} />
                  <View style={styles.bannerItem}>
                    <Text style={[styles.bannerVal, { color: colors.text }]}>{dashData.protein_consumed}g</Text>
                    <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>Protein</Text>
                  </View>
                  <View style={styles.bannerDivider} />
                  <View style={styles.bannerItem}>
                    <Text style={[styles.bannerVal, { color: colors.text }]}>{dashData.water_drunk_liters?.toFixed(1)}L</Text>
                    <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>Water</Text>
                  </View>
                  <View style={styles.bannerDivider} />
                  <View style={styles.bannerItem}>
                    <Text style={[styles.bannerScore, { color: colors.success }]}>{dashData.life_consistency_score}</Text>
                    <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>Score</Text>
                  </View>
               </View>
            </View>
          )}

          {/* Context error card */}
          {contextError && (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, margin: 4, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 8 }}>Could not load data</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>Make sure the backend server is running at port 8000, then tap retry.</Text>
              <TouchableOpacity style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 20, marginTop: 12 }} onPress={() => { setContextError(false); loadCtx(); }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {messages.map((m) => (
            <View key={m.id} style={[styles.messageRow, m.role === 'user' ? styles.userRow : styles.aiRow]}>
              {m.role === 'ai' && (
                <View style={[styles.aiAvatar, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                   <MaterialCommunityIcons name="robot" size={20} color="#fff" />
                </View>
              )}
              <View style={[
                styles.bubble,
                m.role === 'user'
                  ? [styles.userBubble, { backgroundColor: colors.primary, shadowColor: colors.primary }]
                  : [styles.aiBubble, { backgroundColor: colors.card, borderColor: border }]
              ]}>
                <Text style={[styles.messageText, { color: m.role === 'user' ? '#fff' : colors.text }]}>
                  {m.text}
                </Text>
                <Text style={[styles.timestamp, { color: m.role === 'user' ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}

          {isTyping && (
            <View style={styles.aiRow}>
              <View style={[styles.aiAvatar, { backgroundColor: colors.primary }]}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
              <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: border, paddingVertical: 15 }]}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={[styles.aiText, { color: colors.textSecondary, marginRight: 8 }]}>Analyzing cloud data</Text>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Prompts */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptScroll}>
            {INITIAL_PROMPTS.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.promptChip, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]}
                onPress={() => handleSend(p)}
              >
                <Text style={[styles.promptText, { color: colors.primary }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={[styles.inputWrapper, { backgroundColor: 'transparent' }]}>
          <View style={[styles.inputInner, { backgroundColor: colors.card, borderColor: border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Ask anything..."
              placeholderTextColor={colors.textSecondary}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, (!input.trim() || isTyping) && { opacity: 0.4 }]}
              onPress={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
    zIndex: 100,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  floatingBanner: { 
    marginHorizontal: 4, 
    marginTop: 0, 
    marginBottom: 24, 
    borderRadius: 20, 
    padding: 16, 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  bannerTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerItem: { alignItems: 'center', flex: 1 },
  bannerVal: { fontSize: 18, fontWeight: '800' },
  bannerScore: { fontSize: 18, fontWeight: '900' },
  bannerLabel: { fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  bannerDivider: { width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.05)' },

  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 20 },

  messageRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },

  aiAvatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10, elevation: 4, shadowOpacity: 0.2, shadowRadius: 5 },

  bubble: { maxWidth: Platform.OS === 'web' ? '75%' : '85%', padding: 14, borderRadius: 22 },
  userBubble: { borderBottomRightRadius: 4, elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  aiBubble: { borderBottomLeftRadius: 4, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },

  messageText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  aiText: { fontStyle: 'italic', fontSize: 14 },
  timestamp: { fontSize: 9, marginTop: 6, alignSelf: 'flex-end', opacity: 0.4 },

  promptScroll: { paddingHorizontal: 16, paddingVertical: 8 },
  promptChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25, marginRight: 10, borderWidth: 1, height: 42, justifyContent: 'center' },
  promptText: { fontSize: 13, fontWeight: '700' },

  inputWrapper: { paddingHorizontal: 16, paddingVertical: 16 },
  inputInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 30, 
    paddingHorizontal: 18, 
    paddingVertical: 6, 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  input: { flex: 1, maxHeight: 120, fontSize: 16, paddingRight: 12, paddingVertical: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
