import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import { requestPermissions, scheduleWaterReminders, scheduleMealReminders, scheduleMessWarning, scheduleDeficitWarning, scheduleSleepReminder, setupNotificationChannels } from '../src/services/NotificationService';
import { syncOnStartup } from '../src/storage/syncService';
import { logStorage } from '../src/storage';
import Config from '../src/constants/Config';
import { auth } from '../src/firebaseConfig';

// Handle foreground notification — show as in-app banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  }),
});

import { ThemeProvider } from '../src/context/ThemeContext';
import { ToastProvider } from '../src/context/ToastContext';

export default function RootLayout() {

  useEffect(() => {
    async function setupNotifications() {
      await setupNotificationChannels();
      const granted = await requestPermissions();
      if (granted) {
        await scheduleWaterReminders();
        await scheduleMealReminders();
        await scheduleMessWarning();
        await scheduleSleepReminder(23);
        
        try {
          const uid = auth.currentUser?.uid || 'user123';
          const res = await axios.get(`${Config.API_BASE_URL}/users/${uid}/dashboard`);
          if (res.data) {
             await scheduleDeficitWarning(res.data.water_drunk_liters);
          }
        } catch(e) {}
      }
    }
    
    if (Platform.OS !== 'web') {
      setupNotifications();
    }

    // Flush any pending offline logs to the backend on startup
    syncOnStartup().catch(() => {});

    // ─── Notification Action Handler ───────────────────────────────────
    // When user taps Logged/Skip/Later, this fires and writes to Firestore
    const subscription = Platform.OS !== 'web' 
      ? Notifications.addNotificationResponseReceivedListener(response => {
          const actionId = response.actionIdentifier;
          const categoryId = response.notification.request.content.categoryIdentifier;
          
          const fireAction = async () => {
            try {
              // ✅ LOGGED / COMPLETE — Save real data to Firestore
              if (actionId === 'complete') {
                if (categoryId === 'WATER_REMINDER') {
                  await logStorage.saveWaterLog(250);
                  console.log('[Notification] Water logged: 250ml');
                } else if (categoryId === 'MEAL_REMINDER') {
                  const hour = new Date().getHours();
                  const mealName = hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 18 ? 'Snack' : 'Dinner';
                  await logStorage.saveMealLog({
                    date: new Date().toISOString().split('T')[0],
                    name: mealName,
                    calories: 400,
                    protein: 20,
                    carbs: 50,
                    fat: 15,
                    loggedAt: new Date().toISOString()
                  });
                  console.log(`[Notification] ${mealName} logged via notification`);
                } else if (categoryId === 'SLEEP_REMINDER') {
                  const now = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(now.getDate() - 1);
                  await logStorage.saveSleepLog({
                    date: new Date().toISOString().split('T')[0],
                    startTime: new Date(yesterday.setHours(23, 0)).toISOString(),
                    endTime: now.toISOString(),
                    durationMinutes: 480 // 8 hours default
                  });
                  console.log('[Notification] Sleep logged: 8h');
                }
              }
              // ⏭️ SKIP — Just acknowledge, no action needed
              else if (actionId === 'skip') {
                console.log(`[Notification] Skipped ${categoryId} at ${new Date().toISOString()}`);
              }
              // ⏰ REMIND LATER — Reschedule in 15 minutes
              else if (actionId === 'remind_later') {
                const originalContent = response.notification.request.content;
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: originalContent.title || 'Reminder',
                    body: originalContent.body || '',
                    sound: true,
                    categoryIdentifier: originalContent.categoryIdentifier || undefined,
                    ...(Platform.OS === 'android' && originalContent.categoryIdentifier === 'WATER_REMINDER' && { channelId: 'water_reminders' }),
                    ...(Platform.OS === 'android' && originalContent.categoryIdentifier === 'MEAL_REMINDER' && { channelId: 'meal_reminders' }),
                    ...(Platform.OS === 'android' && originalContent.categoryIdentifier === 'SLEEP_REMINDER' && { channelId: 'sleep_reminders' }),
                  },
                  trigger: { seconds: 15 * 60, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL }
                });
                console.log('[Notification] Rescheduled for 15 min later');
              }
            } catch (e) {
              console.error('[Notification] Action handler error:', e);
            }
          };
          
          fireAction();
        })
      : null;

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}
