import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import axios from 'axios';

let dynamicTimetable: Record<string, any[]> = {};
let currentMode: string = "at_start";
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function fetchLiveTimetable() {
  try {
    const res = await axios.get('http://10.0.2.2:8000/users/user123/timetable');
    if (res.data && res.data.timetable) {
      dynamicTimetable = res.data.timetable;
    }
    
    // Also fetch settings to apply buffers
    const setRes = await axios.get('http://10.0.2.2:8000/users/user123/settings');
    if (setRes.data && setRes.data.notification_mode) {
      currentMode = setRes.data.notification_mode;
    }
  } catch (e) {
    console.log("Failed to fetch live timetable or settings", e);
  }
}

export async function requestPermissions() {
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
  if (Platform.OS !== 'web') {
    await Notifications.setNotificationCategoryAsync('WATER_REMINDER', [
      { identifier: 'complete', buttonTitle: 'Completed', options: { opensAppToForeground: false } },
      { identifier: 'skip', buttonTitle: 'Skip', options: { opensAppToForeground: false } },
      { identifier: 'remind_later', buttonTitle: 'Remind me later', options: { opensAppToForeground: false } }
    ]);

    await Notifications.setNotificationCategoryAsync('MEAL_REMINDER', [
      { identifier: 'complete', buttonTitle: 'Completed', options: { opensAppToForeground: false } },
      { identifier: 'skip', buttonTitle: 'Skip', options: { opensAppToForeground: false } },
      { identifier: 'remind_later', buttonTitle: 'Remind me later', options: { opensAppToForeground: false } }
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
  await fetchLiveTimetable();
  await Notifications.cancelAllScheduledNotificationsAsync();

  let baseTime = new Date();
  baseTime.setMinutes(0, 0, 0);
  
  for (let i = 1; i <= 6; i++) {
    const target = new Date(baseTime.getTime() + (i * 2 * 60 * 60 * 1000));
    
    if (target.getHours() >= 8 && target.getHours() <= 22) {
      const safeTime = findAvailableTime(target);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💧 Time to hydrate!",
          body: "Time to drink water. Add 500 ml now.",
          categoryIdentifier: 'WATER_REMINDER',
          sound: true,
          vibrate: [0, 250, 250, 250],
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: safeTime },
      });
    }
  }
}

export async function scheduleDeficitWarning(currentLiters: number) {
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
  // Assuming live timetable already fetched by water reminder wrapper
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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🍽️ Time for ${meal.name}!`,
        body: `Log your ${meal.name} to track your calories and protein.`,
        categoryIdentifier: 'MEAL_REMINDER',
        sound: true,
        vibrate: [0, 500, 200, 500],
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: safeTime },
    });
  }
}

export async function scheduleMessWarning() {
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
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: safeTime },
    });
  }
}
