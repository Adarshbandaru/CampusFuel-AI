import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Share, Animated, RefreshControl
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { offlineGet } from '../utils/offlineSync';

const API = 'http://10.0.2.2:8000';
const UID = 'user123';

// ─── Mini inline bar chart ───────────────────────────────────────────────────
const BAR_MAX_HEIGHT = 60;

function MiniBarChart({
  values, labels, color, goal,
}: { values: number[]; labels: string[]; color: string; goal?: number }) {
  const max = Math.max(...values, goal ?? 0, 1);
  return (
    <View style={chartStyles.wrap}>
      {values.map((v, i) => {
        const h = Math.round((v / max) * BAR_MAX_HEIGHT);
        const hitGoal = goal !== undefined && v >= goal;
        return (
          <View key={i} style={chartStyles.colWrap}>
            <View style={chartStyles.barBg}>
              <View style={[chartStyles.bar, { height: h, backgroundColor: hitGoal ? '#10b981' : color }]} />
            </View>
            <Text style={chartStyles.barLabel}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 },
  colWrap: { alignItems: 'center', flex: 1 },
  barBg: { width: 22, height: BAR_MAX_HEIGHT, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 6, overflow: 'hidden' },
  bar: { borderRadius: 6, width: '100%' },
  barLabel: { fontSize: 9, color: '#9ca3af', marginTop: 4, fontWeight: '600' },
});

// ─── Metric stat tile ────────────────────────────────────────────────────────
function StatTile({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <View style={[tileStyles.tile, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      <Text style={tileStyles.label}>{label}</Text>
      <Text style={tileStyles.value}>{value}</Text>
      <Text style={tileStyles.sub}>{sub}</Text>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: { backgroundColor: '#fff', borderRadius: 14, padding: 14, width: '48%', marginBottom: 12, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 },
  label: { fontSize: 11, color: '#6b7280', fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },
  value: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 2 },
  sub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreDisplay({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <View style={scoreStyles.wrap}>
      <View style={[scoreStyles.ring, { borderColor: color }]}>
        <Text style={[scoreStyles.num, { color }]}>{score}</Text>
        <Text style={scoreStyles.denom}>/100</Text>
      </View>
      <Text style={[scoreStyles.label, { color }]}>
        {score >= 70 ? '🌟 Excellent Week!' : score >= 45 ? '👍 Good Week' : '💪 Room to Improve'}
      </Text>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 16 },
  ring: { width: 110, height: 110, borderRadius: 55, borderWidth: 8, justifyContent: 'center', alignItems: 'center' },
  num: { fontSize: 34, fontWeight: '900' },
  denom: { fontSize: 13, color: '#9ca3af', marginTop: -4, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '700', marginTop: 12 },
});

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon, iconColor, children }: any) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
        <Text style={cardStyles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800', color: '#1f2937', marginLeft: 8 },
});

// ─── Habit Heatmap Grid ───────────────────────────────────────────────────────
const CELL_SIZE = 34;
const COLOR_MAP: Record<string, string> = {
  green:  '#16a34a',
  yellow: '#eab308',
  red:    '#ef4444',
  empty:  '#e5e7eb',
};

function HeatmapGrid({ cells }: { cells: any[] }) {
  // Split 30 cells into rows of 7 (≈ 4.3 weeks)
  const rows: any[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View>
      {/* Day-of-week header */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <Text key={d} style={hmStyles.dayHeader}>{d}</Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
          {row.map((cell: any, ci: number) => (
            <View
              key={ci}
              style={[
                hmStyles.cell,
                { backgroundColor: COLOR_MAP[cell.color] ?? COLOR_MAP.empty },
                cell.is_today && hmStyles.todayCell,
              ]}
            >
              <Text style={hmStyles.cellDay}>{cell.day}</Text>
              {cell.score > 0 && (
                <Text style={hmStyles.cellScore}>{cell.score}</Text>
              )}
            </View>
          ))}
        </View>
      ))}

      {/* Legend */}
      <View style={hmStyles.legend}>
        {[['#16a34a','Perfect'],['#eab308','Partial'],['#ef4444','Skipped']].map(([c,l]) => (
          <View key={l} style={hmStyles.legendItem}>
            <View style={[hmStyles.legendDot, { backgroundColor: c }]} />
            <Text style={hmStyles.legendLabel}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const hmStyles = StyleSheet.create({
  dayHeader: { width: CELL_SIZE, fontSize: 9, fontWeight: '700', color: '#9ca3af', textAlign: 'center' },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: 6, marginRight: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  todayCell: { borderWidth: 2, borderColor: '#6366f1' },
  cellDay: { fontSize: 9, fontWeight: '700', color: '#fff', opacity: 0.9 },
  cellScore: { fontSize: 8, color: '#fff', opacity: 0.7 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
});

export default function ReportScreen() {
  const [report, setReport] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadReport = async () => {
    try {
      const [rRes, hRes] = await Promise.all([
        offlineGet(`${API}/users/${UID}/report/weekly`),
        offlineGet(`${API}/users/${UID}/habits/heatmap`),
      ]);
      setReport(rRes.data);
      setHeatmap(hRes.data);
    } catch {
      // Fallback demo data
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      setReport({
        week_start: '2026-03-09', week_end: '2026-03-15',
        day_labels: labels,
        weekly_health_score: 63,
        habit_consistency_pct: 71,
        avg_calories: 1850, calories_goal: 2500,
        calories_per_day: [2100, 1600, 2200, 1500, 1900, 2000, 1600],
        avg_protein: 82, protein_goal: 150,
        protein_per_day: [95, 70, 110, 60, 80, 90, 70],
        nutrition_insight: 'You averaged 1850 kcal/day against your 2500 kcal goal.',
        avg_water_liters: 2.8, water_goal_liters: 4.0,
        water_per_day: [3.2, 2.5, 4.1, 2.0, 3.0, 3.5, 1.8],
        hydration_days_hit: 2,
        hydration_insight: 'You hit your water goal on 2/7 days. Try setting morning water reminders!',
        avg_sleep_hours: 6.4, sleep_goal_hours: 8,
        sleep_per_day: [7.5, 5.0, 7.0, 6.0, 8.0, 5.5, 6.0],
        sleep_days_hit: 1,
        sleep_insight: 'You achieved your sleep goal on 1/7 nights. Prioritize an earlier bedtime.',
        streak_counters: { Water: 6, Meal: 5, Sleep: 2, Skincare: 1 },
      });
      // Heatmap fallback: generate 30 demo cells
      const today = new Date();
      const demoCells = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (29 - i));
        const colors = ['green','green','yellow','red','green','yellow','green'];
        return {
          date: d.toISOString().split('T')[0],
          day: String(d.getDate()).padStart(2,'0'),
          weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
          score: [100,80,55,20,90,65,75][i % 7],
          color: colors[i % 7],
          is_today: i === 29,
        };
      });
      setHeatmap({ cells: demoCells, summary: { perfect_days: 14, partial_days: 10, skipped_days: 6, best_streak: 6 } });
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  };

  useEffect(() => { loadReport(); }, []);

  const handleShare = async () => {
    if (!report) return;
    const text = [
      `📊 CampusFuel AI — Weekly Health Report`,
      `📅 ${report.week_start} → ${report.week_end}`,
      ``,
      `🏆 Weekly Health Score: ${report.weekly_health_score}/100`,
      `🎯 Habit Consistency: ${report.habit_consistency_pct}%`,
      ``,
      `🍽️ Nutrition`,
      `  Avg Calories: ${report.avg_calories} / ${report.calories_goal} kcal`,
      `  Avg Protein:  ${report.avg_protein} / ${report.protein_goal} g`,
      `  ${report.nutrition_insight}`,
      ``,
      `💧 Hydration`,
      `  Avg Water: ${report.avg_water_liters}L / ${report.water_goal_liters}L`,
      `  Goal Hit: ${report.hydration_days_hit}/7 days`,
      `  ${report.hydration_insight}`,
      ``,
      `😴 Sleep`,
      `  Avg Sleep: ${report.avg_sleep_hours}h / ${report.sleep_goal_hours}h`,
      `  Goal Hit: ${report.sleep_days_hit}/7 nights`,
      `  ${report.sleep_insight}`,
      ``,
      `🔥 Habit Streaks`,
      ...Object.entries(report.streak_counters).map(([k, v]) => `  ${k}: ${v} days`),
      ``,
      `Generated by CampusFuel AI`,
    ].join('\n');

    await Share.share({ message: text, title: 'Weekly Health Report' });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6ff' }}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ color: '#6366f1', marginTop: 12, fontWeight: '600' }}>Generating your report...</Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: '#f4f6ff' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReport(); }} />}
    >
      {/* Header */}
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.headerTitle}>Weekly Health Report</Text>
          <Text style={styles.headerDates}>{report.week_start} — {report.week_end}</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Health Score */}
      <SectionCard title="Weekly Health Score" icon="shield-star" iconColor="#6366f1">
        <ScoreDisplay score={report.weekly_health_score} />
        <View style={styles.consistencyBar}>
          <Text style={styles.consistencyLabel}>Habit Consistency</Text>
          <Text style={styles.consistencyPct}>{report.habit_consistency_pct}%</Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFg, { width: `${report.habit_consistency_pct}%` }]} />
        </View>
      </SectionCard>

      {/* Stat Tiles */}
      <View style={styles.tilesRow}>
        <StatTile icon="fire" label="AVG CALORIES" value={`${report.avg_calories}`} sub={`Goal: ${report.calories_goal} kcal`} color="#f97316" />
        <StatTile icon="arm-flex" label="AVG PROTEIN" value={`${report.avg_protein}g`} sub={`Goal: ${report.protein_goal}g`} color="#8b5cf6" />
        <StatTile icon="water" label="AVG WATER" value={`${report.avg_water_liters}L`} sub={`Goal: ${report.water_goal_liters}L`} color="#3b82f6" />
        <StatTile icon="sleep" label="AVG SLEEP" value={`${report.avg_sleep_hours}h`} sub={`Goal: ${report.sleep_goal_hours}h`} color="#10b981" />
      </View>

      {/* Nutrition Section */}
      <SectionCard title="Nutrition Summary" icon="food-apple" iconColor="#f97316">
        <Text style={styles.insightText}>{report.nutrition_insight}</Text>
        <Text style={styles.chartTitle}>Calories / Day</Text>
        <MiniBarChart values={report.calories_per_day} labels={report.day_labels} color="#fb923c" goal={report.calories_goal} />
        <Text style={[styles.chartTitle, { marginTop: 16 }]}>Protein / Day (g)</Text>
        <MiniBarChart values={report.protein_per_day} labels={report.day_labels} color="#a78bfa" goal={report.protein_goal} />
      </SectionCard>

      {/* Hydration Section */}
      <SectionCard title="Hydration Summary" icon="cup-water" iconColor="#3b82f6">
        <View style={styles.hitBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={styles.hitText}>Goal hit {report.hydration_days_hit}/7 days</Text>
        </View>
        <Text style={styles.insightText}>{report.hydration_insight}</Text>
        <Text style={styles.chartTitle}>Water Intake / Day (L)</Text>
        <MiniBarChart values={report.water_per_day} labels={report.day_labels} color="#60a5fa" goal={report.water_goal_liters} />
      </SectionCard>

      {/* Sleep Section */}
      <SectionCard title="Sleep Summary" icon="moon-waning-crescent" iconColor="#8b5cf6">
        <View style={styles.hitBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={styles.hitText}>Goal hit {report.sleep_days_hit}/7 nights</Text>
        </View>
        <Text style={styles.insightText}>{report.sleep_insight}</Text>
        <Text style={styles.chartTitle}>Sleep Duration / Day (h)</Text>
        <MiniBarChart values={report.sleep_per_day} labels={report.day_labels} color="#818cf8" goal={report.sleep_goal_hours} />
      </SectionCard>

      {/* Habit Consistency */}
      <SectionCard title="Habit Consistency" icon="check-all" iconColor="#10b981">
        {Object.entries(report.streak_counters).map(([key, count]) => (
          <View key={key} style={styles.streakRow}>
            <Text style={styles.streakIcon}>{(count as number) > 0 ? '🔥' : '❄️'}</Text>
            <Text style={styles.streakName}>{key} Streak</Text>
            <Text style={styles.streakCount}>{count as number} days</Text>
          </View>
        ))}
      </SectionCard>

      {/* Habit Heatmap */}
      {heatmap && (
        <SectionCard title="Habit Heatmap" icon="calendar-month" iconColor="#6366f1">
          <Text style={styles.insightText}>Daily habit completion for the last 30 days.</Text>

          {/* Summary badges */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 }}>
            <View style={styles.hmBadge}>
              <Text style={[styles.hmBadgeNum, { color: '#16a34a' }]}>{heatmap.summary.perfect_days}</Text>
              <Text style={styles.hmBadgeLabel}>Perfect</Text>
            </View>
            <View style={styles.hmBadge}>
              <Text style={[styles.hmBadgeNum, { color: '#eab308' }]}>{heatmap.summary.partial_days}</Text>
              <Text style={styles.hmBadgeLabel}>Partial</Text>
            </View>
            <View style={styles.hmBadge}>
              <Text style={[styles.hmBadgeNum, { color: '#ef4444' }]}>{heatmap.summary.skipped_days}</Text>
              <Text style={styles.hmBadgeLabel}>Skipped</Text>
            </View>
            <View style={styles.hmBadge}>
              <Text style={[styles.hmBadgeNum, { color: '#6366f1' }]}>{heatmap.summary.best_streak}🔥</Text>
              <Text style={styles.hmBadgeLabel}>Best Streak</Text>
            </View>
          </View>

          <HeatmapGrid cells={heatmap.cells} />
        </SectionCard>
      )}

      {/* Export Footer */}
      <TouchableOpacity style={styles.bigExportBtn} onPress={handleShare}>
        <Ionicons name="document-text-outline" size={22} color="#fff" />
        <Text style={styles.bigExportText}>Share / Export Report</Text>
      </TouchableOpacity>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerDates: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  insightText: { fontSize: 14, color: '#4b5563', lineHeight: 21, marginTop: 8, marginBottom: 4 },
  chartTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginTop: 8, letterSpacing: 0.5 },
  hitBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  hitText: { fontSize: 14, fontWeight: '600', color: '#10b981' },
  streakRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  streakIcon: { fontSize: 18, width: 28 },
  streakName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#374151' },
  streakCount: { fontSize: 15, fontWeight: '800', color: '#111827' },
  consistencyBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  consistencyLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  consistencyPct: { fontSize: 13, fontWeight: '800', color: '#4f46e5' },
  progressBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 6, marginTop: 6, overflow: 'hidden' },
  progressFg: { height: '100%', backgroundColor: '#6366f1', borderRadius: 6 },
  bigExportBtn: {
    backgroundColor: '#4f46e5', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8,
  },
  bigExportText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  // Heatmap badge stats
  hmBadge: { alignItems: 'center' },
  hmBadgeNum: { fontSize: 22, fontWeight: '900' },
  hmBadgeLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', marginTop: 2 },
});
