/**
 * timelineEngine.ts
 * Generates the Smart Daily Timeline from user schedule, meals, water reminders, and sleep time.
 * Screens call buildDailyTimeline() and getNextAction() — no logic in UI.
 */

export type TimelineItemType = 'meal' | 'water' | 'class' | 'sleep' | 'workout';

export interface TimelineItem {
  id: string;
  time: string;         // "HH:MM" 24-hr format
  label: string;
  type: TimelineItemType;
  icon: string;         // MaterialCommunityIcons name
  completed: boolean;
  minutesFromNow?: number;
}

export interface ClassSlot {
  start: string;        // "HH:MM"
  end: string;          // "HH:MM"
  subject: string;
}

/**
 * Builds the full daily timeline by merging:
 * - Fixed meal schedule
 * - Periodic water reminders
 * - User's class timetable
 * - Sleep reminder
 */
export function buildDailyTimeline(
  classSlots: ClassSlot[],
  sleepTargetHour: number = 23
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Fixed meals
  const meals: Omit<TimelineItem, 'completed' | 'minutesFromNow'>[] = [
    { id: 'breakfast',  time: '08:00', label: 'Breakfast',     type: 'meal',  icon: 'food-apple' },
    { id: 'lunch',      time: '13:00', label: 'Lunch',         type: 'meal',  icon: 'food' },
    { id: 'snack',      time: '17:00', label: 'Protein Shake', type: 'meal',  icon: 'bottle-tonic' },
    { id: 'dinner',     time: '20:00', label: 'Dinner',        type: 'meal',  icon: 'food-variant' },
  ];

  // Water reminders every 2 hours between 08:00 and 22:00
  const waterTimes = ['08:30', '10:30', '12:30', '14:30', '16:30', '18:30', '20:30', '22:00'];
  const waterItems: Omit<TimelineItem, 'completed' | 'minutesFromNow'>[] = waterTimes.map((t, i) => ({
    id: `water_${i}`,
    time: t,
    label: 'Drink Water (250ml)',
    type: 'water' as TimelineItemType,
    icon: 'water',
  }));

  // Classes from timetable
  const classItems: Omit<TimelineItem, 'completed' | 'minutesFromNow'>[] = classSlots.map((c, i) => ({
    id: `class_${i}`,
    time: c.start,
    label: c.subject || 'Class',
    type: 'class' as TimelineItemType,
    icon: 'book-open-outline',
  }));

  // Sleep reminder
  const sleepH = sleepTargetHour.toString().padStart(2, '0');
  const sleepItem: Omit<TimelineItem, 'completed' | 'minutesFromNow'> = {
    id: 'sleep',
    time: `${sleepH}:30`,
    label: 'Wind Down & Sleep',
    type: 'sleep',
    icon: 'sleep',
  };

  const allRaw = [...meals, ...waterItems, ...classItems, sleepItem];

  // Sort by time
  const sorted = allRaw.sort((a, b) => {
    const [ah, am] = a.time.split(':').map(Number);
    const [bh, bm] = b.time.split(':').map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  sorted.forEach(item => {
    const [h, m] = item.time.split(':').map(Number);
    const itemMinutes = h * 60 + m;
    const diff = itemMinutes - nowMinutes;
    items.push({
      ...item,
      completed: diff < -15,    // Completed if >15 mins in the past
      minutesFromNow: diff,
    });
  });

  return items;
}

/**
 * Returns the very next upcoming action (first item that is not yet completed).
 */
export function getNextAction(timeline: TimelineItem[]): TimelineItem | null {
  return timeline.find(t => !t.completed) ?? null;
}

/**
 * Format the time remaining for the "Next Action" card.
 */
export function formatTimeRemaining(minutesFromNow: number | undefined): string {
  if (minutesFromNow === undefined) return '';
  if (minutesFromNow <= 0) return 'Now';
  if (minutesFromNow < 60) return `in ${minutesFromNow} min`;
  const hours = Math.floor(minutesFromNow / 60);
  const mins  = minutesFromNow % 60;
  return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
}
