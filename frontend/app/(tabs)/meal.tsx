import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { offlineGet, offlinePost } from '../utils/offlineSync';

const AVAILABLE_FOODS = ["Rice", "Dal", "Chapati", "Paneer", "Curd", "Vegetable curry", "Oats", "Milk", "Banana", "Peanut butter"];

export default function MealLog() {
  const [activeTab, setActiveTab] = useState('plate'); // 'plate', 'text', 'ocr'
  const [meals, setMeals] = useState<any[]>([]);
  
  // Plate State
  const [plate, setPlate] = useState<Record<string, number>>({});
  
  // NLP State
  const [nlpText, setNlpText] = useState('');
  
  // OCR State
  const [ocrFoodName, setOcrFoodName] = useState('');
  const [customFoods, setCustomFoods] = useState<any[]>([]);

  // AI Intelligence State
  const [quickMeal, setQuickMeal] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [snackIntelligence, setSnackIntelligence] = useState<any>(null);

  // Personal Food Database
  const [savedMeals, setSavedMeals] = useState<any[]>([]);
  const [savedMealName, setSavedMealName] = useState<string>('');

  // Initialize Custom Foods on mount
  useEffect(() => {
    fetchCustomFoods();
    fetchIntelligence();
  }, []);

  const fetchCustomFoods = async () => {
    try {
      const dbRes = await offlineGet('http://10.0.2.2:8000/users/user123/dashboard');
      if (dbRes?.data?.custom_foods) setCustomFoods(dbRes.data.custom_foods);
      
      const savedRes = await offlineGet('http://10.0.2.2:8000/users/user123/food/saved_meals');
      if (savedRes?.data?.saved_meals) setSavedMeals(savedRes.data.saved_meals);
    } catch(e) {}
  };

  const fetchIntelligence = async () => {
    try {
      const [qmRes, suggRes, snackRes] = await Promise.all([
        offlineGet('http://10.0.2.2:8000/users/user123/intelligence/quick_meal'),
        offlineGet('http://10.0.2.2:8000/users/user123/intelligence/suggestions'),
        offlineGet('http://10.0.2.2:8000/users/user123/intelligence/snacks')
      ]);
      setQuickMeal(qmRes.data);
      setSuggestions(suggRes.data);
      if (snackRes.data.status === 'success') {
        setSnackIntelligence(snackRes.data);
      }
    } catch(e) {}
  };

  const handlePlateSubmit = async () => {
    const items = Object.entries(plate).filter(([k,v]) => v > 0).map(([k,v]) => ({item: k, quantity: v}));
    if (items.length === 0) return Alert.alert("Empty Plate", "Please add some food first.");
    
    try {
      const res = await offlinePost('http://10.0.2.2:8000/users/user123/meal/plate', { items });
      if (res.data?.meal) {
        setMeals([res.data.meal, ...meals]);
      }
      setPlate({});
      Alert.alert("Success", "Plate logged!");
    } catch(e) {
      Alert.alert("Error logging plate");
    }
  };

  const handleSaveMeal = async () => {
    const items = Object.keys(plate).filter(k => plate[k] > 0).map(k => ({ item: k, quantity: plate[k] }));
    if (items.length === 0) return Alert.alert("Empty", "Select items to save");
    if (!savedMealName.trim()) return Alert.alert("Required", "Provide a name for this meal");

    try {
      const res = await offlinePost('http://10.0.2.2:8000/users/user123/food/saved_meals', { name: savedMealName, items });
      if (res.data?.saved_meal) {
        setSavedMeals([...savedMeals, res.data.saved_meal]);
        setSavedMealName('');
        Alert.alert("Success", "Meal blueprint saved to database!");
      }
    } catch (e) {
      Alert.alert("Error saving meal blueprint");
    }
  };

  const handleQuickAddSavedMeal = async (meal: any) => {
    try {
      // Create identical items array for the plate builder endpoint to reuse logic
      const textToSubmit = meal.items.join(" and ");
      const res = await offlinePost('http://10.0.2.2:8000/users/user123/meal/nlp', { text: textToSubmit });
      if (res.data?.meal) {
        setMeals([{...res.data.meal, name: meal.name}, ...meals]);
      }
      fetchIntelligence(); // Re-eval macro deficites instantly
      Alert.alert("Success", `${meal.name} quick logged!`);
    } catch(e) {
      Alert.alert("Error logging bundle");
    }
  };

  const handleNLPSubmit = async (overrideText: string | null = null) => {
    const textToSubmit = overrideText || nlpText;
    if(!textToSubmit.trim()) return;
    try {
      const res = await offlinePost('http://10.0.2.2:8000/users/user123/meal/nlp', { text: textToSubmit });
      if (res.data?.meal) {
        setMeals([res.data.meal, ...meals]);
      }
      if (!overrideText) setNlpText('');
      Alert.alert("Success", "Meal parsed and logged!");
    } catch(e) {
      Alert.alert("Error processing text");
    }
  };

  const handleOCRSubmit = async (overrideName = null) => {
    const name = overrideName || ocrFoodName;
    if(!name.trim()) return Alert.alert("Required", "Please enter the packaged food name");
    
    // Simulate image uploading if this isn't a "Quick Add"
    if (!overrideName) {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
      });

      if (result.canceled) return;
    }

    try {
      // Mocking base64 string
      const res = await offlinePost('http://10.0.2.2:8000/users/user123/meal/ocr', { 
        food_name: name,
        image_base64: "dummy_base64_string"
      });
      if (res.data?.meal) {
        setMeals([res.data.meal, ...meals]);
      }
      setOcrFoodName('');
      fetchCustomFoods(); // Refresh quick-add list
      fetchIntelligence(); // Refresh snacks based on new macros
      Alert.alert("Success", overrideName ? "Quick-added logged!" : "Label Scanned & Saved!");
    } catch(e) {
      Alert.alert("Error parsing label");
    }
  };

  const handleQuickAddSnack = async (snackName: string) => {
    try {
      const res = await offlinePost('http://10.0.2.2:8000/users/user123/meal/nlp', { text: `1 serving of ${snackName}` });
      if (res.data?.meal) {
        setMeals([res.data.meal, ...meals]);
      }
      fetchIntelligence(); // Refresh macro deficits instantly
      Alert.alert("Success", `${snackName} logged!`);
    } catch(e) {
      Alert.alert("Error", "Could not log snack");
    }
  };

  const renderPlateItem = (food: string) => (
    <View key={food} style={styles.plateItemCard}>
      <Text style={styles.plateItemName}>{food}</Text>
      <View style={styles.qtyControls}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => setPlate({...plate, [food]: Math.max((plate[food]||0)-1, 0)})}>
          <Ionicons name="remove" size={18} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.qtyCount}>{plate[food] || 0}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => setPlate({...plate, [food]: (plate[food]||0)+1})}>
          <Ionicons name="add" size={18} color="#1f2937" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      {/* AI Quick Meal Predictor */}
      {quickMeal && (
        <View style={styles.quickMealWrapper}>
          <Text style={styles.quickMealHeader}>AI Quick Add</Text>
          <TouchableOpacity 
            style={styles.quickMealCard} 
            onPress={() => handleNLPSubmit(quickMeal.suggestion)}
          >
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Ionicons name="flash" size={20} color="#f59e0b" style={{marginRight: 8}}/>
               <Text style={styles.quickMealTitle}>Log {quickMeal.suggestion}</Text>
            </View>
            <Ionicons name="add-circle" size={26} color="#10b981" />
          </TouchableOpacity>
        </View>
      )}

      {/* Smart Snack Suggestions */}
      {snackIntelligence && snackIntelligence.deficit.protein > 0 && (
        <View style={styles.snackWrapper}>
          <View style={styles.snackHeaderRow}>
            <Text style={styles.snackHeader}>Smart Snack Suggestions</Text>
            <Text style={styles.snackMacroText}>
              Goal: {snackIntelligence.current.protein} / {snackIntelligence.current.protein_target}g Protein
            </Text>
          </View>
          <Text style={styles.snackMessage}>{snackIntelligence.message}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.snackScroll}>
            {snackIntelligence.suggestions.map((snack: any, i: number) => (
              <View key={i} style={styles.snackChip}>
                <View>
                  <Text style={styles.snackName}>{snack.name}</Text>
                  <Text style={styles.snackMacros}>{snack.calories} kcal • {snack.protein}g P</Text>
                </View>
                <TouchableOpacity style={styles.snackAddBtn} onPress={() => handleQuickAddSnack(snack.name)}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.snackAddText}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tab Router */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'plate' && styles.activeTab]} onPress={() => setActiveTab('plate')}>
          <Ionicons name="restaurant-outline" size={20} color={activeTab === 'plate' ? '#fff' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'plate' && styles.activeTabText]}>Plate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'text' && styles.activeTab]} onPress={() => setActiveTab('text')}>
          <Ionicons name="chatbox-ellipses-outline" size={20} color={activeTab === 'text' ? '#fff' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'text' && styles.activeTabText]}>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'ocr' && styles.activeTab]} onPress={() => setActiveTab('ocr')}>
          <Ionicons name="scan-outline" size={20} color={activeTab === 'ocr' ? '#fff' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'ocr' && styles.activeTabText]}>Scan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>

        {/* My Saved Meals (Personal DB) */}
        {savedMeals.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.quickMealHeader}>MY SAVED MEALS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16 }}>
              {savedMeals.map((m: any, i: number) => (
                <View key={i} style={[styles.snackCard, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe', width: 220, marginRight: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Ionicons name="bookmark-outline" size={18} color="#4f46e5" style={{ marginRight: 6 }} />
                    <Text style={[styles.snackName, { color: '#312e81' }]} numberOfLines={1}>{m.name}</Text>
                  </View>
                  <Text style={[styles.snackMacros, { color: '#4f46e5' }]} numberOfLines={1}>{m.items?.join(", ")}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <Text style={[styles.snackMacros, { color: '#4338ca', fontWeight: 'bold' }]}>{m.calories}kcal • {m.protein}g P</Text>
                    <TouchableOpacity style={[styles.snackAddBtn, { backgroundColor: '#4f46e5' }]} onPress={() => handleQuickAddSavedMeal(m)}>
                      <Text style={styles.snackAddText}>Log</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI Mess Food Suggestions Banner */}
        {suggestions && (
          <View style={styles.suggestionBox}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                <Ionicons name="information-circle-outline" size={20} color="#ef4444" style={{marginRight: 6}}/>
                <Text style={styles.suggestionTitle}>{suggestions.message}</Text>
              </View>
              <Text style={styles.suggestionText}>Smart add suggestion: {suggestions.suggestions.join(", ")}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          
          {/* METHOD 1: PLATE BUILDER */}
          {activeTab === 'plate' && (
            <View>
              <Text style={styles.sectionTitle}>Mess Plate Builder</Text>
              <Text style={styles.sectionDesc}>Select quantities visually</Text>
              <View style={styles.plateGrid}>
                {AVAILABLE_FOODS.map(renderPlateItem)}
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={handlePlateSubmit}>
                <Text style={styles.submitBtnText}>Calculate & Log Plate</Text>
              </TouchableOpacity>
              
              <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderColor: '#e5e7eb' }}>
                <Text style={styles.sectionDesc}>Want to log this setup quickly next time?</Text>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <TextInput 
                    style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                    placeholder="E.g., Mess Lunch" 
                    value={savedMealName} 
                    onChangeText={setSavedMealName}
                  />
                  <TouchableOpacity style={[styles.submitBtn, { marginLeft: 10, paddingVertical: 0, paddingHorizontal: 20, backgroundColor: '#4f46e5' }]} onPress={handleSaveMeal}>
                    <Text style={styles.submitBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* METHOD 2: TEXT NLP */}
          {activeTab === 'text' && (
            <View>
              <Text style={styles.sectionTitle}>Smart Text Log</Text>
              <Text style={styles.sectionDesc}>Type what you ate (e.g., "2 chapati and rice")</Text>
              <TextInput 
                style={styles.textArea} 
                multiline 
                placeholder="What did you eat?" 
                value={nlpText} 
                onChangeText={setNlpText}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={() => handleNLPSubmit()}>
                <Ionicons name="sparkles" size={18} color="#fff" style={{marginRight: 6}}/>
                <Text style={styles.submitBtnText}>Parse & Log</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* METHOD 3: LABEL OCR */}
          {activeTab === 'ocr' && (
            <View>
              <Text style={styles.sectionTitle}>Scan Packaged Food</Text>
              <Text style={styles.sectionDesc}>Enter name and take a photo of the nutrition label</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Product Name (e.g., Lays Chips)" 
                value={ocrFoodName} 
                onChangeText={setOcrFoodName}
              />
              <TouchableOpacity style={styles.scanBtn} onPress={() => handleOCRSubmit()}>
                <Ionicons name="camera-outline" size={24} color="#3b82f6" style={{marginRight: 8}}/>
                <Text style={styles.scanBtnText}>Upload Label Image</Text>
              </TouchableOpacity>

              {customFoods.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionTitle}>Quick Add Saved Foods</Text>
                  {customFoods.map((f, i) => (
                    <TouchableOpacity key={i} style={styles.quickAddRow} onPress={() => handleOCRSubmit(f.name)}>
                      <Text style={styles.quickAddName}>{f.name}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={styles.quickAddMacros}>{f.calories}kcal • {f.protein}g</Text>
                        <Ionicons name="add-circle" size={24} color="#10b981" style={{marginLeft: 10}}/>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

        </View>

        {/* Recent Meals Feed */}
        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12, marginHorizontal: 16 }]}>Recently Logged</Text>
        {meals.map((item, idx) => (
          <View key={idx} style={styles.mealCard}>
            <View style={styles.mealIcon}>
              <Ionicons name="fast-food" size={24} color="#f59e0b" />
            </View>
            <View style={styles.mealInfo}>
              <Text style={styles.mealName}>{item.name}</Text>
              <Text style={styles.mealNutrients}>{item.calories} kcal • {item.protein}g protein</Text>
            </View>
          </View>
        ))}
        {meals.length === 0 && <Text style={{marginLeft:16, color: '#9ca3af'}}>No meals logged in this session yet.</Text>}
        <View style={{ height: 40 }} />
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  quickMealWrapper: { marginHorizontal: 16, marginTop: 10, marginBottom: 0 },
  quickMealHeader: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  quickMealCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#e5e7eb' },
  quickMealTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  
  // Snack Suggestions styles
  snackWrapper: { marginHorizontal: 16, marginTop: 16 },
  snackHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  snackHeader: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginLeft: 4 },
  snackMacroText: { fontSize: 12, fontWeight: '600', color: '#10b981' },
  snackMessage: { fontSize: 13, color: '#4b5563', marginLeft: 4, marginBottom: 10 },
  snackScroll: { paddingBottom: 8, paddingHorizontal: 4 },
  snackCard: { padding: 12, borderRadius: 12, borderWidth: 1 },
  snackChip: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 14, 
    marginRight: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    borderWidth: 1, 
    borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1
  },
  snackName: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  snackMacros: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  snackAddBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  snackAddText: { color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 2 },

  suggestionBox: { backgroundColor: '#fee2e2', marginHorizontal: 16, marginBottom: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#fca5a5' },
  suggestionTitle: { fontWeight: '700', color: '#b91c1c', fontSize: 15 },
  suggestionText: { color: '#991b1b', fontSize: 14, fontWeight: '500' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    margin: 16,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
  },
  activeTab: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#6b7280', marginLeft: 6 },
  activeTabText: { color: '#fff' },
  formCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  input: {
    backgroundColor: '#f9fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  textArea: {
    backgroundColor: '#f9fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top'
  },
  plateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  plateItemCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  plateItemName: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, textAlign: 'center' },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  qtyCount: { fontSize: 16, fontWeight: '700', marginHorizontal: 16, width: 20, textAlign: 'center' },
  submitBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  scanBtn: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    marginBottom: 8
  },
  scanBtnText: { color: '#3b82f6', fontSize: 16, fontWeight: '700' },
  quickAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6'
  },
  quickAddName: { fontSize: 15, fontWeight: '600', color: '#374151' },
  quickAddMacros: { fontSize: 13, color: '#6b7280' },
  mealCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  mealIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  mealNutrients: { fontSize: 13, color: '#6b7280' },
});
