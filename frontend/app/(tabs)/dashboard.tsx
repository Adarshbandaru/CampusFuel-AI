import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { offlineGet } from '../utils/offlineSync';

// A simple custom progress bar
const ProgressBar = ({ progress, color = '#3b82f6', height = 10, label = '' }: { progress: number, color?: string, height?: number, label?: string }) => {
  const boundedProgress = Math.max(0, Math.min(100, progress));
  return (
    <View style={styles.progressContainer}>
      {label ? <Text style={styles.progressLabel}>{label} ({boundedProgress}%)</Text> : null}
      <View style={[styles.progressBackground, { height }]}>
        <View style={[styles.progressFill, { width: `${boundedProgress}%`, backgroundColor: color, height }]} />
      </View>
    </View>
  );
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hidden Developer Mode State
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevModal, setShowDevModal] = useState(false);
  const [devInsights, setDevInsights] = useState<any>(null);

  const handleDevTrigger = async () => {
    const newCount = devTapCount + 1;
    if (newCount >= 5) {
      setDevTapCount(0);
      setShowDevModal(true);
      try {
        const res = await offlineGet('http://10.0.2.2:8000/users/user123/developer/insights');
        if (res.data) setDevInsights(res.data);
      } catch (e) {}
    } else {
      setDevTapCount(newCount);
      // Reset count after 2 seconds of inactivity
      setTimeout(() => setDevTapCount(0), 2000);
    }
  };

  // Fetch dashboard + intelligence modules
  const loadDashboard = async () => {
    try {
      const [dashRes, insightsRes, summaryRes] = await Promise.all([
        offlineGet('http://10.0.2.2:8000/users/user123/dashboard', { timeout: 3000 }),
        offlineGet('http://10.0.2.2:8000/users/user123/intelligence/insights'),
        offlineGet('http://10.0.2.2:8000/users/user123/summary/morning'),
      ]);

      if (dashRes.data) setData(dashRes.data);
      if (insightsRes.data) setInsights(insightsRes.data.insights);
      if (summaryRes.data) setSummary(summaryRes.data);
    } catch (e) {
      // Fallback data
      setData({
        water_drunk_liters: 2.5,
        water_goal_liters: 4.0,
        calories_consumed: 1250,
        calories_goal: 2500,
        protein_consumed: 65,
        protein_goal: 150,
        meals_today: 2,
        life_consistency_score: 55,
        score_reason: "Score reduced due to low hydration.",
        score_breakdown: { "Nutrition": 10, "Hydration": 5, "Sleep": 15, "Habits": 10, "Discipline": 15 },
        habit_streak: 12,
        meals_tracker: {
          "Breakfast": true,
          "Lunch": true,
          "Snack": false,
          "Dinner": false,
          "Protein shake": false
        },
        level: 1,
        xp_current: 0,
        xp_target: 100,
        xp_progress_percentage: 0,
        streak_counters: {"Water": 0, "Meal": 0, "Sleep": 0, "Skincare": 0},
        achievements: [],
        prediction_insight: "No prediction data",
        preventive_suggestion: "",
        adaptive_reminders: []
      });
      setSummary({
        greeting: "Good morning",
        day: "Today",
        date: new Date().toLocaleDateString(),
        schedule: [
          { label: "Breakfast", time: "Before 9:30 AM" },
          { label: "Lunch", time: "1:00 PM" },
          { label: "Dinner", time: "8:00 PM" }
        ],
        water_target: "4 L",
        predicted_risks: ["Low hydration risk before noon."],
        habit_focus: ["Start a new habit streak today!"],
      });
      setInsights([
        "You skipped lunch twice this week.",
        "Your water intake is usually low before noon.",
        "You often delay dinner on Thursdays."
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const testTimetableConflict = async () => {
    const { findAvailableTime } = require('../../src/services/NotificationService');
    const Notifications = require('expo-notifications');
    
    const mockTime = new Date();
    mockTime.setHours(10, 30, 0, 0);
    const safeTime = findAvailableTime(mockTime);
    alert(`Tried to schedule at 10:30 AM.\nTimetable Conflict shift generated:\n${safeTime.toLocaleTimeString()}`);
    
    // Quick local notification test
    const testFireTime = new Date(Date.now() + 5000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧪 Test Notification Actions",
        body: "Check if completing/skipping hits the backend log.",
        categoryIdentifier: 'WATER_REMINDER',
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: testFireTime },
    });
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <TouchableOpacity 
        style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 10, marginBottom: 16, alignItems: 'center' }}
        onPress={testTimetableConflict}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>🧪 Run Local Reminder Test</Text>
      </TouchableOpacity>

      {/* 📋 Daily Smart Summary Card */}
      {summary && (
        <View style={styles.summaryCard}>
          {/* Header Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={styles.summaryGreeting}>{summary.greeting} 👋</Text>
              <Text style={styles.summaryDate}>{summary.day} • {summary.date}</Text>
            </View>
            <MaterialCommunityIcons name="calendar-star" size={32} color="#fbbf24" />
          </View>

          {/* Schedule Section */}
          <Text style={styles.summarySection}>TODAY'S SCHEDULE</Text>
          {summary.schedule?.map((s: any, i: number) => (
            <View key={i} style={styles.scheduleRow}>
              <Ionicons name="time-outline" size={16} color="#a5b4fc" />
              <Text style={styles.scheduleLabel}>{s.label}</Text>
              <Text style={styles.scheduleTime}>{s.time}</Text>
            </View>
          ))}

          {/* Water target */}
          <View style={[styles.riskChip, { backgroundColor: 'rgba(59,130,246,0.25)', marginTop: 12 }]}>
            <Ionicons name="water" size={16} color="#60a5fa" />
            <Text style={{ color: '#bfdbfe', fontWeight: '700', marginLeft: 6, fontSize: 13 }}>
              Water Target: {summary.water_target}
            </Text>
          </View>

          {/* Predicted Risks */}
          {summary.predicted_risks?.length > 0 && (
            <>
              <Text style={[styles.summarySection, { marginTop: 14 }]}>PREDICTIONS</Text>
              {summary.predicted_risks.map((r: string, i: number) => (
                <View key={i} style={styles.riskChip}>
                  <Ionicons name="warning-outline" size={15} color="#fbbf24" />
                  <Text style={styles.riskText}>{r}</Text>
                </View>
              ))}
            </>
          )}

          {/* Habit Focus */}
          {summary.habit_focus && (
            <>
              <Text style={[styles.summarySection, { marginTop: 14 }]}>HABIT FOCUS</Text>
              <View style={styles.riskChip}>
                <Ionicons name="flame" size={15} color="#f97316" />
                <Text style={[styles.riskText, { color: '#fed7aa' }]}>{summary.habit_focus}</Text>
              </View>
            </>
          )}

          {/* Habit Recovery Nudges */}
          {summary.habit_recovery?.length > 0 && (
            <>
              <Text style={[styles.summarySection, { marginTop: 14, color: '#34d399' }]}>RECOVERY ACTIONS</Text>
              {summary.habit_recovery.map((r: string, i: number) => (
                <View key={i} style={[styles.riskChip, { backgroundColor: 'rgba(52,211,153,0.15)', borderColor: 'rgba(52,211,153,0.3)', borderWidth: 1 }]}>
                  <Ionicons name="medical-outline" size={16} color="#4ade80" />
                  <Text style={[styles.riskText, { color: '#a7f3d0' }]}>{r}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Life Consistency Score Card */}
      <View style={[styles.card, styles.heroCard]}>

        <View style={styles.heroHeader}>
          <TouchableOpacity activeOpacity={1} onPress={handleDevTrigger}>
            <Text style={styles.heroTitle}>Life Consistency Score</Text>
          </TouchableOpacity>
          <MaterialCommunityIcons name="heart-pulse" size={28} color="#fff" />
        </View>
        <View style={{flexDirection: 'row', alignItems: 'flex-end', marginVertical: 0}}>
           <Text style={styles.scoreText}>{data.life_consistency_score}</Text>
           <Text style={{color: '#fff', fontSize: 24, marginBottom: 20, marginLeft: 2, fontWeight: 'bold'}}>/ 100</Text>
        </View>
        
        {data.score_reason && <Text style={styles.energyReason}>{data.score_reason}</Text>}

        {data.score_breakdown && (
            <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, justifyContent: 'space-between'}}>
               {Object.entries(data.score_breakdown).map(([k,v]) => (
                   <View key={k} style={{width: '30%', marginBottom: 12}}>
                       <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600'}}>{k}</Text>
                       <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold'}}>{v as number} pts</Text>
                   </View>
               ))}
            </View>
        )}
      </View>

      {/* Gamification Module */}
      <View style={[styles.card, { borderColor: '#fcd34d', borderWidth: 2, padding: 16 }]}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <MaterialCommunityIcons name="star-shooting" size={28} color="#f59e0b" />
                <Text style={{fontSize: 20, fontWeight: '800', color: '#1f2937', marginLeft: 8}}>Level {data.level}</Text>
             </View>
             <Text style={{color: '#6b7280', fontWeight: 'bold'}}>{data.xp_current} / {data.xp_target} XP</Text>
          </View>
          
          {/* Custom XP Bar */}
          <View style={{width: '100%', height: 12, backgroundColor: '#fef3c7', borderRadius: 10, overflow: 'hidden', marginBottom: 16}}>
             <View style={{width: `${data.xp_progress_percentage}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: 10}} />
          </View>

          {/* Habit Streaks Badges */}
          <Text style={{fontSize: 14, fontWeight: '700', color: '#4b5563', marginBottom: 8}}>Active Streaks</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16}}>
             {data.streak_counters && Object.entries(data.streak_counters).map(([key, count]) => (
                <View key={key} style={{backgroundColor: (count as number) > 0 ? '#dcfce7' : '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={{marginRight: 4}}>{(count as number) > 0 ? '🔥' : '❄️'}</Text>
                    <Text style={{color: (count as number) > 0 ? '#166534' : '#9ca3af', fontWeight: 'bold'}}>{count as number}d {key}</Text>
                </View>
             ))}
          </View>

          {/* Achievements Scroller */}
          {data.achievements && data.achievements.length > 0 && (
             <>
               <Text style={{fontSize: 14, fontWeight: '700', color: '#4b5563', marginBottom: 8}}>Achievements</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {data.achievements.map((ach: string, i: number) => (
                      <View key={`ach-${i}`} style={{backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 8, flexDirection: 'row', alignItems: 'center'}}>
                          <MaterialCommunityIcons name="trophy-award" size={20} color="#fde047" />
                          <Text style={{color: '#fff', fontWeight: 'bold', marginLeft: 6}}>{ach}</Text>
                      </View>
                  ))}
               </ScrollView>
             </>
          )}
      </View>
      
      {/* Behavioral AI Prediction Engine */}
      {data.prediction_insight && (
          <View style={[styles.card, { borderColor: '#818cf8', borderWidth: 2, padding: 16 }]}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                  <MaterialCommunityIcons name="brain" size={28} color="#6366f1" />
                  <Text style={{fontSize: 20, fontWeight: '800', color: '#312e81', marginLeft: 8}}>Behavioral AI Engine</Text>
              </View>

              {/* Prediction Insight */}
              <View style={{flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12}}>
                  <Ionicons name="analytics-outline" size={20} color="#4f46e5" style={{marginTop: 2}} />
                  <Text style={{fontSize: 15, fontWeight: '600', color: '#4338ca', marginLeft: 8, flex: 1}}>
                      {data.prediction_insight}
                  </Text>
              </View>

              {/* Preventive Action */}
              {data.preventive_suggestion && data.preventive_suggestion !== "" && (
                  <View style={{backgroundColor: '#e0e7ff', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12}}>
                      <Ionicons name="bulb" size={20} color="#f59e0b" />
                      <Text style={{fontSize: 14, fontWeight: '700', color: '#1e3a8a', marginLeft: 8, flex: 1}}>
                          Action: {data.preventive_suggestion}
                      </Text>
                  </View>
              )}

              {/* Adaptive Reminders */}
              {data.adaptive_reminders && data.adaptive_reminders.length > 0 && (
                  <View style={{marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb'}}>
                      <Text style={{fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 8}}>ADAPTIVE REMINDERS ACTIVE</Text>
                      {data.adaptive_reminders.map((rem: string, idx: number) => (
                          <View key={`rem-${idx}`} style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
                              <Ionicons name="notifications-circle" size={18} color="#10b981" />
                              <Text style={{fontSize: 13, color: '#4b5563', marginLeft: 6, flex: 1}}>{rem}</Text>
                          </View>
                      ))}
                  </View>
              )}
          </View>
      )}

      {/* AI Habit Insights */}
      {insights.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>AI Habit Insights</Text>
            <Ionicons name="sparkles" size={24} color="#f59e0b" />
          </View>
          {insights.map((insight, idx) => (
            <View key={idx} style={styles.insightRow}>
              <View style={styles.insightIconWrap}>
                 <Ionicons name="information-outline" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Today's Summary</Text>

      <View style={styles.grid}>
        {/* Habit Streak Card */}
        <View style={styles.cardHalf}>
          <Ionicons name="flame" size={28} color="#f97316" />
          <Text style={styles.cardValue}>{data.habit_streak}</Text>
          <Text style={styles.cardLabel}>Day Streak 🔥</Text>
        </View>

        {/* Small Nutrition Summary */}
        <View style={styles.cardHalf}>
          <Ionicons name="barbell" size={28} color="#8b5cf6" />
          <Text style={styles.cardValue}>{data.protein_consumed}g</Text>
          <Text style={styles.cardLabel}>Protein Consumed</Text>
        </View>
      </View>

      {/* Water Tracker Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Water Intake</Text>
          <Ionicons name="water" size={24} color="#3b82f6" />
        </View>
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>{data.water_drunk_liters} Liters / {data.water_goal_liters} Liters Goal</Text>
        </View>
        <ProgressBar progress={(data.water_drunk_liters / data.water_goal_liters) * 100} color="#3b82f6" height={10} />
      </View>

      {/* Meal Tracker */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Meal Tracker</Text>
          <Ionicons name="restaurant" size={24} color="#f59e0b" />
        </View>
        
        {data.meals_tracker && Object.keys(data.meals_tracker).map((mealName) => (
          <TouchableOpacity 
            key={mealName} 
            style={styles.mealChecklistRow}
            onPress={() => {
              setData({
                ...data,
                meals_tracker: {
                  ...data.meals_tracker,
                  [mealName]: !data.meals_tracker[mealName]
                }
              });
            }}
          >
            <Ionicons 
              name={data.meals_tracker[mealName] ? "checkmark-circle" : "ellipse-outline"} 
              size={26} 
              color={data.meals_tracker[mealName] ? "#10b981" : "#d1d5db"} 
            />
            <Text style={[styles.mealChecklistText, data.meals_tracker[mealName] && styles.mealChecklistTextDone]}>
              {mealName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 30 }} />
      
      {/* Developer Insights Modal */}
      <Modal
        visible={showDevModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDevModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.devContainer}>
            <View style={styles.devHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="terminal" size={20} color="#10b981" />
                <Text style={styles.devTitle}>DEVELOPER CONSOLE</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDevModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.devContent}>
              {!devInsights ? (
                <ActivityIndicator color="#10b981" style={{marginTop: 50}} />
              ) : (
                <>
                  <Text style={styles.devJsonLabel}>// AI Prediction Model Insights</Text>
                  <View style={styles.devJsonBox}>
                    <Text style={styles.devJsonText}>Confidence: {devInsights.ai_confidence_score}%</Text>
                    <Text style={styles.devJsonText}>Engine: {devInsights.model_insights.prediction_engine}</Text>
                    <Text style={styles.devJsonText}>Features: {devInsights.model_insights.active_features.join(', ')}</Text>
                  </View>

                  <Text style={styles.devJsonLabel}>// Habit Analytics Telemetry</Text>
                  <View style={styles.devJsonBox}>
                    <Text style={styles.devJsonText}>Completion Ratio (30d): {devInsights.habit_analytics.completion_ratio_30d}</Text>
                    <Text style={styles.devJsonText}>Trend: {devInsights.habit_analytics.consistency_trend}</Text>
                    <Text style={styles.devJsonText}>Optimal Log Window: {devInsights.habit_analytics.optimal_log_time}</Text>
                  </View>

                  <Text style={styles.devJsonLabel}>// System Architecture Health</Text>
                  <View style={styles.devJsonBox}>
                    <Text style={styles.devJsonText}>DB Latency: {devInsights.system_health.database_latency}</Text>
                    <Text style={styles.devJsonText}>Queue: {devInsights.system_health.sync_queue_status}</Text>
                  </View>
                  
                  <Text style={styles.devJsonLabel}>// RAW JSON PAYLOAD</Text>
                  <View style={[styles.devJsonBox, {backgroundColor: '#000'}]}>
                    <Text style={[styles.devJsonText, {color: '#10b981', fontFamily: 'monospace'}]}>
                      {JSON.stringify(devInsights, null, 2)}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f2f5f9', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroCard: {
    backgroundColor: '#3b82f6',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '600', opacity: 0.9 },
  scoreText: { color: '#fff', fontSize: 42, fontWeight: '800', marginVertical: 10 },
  energyReason: { color: '#ffffff', fontSize: 14, opacity: 0.9, marginTop: -4, fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 12, marginTop: 4 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardHalf: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardValue: { fontSize: 24, fontWeight: '800', color: '#1f2937', marginTop: 8 },
  cardLabel: { fontSize: 13, color: '#6b7280', marginVertical: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  nutritionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  nutritionLabel: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  progressContainer: { width: '100%', marginVertical: 4 },
  progressLabel: { fontSize: 12, marginBottom: 4, color: '#6b7280' },
  progressBackground: { width: '100%', backgroundColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden' },
  progressFill: { borderRadius: 10 },
  mealChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  mealChecklistText: { fontSize: 16, fontWeight: '500', color: '#374151', marginLeft: 12 },
  mealChecklistTextDone: { color: '#9ca3af', textDecorationLine: 'line-through' },
  insightRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  insightIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  insightText: { fontSize: 15, color: '#374151', flex: 1, lineHeight: 22 },

  // Smart Summary Card
  summaryCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryGreeting: { color: '#fff', fontSize: 22, fontWeight: '800' },
  summaryDate: { color: '#a5b4fc', fontSize: 13, marginTop: 2 },
  summarySection: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(165,180,252,0.15)',
  },
  scheduleLabel: { color: '#e0e7ff', fontSize: 14, fontWeight: '600', marginLeft: 8, flex: 1 },
  scheduleTime: { color: '#a5b4fc', fontSize: 13, fontWeight: '500' },
  riskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
  },
  riskText: { color: '#fde68a', fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 },

  // Developer Mode Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  devContainer: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  devHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  devTitle: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 2,
  },
  devContent: {
    flex: 1,
  },
  devJsonLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    fontFamily: 'monospace',
  },
  devJsonBox: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  devJsonText: {
    color: '#e5e7eb',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
});
