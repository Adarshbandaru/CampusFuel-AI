import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { offlineGet, offlinePost } from '../utils/offlineSync';

export default function WaterTracker() {
  const [ml, setMl] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const goalMl = 4000;
  const progress = Math.min((ml / goalMl) * 100, 100);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch today's total from dashboard
      const dashRes = await offlineGet('http://10.0.2.2:8000/users/user123/dashboard');
      if (dashRes.data) {
        setMl(dashRes.data.water_drunk_liters * 1000);
      }
      
      // Fetch 7-day history
      const histRes = await offlineGet('http://10.0.2.2:8000/users/user123/water/history');
      if (histRes.data && histRes.data.history) {
        setHistory(histRes.data.history);
      }
    } catch(e) {
      console.log('Failed to fetch water data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWater = async (amount: number) => {
    setMl(prev => prev + amount);
    try {
      await offlinePost(`http://10.0.2.2:8000/users/user123/water?amount_ml=${amount}`, {});
      fetchData(); // refresh history if applicable
    } catch(e) {
      // Offline fallback already handles UI
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const renderHistoryItem = ({ item }: { item: any }) => {
    // Basic date parsing to show abbreviated string
    const d = new Date(item.date);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = isNaN(d.getTime()) ? item.date : `${dayNames[d.getDay()]} (${item.date})`;

    return (
      <View style={styles.historyRow}>
        <Text style={styles.historyDate}>{day}</Text>
        <View style={styles.historyValueContainer}>
          <Ionicons name="water-outline" size={16} color="#3b82f6" />
          <Text style={styles.historyLiters}>{item.liters.toFixed(1)} L</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Water Intake</Text>
      <Text style={styles.subtitle}>Stay hydrated throughout the day</Text>

      {/* Progress Visualization */}
      <View style={styles.circleContainer}>
        <View style={styles.outerCircle}>
          <View style={[styles.waterFill, { height: `${progress}%` }]} />
          <Ionicons name="water" size={60} color="#fff" style={styles.iconOverlay} />
        </View>
        <Text style={styles.progressText}>{(ml/1000).toFixed(1)} L / {(goalMl/1000).toFixed(1)} L</Text>
        <Text style={styles.progressLabel}>Current Intake</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Log</Text>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddWater(250)}>
            <Ionicons name="beaker-outline" size={24} color="#3b82f6" />
            <Text style={styles.quickBtnText}>+250 ml</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddWater(500)}>
            <Ionicons name="pint-outline" size={24} color="#3b82f6" />
            <Text style={styles.quickBtnText}>+500 ml</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => handleAddWater(1000)}>
            <Ionicons name="cafe-outline" size={24} color="#3b82f6" />
            <Text style={styles.quickBtnText}>+1 Liter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* History Log */}
      <View style={{ flex: 1, width: '100%', marginTop: 24 }}>
        <Text style={styles.sectionTitle}>7-Day History</Text>
        {history.length > 0 ? (
          <FlatList
            data={history}
            keyExtractor={(item) => item.date}
            renderItem={renderHistoryItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        ) : (
          <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20 }}>No history manually tracked yet.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9', padding: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#1f2937', marginTop: 20 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, marginBottom: 20 },
  circleContainer: { alignItems: 'center', marginBottom: 20 },
  outerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#e0f2fe',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    borderWidth: 4,
    borderColor: '#bae6fd',
    marginBottom: 20,
    alignItems: 'center',
  },
  waterFill: {
    width: '100%',
    backgroundColor: '#3b82f6',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  iconOverlay: { position: 'absolute', top: 65 },
  progressText: { fontSize: 28, fontWeight: '800', color: '#1f2937' },
  progressLabel: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  quickActionsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '700', marginTop: 4 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  historyDate: { fontSize: 15, fontWeight: '600', color: '#374151' },
  historyValueContainer: { flexDirection: 'row', alignItems: 'center' },
  historyLiters: { fontSize: 15, fontWeight: '700', color: '#3b82f6', marginLeft: 6 },
});
