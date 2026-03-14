import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';

export default function Timetable() {
  const [timetable, setTimetable] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchTimetable();
  }, []);

  const fetchTimetable = async () => {
    try {
      const res = await axios.get('http://10.0.2.2:8000/users/user123/timetable');
      if (res.data && res.data.timetable) {
        setTimetable(res.data.timetable);
      }
    } catch(e) {
      console.log('Failed to fetch timetable');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
      });

      if (result.canceled || result.assets.length === 0) return;

      const file = result.assets[0];
      setUploading(true);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: 'application/pdf',
      } as any);

      const res = await axios.post('http://10.0.2.2:8000/users/user123/timetable/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTimetable(res.data.timetable);
      Alert.alert('Success', 'Timetable parsed and saved!');
    } catch (e) {
      Alert.alert('Upload Error', 'Failed to upload or parse PDF.');
      console.log(e);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const hasTimetable = Object.keys(timetable).length > 0;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your Class Timetable</Text>
      <Text style={styles.subtitle}>We use this to remind you to eat meals and drink water between classes.</Text>

      {uploading && (
        <View style={{marginBottom: 20, alignItems: 'center'}}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={{color: '#6b7280', marginTop: 8}}>Extracting schedule from PDF with AI...</Text>
        </View>
      )}

      {!hasTimetable && !uploading ? (
        <View style={styles.uploadCard}>
          <Ionicons name="document-text-outline" size={64} color="#3b82f6" />
          <Text style={styles.uploadText}>No timetable found</Text>
          <Text style={styles.uploadSubtext}>Upload a PDF of your college timetable to enable smart reminders</Text>
          <TouchableOpacity style={styles.button} onPress={handleUpload}>
            <Text style={styles.buttonText}>Upload Timetable PDF</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {hasTimetable && !uploading && (
        <View style={styles.timetableList}>
          {days.map(day => {
            const classes = timetable[day];
            if (!classes || classes.length === 0) return null;
            
            return (
              <View key={day} style={styles.dayGroup}>
                <Text style={styles.dayTitle}>{day}</Text>
                {classes.map((cls, index) => (
                  <View key={index} style={styles.timeSlot}>
                    <View style={styles.timeLine}>
                      <View style={styles.timeDot} />
                      {index !== classes.length - 1 && <View style={styles.timePipe} />}
                    </View>
                    <View style={styles.timeContent}>
                      <Text style={styles.timeText}>{cls.start} &ndash; {cls.end}</Text>
                      <Text style={styles.subjectText}>Scheduled Class</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
          
          <TouchableOpacity style={styles.reuploadBtn} onPress={handleUpload}>
            <Text style={styles.reuploadBtnText}>Replace PDF</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9', padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#1f2937', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, marginBottom: 24 },
  uploadCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1
  },
  uploadText: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  uploadSubtext: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 10 },
  button: { backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  timetableList: { marginTop: 10, paddingBottom: 40 },
  dayGroup: { marginBottom: 24 },
  dayTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  timeSlot: { flexDirection: 'row', marginBottom: 0 },
  timeLine: { alignItems: 'center', marginRight: 16, width: 20 },
  timeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3b82f6', zIndex: 2, marginTop: 16 },
  timePipe: { width: 2, backgroundColor: '#e5e7eb', flex: 1, alignSelf: 'center', marginTop: -4 },
  timeContent: { backgroundColor: '#fff', padding: 16, borderRadius: 16, flex: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1, marginBottom: 16 },
  timeText: { fontSize: 14, fontWeight: '700', color: '#3b82f6', marginBottom: 4 },
  subjectText: { fontSize: 16, color: '#1f2937', fontWeight: '500' },
  reuploadBtn: { marginTop: 10, padding: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6', borderStyle: 'dashed' },
  reuploadBtnText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' }
});
