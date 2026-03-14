import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, SafeAreaView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

export default function MealTrackerTab() {
  const [activeTab, setActiveTab] = useState<'text' | 'plate' | 'scan_plate' | 'scan_label'>('scan_plate');
  const [loading, setLoading] = useState(false);
  
  // OCR & Plate Result State
  const [scanResult, setScanResult] = useState<any>(null);
  const [plateItems, setPlateItems] = useState<any[]>([]); // For plate confirmation loop
  const [originalPlateItems, setOriginalPlateItems] = useState<string[]>([]); // For AI Training log
  
  const handleScanPlate = async () => {
      setLoading(true);
      try {
          // Simulate taking photo & pushing b64 to backend
          const res = await axios.post('http://10.0.2.2:8000/users/user123/food/detect-plate', {
              image_base64: "dummy_image_data"
          });
          const detected = res.data.detected_foods.map((item: string) => ({ item, quantity: 1 }));
          
          setOriginalPlateItems(res.data.detected_foods);
          setPlateItems(detected);
          setScanResult({ type: 'plate', name: "AI Plate Scan" });
      } catch (e) {
          Alert.alert("Plate Detection Failed");
      } finally {
          setLoading(false);
      }
  };

  const handleScanLabelOCR = async () => {
      setLoading(true);
      try {
          const res = await axios.post('http://10.0.2.2:8000/users/user123/food/ocr-label', {
              food_name: "Packaged Product",
              image_base64: "dummy_image_data"
          });
          setScanResult({
             type: 'ocr',
             name: "Scanned Label Data",
             macros: res.data.macros
          });
          setPlateItems([]);
      } catch (e) {
          Alert.alert("OCR Failed");
      } finally {
          setLoading(false);
      }
  };

  const handleLogPlate = async () => {
      if (plateItems.length === 0) return;
      setLoading(true);
      try {
          await axios.post('http://10.0.2.2:8000/users/user123/food/log-detected', {
              items: plateItems,
              original_detection: originalPlateItems
          });
          Alert.alert("Success", `Plate logged and AI training synced.`);
          setScanResult(null);
          setPlateItems([]);
      } catch (e) {
          Alert.alert("Error logging plate");
      } finally {
          setLoading(false);
      }
  };

  const handleAddToLog = async () => {
       if (!scanResult) return;
       Alert.alert("Success", `Logged ${scanResult.name} to Daily Intake.`);
       setScanResult(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Meal Logger</Text>
            <Ionicons name="fast-food-outline" size={32} color="#1d4ed8" />
        </View>

        {/* Tab Navigator */}
        <View style={styles.tabContainer}>
           <TouchableOpacity style={[styles.tab, activeTab === 'text' && styles.tabActive]} onPress={() => setActiveTab('text')}>
               <Ionicons name="create-outline" size={20} color={activeTab === 'text' ? '#fff' : '#6b7280'} />
               <Text style={[styles.tabText, activeTab === 'text' && styles.tabTextActive]}>Text</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.tab, activeTab === 'plate' && styles.tabActive]} onPress={() => setActiveTab('plate')}>
               <Ionicons name="restaurant-outline" size={20} color={activeTab === 'plate' ? '#fff' : '#6b7280'} />
               <Text style={[styles.tabText, activeTab === 'plate' && styles.tabTextActive]}>Plate</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.tab, activeTab === 'scan_plate' && styles.tabActive]} onPress={() => setActiveTab('scan_plate')}>
               <Ionicons name="camera-outline" size={20} color={activeTab === 'scan_plate' ? '#fff' : '#6b7280'} />
               <Text style={[styles.tabText, activeTab === 'scan_plate' && styles.tabTextActive]}>Plate AI</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.tab, activeTab === 'scan_label' && styles.tabActive]} onPress={() => setActiveTab('scan_label')}>
               <MaterialCommunityIcons name="text-recognition" size={20} color={activeTab === 'scan_label' ? '#fff' : '#6b7280'} />
               <Text style={[styles.tabText, activeTab === 'scan_label' && styles.tabTextActive]}>Label OCR</Text>
           </TouchableOpacity>
        </View>

        {(activeTab === 'scan_plate' || activeTab === 'scan_label') && (
           <View style={styles.card}>
               <Text style={styles.cardTitle}>{activeTab === 'scan_plate' ? "AI Food Detection" : "Nutrition Label OCR"}</Text>
               <Text style={styles.cardSubtitle}>{activeTab === 'scan_plate' ? "Snap a photo of your mess plate to log items." : "Snap a photo of a label to extract macros."}</Text>

               {!scanResult && (
                   <>
                       <View style={styles.cameraBoxMock}>
                           <Ionicons name="camera" size={60} color="#9ca3af" style={{opacity: 0.5}} />
                       </View>

                       <TouchableOpacity 
                           style={styles.btnPrimary} 
                           onPress={activeTab === 'scan_plate' ? handleScanPlate : handleScanLabelOCR} 
                           disabled={loading}
                        >
                           {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Use Camera</Text>}
                       </TouchableOpacity>
                   </>
               )}

               {scanResult && scanResult.type === 'ocr' && (
                   <View style={styles.resultBox}>
                       <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                          <MaterialCommunityIcons name="text-recognition" size={32} color="#8b5cf6" />
                          <View style={{marginLeft: 12}}>
                             <Text style={{fontSize: 18, fontWeight: 'bold'}}>{scanResult.name}</Text>
                             <Text style={{color: '#6b7280', fontSize: 13}}>Parsed from image</Text>
                          </View>
                       </View>

                       <View style={styles.macroGrid}>
                           {Object.entries(scanResult.macros).map(([key, val]) => (
                               <View key={key} style={styles.macroPill}>
                                   <Text style={styles.macroVal}>{val as number} {key === 'calories' ? '' : (key === 'sodium' ? 'mg' : 'g')}</Text>
                                   <Text style={styles.macroName}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                               </View>
                           ))}
                       </View>

                       <TouchableOpacity style={[styles.btnPrimary, {marginTop: 20, width: '100%', backgroundColor: '#2563eb'}]} onPress={handleAddToLog}>
                          <Text style={styles.btnText}>Add to Daily Log +</Text>
                       </TouchableOpacity>

                       <TouchableOpacity style={{alignItems: 'center', marginTop: 16}} onPress={() => setScanResult(null)}>
                          <Text style={{color: '#6b7280', fontWeight: 'bold'}}>Cancel</Text>
                       </TouchableOpacity>
                   </View>
               )}
               
               {scanResult && scanResult.type === 'plate' && (
                   <View style={styles.resultBox}>
                       <Text style={{fontSize: 16, fontWeight: 'bold', marginBottom: 12}}>Detected Items. Confirm & Edit portions:</Text>
                       
                       {plateItems.map((pi, idx) => (
                           <View key={idx} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb'}}>
                               <Text style={{fontSize: 16, fontWeight: '600', color: '#1f2937'}}>{pi.item}</Text>
                               <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                   <TouchableOpacity 
                                      style={{backgroundColor: '#f3f4f6', padding: 6, borderRadius: 6}} 
                                      onPress={() => {
                                          const next = [...plateItems];
                                          next[idx].quantity = Math.max(0, next[idx].quantity - 0.5);
                                          setPlateItems(next);
                                      }}
                                    >
                                       <Ionicons name="remove" size={18} />
                                   </TouchableOpacity>
                                   <Text style={{marginHorizontal: 12, fontWeight: 'bold', minWidth: 20, textAlign: 'center'}}>{pi.quantity}</Text>
                                   <TouchableOpacity 
                                      style={{backgroundColor: '#f3f4f6', padding: 6, borderRadius: 6}} 
                                      onPress={() => {
                                          const next = [...plateItems];
                                          next[idx].quantity += 0.5;
                                          setPlateItems(next);
                                      }}
                                    >
                                       <Ionicons name="add" size={18} />
                                   </TouchableOpacity>
                               </View>
                           </View>
                       ))}

                       <TouchableOpacity style={[styles.btnPrimary, {marginTop: 20, width: '100%', backgroundColor: '#10b981'}]} onPress={handleLogPlate} disabled={loading}>
                          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log Plate AI</Text>}
                       </TouchableOpacity>

                       <TouchableOpacity style={{alignItems: 'center', marginTop: 16}} onPress={() => {setScanResult(null); setPlateItems([]);}}>
                          <Text style={{color: '#6b7280', fontWeight: 'bold'}}>Retake Photo</Text>
                       </TouchableOpacity>
                   </View>
               )}
           </View>
        )}
        
        {/* Placeholder UI for the other modes */}
        {(activeTab === 'text' || activeTab === 'plate') && (
            <View style={[styles.card, {alignItems: 'center', paddingVertical: 40}]}>
                <Ionicons name="construct-outline" size={40} color="#d1d5db" />
                <Text style={{color: '#9ca3af', marginTop: 12, fontWeight: 'bold'}}>Mode under construction.</Text>
            </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f2f5f9' },
  container: { padding: 16, paddingTop: Platform.OS === 'ios' ? 10 : 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1e3a8a' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#3b82f6', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontWeight: '600', color: '#6b7280', marginLeft: 6 },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  cameraBoxMock: { height: 200, backgroundColor: '#f3f4f6', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  testActions: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f9fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, marginRight: 12 },
  btnPrimary: { backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ocrBox: { backgroundColor: '#fee2e2', padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  ocrText: { fontWeight: '800', color: '#991b1b', fontSize: 16, marginTop: 10, textAlign: 'center' },
  ocrSubText: { color: '#b91c1c', fontSize: 14, textAlign: 'center', marginTop: 6 },
  resultBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, marginTop: 10 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  macroPill: { width: '48%', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  macroVal: { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  macroName: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginTop: 2 }
});
