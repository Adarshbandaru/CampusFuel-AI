import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import { requestPermissions, scheduleWaterReminders, scheduleMealReminders, scheduleMessWarning, scheduleDeficitWarning } from '../src/services/NotificationService';

// Handle foreground notification (not immediately required, but good practice)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  }),
});

export default function RootLayout() {

  useEffect(() => {
    async function setupNotifications() {
      const granted = await requestPermissions();
      if (granted) {
        // Pre-schedule out the day
        await scheduleWaterReminders();
        await scheduleMealReminders();
        await scheduleMessWarning();
        
        try {
          const res = await axios.get('http://10.0.2.2:8000/users/user123/dashboard');
          if (res.data) {
             await scheduleDeficitWarning(res.data.water_drunk_liters);
          }
        } catch(e) {}
      }
    }
    
    setupNotifications();

    // Listeners for when a user interacts with a notification
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const actionId = response.actionIdentifier;
      const categoryId = response.notification.request.content.categoryIdentifier;
      
      const fireAction = async () => {
        try {
          if (actionId === 'complete') {
            if (categoryId === 'WATER_REMINDER') {
              await axios.post(`http://10.0.2.2:8000/users/user123/water?amount_ml=500`);
            } else if (categoryId === 'MEAL_REMINDER') {
              // Just inferring a generic meal for now automatically from background
              await axios.post('http://10.0.2.2:8000/users/user123/meal', {
                id: Math.random().toString(),
                uid: 'user123',
                name: 'Logged via Notification',
                calories: 400,
                protein: 20,
                date: new Date().toISOString()
              });
            }
          } else if (actionId === 'skip') {
            await axios.post('http://10.0.2.2:8000/users/user123/analytics/skip', {
              category: categoryId || 'UNKNOWN',
              time_scheduled: new Date(response.notification.date).toISOString(),
              skipped_at: new Date().toISOString()
            });
          } else if (actionId === 'remind_later') {
            // Re-schedule in 15 mins
            const originalContent = response.notification.request.content;
            await Notifications.scheduleNotificationAsync({
              content: {
                title: originalContent.title || 'Reminder',
                body: originalContent.body || '',
                sound: true,
                categoryIdentifier: originalContent.categoryIdentifier || undefined
              },
              trigger: { seconds: 15 * 60, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL }
            });
          }
        } catch (e) {
          console.error("Failed to post notification action to API:", e);
        }
      };
      
      fireAction();
    });

    return () => subscription.remove();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
