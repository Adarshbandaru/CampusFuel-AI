import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleWaterReminders, scheduleMealReminders, scheduleSleepReminder, scheduleCampusReminders } from '../../src/services/NotificationService';
import { useTheme } from '../../src/context/ThemeContext';
import { useToast } from '../../src/context/ToastContext';
import { auth } from '../../src/firebaseConfig';
import Config from '../../src/constants/Config';

export default function Settings() {
  const router = useRouter();
  const { theme, mode, setMode, colors } = useTheme();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [campusModeEnabled, setCampusModeEnabled] = useState(false);
  const [campusClasses, setCampusClasses] = useState<any[]>([]);
  
  // "at_start", "before_class", "after_class"
  const [notificationMode, setNotificationMode] = useState("at_start");

  const [devClickCount, setDevClickCount] = useState(0);
  const [devVisible, setDevVisible] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [devData, setDevData] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<string[]>([]);
  const [reminderLogs, setReminderLogs] = useState<string[]>([]);

  useEffect(() => {
    if (devModeEnabled) {
      fetchDevData();
    }
  }, [devModeEnabled]);

  // Load campus mode preference on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      await fetchSettings();
    };

    const loadCampusMode = async () => {
      const val = await AsyncStorage.getItem('campus_mode_enabled');
      setCampusModeEnabled(val === 'true');
    };

    loadCampusMode();
    loadSettings();
  }, []);

  const handleCampusModeToggle = async (value: boolean) => {
    setCampusModeEnabled(value);
    await AsyncStorage.setItem('campus_mode_enabled', value ? 'true' : 'false');
    
    if (value) {
      // Fetch timetable and schedule campus reminders
      try {
        const uid = auth.currentUser?.uid || 'user123';
        const res = await axios.get(`${Config.API_BASE_URL}/users/${uid}/timetable`);
        if (res.data?.timetable) {
          // Flatten timetable to array of { day, start, end, subject }
          const flat: any[] = [];
          Object.entries(res.data.timetable).forEach(([day, classes]: any) => {
            (classes || []).forEach((cls: any) => flat.push({ day, ...cls }));
          });
          setCampusClasses(flat);
          await scheduleCampusReminders(flat);
        }
        showToast('Campus Mode is now active 🎓', 'success');
      } catch {
        showToast('Campus Mode enabled. Add timetable for reminders.', 'info');
      }
    } else {
      showToast('Campus notifications disabled.', 'info');
    }
  };

  const fetchDevData = async () => {
    try {
      const uid = auth.currentUser?.uid || 'user123';
      const dashRes = await axios.get(`${Config.API_BASE_URL}/users/${uid}/dashboard`);
      const actRes = await axios.get(`${Config.API_BASE_URL}/users/${uid}/activity_logs`);
      setDevData(dashRes.data);
      setActivityLogs(actRes.data.logs || []);
    } catch(e) {
      setDevData({ fallback: true });
    }
  };

  const testReminder = async (type: string) => {
    try {
      const uid = auth.currentUser?.uid || 'user123';
      const res = await axios.post(`${Config.API_BASE_URL}/users/${uid}/test_reminder`, { category: type });
      if (res.data?.logs) {
        setReminderLogs(res.data.logs);
      }
    } catch(e) {
      setReminderLogs(["Feature temporarily unavailable."]); // Fallback crash safety
    }
  };

  const handleVersionPress = () => {
    const newCount = devClickCount + 1;
    setDevClickCount(newCount);
    if (newCount >= 5 && !devVisible) {
      setDevVisible(true);
      showToast("Developer Mode Unlocked", "success");
    }
  };


  const fetchSettings = async () => {
    try {
      const uid = auth.currentUser?.uid || 'user123';
      const res = await axios.get(`${Config.API_BASE_URL}/users/${uid}/settings`);
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
      const uid = auth.currentUser?.uid || 'user123';
      await axios.post(`${Config.API_BASE_URL}/users/${uid}/settings`, {
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
    <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
      <View style={[styles.settingIconContainer, { backgroundColor: theme === 'dark' ? '#334155' : '#f3f4f6' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.settingValue}>
        {valueElement}
        {showArrow && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
      </View>
    </View>
  );

  const AppearanceOption = ({ title, icon, value }: { title: string, icon: any, value: 'light' | 'dark' | 'system' }) => {
    const isSelected = mode === value;
    return (
      <TouchableOpacity 
        style={[styles.modeOption, { backgroundColor: colors.card }]} 
        onPress={() => setMode(value)}
      >
        <Ionicons name={icon} size={22} color={isSelected ? colors.primary : colors.textSecondary} style={{ marginRight: 12 }} />
        <Text style={[styles.modeTitle, { color: isSelected ? colors.primary : colors.text, flex: 1 }]}>{title}</Text>
        <Ionicons 
          name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
          size={24} 
          color={isSelected ? colors.primary : colors.border} 
        />
      </TouchableOpacity>
    );
  };

  const ModeOption = ({ title, desc, value }: { title: string, desc: string, value: string }) => {
    const isSelected = notificationMode === value;
    return (
      <TouchableOpacity style={[styles.modeOption, { backgroundColor: colors.card }]} onPress={() => updateMode(value)}>
        <View style={styles.modeTextContainer}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.modeDesc, { color: colors.textSecondary }]}>{desc}</Text>
        </View>
        <Ionicons 
          name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
          size={24} 
          color={isSelected ? colors.primary : colors.border} 
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.pageBg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Account</Text>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <SettingRow title="Edit Profile" icon="person" color={colors.primary} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow title="Daily Goals" icon="flag-outline" color={colors.warning} />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Appearance</Text>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <AppearanceOption title="System Default" icon="settings-outline" value="system" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppearanceOption title="Light Mode" icon="sunny-outline" value="light" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppearanceOption title="Dark Mode" icon="moon-outline" value="dark" />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Preferences</Text>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <SettingRow 
          title="Push Notifications" 
          icon="notifications" 
          color={colors.danger} 
          showArrow={false}
          valueElement={
            <Switch 
              value={notifications} 
              onValueChange={setNotifications} 
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={notifications ? '#FFFFFF' : colors.cardHighlight}
            />
          } 
        />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Class Conflict Buffer</Text>
      <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>If a reminder occurs during a class block on your Timetable, when should we deliver it?</Text>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <ModeOption 
          title="At class start" 
          desc="Send exactly when the class begins." 
          value="at_start" 
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ModeOption 
          title="5 minutes before class" 
          desc="Send just before the class starts." 
          value="before_class" 
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ModeOption 
          title="2 minutes after class" 
          desc="Wait until the class ends to remind you." 
          value="after_class" 
        />
      </View>

      {/* Campus Mode */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Campus Mode</Text>
      <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>When enabled, the app adapts health reminders to your class timetable — reminding you to hydrate before lectures and eat during breaks.</Text>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={[styles.settingRow, { backgroundColor: colors.card }]}>
          <View style={[styles.campusIconWrap, { backgroundColor: colors.cardHighlight }]}>
            <MaterialCommunityIcons name="school" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Campus Mode</Text>
            <Text style={[styles.campusDesc, { color: colors.textSecondary }]}>Timetable-aware health assistant</Text>
          </View>
          <Switch
            value={campusModeEnabled}
            onValueChange={handleCampusModeToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={campusModeEnabled ? '#FFFFFF' : colors.cardHighlight}
          />
        </View>
        {campusModeEnabled && (
          <View style={[styles.campusStatusBanner, { backgroundColor: colors.cardHighlight, borderTopColor: colors.border }]}>
            <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.primary} />
            <Text style={[styles.campusStatusText, { color: colors.primary }]}>Campus Routine Engine Active · {campusClasses.length} classes tracked</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.cardHighlight }]} onPress={handleLogout}>
        <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
      </TouchableOpacity>

      {devVisible && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.warning }]}>Developer Options</Text>
          <View style={[styles.card, { borderColor: colors.border }]}>
            <SettingRow 
              title="Developer Mode" 
              icon="code-slash" 
              color={colors.warning} 
              showArrow={false}
              valueElement={
                <Switch 
                  value={devModeEnabled} 
                  onValueChange={setDevModeEnabled} 
                  trackColor={{ false: colors.border, true: colors.warning }}
                />
              } 
            />
          </View>
          
          {devModeEnabled && (
            <View style={{ marginHorizontal: 20, marginTop: 16 }}>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 12}}>Debug Dashboard</Text>
                
                <View style={[styles.card, { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }]}>
                  {devData && !devData.fallback ? (
                    <>
                      <Text style={{color: colors.text, fontWeight: 'bold', marginBottom: 8}}>Calculations:</Text>
                      <Text style={{color: colors.textSecondary}}>Nutrition Score: {Math.round((devData.score_breakdown?.Nutrition || 0) * 0.3)} / 30</Text>
                      <Text style={{color: colors.textSecondary}}>Hydration Score: {Math.round((devData.score_breakdown?.Hydration || 0) * 0.2)} / 20</Text>
                      <Text style={{color: colors.textSecondary}}>Sleep Score: {Math.round((devData.score_breakdown?.Sleep || 0) * 0.2)} / 20</Text>
                      <Text style={{color: colors.textSecondary}}>Habits Score: {Math.round((devData.score_breakdown?.Habits || 0) * 0.15)} / 15</Text>
                      <Text style={{color: colors.textSecondary}}>Discipline Score: {Math.round((devData.score_breakdown?.Discipline || 0) * 0.15)} / 15</Text>
                      <Text style={{color: colors.text, fontWeight: 'bold', marginTop: 12}}>Final Score: {devData.life_consistency_score}</Text>
                    </>
                  ) : (
                      <Text style={{color: colors.textSecondary}}>Feature temporarily unavailable.</Text>
                  )}
                  
                  <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 16, marginLeft: 0 }]} />
                  
                  <Text style={{color: colors.text, fontWeight: 'bold', marginBottom: 8}}>Test Reminder</Text>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
                      <TouchableOpacity onPress={() => testReminder('water')} style={[styles.devBtn, {backgroundColor: colors.primary}]}><Text style={styles.devBtnText}>Water</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => testReminder('meal')} style={[styles.devBtn, {backgroundColor: colors.primary}]}><Text style={styles.devBtnText}>Meal</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => testReminder('sleep')} style={[styles.devBtn, {backgroundColor: colors.primary}]}><Text style={styles.devBtnText}>Sleep</Text></TouchableOpacity>
                  </View>
                  
                  {reminderLogs.length > 0 && (
                      <View style={{backgroundColor: theme === 'dark' ? '#1E293B': '#F1F5F9', padding: 8, borderRadius: 8}}>
                          {reminderLogs.map((r, i) => <Text key={i} style={{color: colors.textSecondary, fontSize: 13}}>{r}</Text>)}
                      </View>
                  )}

                  <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 16, marginLeft: 0 }]} />

                  <Text style={{color: colors.text, fontWeight: 'bold', marginBottom: 8}}>Activity Logs (Last 20)</Text>
                  {activityLogs.length > 0 ? activityLogs.map((pl, i) => (
                      <Text key={i} style={{color: colors.textSecondary, fontSize: 13, marginBottom: 4}}>{pl}</Text>
                  )) : <Text style={{color: colors.textSecondary, fontSize: 13}}>No recent activity.</Text>}
                </View>
            </View>
          )}
        </>
      )}

      <TouchableOpacity activeOpacity={1} onPress={handleVersionPress}>
        <Text style={styles.version}>CampusFuel AI v1.0.0</Text>
      </TouchableOpacity>
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
  devBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, width: '30%', alignItems: 'center' },
  devBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  campusIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  campusDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  campusStatusBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, gap: 6 },
  campusStatusText: { fontSize: 12, fontWeight: '700' },
});
