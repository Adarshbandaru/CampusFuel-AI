import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Platform, Dimensions, Alert, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { auth } from '../../src/firebaseConfig';
import { useFocusEffect } from '@react-navigation/native';


// Logic & Data Layers
import { scoreEngine, nutritionEngine } from '../../src/services';
import { logStorage, userStorage } from '../../src/storage';

const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';
const INFO = '#0EA5E9';
const { width } = Dimensions.get('window');

// --- Custom Bar Component ---
const BarChart = ({ data, goal, color }: { data: number[], goal: number, color: string }) => {
  const { colors } = useTheme();
  const max = Math.max(...data, goal, 1);
  return (
    <View style={styles.chartContainer}>
      {data.map((val, i) => {
        const height = (val / max) * 100;
        const reached = val >= goal;
        return (
          <View key={i} style={styles.barWrapper}>
            <View style={[styles.barBackground, { backgroundColor: colors.border }]}>
              <View style={[styles.barFill, { height: `${height}%`, backgroundColor: reached ? SUCCESS : color }]} />
            </View>
            <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{['M','T', 'W', 'T', 'F', 'S', 'S'][i]}</Text>
          </View>
        );
      })}
    </View>
  );
};

// --- Stat Card ---
const StatCard = ({ label, value, sub, icon, color }: any) => {
  const { colors, theme } = useTheme();
  return (
    <View style={[styles.statCard, { borderLeftColor: color, backgroundColor: colors.card }]}>
      <View style={[styles.statIconContainer, { backgroundColor: theme === 'dark' ? colors.accent : '#F8FAFC' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statSub, { color: colors.textSecondary }]}>{sub}</Text>
    </View>
  );
};

export default function InsightsScreen() {
  const { colors, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState(false);

  const fetchData = async () => {
    try {
      if (!auth.currentUser) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const today = new Date();
      const last7Days: string[] = [];
      const last30Days: string[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
      }
      
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        last30Days.push(d.toISOString().split('T')[0]);
      }

      const [summaries7, summaries30, goals, streaks, xp] = await Promise.all([
        logStorage.getSummaryForRange(last7Days),
        logStorage.getSummaryForRange(last30Days),
        userStorage.getHealthGoals(),
        userStorage.getStreaks(),
        userStorage.getXP(),
      ]);

      // 1. Weekly Report Trends
      const weeklyScores = summaries7.map(s => {
        const inputs = {
          calories: s?.totalCalories || 0,
          caloriesGoal: goals.caloriesGoal || 2000,
          protein: s?.totalProtein || 0,
          proteinGoal: goals.proteinGoal || 150,
          mealsLogged: s?.mealsCount || 0,
          waterLiters: (s?.totalWaterMl || 0) / 1000,
          waterGoalLiters: goals.waterGoalLiters || 3,
          sleepHours: (s?.sleepMinutes || 0) / 60,
          sleepGoalHours: goals.sleepGoalHours || 8,
          streaks: { water: 0, protein: 0, calories: 0, sleep: 0 }
        };
        return scoreEngine.calculateConsistencyScore(inputs).total;
      });

      const weekly_health_score = Math.round(weeklyScores.reduce((a, b) => a + b, 0) / 7);

      // 2. Heatmap Generation
      const cells = summaries30.map((s, i) => {
        const inputs = {
            calories: s?.totalCalories || 0,
            caloriesGoal: goals.caloriesGoal || 2000,
            protein: s?.totalProtein || 0,
            proteinGoal: goals.proteinGoal || 150,
            mealsLogged: s?.mealsCount || 0,
            waterLiters: (s?.totalWaterMl || 0) / 1000,
            waterGoalLiters: goals.waterGoalLiters || 3,
            sleepHours: (s?.sleepMinutes || 0) / 60,
            sleepGoalHours: goals.sleepGoalHours || 8,
            streaks: { water: 0, protein: 0, calories: 0, sleep: 0 }
        };
        const dayScore = scoreEngine.calculateConsistencyScore(inputs).total;

        let color = 'empty';
        if (dayScore >= 80) color = 'green';
        else if (dayScore >= 40) color = 'yellow';
        else if (dayScore > 0) color = 'red';

        return {
          day: new Date(last30Days[i]).getDate(),
          color,
          is_today: i === 29
        };
      });

      // 3. AI Weekly Insight
      const avgNutri = { 
          calories: Math.round(summaries7.reduce((s, d) => s + (d?.totalCalories || 0), 0) / 7), 
          protein: Math.round(summaries7.reduce((s, d) => s + (d?.totalProtein || 0), 0) / 7),
          carbs: 0, fat: 0 
      };
      const nutriGoals = { calories: goals.caloriesGoal, protein: goals.proteinGoal };
      const suggestion = nutritionEngine.getNutritionSuggestion(avgNutri, nutriGoals);
      const weeklyInsight = `Your weekly average score is ${weekly_health_score}%. ${suggestion.message}`;

      // 4. Today Summary
      const todaySum = summaries7[6];
      const todayInputs = {
        calories: todaySum?.totalCalories || 0,
        caloriesGoal: goals.caloriesGoal || 2000,
        protein: todaySum?.totalProtein || 0,
        proteinGoal: goals.proteinGoal || 150,
        mealsLogged: todaySum?.mealsCount || 0,
        waterLiters: (todaySum?.totalWaterMl || 0) / 1000,
        waterGoalLiters: goals.waterGoalLiters || 3,
        sleepHours: (todaySum?.sleepMinutes || 0) / 60,
        sleepGoalHours: goals.sleepGoalHours || 8,
        streaks: { water: streaks?.water || 0, protein: streaks?.protein || 0, calories: streaks?.calories || 0, sleep: streaks?.sleep || 0 }
      };
      const todayScoreRes = scoreEngine.calculateConsistencyScore(todayInputs);
      
      const reportData = {
        weekly_health_score,
        avg_calories: avgNutri.calories,
        calories_goal: goals.caloriesGoal,
        protein_goal: goals.proteinGoal,
        calories_per_day: summaries7.map(s => s?.totalCalories || 0),
        avg_protein: avgNutri.protein,
        protein_per_day: summaries7.map(s => s?.totalProtein || 0),
        avg_water_liters: Math.round(summaries7.reduce((s, d) => s + ((d?.totalWaterMl || 0) / 1000), 0) / 7 * 10) / 10,
        water_goal_liters: goals.waterGoalLiters,
        water_per_day: summaries7.map(s => (s?.totalWaterMl || 0) / 1000),
        avg_sleep_hours: Math.round(summaries7.reduce((s, d) => s + ((d?.sleepMinutes || 0) / 60), 0) / 7 * 10) / 10,
        sleep_goal_hours: goals.sleepGoalHours,
        sleep_per_day: summaries7.map(s => (s?.sleepMinutes || 0) / 60),
        streak_counters: streaks,
        heatmap: { cells, summary: { perfect_days: cells.filter(c => c.color === 'green').length, partial_days: cells.filter(c => c.color === 'yellow').length, skipped_days: cells.filter(c => c.color === 'red').length, best_streak: Object.values(streaks || {}).reduce((a: any, b: any) => Math.max(a, typeof b === 'number' ? b : 0), 0) } },
        weeklyInsight,
        todaySummary: {
          score: todayScoreRes.total,
          metrics: {
            calories: `${todaySum?.totalCalories || 0} kcal`,
            protein: `${todaySum?.totalProtein || 0}g`,
            water: `${((todaySum?.totalWaterMl || 0) / 1000).toFixed(1)}L`,
            sleep: `${((todaySum?.sleepMinutes || 0) / 60).toFixed(1)}h`
          },
          suggestion: todayScoreRes.analysis[0] || "Keep following your daily routine."
        }
      };

      setReport(reportData);

    } catch (e) {
      console.error("Insights Data Load Error:", e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      setError(false);
      fetchData();
    }, [])
  );

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

  if (loading) return (
    <View style={[styles.loader, { backgroundColor: colors.pageBg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  if (error || !report) return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <View style={{ backgroundColor: colors.headerBg }}>
        <View style={[styles.appBar, { backgroundColor: colors.headerBg, shadowColor: colors.shadow }]}>
          <Text style={[styles.appBarTitle, { color: colors.text }]}>Insights</Text>
        </View>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, margin: 16, alignItems: 'center' }}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 }}>Could not load data</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>Make sure the backend server is running at port 8000, then tap retry.</Text>
          <TouchableOpacity style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, marginTop: 16 }} onPress={() => { setError(false); setLoading(true); fetchData(); }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Layer 1 — App Bar (Sticky) */}
      <View style={{ backgroundColor: colors.headerBg }}>
        <View style={[styles.appBar, { backgroundColor: colors.headerBg, shadowColor: colors.shadow }]}>
          <Text style={[styles.appBarTitle, { color: colors.text }]}>Insights</Text>
        </View>
      </View>

      {/* Layer 2 — Hero Score Section */}
      <View style={[styles.heroCard, { backgroundColor: colors.primary, marginHorizontal: 20, marginTop: 20 }]}>
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroLabel}>Weekly Consistency</Text>
          <Text style={styles.heroValue}>{report.weekly_health_score}%</Text>
          <Text style={styles.heroSub}>You're doing better than last week!</Text>
        </View>
        <View style={styles.heroIconCircle}>
          <Ionicons name="trending-up" size={32} color="#fff" />
        </View>
      </View>

      {/* Layer 3 — Scrollable Content */}
      <ScrollView 
        style={[styles.scrollContainer, { backgroundColor: colors.pageBg }]} 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 🔮 Daily AI Health Summary */}
        {report.todaySummary && (
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: theme === 'dark' ? colors.border : '#EEF2FF' }]}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Today Summary</Text>
                <Text style={[styles.summaryDate, { color: colors.textSecondary }]}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.scoreText}>{report.todaySummary.score}</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: colors.text }]}>{report.todaySummary.metrics.calories}</Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Calories</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: colors.text }]}>{report.todaySummary.metrics.protein}</Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Protein</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: colors.text }]}>{report.todaySummary.metrics.water}</Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Water</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: colors.text }]}>{report.todaySummary.metrics.sleep}</Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Sleep</Text>
              </View>
            </View>

            <View style={[styles.suggestionBox, { backgroundColor: colors.cardHighlight }]}>
              <Ionicons name="bulb" size={18} color={colors.primary} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>{report.todaySummary.suggestion}</Text>
            </View>
          </View>
        )}

        {/* 🧠 AI Weekly Coach Insight */}
        {report.weeklyInsight ? (
          <View style={[styles.insightCard, { backgroundColor: theme === 'dark' ? '#1E1B4B' : '#EEF2FF', borderColor: theme === 'dark' ? '#312E81' : '#E0E7FF' }]}>
            <View style={styles.insightHeader}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={[styles.insightTitle, { color: colors.primary }]}>AI Weekly Coach Insight</Text>
            </View>
            <Text style={[styles.insightText, { color: theme === 'dark' ? '#C7D2FE' : '#3730A3' }]}>{report.weeklyInsight}</Text>
          </View>
        ) : null}

        {/* 📊 Overview Tiles */}
        <View style={styles.tilesGrid}>
          <StatCard label="Avg Calories" value={report.avg_calories} sub={`Goal: ${report.calories_goal}`} icon="fire" color={WARNING} />
          <StatCard label="Avg Protein" value={`${report.avg_protein}g`} sub={`Goal: ${report.protein_goal}g`} icon="arm-flex" color="#8B5CF6" />
          <StatCard label="Hydration" value={`${report.avg_water_liters}L`} sub={`Goal: ${report.water_goal_liters}L`} icon="water" color={INFO} />
          <StatCard label="Sleep" value={`${report.avg_sleep_hours}h`} sub={`Goal: ${report.sleep_goal_hours}h`} icon="moon-waning-crescent" color={SUCCESS} />
        </View>

        {/* 📅 Grid of Greatness (Heatmap) */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Habit Heatmap</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Consistency over last 30 days.</Text>
          
          <View style={styles.heatmapGrid}>
            {report.heatmap?.cells.map((cell: any, i: number) => (
              <View 
                key={i} 
                style={[
                  styles.heatmapCell, 
                  { backgroundColor: cell.color === 'green' ? SUCCESS : cell.color === 'yellow' ? WARNING : cell.color === 'red' ? '#EF4444' : (theme === 'dark' ? '#1E293B' : '#E2E8F0') },
                  cell.is_today && [styles.todayCell, { borderColor: colors.primary }]
                ]} 
              />
            ))}
          </View>

          <View style={styles.heatmapLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: SUCCESS }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Ideal</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: WARNING }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Partial</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Skipped</Text></View>
          </View>
        </View>

        {/* Nutrition Trends */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition Trends</Text>
          
          <Text style={[styles.chartSubTitle, { color: colors.textSecondary }]}>Weekly Calories</Text>
          {report.calories_per_day && report.calories_per_day.some((v: number) => v > 0) ? (
            <BarChart data={report.calories_per_day} goal={report.calories_goal} color={WARNING} />
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chart-bar" size={32} color={colors.border} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No nutrition data yet.</Text>
              <Text style={[styles.emptyStateHint, { color: colors.textSecondary }]}>Log your first meal to start tracking.</Text>
            </View>
          )}
          
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 20 }]} />
          
          <Text style={[styles.chartSubTitle, { color: colors.textSecondary }]}>Weekly Protein (g)</Text>
          {report.protein_per_day && report.protein_per_day.some((v: number) => v > 0) ? (
            <BarChart data={report.protein_per_day} goal={report.protein_goal} color="#8B5CF6" />
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chart-bar" size={32} color={colors.border} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No protein data yet.</Text>
            </View>
          )}
        </View>

        {/* 🔥 Streaks */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Streaks</Text>
          <View style={styles.streakGrid}>
            {Object.entries(report.streak_counters || {}).map(([name, val]: any) => (
              <View key={name} style={styles.streakItem}>
                <Text style={styles.streakEmoji}>{val > 0 ? '🔥' : '❄️'}</Text>
                <View>
                  <Text style={[styles.streakName, { color: colors.textSecondary }]}>{name}</Text>
                  <Text style={[styles.streakVal, { color: colors.text }]}>{val} Days</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  appBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  
  insightCard: { borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  insightTitle: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  insightText: { fontSize: 15, fontWeight: '500', lineHeight: 24 },
  heroTextContainer: { flex: 1 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: '#fff', fontSize: 36, fontWeight: '800', marginVertical: 4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  heroIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { width: '48%', borderRadius: 20, padding: 16, marginBottom: 16, borderLeftWidth: 4, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  statIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontWeight: '800', marginVertical: 4 },
  statSub: { fontSize: 11, fontWeight: '500' },

  sectionCard: { borderRadius: 24, padding: 20, marginBottom: 20, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sectionDesc: { fontSize: 13, marginBottom: 20 },

  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  heatmapCell: { width: 20, height: 20, borderRadius: 4 },
  todayCell: { borderWidth: 2 },
  heatmapLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },

  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, marginTop: 16, paddingHorizontal: 10, paddingTop: 8 },
  barWrapper: { alignItems: 'center', flex: 1 },
  barBackground: { width: 14, height: 100, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 7 },
  barLabel: { fontSize: 10, fontWeight: '700', marginTop: 6 },
  chartSubTitle: { fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 0, textTransform: 'uppercase', letterSpacing: 0.5 },
  chartBarSub: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  divider: { height: 1, marginVertical: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyStateText: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyStateHint: { fontSize: 13, fontWeight: '500', marginTop: 4, opacity: 0.7 },

  streakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  streakItem: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '45%' },
  streakEmoji: { fontSize: 24 },
  streakName: { fontSize: 12, fontWeight: '600' },
  streakVal: { fontSize: 16, fontWeight: '800' },

  summaryCard: { borderRadius: 24, padding: 24, marginBottom: 24, shadowOpacity: 0.1, shadowRadius: 15, elevation: 4, borderWidth: 1 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  summaryTitle: { fontSize: 20, fontWeight: '800' },
  summaryDate: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  scoreBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scoreText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  metricItem: { alignItems: 'center' },
  metricVal: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  suggestionBox: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16 },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: '600', marginLeft: 10 },
});
