import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import axios from 'axios';
import Config from '../constants/Config';
import { auth } from '../firebaseConfig';

// ─── Android Notification Channels ────────────────────────────────────────────
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('water_reminders', {
    name: 'Water Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    sound: 'default',
    lightColor: '#0EA5E9',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  await Notifications.setNotificationChannelAsync('meal_reminders', {
    name: 'Meal Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500, 200, 500],
    enableVibrate: true,
    sound: 'default',
    lightColor: '#F59E0B',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  await Notifications.setNotificationChannelAsync('sleep_reminders', {
    name: 'Sleep Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 200, 300],
    enableVibrate: true,
    sound: 'default',
    lightColor: '#6366F1',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  await Notifications.setNotificationChannelAsync('campus_reminders', {
    name: 'Campus Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    sound: 'default',
    lightColor: '#4F46E5',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

let dynamicTimetable: Record<string, any[]> = {};
let currentMode: string = "at_start";
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function fetchLiveTimetable() {
  try {
    const uid = auth.currentUser?.uid || 'user123';
    const res = await axios.get(`${Config.API_BASE_URL}/users/${uid}/timetable`);
    if (res.data && res.data.timetable) {
      dynamicTimetable = res.data.timetable;
    }
    
    // Also fetch settings to apply buffers
    const setRes = await axios.get(`${Config.API_BASE_URL}/users/${uid}/settings`);
    if (setRes.data && setRes.data.notification_mode) {
      currentMode = setRes.data.notification_mode;
    }
  } catch (e) {
    console.log("Failed to fetch live timetable or settings", e);
  }
}

export async function requestPermissions() {
  if (Platform.OS === 'web') return false;
  // Setup Android channels first
  await setupNotificationChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return false;
  }

  // Setup actionable categories
  if ((Platform.OS as any) !== 'web') {
    await Notifications.setNotificationCategoryAsync('WATER_REMINDER', [
      { identifier: 'complete', buttonTitle: '✅ Done', options: { opensAppToForeground: false } },
      { identifier: 'skip', buttonTitle: 'Skip', options: { opensAppToForeground: false } },
      { identifier: 'remind_later', buttonTitle: '⏰ Later', options: { opensAppToForeground: false } }
    ]);

    await Notifications.setNotificationCategoryAsync('MEAL_REMINDER', [
      { identifier: 'complete', buttonTitle: '✅ Logged', options: { opensAppToForeground: false } },
      { identifier: 'skip', buttonTitle: 'Skip', options: { opensAppToForeground: false } },
      { identifier: 'remind_later', buttonTitle: '⏰ Later', options: { opensAppToForeground: false } }
    ]);

    await Notifications.setNotificationCategoryAsync('SLEEP_REMINDER', [
      { identifier: 'complete', buttonTitle: '😴 Going to sleep', options: { opensAppToForeground: false } },
      { identifier: 'remind_later', buttonTitle: '⏰ 30 min later', options: { opensAppToForeground: false } }
    ]);
  }

  return true;
}

// Conflict Resolution Engine
export function findAvailableTime(targetDate: Date): Date {
  let proposed = new Date(targetDate.getTime());
  let conflictFound = true;
  let iterations = 0; // fallback break
  
  const dayName = days[proposed.getDay()];
  const todaysClasses = dynamicTimetable[dayName] || [];
  
  if (todaysClasses.length === 0) return proposed;

  // Helper to parse HH:MM to comparable minutes
  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Keep advancing until it clears all blocks
  while(conflictFound && iterations < 10) {
    conflictFound = false;
    iterations++;
    const proposedMins = proposed.getHours() * 60 + proposed.getMinutes();

    for (const block of todaysClasses) {
      const startMins = getMinutes(block.start);
      const endMins = getMinutes(block.end);

      if (proposedMins >= startMins && proposedMins < endMins) {
        // We are inside a class! Apply the buffer logic.
        proposed = new Date(proposed.getTime());
        conflictFound = true;
        
        let newTotalMins = 0;

        if (currentMode === "at_start") {
            newTotalMins = startMins; // Exactly when class begins
        } else if (currentMode === "before_class") {
            newTotalMins = startMins - 5; // 5 minutes before class
        } else if (currentMode === "after_class") {
            newTotalMins = endMins + 2; // 2 minutes after class ends
        } else {
            // Default fallback
            newTotalMins = endMins + 5;
        }

        const newH = Math.floor(newTotalMins / 60);
        const newM = newTotalMins % 60;
        proposed.setHours(newH, newM, 0, 0);
        break;
      }
    }
  }
  return proposed;
}

export async function scheduleWaterReminders() {
  if (Platform.OS === 'web') return;
  await fetchLiveTimetable();
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  let dashData: any = null;
  try {
     const uid = auth.currentUser?.uid || 'user123';
     const res = await axios.get(`${Config.API_BASE_URL}/users/${uid}/dashboard`);
     dashData = res.data;
  } catch(e) {}

  let baseTime = new Date();
  baseTime.setMinutes(0, 0, 0);
  
  for (let i = 1; i <= 6; i++) {
    const target = new Date(baseTime.getTime() + (i * 2 * 60 * 60 * 1000));
    
    if (target.getHours() >= 8 && target.getHours() <= 22) {
      const safeTime = findAvailableTime(target);
      
      let bodyText = "Time to drink water. Add 500 ml now.";
      if (dashData) {
         const remaining = dashData.water_goal_liters - dashData.water_drunk_liters;
         if (remaining <= 0.5 && remaining > 0) {
            bodyText = `Great job today. Only ${Math.round(remaining*1000)}ml water left to reach your goal.`;
         } else if (remaining <= 0) {
            bodyText = "Hydration goal reached! Keep it up if you're still thirsty.";
         } else {
            bodyText = "You haven't logged water for 2 hours. Drink 250ml.";
         }
      }
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💧 Time to hydrate!",
          body: bodyText,
          categoryIdentifier: 'WATER_REMINDER',
          sound: true,
          vibrate: [0, 250, 250, 250],
          ...(Platform.OS === 'android' && { channelId: 'water_reminders' }),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: safeTime },
      });
    }
  }
}

export async function scheduleDeficitWarning(currentLiters: number) {
  if (Platform.OS === 'web') return;
  if (currentLiters >= 2.5) return;
  
  const target = new Date();
  target.setHours(18, 0, 0, 0);
  
  if (target > new Date()) {
    const safeTime = findAvailableTime(target);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ Hydration Warning",
        body: "You are behind your hydration goal today. Suggest drinking 500 ml.",
        categoryIdentifier: 'WATER_REMINDER',
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: safeTime },
    });
  }
}

export async function scheduleMealReminders() {
  if (Platform.OS === 'web') return;
  // Assuming live timetable already fetched by water reminder wrapper
  let dashData: any = null;
  try {
     const uid = auth.currentUser?.uid || 'user123';
     const res = await axios.get(`${Config.API_BASE_URL}/users/${uid}/dashboard`);
     dashData = res.data;
  } catch(e) {}

  const meals = [
    { name: 'Breakfast', hour: 8, min: 0 },
    { name: 'Lunch', hour: 13, min: 0 },
    { name: 'Snack', hour: 17, min: 0 },
    { name: 'Dinner', hour: 20, min: 0 },
    { name: 'Protein shake', hour: 21, min: 15 },
  ];

  for (const meal of meals) {
    const target = new Date();
    target.setHours(meal.hour, meal.min, 0, 0);
    
    if (target < new Date()) {
      target.setDate(target.getDate() + 1);
    }

    const safeTime = findAvailableTime(target);
    
    let bodyText = `Log your ${meal.name} to track your calories and protein.`;
    if (dashData) {
        if (meal.name === 'Dinner' || meal.name === 'Protein shake') {
            const missingPro = Math.round(dashData.protein_goal - dashData.protein_consumed);
            const missingCals = Math.round(dashData.calories_goal - dashData.calories_consumed);
            if (missingPro > 0 && missingPro > 10) {
                bodyText = `You are ${missingPro}g short of today's protein goal.`;
            } else if (missingCals > 0 && missingCals > 100) {
                bodyText = `You are ${missingCals} calories short. Have a good ${meal.name}!`;
            } else {
                bodyText = `Goals met! Enjoy your ${meal.name}.`;
            }
        }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🍽️ Time for ${meal.name}!`,
        body: bodyText,
        categoryIdentifier: 'MEAL_REMINDER',
        sound: true,
        vibrate: [0, 500, 200, 500],
        ...(Platform.OS === 'android' && { channelId: 'meal_reminders' }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: safeTime },
    });
  }
}

export async function scheduleMessWarning() {
  if (Platform.OS === 'web') return;
  const dayName = days[new Date().getDay()];
  const todaysClasses = dynamicTimetable[dayName] || [];
  
  let hasLateClass = false;
  let latestClassEndTimeStr = "20:30"; // Default
  
  // Check if any class ends late (e.g. between 19:00 and 20:30)
  const getMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number); return h * 60 + m;
  };
  
  for (const block of todaysClasses) {
      const startMins = getMinutes(block.start);
      const endMins = getMinutes(block.end);
      
      // If a class is between 7 PM (1140) and 8:30 PM (1230)
      if (endMins > 1140 && startMins < 1230) {
          hasLateClass = true;
          latestClassEndTimeStr = block.end;
      }
  }

  const target = new Date();
  
  if (hasLateClass) {
      // Fire 5 mins before class ends as a smart warning
      const [eh, em] = latestClassEndTimeStr.split(':').map(Number);
      target.setHours(eh, em - 5, 0, 0);
  } else {
      target.setHours(20, 30, 0, 0); // Warning at 8:30 PM
  }
  
  if (target < new Date()) {
    target.setDate(target.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⚠️ Mess closes soon!",
      body: hasLateClass ? `You have class until ${latestClassEndTimeStr}. Go to mess early.` : "Go for dinner before the hostel mess closes.",
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
}

export async function scheduleMissedMealAlert() {
  if (Platform.OS === 'web') return;
  // Feature 6: Missed Meal Alert (>6 Hours without food)
  // Simulating the interval logic: schedules a warning for 2:30 PM (6 hours after breakfast)
  const target = new Date();
  target.setHours(14, 30, 0, 0);

  if (target > new Date()) {
    const safeTime = findAvailableTime(target);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ Missed Meal Alert",
        body: "You haven't eaten for several hours. Consider eating a snack.",
        categoryIdentifier: 'MEAL_REMINDER',
        sound: true,
        vibrate: [0, 500, 200, 500],
        ...(Platform.OS === 'android' && { channelId: 'meal_reminders' }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: safeTime },
    });
  }
}

// ─── Sleep Reminder ─────────────────────────────────────────────────────────

export async function scheduleSleepReminder(targetHour: number = 23) {
  if (Platform.OS === 'web') return;
  const target = new Date();
  target.setHours(targetHour, 0, 0, 0);
  if (target < new Date()) {
    target.setDate(target.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌙 Time to wind down',
      body: 'Consistent sleep improves your Consistency Score. Try to sleep now.',
      categoryIdentifier: 'SLEEP_REMINDER',
      sound: true,
      vibrate: [0, 300, 200, 300],
      ...(Platform.OS === 'android' && { channelId: 'sleep_reminders' }),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
}

// ─── Campus Mode: Pre-Class Water Reminder ──────────────────────────────────
// Called by Campus Routine Engine when Campus Mode is enabled.
// Schedules a water reminder 10 minutes before each class.

export async function scheduleCampusReminders(classes: { day: string; start: string; end: string; subject: string }[]) {
  if (Platform.OS === 'web') return;
  const today = days[new Date().getDay()];
  const todayClasses = classes.filter(c => c.day === today);

  for (const cls of todayClasses) {
    const [h, m] = cls.start.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m - 10, 0, 0); // 10 minutes before class

    if (target < new Date()) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📚 ${cls.subject} in 10 minutes`,
        body: "Drink water before your class and pack a snack if it's a long session.",
        sound: true,
        vibrate: [0, 250, 250, 250],
        ...(Platform.OS === 'android' && { channelId: 'campus_reminders' }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
    });
  }
}

// ─── Routine AI Notifications ────────────────────────────────────────────────
export async function scheduleRoutineNotifications(plan: any) {
  if (Platform.OS === 'web') return;

  // Notification 1 - Morning
  // Extract time from morning_tip if possible, else 07:30
  let morningTarget = new Date();
  morningTarget.setHours(7, 30, 0, 0);

  const timeMatch = plan.morning_tip?.match(/(\d{1,2}:\d{2}(?:\s?[aApP][mM])?)/);
  if (timeMatch) {
    let tStr = timeMatch[1].toLowerCase().replace(/\s/g, '');
    let h = 0, m = 0;
    if (tStr.includes('am') || tStr.includes('pm')) {
      const pm = tStr.includes('pm');
      tStr = tStr.replace('am', '').replace('pm', '');
      [h, m] = tStr.split(':').map(Number);
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    } else {
      [h, m] = tStr.split(':').map(Number);
    }
    const tempDate = new Date();
    tempDate.setHours(h, m, 0, 0);
    // 30 mins before
    morningTarget = new Date(tempDate.getTime() - 30 * 60000);
  }

  if (morningTarget > new Date() && plan.morning_tip) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'routine_morning',
      content: {
        title: "☀️ Morning Guide",
        body: plan.morning_tip,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: morningTarget },
    });
  }

  // Notification 2 - Afternoon Hydration
  let hydroTarget = new Date();
  hydroTarget.setHours(14, 0, 0, 0);
  if (hydroTarget > new Date() && plan.hydration_tip && plan.hydration_tip.includes("behind")) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'routine_hydration',
      content: {
        title: "💧 Hydration Check",
        body: plan.hydration_tip,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: hydroTarget },
    });
  }

  // Notification 3 - Sleep Reminder
  let sleepTarget = new Date();
  const sleepTimeMatch = plan.sleep_tip?.match(/bed by (\d{1,2}:\d{2}\s?[aApP][mM])/i);
  if (sleepTimeMatch) {
    let sStr = sleepTimeMatch[1].toLowerCase().replace(/\s/g, '');
    let sh = 0, sm = 0;
    const pm = sStr.includes('pm');
      sStr = sStr.replace('am', '').replace('pm', '');
      [sh, sm] = sStr.split(':').map(Number);
      if (pm && sh < 12) sh += 12;
      if (!pm && sh === 12) sh = 0;
    
    sleepTarget.setHours(sh, sm, 0, 0);
    // 60 mins before
    sleepTarget = new Date(sleepTarget.getTime() - 60 * 60000);
  } else {
    sleepTarget.setHours(22, 0, 0, 0);
  }

  if (sleepTarget > new Date() && plan.sleep_tip) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'routine_sleep',
      content: {
        title: "🌙 Sleep Prep",
        body: plan.sleep_tip,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: sleepTarget },
    });
  }

  if (plan.exam_mode && plan.focus_tip) {
    let focusTarget = new Date();
    focusTarget.setHours(22, 0, 0, 0);
    if (focusTarget > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'routine_focus',
        content: {
          title: "🎯 Exam Focus",
          body: plan.focus_tip,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: focusTarget },
      });
    }
  }
}
