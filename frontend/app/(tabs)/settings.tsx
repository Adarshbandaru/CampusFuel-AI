import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { scheduleWaterReminders, scheduleMealReminders } from '../../src/services/NotificationService';

export default function Settings() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // "at_start", "before_class", "after_class"
  const [notificationMode, setNotificationMode] = useState("at_start");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('http://10.0.2.2:8000/users/user123/settings');
      if (res.data && res.data.notification_mode) {
        setNotificationMode(res.data.notification_mode);
      }
    } catch(e) {
      console.log('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const updateMode = async (mode: string) => {
    setNotificationMode(mode);
    try {
      await axios.post('http://10.0.2.2:8000/users/user123/settings', {
        notification_mode: mode
      });
      
      // Instantly recalculate the day's notifications to apply the new buffer
      await scheduleWaterReminders();
      await scheduleMealReminders();
      
    } catch(e) {
      console.log('Failed to save settings');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to exit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => router.replace('/login') },
    ]);
  };

  const SettingRow = ({ title, icon, color, showArrow = true, valueElement = null }: { title: string, icon: any, color: string, showArrow?: boolean, valueElement?: any }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIconContainer}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.settingTitle}>{title}</Text>
      <View style={styles.settingValue}>
        {valueElement}
        {showArrow && <Ionicons name="chevron-forward" size={20} color="#9ca3af" />}
      </View>
    </View>
  );

  const ModeOption = ({ title, desc, value }: { title: string, desc: string, value: string }) => {
    const isSelected = notificationMode === value;
    return (
      <TouchableOpacity style={styles.modeOption} onPress={() => updateMode(value)}>
        <View style={styles.modeTextContainer}>
          <Text style={styles.modeTitle}>{title}</Text>
          <Text style={styles.modeDesc}>{desc}</Text>
        </View>
        <Ionicons 
          name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
          size={24} 
          color={isSelected ? "#3b82f6" : "#d1d5db"} 
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionHeader}>Account</Text>
      <View style={styles.card}>
        <SettingRow title="Edit Profile" icon="person" color="#3b82f6" />
        <View style={styles.divider} />
        <SettingRow title="Daily Goals" icon="target" color="#f59e0b" />
      </View>

      <Text style={styles.sectionHeader}>Preferences</Text>
      <View style={styles.card}>
        <SettingRow 
          title="Push Notifications" 
          icon="notifications" 
          color="#ef4444" 
          showArrow={false}
          valueElement={
            <Switch 
              value={notifications} 
              onValueChange={setNotifications} 
              trackColor={{ false: '#d1d5db', true: '#bfdbfe' }}
              thumbColor={notifications ? '#3b82f6' : '#f3f4f6'}
            />
          } 
        />
        <View style={styles.divider} />
        <SettingRow title="Appearance" icon="color-palette" color="#8b5cf6" />
      </View>

      <Text style={styles.sectionHeader}>Class Conflict Buffer</Text>
      <Text style={styles.sectionDesc}>If a reminder occurs during a class block on your Timetable, when should we deliver it?</Text>
      <View style={styles.card}>
        <ModeOption 
          title="At class start" 
          desc="Send exactly when the class begins." 
          value="at_start" 
        />
        <View style={styles.divider} />
        <ModeOption 
          title="5 minutes before class" 
          desc="Send just before the class starts." 
          value="before_class" 
        />
        <View style={styles.divider} />
        <ModeOption 
          title="2 minutes after class" 
          desc="Wait until the class ends to remind you." 
          value="after_class" 
        />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>CampusFuel AI v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#9ca3af', paddingHorizontal: 20, marginBottom: 12 },
  card: { backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  settingIconContainer: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  settingTitle: { fontSize: 16, color: '#1f2937', flex: 1 },
  settingValue: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 60 },
  logoutButton: { margin: 24, backgroundColor: '#fee2e2', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: '#9ca3af', fontSize: 13, marginBottom: 40 },
  
  modeOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, backgroundColor: '#fff' },
  modeTextContainer: { flex: 1 },
  modeTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 2 },
  modeDesc: { fontSize: 13, color: '#6b7280' },
});
