import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  
  // You would replace these with your actual Client IDs from Google Cloud Console
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
    iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
    webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLogin(authentication?.accessToken);
    }
  }, [response]);

  const handleGoogleLogin = async (token: string | undefined) => {
    if (!token) return;

    try {
      // Get user info from Google
      const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { email, name, picture, sub } = userInfoRes.data;

      // Send to backend
      const backendRes = await axios.post('http://10.0.2.2:8000/auth/google', {
        id_token: token,
        email,
        name,
        photo_url: picture,
      });

      if (backendRes.data.status === 'success') {
        // Store user and token securely
        await SecureStore.setItemAsync('user_token', backendRes.data.token);
        await SecureStore.setItemAsync('user_profile', JSON.stringify(backendRes.data.user));
        
        // Navigate to Dashboard
        router.replace('/(tabs)/dashboard');
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Authentication Error", "Failed to sign in with Google.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
            <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3069/3069172.png' }} 
                style={styles.logo}
            />
            <Text style={styles.title}>CampusFuel AI</Text>
            <Text style={styles.subtitle}>Fueling the Modern Student</Text>
        </View>

        <View style={styles.footer}>
            <TouchableOpacity 
                style={styles.googleBtn} 
                onPress={() => promptAsync()}
                disabled={!request}
            >
                {response?.type === 'success' ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <>
                        <Ionicons name="logo-google" size={24} color="#FFFFFF" />
                        <Text style={styles.googleBtnText}>Sign in with Google</Text>
                    </>
                )}
            </TouchableOpacity>
            <Text style={styles.terms}>By signing in, you agree to our Terms and Privacy Policy.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, padding: 40, justifyContent: 'space-between', alignItems: 'center' },
  logoContainer: { marginTop: 100, alignItems: 'center' },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#1E293B', letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '500' },
  footer: { width: '100%', marginBottom: 40, alignItems: 'center' },
  googleBtn: { 
    flexDirection: 'row', 
    backgroundColor: '#1E293B', 
    width: '100%', 
    height: 60, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  googleBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginLeft: 12 },
  terms: { fontSize: 12, color: '#94A3B8', marginTop: 20, textAlign: 'center' }
});
