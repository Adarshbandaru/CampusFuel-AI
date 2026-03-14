import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

export default function WeightPredictorScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [sleepData, setSleepData] = useState<any>(null);

  const loadData = async () => {
    try {
      const [weightRes, sleepRes] = await Promise.all([
          axios.get('http://10.0.2.2:8000/users/user123/intelligence/weight_prediction'),
          axios.get('http://10.0.2.2:8000/users/user123/intelligence/sleep')
      ]);
      setData(weightRes.data);
      setSleepData(sleepRes.data);
    } catch (e) {
      setData({
        current_weight: 61.2,
        target_weight: 65.0,
        start_weight: 60.5,
        progress_percentage: 15,
        estimated_weight_30d: 63.5,
        history: [
            {date: "2023-09-15", weight: 60.5},
            {date: "2023-09-22", weight: 60.8},
            {date: "2023-10-01", weight: 61.2}
        ],
        motivation_message: "You gained 0.7 kg so far. Great progress!"
      });
      setSleepData({
          score: 65,
          insight: "You slept less than 6 hours yesterday (5.1h). Consider an earlier bedtime.",
          history: [
             {date: "2023-10-14", duration_hours: 7.6},
             {date: "2023-10-15", duration_hours: 5.1}
          ]
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => { 
    setRefreshing(true); 
    loadData(); 
  };

  const handleLogWeight = async () => {
    if (!newWeight) return;
    const w = parseFloat(newWeight);
    if (isNaN(w)) return Alert.alert("Invalid weight");

    try {
      await axios.post('http://10.0.2.2:8000/users/user123/weight', { weight_kg: w });
      setNewWeight('');
      Alert.alert("Success", "Weight logged!");
      loadData();
    } catch(e) {
      Alert.alert("Error logging weight");
    }
  };

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Calculate dynamic bar heights based on min/max graph range
  const validHistory = data.history.filter((h: any) => h.weight > 0);
  const allWeights = [...validHistory.map((h:any) => h.weight), data.estimated_weight_30d];
  const maxWeight = Math.max(...allWeights) + 2;
  const minWeight = Math.max(0, Math.min(...allWeights) - 2);
  const range = maxWeight - minWeight;

  const handleSimulateSleep = async () => {
      try {
          const SleepDetectionService = require('../../src/services/SleepDetectionService').default;
          const res = await SleepDetectionService.simulateOvernightSleep(7.7);
          Alert.alert("Hardware Sleep Simulated", res.message);
          loadData();
      } catch (e) {
          Alert.alert("Simulation Failed");
      }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.pageTitle}>AI Weight Tracker</Text>

      {/* Hero Progress Card */}
      <View style={[styles.card, styles.heroCard]}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Weight Goal Progress</Text>
          <MaterialCommunityIcons name="target" size={28} color="#fff" />
        </View>
        <Text style={styles.scoreText}>{data.current_weight} <Text style={{fontSize: 24, fontWeight: '600'}}>kg</Text></Text>
        <Text style={styles.heroConfigText}>Target: {data.target_weight} kg • {data.progress_percentage}% completed</Text>
        
        <View style={styles.progressBackground}>
           <View style={[styles.progressFill, { width: `${data.progress_percentage}%` }]} />
        </View>
        
        <Text style={{color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 14}}>{data.motivation_message}</Text>
      </View>

      {/* Calorie Adjustment Banner */}
      <View style={[styles.card, {backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1}]}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Ionicons name="information-circle" size={24} color="#3b82f6" />
             <Text style={{fontSize: 16, fontWeight: '700', color: '#1e3a8a', marginLeft: 8}}>AI Calorie Advisor</Text>
          </View>
          <Text style={{fontSize: 14, color: '#1e40af', marginTop: 8, fontWeight: '500'}}>{data.calorie_adjustment}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.cardHalf}>
          <Ionicons name="trending-up" size={28} color="#8b5cf6" />
          <Text style={styles.cardValue}>+ {Math.max(0, (data.estimated_weight_30d - data.current_weight)).toFixed(1)} kg</Text>
          <Text style={styles.cardLabel}>AI 30d Gain</Text>
        </View>
        <View style={styles.cardHalf}>
          <Ionicons name="calendar-outline" size={28} color="#10b981" />
          <Text style={styles.cardValue}>{data.estimated_weight_30d}</Text>
          <Text style={styles.cardLabel}>AI 30d Projection</Text>
        </View>
      </View>

      {/* Manual Logging */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Log Today's Weight</Text>
        <View style={{flexDirection: 'row', marginTop: 8}}>
           <TextInput 
             style={styles.input}
             placeholder="e.g. 62.5"
             keyboardType="numeric"
             value={newWeight}
             onChangeText={setNewWeight}
           />
           <TouchableOpacity style={styles.submitBtn} onPress={handleLogWeight}>
             <Text style={styles.submitBtnText}>Save</Text>
           </TouchableOpacity>
        </View>
      </View>

      {/* Simple Vertical Bar Chart */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Progress Chart</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
           <View style={styles.chartLineWrapper}>
              
              {/* Historical Bars */}
              {validHistory.map((h: any, i: number) => {
                 const heightRatio = range > 0 ? (h.weight - minWeight) / range : 0.5;
                 const barHeight = Math.max(10, heightRatio * 150);
                 
                 return (
                   <View key={`hist-${i}`} style={styles.chartCol}>
                      <Text style={styles.chartValText}>{Number(h.weight).toFixed(1)}</Text>
                      <View style={[styles.chartBar, {height: barHeight, backgroundColor: '#3b82f6'}]} />
                      <Text style={styles.chartDateText}>{h.date.substring(5)}</Text>
                   </View>
                 );
              })}

              {/* Spacing */}
              <View style={{width: 20}} />

              {/* AI Prediction Bar */}
              <View style={styles.chartCol}>
                  <Text style={[styles.chartValText, {color: '#8b5cf6'}]}>{data.estimated_weight_30d}</Text>
                  <View style={[styles.chartBar, {height: 150, backgroundColor: '#c4b5fd', borderWidth: 1, borderColor: '#8b5cf6', borderStyle: 'dashed'}]} />
                  <Text style={styles.chartDateText}>In 30d</Text>
              </View>

           </View>
        </ScrollView>
      </View>

      <Text style={[styles.pageTitle, {marginTop: 16}]}>AI Sleep Tracker</Text>
      
      {/* Sleep Simulation Test Button */}
      <TouchableOpacity 
        style={{ backgroundColor: '#4f46e5', padding: 12, borderRadius: 10, marginBottom: 16, alignItems: 'center' }}
        onPress={handleSimulateSleep}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>🧪 Simulate Hardware Sleep (7.7h)</Text>
      </TouchableOpacity>

      {/* Sleep Insight Card */}
      {sleepData && (
          <>
            <View style={[styles.card, styles.heroCard, {backgroundColor: '#1e3a8a'}]}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroTitle}>Sleep Intelligence</Text>
                <Ionicons name="moon" size={26} color="#bfdbfe" />
              </View>
              <View style={{flexDirection: 'row', alignItems: 'flex-end', marginTop: 12}}>
                 <Text style={[styles.scoreText, {color: '#bfdbfe'}]}>{sleepData.score}</Text>
                 <Text style={{color: '#93c5fd', fontSize: 20, marginBottom: 14, marginLeft: 4, fontWeight: 'bold', opacity: 0.9}}>Score</Text>
              </View>
              
              <View style={[styles.card, {backgroundColor: '#3b82f6', marginTop: 16, padding: 12, borderRadius: 12}]}>
                 <Text style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>{sleepData.insight}</Text>
              </View>
            </View>

            {/* Sleep Chart */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Sleep History (Hours)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                   <View style={styles.chartLineWrapper}>
                      
                      {/* Sub-Target line (mocked at 150px = 10 hours for scaling, 8h target = ~120px height) */}
                      <View style={{position: 'absolute', top: 50, left: 0, right: 0, height: 1, backgroundColor: '#e5e7eb', borderStyle: 'dashed', borderWidth: 1, borderColor: '#d1d5db', zIndex: 0}} />
                      <Text style={{position: 'absolute', top: 32, right: 10, fontSize: 10, color: '#9ca3af', fontWeight: 'bold'}}>8h Target</Text>

                      {sleepData.history.map((h: any, i: number) => {
                         const sleepHeightRatio = Math.min(1.0, h.duration_hours / 10.0); 
                         const sleepBarHeight = Math.max(10, sleepHeightRatio * 150);
                         
                         return (
                           <View key={`sleep-${i}`} style={styles.chartCol}>
                              <Text style={[styles.chartValText, {color: h.duration_hours >= 8 ? '#10b981' : '#f59e0b'}]}>{h.duration_hours}h</Text>
                              <View style={[styles.chartBar, {height: sleepBarHeight, backgroundColor: h.duration_hours >= 8 ? '#10b981' : '#fcd34d'}]} />
                              <Text style={styles.chartDateText}>{h.date.substring(5)}</Text>
                           </View>
                         );
                      })}
                   </View>
                </ScrollView>
            </View>
          </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f2f5f9', padding: 16, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1f2937', marginBottom: 16 },
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
  heroCard: { backgroundColor: '#8b5cf6' },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '600', opacity: 0.9 },
  scoreText: { color: '#fff', fontSize: 48, fontWeight: '800' },
  heroConfigText: { color: '#ffffff', fontSize: 14, opacity: 0.9, marginTop: -4, marginBottom: 12, fontWeight: '500' },
  progressBackground: { width: '100%', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 10, height: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: '#fff', height: 8, borderRadius: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
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
  cardValue: { fontSize: 22, fontWeight: '800', color: '#1f2937', marginTop: 8 },
  cardLabel: { fontSize: 13, color: '#6b7280', marginVertical: 4 },
  input: {
    flex: 1,
    backgroundColor: '#f9fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginRight: 12
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  chartScroll: { marginTop: 16 },
  chartLineWrapper: { flexDirection: 'row', height: 210, alignItems: 'flex-end', paddingTop: 20 },
  chartCol: { alignItems: 'center', marginHorizontal: 12 },
  chartBar: { width: 34, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#3b82f6' },
  chartValText: { fontSize: 14, fontWeight: 'bold', color: '#4b5563', marginBottom: 8 },
  chartDateText: { fontSize: 12, color: '#9ca3af', marginTop: 8, fontWeight: '600' }
});
