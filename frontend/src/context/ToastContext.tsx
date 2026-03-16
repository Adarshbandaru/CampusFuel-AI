import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { StyleSheet, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextData {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextData>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const showToast = (msg: string, toastType: ToastType = 'info') => {
    setMessage(msg);
    setType(toastType);
    setVisible(true);

    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 60, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(slideAnim, { toValue: -100, duration: 300, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View style={[
          styles.toast, 
          { transform: [{ translateY: slideAnim }] }, 
          type === 'error' ? styles.error : type === 'success' ? styles.success : styles.info
        ]}>
          <Ionicons 
            name={type === 'error' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : 'information-circle'} 
            size={24} color="#FFF" 
          />
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 12,
  },
  error: { backgroundColor: '#EF4444' },
  success: { backgroundColor: '#10B981' },
  info: { backgroundColor: '#3B82F6' },
});
