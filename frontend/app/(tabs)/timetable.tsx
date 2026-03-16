import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, SafeAreaView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { userStorage } from '../../src/storage';
import { useTheme } from '../../src/context/ThemeContext';


const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const STORAGE_KEY = 'campusfuel_timetable';

interface ClassSlot {
  start: string;
  end: string;
  subject: string;
}

interface NewClass {
  day: string;
  subject: string;
  start: string;
  end: string;
}

export default function Timetable() {
  const { colors, theme } = useTheme();
  const [timetable, setTimetable] = useState<Record<string, ClassSlot[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'view' | 'add'>('view');

  // Manual entry state
  const [newClass, setNewClass] = useState<NewClass>({ day: 'Monday', subject: '', start: '09:00', end: '10:00' });

  useEffect(() => {
    loadTimetable();
  }, []);

  // Load from Firestore
  const loadTimetable = async () => {
    try {
      const data = await userStorage.getTimetable();
      setTimetable(data as any || {});
    } catch (e) {
      console.error("Timetable Load Error:", e);
    } finally { 
      setLoading(false); 
    }
  };


  const saveTimetable = async (updated: Record<string, ClassSlot[]>) => {
    setTimetable(updated);
    try {
      await userStorage.saveTimetable(updated);
    } catch (e) {
      Alert.alert("Sync Error", "Failed to save timetable to cloud. Changes kept locally.");
    }
  };

  const handleAddClass = async () => {
    if (!newClass.subject.trim()) {
      Alert.alert('Missing Info', 'Please enter a subject name.');
      return;
    }
    const updated = { ...timetable };
    if (!updated[newClass.day]) updated[newClass.day] = [];
    // Insert sorted by start time
    updated[newClass.day].push({ start: newClass.start, end: newClass.end, subject: newClass.subject.trim() });
    updated[newClass.day].sort((a, b) => a.start.localeCompare(b.start));
    await saveTimetable(updated);
    setNewClass({ day: newClass.day, subject: '', start: '09:00', end: '10:00' });
    setMode('view');
    Alert.alert('Class Added ✅', `${newClass.subject} added to ${newClass.day}.`);
  };

  const handleDeleteClass = (day: string, index: number) => {
    Alert.alert('Delete Class', 'Remove this class from your timetable?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = { ...timetable };
        updated[day] = updated[day].filter((_, i) => i !== index);
        if (updated[day].length === 0) delete updated[day];
        await saveTimetable(updated);
      }},
    ]);
  };

  const handleUploadPDF = async () => {
    Alert.alert("Cloud Upgrade", "Timetable PDF parsing is being migrated to Firebase AI Functions. Please use manual entry for now!");
  };

  const hasTimetable = Object.keys(timetable).some(d => timetable[d]?.length > 0);
  const bg = colors.pageBg;
  const card = colors.card;
  const border = colors.border;

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Class Timetable</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Smart health reminders during classes</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setMode(mode === 'add' ? 'view' : 'add')}
        >
          <Ionicons name={mode === 'add' ? 'close' : 'add'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>

        {/* Add Class Panel */}
        {mode === 'add' && (
          <View style={[styles.addPanel, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.addTitle, { color: colors.text }]}>Add New Class</Text>

            {/* Day Picker */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {DAYS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayChip, newClass.day === d && styles.dayChipActive,
                    newClass.day === d ? { backgroundColor: colors.primary } : { backgroundColor: colors.cardHighlight, borderColor: border }
                  ]}
                  onPress={() => setNewClass({ ...newClass, day: d })}
                >
                  <Text style={[styles.dayChipText, { color: newClass.day === d ? '#fff' : colors.textSecondary }]}>{d.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Subject */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Subject Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: border }]}
              placeholder="e.g. Data Structures"
              placeholderTextColor={colors.textSecondary}
              value={newClass.subject}
              onChangeText={t => setNewClass({ ...newClass, subject: t })}
            />

            {/* Time */}
            <View style={styles.timeRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Start Time</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: border }]}
                  placeholder="09:00"
                  placeholderTextColor={colors.textSecondary}
                  value={newClass.start}
                  onChangeText={t => setNewClass({ ...newClass, start: t })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>End Time</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: border }]}
                  placeholder="10:00"
                  placeholderTextColor={colors.textSecondary}
                  value={newClass.end}
                  onChangeText={t => setNewClass({ ...newClass, end: t })}
                />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAddClass}>
              <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Add to Timetable</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upload PDF Option */}
        <TouchableOpacity
          style={[styles.pdfBtn, { backgroundColor: colors.cardHighlight, borderColor: border }]}
          onPress={handleUploadPDF}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <MaterialCommunityIcons name="file-pdf-box" size={22} color={colors.primary} />
          )}
          <Text style={[styles.pdfBtnText, { color: colors.primary }]}>
            {uploading ? 'Parsing PDF with AI...' : 'Import Timetable from PDF'}
          </Text>
        </TouchableOpacity>

        {/* Empty State */}
        {!hasTimetable && !uploading && mode !== 'add' && (
          <View style={[styles.emptyCard, { backgroundColor: card, borderColor: border }]}>
            <MaterialCommunityIcons name="school-outline" size={52} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Classes Yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Add your classes manually or import a PDF to enable smart campus reminders.
            </Text>
          </View>
        )}

        {/* Timetable Display */}
        {hasTimetable && DAYS.map(day => {
          const classes = timetable[day];
          if (!classes || classes.length === 0) return null;
          return (
            <View key={day} style={{ marginBottom: 24 }}>
              <View style={styles.daySectionHeader}>
                <View style={[styles.dayDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.dayName, { color: colors.text }]}>{day}</Text>
                <Text style={[styles.dayCount, { color: colors.textSecondary }]}>{classes.length} class{classes.length > 1 ? 'es' : ''}</Text>
              </View>
              {classes.map((cls, i) => (
                <View key={i} style={[styles.classCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={[styles.classTimeBadge, { backgroundColor: colors.cardHighlight }]}>
                    <Text style={[styles.classTime, { color: colors.primary }]}>{cls.start}</Text>
                    <Text style={[styles.classTimeSep, { color: colors.textSecondary }]}>–</Text>
                    <Text style={[styles.classTime, { color: colors.primary }]}>{cls.end}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.className, { color: colors.text }]}>{cls.subject}</Text>
                    <Text style={[styles.classDuration, { color: colors.textSecondary }]}>
                      {(() => {
                        const [sh, sm] = cls.start.split(':').map(Number);
                        const [eh, em] = cls.end.split(':').map(Number);
                        const total = (eh * 60 + em) - (sh * 60 + sm);
                        return `${total} min`;
                      })()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteClass(day, i)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  addPanel: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1 },
  addTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: 12 },
  timeRow: { flexDirection: 'row' },
  dayChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8, borderWidth: 1 },
  dayChipActive: {},
  dayChipText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  pdfBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20, gap: 10 },
  pdfBtnText: { fontSize: 15, fontWeight: '600' },

  emptyCard: { borderRadius: 20, padding: 40, alignItems: 'center', borderWidth: 1 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },

  daySectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dayDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  dayName: { fontSize: 17, fontWeight: '800', flex: 1 },
  dayCount: { fontSize: 13, fontWeight: '600' },

  classCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  classTimeBadge: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, minWidth: 70 },
  classTime: { fontSize: 13, fontWeight: '800' },
  classTimeSep: { fontSize: 11 },
  className: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  classDuration: { fontSize: 12, fontWeight: '500' },
  deleteBtn: { padding: 6 },
});
