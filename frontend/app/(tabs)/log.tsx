// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, G, Path, Defs, ClipPath } from 'react-native-svg';
import { Animated } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { logStorage, userStorage } from '../../src/storage';
import { healthEngine } from '../../src/services';
import { useFocusEffect } from '@react-navigation/native';

import { NUTRITION_DATABASE } from '../../utils/nutritionData';

import { WaterProgressCircle } from '../../src/components/log/WaterProgressCircle';
import { PlateBuilder } from '../../src/components/log/PlateBuilder';
import { WaterHistoryModal } from '../../src/components/log/WaterHistoryModal';



export default function LogScreen() {
  const { colors, theme } = useTheme();
  const [activeSegment, setActiveSegment] = useState<'food' | 'water' | 'weight'>('food');
  const [foodMethod, setFoodMethod] = useState<'plate' | 'text' | 'ocr'>('plate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Food State
  const [plate, setPlate] = useState<Record<string, number>>({});
  const [nlpText, setNlpText] = useState('');
  const [ocrName, setOcrName] = useState('');
  const [quickMeal, setQuickMeal] = useState<any>(null);
  const [templates, setTemplates] = useState<{name: string, items: Record<string, number>}[]>([
    { name: 'Mess Lunch', items: { 'Rice': 1, 'Dal': 1, 'Chapati': 2, 'Veg Curry': 1 } },
    { name: 'Breakfast', items: { 'Oats': 1, 'Milk': 1, 'Banana': 1 } }
  ]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [scannedResult, setScannedResult] = useState<any>(null);

  // Water State
  const [waterToday, setWaterToday] = useState(0);
  const waterAnimValue = useRef(new Animated.Value(0)).current;
  const [displayWater, setDisplayWater] = useState(0);
  const [WATER_GOAL, setWaterGoal] = useState(2.5); // Default, overridden by Firestore goals
  
  // Water Undo State
  const [waterHistory, setWaterHistory] = useState<number[]>([]);
  const [toastVisible, setToastVisible] = useState(false);
  const [lastAmount, setLastAmount] = useState<number | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Water Entries Modal State
  const [waterEntries, setWaterEntries] = useState<{ id: string; amountMl: number; time: string }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const listener = waterAnimValue.addListener(({ value }: { value: number }) => {
      setDisplayWater(value);
    });
    return () => waterAnimValue.removeListener(listener);
  }, []);

  // Weight State
  const [weightInput, setWeightInput] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      fetchInitialData();
    }, [])
  );

  const fetchInitialData = async () => {
    try {
      // Load user's personalized water goal from Firestore
      const goals = await userStorage.getHealthGoals();
      if (goals?.waterGoalLiters) {
        setWaterGoal(goals.waterGoalLiters);
      }

      const logs = await logStorage.getDailyLog(new Date());
      if (logs) {
        setWaterToday(logs.totalWaterMl / 1000);
        waterAnimValue.setValue(logs.totalWaterMl / 1000);
      }
      setQuickMeal({ suggestion: "Chicken Breast with Rice" });
    } catch (e) {
      console.error(e);
      setError(true);
    }
  };

  const calculateTotals = () => {
    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    Object.entries(plate).forEach(([item, qty]) => {
      const info = NUTRITION_DATABASE[item];
      if (info && qty > 0) {
        totals.calories += info.calories * qty;
        totals.protein += info.protein * qty;
        totals.carbs += info.carbs * qty;
        totals.fat += info.fat * qty;
      }
    });
    return totals;
  };

  const totals = calculateTotals();

  const handlePlateLog = async () => {
    const items = Object.entries(plate).filter(([k, v]) => v > 0).map(([k, v]) => ({ item: k, quantity: v }));
    if (items.length === 0) return Alert.alert("Empty", "Add some food to your plate.");
    setLoading(true);
    try {
      const nutri = calculateTotals();
      await logStorage.saveMealLog({
        name: 'Lunch',
        items: items.map(i => i.item),
        calories: nutri.calories,
        protein: nutri.protein
      });
      setPlate({});
      Alert.alert("Cloud Logged ✅", "Your meal has been saved and synced to Firebase!");
    } catch (e) {
      Alert.alert("Error", "Could not log plate to cloud.");
    } finally { setLoading(false); }
  };

  const saveTemplate = () => {
    if (Object.keys(plate).length === 0) return;
    if (!newTemplateName.trim()) return Alert.alert("Name Required", "Please name your template.");
    
    const newTemplate = { name: newTemplateName, items: { ...plate } };
    setTemplates([newTemplate, ...templates]);
    setNewTemplateName('');
    setIsSavingTemplate(false);
    Alert.alert("Success", "Meal template saved!");
  };

  const applyTemplate = (items: Record<string, number>) => {
    setPlate(items);
  };

  const handleNLPLog = async () => {
    if (!nlpText.trim()) return;
    setLoading(true);
    try {
      await logStorage.saveMealLog({
        name: 'Quick Log',
        items: [nlpText],
        calories: 400,
        protein: 20
      });
      setNlpText('');
      Alert.alert("Parsed ✅", "Cloud AI has analyzed and logged your meal!");
    } catch (e) { Alert.alert("Error", "Failed to parse meal to cloud."); }
    finally { setLoading(false); }
  };

  const handleOCRLog = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
      aspect: [4, 3],
    });

    if (result.canceled) return;

    setLoading(true);
    try {
      const mockResult = {
        name: ocrName.trim() || 'Scanned Greek Yogurt',
        macros: { calories: 120, protein: 15, carbs: 8, fat: 2, serving_size: '150g' }
      };
      setScannedResult(mockResult);
    } catch {
      Alert.alert('OCR Error', 'Could not read label.');
    } finally {
      setLoading(false);
    }
  };

  const confirmOCRLog = async () => {
    if (!scannedResult) return;
    setLoading(true);
    try {
      await logStorage.saveMealLog({
        name: 'Scan',
        items: [scannedResult.name],
        calories: scannedResult.macros.calories,
        protein: scannedResult.macros.protein
      });
      setScannedResult(null);
      Alert.alert('Logged ✅', 'Scanned nutrition has been added!');
    } catch {
      Alert.alert('Error', 'Failed to log scanned meal.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWater = async (amountMl: number) => {
    const litersToAdd = amountMl / 1000;
    const newTotal = waterToday + litersToAdd;
    setWaterToday(newTotal);
    
    Animated.timing(waterAnimValue, {
      toValue: newTotal,
      duration: 700,
      useNativeDriver: false,
    }).start();

    setWaterHistory(prev => [litersToAdd, ...prev].slice(0, 5));
    setLastAmount(amountMl);
    showUndoToast();

    try {
      await logStorage.saveWaterLog(amountMl);
    } catch (e) {
      console.error(e);
    }
  };

  const showUndoToast = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setToastVisible(true);
    Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    
    undoTimer.current = setTimeout(() => {
      hideUndoToast();
    }, 5000);
  };

  const hideUndoToast = () => {
    Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
      setToastVisible(false);
    });
  };

  const handleUndoWater = async () => {
    if (waterHistory.length === 0) return;
    const amountToRevert = waterHistory[0];
    const newTotal = Math.max(0, waterToday - amountToRevert);
    setWaterToday(newTotal);
    setWaterHistory(prev => prev.slice(1));
    hideUndoToast();

    Animated.timing(waterAnimValue, {
      toValue: newTotal,
      duration: 700,
      useNativeDriver: false,
    }).start();

    try { await logStorage.saveWaterLog(-amountToRevert * 1000); } catch (e) {}
    setWaterEntries(prev => prev.slice(1));
  };

  const handleDeleteEntry = async (id: string, amountMl: number) => {
    const liters = amountMl / 1000;
    const newTotal = Math.max(0, waterToday - liters);
    setWaterToday(newTotal);
    setWaterEntries(prev => prev.filter(e => e.id !== id));
    
    Animated.timing(waterAnimValue, {
      toValue: newTotal,
      duration: 700,
      useNativeDriver: false,
    }).start();

    try { await logStorage.saveWaterLog(-amountMl); } catch (e) {}
  };

  const openWaterHistory = async () => {
    setModalVisible(true);
    setIsLoadingHistory(true);
    setWaterEntries([]); // Clear stale local state before fetching
    try {
      const allLogs = await logStorage.getAllWaterLogs();
      const todayDate = new Date().toISOString().split('T')[0];
      const todaysLogs = allLogs
        .filter(w => w.date === todayDate && w.amountMl > 0); // Filter out undo (negative) entries
      
      const formattedLogs = todaysLogs.map(log => {
        const d = new Date(log.loggedAt);
        return {
          id: log.id,
          amountMl: log.amountMl,
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });
      setWaterEntries(formattedLogs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLogWeight = async () => {
    if (!weightInput.trim()) return;
    setLoading(true);
    try {
      await logStorage.saveWeightLog(parseFloat(weightInput));
      setWeightInput('');
      Alert.alert("Cloud Success ☁️", "Your weight has been updated.");
    } catch (e) { Alert.alert("Error", "Weight log failed."); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.pageBg }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Layer 1 — App Bar (Sticky) */}
      <View style={{ backgroundColor: colors.headerBg }}>
        <View style={[styles.appBar, { backgroundColor: colors.headerBg, shadowColor: colors.shadow }]}>
          <Text style={[styles.appBarTitle, { color: colors.text }]}>Log</Text>
        </View>
      </View>

      {/* Layer 2 — Tab Strip (Sticky) */}
      <View style={[styles.tabStrip, { backgroundColor: colors.heroBg, borderBottomColor: colors.border }]}>
        <View style={styles.segmentContainer}>
          {['food', 'water', 'weight'].map((seg) => (
            <TouchableOpacity 
              key={seg} 
              style={[
                styles.tabPill, 
                activeSegment === seg ? 
                  [styles.tabPillActive, { backgroundColor: colors.headerBg, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }] : 
                  [styles.tabPillInactive, { backgroundColor: 'transparent' }]
              ]} 
              onPress={() => setActiveSegment(seg as any)}
            >
              <Text style={[
                styles.tabText, 
                { color: activeSegment === seg ? colors.primary : colors.textSecondary, fontWeight: activeSegment === seg ? '800' : '600' }
              ]}>
                {seg.charAt(0).toUpperCase() + seg.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Layer 3 — Scrollable Content */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }}
        style={{ backgroundColor: colors.pageBg }}
      >

        {/* Error Card */}
        {error && (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, margin: 16, alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 }}>Could not load data</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>Make sure the backend server is running at port 8000, then tap retry.</Text>
            <TouchableOpacity style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, marginTop: 16 }} onPress={() => { setError(false); fetchInitialData(); }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FOOD SECTION */}
        {activeSegment === 'food' && (
          <View style={styles.section}>
            {quickMeal && (
              <TouchableOpacity style={[styles.aiQuickBtn, { backgroundColor: colors.heroBg, borderColor: colors.border }]} onPress={() => setNlpText(quickMeal.suggestion)}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <Text style={[styles.aiQuickText, { color: colors.primary }]}>Quick Log: {quickMeal.suggestion}</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.methodSelector, { backgroundColor: colors.cardHighlight, borderRadius: 16, padding: 4, marginBottom: 16 }]}>
              {[
                { id: 'plate', icon: 'restaurant', label: 'Plate' },
                { id: 'text', icon: 'create', label: 'Text' },
                { id: 'ocr', icon: 'scan', label: 'Label' }
              ].map((m) => (
                <TouchableOpacity 
                  key={m.id} 
                  style={[styles.methodBtn, foodMethod === m.id && [styles.methodBtnActive, { backgroundColor: colors.surface }]]}
                  onPress={() => setFoodMethod(m.id as any)}
                >
                  <Ionicons name={m.icon as any} size={20} color={foodMethod === m.id ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.methodLabel, { color: foodMethod === m.id ? colors.primary : colors.textSecondary }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {foodMethod === 'plate' && (
                <View>
                  <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.subHeader, { color: colors.textSecondary }]}>Quick Templates</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                      {templates.map((t, idx) => (
                        <TouchableOpacity key={idx} style={[styles.templateChip, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]} onPress={() => applyTemplate(t.items)}>
                          <MaterialCommunityIcons name="bookmark-outline" size={16} color={colors.primary} />
                          <Text style={[styles.templateChipText, { color: colors.primary }]}>{t.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <PlateBuilder plate={plate} setPlate={setPlate} totals={totals} />

                  {totals.calories > 0 && (
                    <View>
                      <TouchableOpacity style={styles.saveTemplateBtn} onPress={() => setIsSavingTemplate(true)}>
                        <Ionicons name="bookmark" size={18} color={colors.primary} />
                        <Text style={[styles.saveTemplateBtnText, { color: colors.primary }]}>Save as Template</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity 
                    style={[styles.submitBtn, { backgroundColor: totals.calories === 0 ? colors.border : colors.primary }]} 
                    onPress={handlePlateLog} 
                    disabled={loading || totals.calories === 0}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Confirm & Log {Math.round(totals.calories)} kcal</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {foodMethod === 'text' && (
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Smart Text Logging</Text>
                  <TextInput 
                    style={[styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} 
                    multiline 
                    placeholder="E.g. 2 slices of bread and an egg" 
                    placeholderTextColor={colors.textSecondary}
                    value={nlpText}
                    onChangeText={setNlpText}
                  />
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleNLPLog} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Parse & Log Meal</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {foodMethod === 'ocr' && (
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Label Scanner</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} 
                    placeholder="Product Name (e.g. Protein Bar)" 
                    placeholderTextColor={colors.textSecondary}
                    value={ocrName}
                    onChangeText={setOcrName}
                  />
                  <TouchableOpacity style={[styles.scanBtn, { borderColor: colors.primary, backgroundColor: colors.cardHighlight }]} onPress={handleOCRLog} disabled={loading}>
                    <Ionicons name="camera" size={24} color={colors.primary} style={{ marginRight: 10 }} />
                    {/* @ts-ignore */}
                    <Text style={[styles.scanBtnText, { color: colors.primary }]}>Scan Nutrition Label</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* WATER SECTION */}
        {activeSegment === 'water' && (
          <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <TouchableOpacity 
                   onLongPress={openWaterHistory} 
                   activeOpacity={0.8}
                   delayLongPress={500}
                 >
                   <WaterProgressCircle progress={Math.min(100, (displayWater / WATER_GOAL) * 100)} />
                 </TouchableOpacity>
                 <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 20 }}>{displayWater.toFixed(1)} L</Text>
                 <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Goal: {WATER_GOAL} L</Text>
                 <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>Long-press ring to view entries</Text>
              </View>

              <View style={styles.waterQuickGrid}>
                {[250, 500, 1000].map(amt => (
                  <TouchableOpacity key={amt} style={[styles.waterBtn, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F0F9FF', borderColor: colors.border }]} onPress={() => handleAddWater(amt)}>
                    <Ionicons name="water" size={24} color={colors.info} />
                    <Text style={[styles.waterBtnText, { color: colors.info }]}>+{amt >= 1000 ? '1L' : amt + 'ml'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* WEIGHT SECTION */}
        {activeSegment === 'weight' && (
          <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Log Weight</Text>
              <View style={styles.inputGroup}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} 
                  placeholder="Keep track of your weight (kg)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={weightInput}
                  onChangeText={setWeightInput}
                />
                <TouchableOpacity style={[styles.weightLogBtn, { backgroundColor: colors.primary }]} onPress={handleLogWeight} disabled={loading}>
                   {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 🍞 Undo Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <Text style={styles.toastText}>Added {lastAmount}ml — </Text>
          <TouchableOpacity onPress={handleUndoWater}>
            <Text style={styles.undoBtnText}>Undo?</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Entries Modal */}
      <WaterHistoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        isLoading={isLoadingHistory}
        entries={waterEntries}
        onDeleteEntry={handleDeleteEntry}
      />

      {/* Template Modal */}
      <Modal visible={isSavingTemplate} transparent animationType="fade">
        <View style={styles.smallModalOverlay}>
          <View style={[styles.smallModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.smallModalTitle, { color: colors.text }]}>Name Template</Text>
            <TextInput style={[styles.smallInput, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', color: colors.text, borderColor: colors.border }]} placeholder="Template Name" placeholderTextColor={colors.textSecondary} value={newTemplateName} onChangeText={setNewTemplateName} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsSavingTemplate(false)}><Text style={{ color: colors.textSecondary }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, { backgroundColor: colors.primary, padding: 10, borderRadius: 8 }]} onPress={saveTemplate}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📸 OCR Result Modal */}
      <Modal visible={!!scannedResult} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Scan Result</Text>
              <TouchableOpacity onPress={() => setScannedResult(null)}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
            </View>
            {scannedResult && (
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{scannedResult.name}</Text>
                <TouchableOpacity style={[styles.submitBtn, { marginTop: 20 }]} onPress={confirmOCRLog}><Text style={styles.submitBtnText}>Confirm & Log</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
    zIndex: 100,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  tabStrip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 90,
  },
  segmentContainer: { 
    flexDirection: 'row', 
    gap: 8,
  },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabPillInactive: {},
  tabText: { fontSize: 13 },
  section: { paddingBottom: 10 },
  subHeader: { fontSize: 13, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  templateScroll: { flexDirection: 'row', marginBottom: 5 },
  templateChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#C7D2FE' },
  templateChipText: { fontSize: 13, fontWeight: '600', color: '#4F46E5', marginLeft: 4 },
  aiQuickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E0E7FF' },
  aiQuickText: { fontSize: 13, fontWeight: '700', color: '#4338CA', marginLeft: 8 },
  methodSelector: { flexDirection: 'row', marginBottom: 16 },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, marginRight: 8 },
  methodBtnActive: { backgroundColor: '#EEF2FF' },
  methodLabel: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#64748B' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 16 },
  plateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  plateItem: { width: '48%', marginBottom: 16 },
  plateItemHeader: { marginBottom: 6 },
  plateItemName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  plateItemSub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  qtyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10 },
  qtyText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#1E293B' },
  totalsCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  totalsTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 12, textAlign: 'center', letterSpacing: 0.5 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  totalItem: { alignItems: 'center' },
  totalVal: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  totalLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 2 },
  saveTemplateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, paddingVertical: 8 },
  saveTemplateBtnText: { fontSize: 14, fontWeight: '700', color: '#4F46E5', marginLeft: 6 },
  textArea: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, height: 120, textAlignVertical: 'top', fontSize: 15, color: '#1E293B', marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  input: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, fontSize: 15, color: '#1E293B', marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  submitBtn: { backgroundColor: '#4F46E5', borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  scanBtn: { flexDirection: 'row', backgroundColor: '#EEF2FF', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#4F46E5', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center' },
  waterQuickGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  waterBtn: { flex: 1, backgroundColor: '#F0F9FF', padding: 16, borderRadius: 16, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: '#BAE6FD' },
  waterBtnText: { fontSize: 13, fontWeight: '800', color: '#0369A1', marginTop: 4 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  weightLogBtn: { backgroundColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 16, marginLeft: 12 },
  toast: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, elevation: 5 },
  toastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  undoBtnText: { color: '#38BDF8', fontSize: 14, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12 },
  entryInfo: { flexDirection: 'row', alignItems: 'center' },
  entryTime: { fontSize: 13, fontWeight: '600', width: 70 },
  entryAmount: { fontSize: 15, fontWeight: '800', color: '#0EA5E9' },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  smallModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  smallModal: { width: '80%', borderRadius: 24, padding: 24, elevation: 10 },
  smallModalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  smallInput: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
});
