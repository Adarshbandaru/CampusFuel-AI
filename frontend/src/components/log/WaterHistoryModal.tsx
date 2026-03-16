import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';

interface WaterEntry {
  id: string;
  amountMl: number;
  time: string;
}

interface WaterHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  isLoading: boolean;
  entries: WaterEntry[];
  onDeleteEntry: (id: string, amountMl: number) => void;
}

export function WaterHistoryModal({ visible, onClose, isLoading, entries, onDeleteEntry }: WaterHistoryModalProps) {
  const { colors, theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Today's Water Logs</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 300 }}>
            {isLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>Loading history...</Text>
              </View>
            ) : entries.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No logs yet today.</Text>
            ) : (
              entries.map((e) => (
                <View key={e.id} style={[styles.entryRow, { backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC' }]}>
                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryTime, { color: colors.textSecondary }]}>{e.time}</Text>
                    <Text style={styles.entryAmount}>
                      {e.amountMl > 0 ? '+' : ''}{e.amountMl}ml
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => onDeleteEntry(e.id, e.amountMl)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24, 
    paddingBottom: 40 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '800' 
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 20, 
    fontSize: 14 
  },
  entryRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 8 
  },
  entryInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  entryTime: { 
    fontSize: 13, 
    fontWeight: '600' 
  },
  entryAmount: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#0EA5E9' 
  },
  deleteBtn: { 
    padding: 8 
  },
});
