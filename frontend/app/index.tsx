import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth } from '../src/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthenticated(!!user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!loading) {
      if (authenticated) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [loading, authenticated]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}
