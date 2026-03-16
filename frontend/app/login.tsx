import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Config from '../src/constants/Config';
import { secureStorage } from '../src/storage/secureStorage';

import { Ionicons } from '@expo/vector-icons';
import { auth } from '../src/firebaseConfig';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { userStorage } from '../src/storage';
import { useTheme } from '../src/context/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  // Generate the proper redirect URI for Expo
  const redirectUri = makeRedirectUri({
    scheme: 'frontend',
    path: 'redirect',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: "900928347196-fqfnitr168ua2luevfr1v2lfujuaa20f.apps.googleusercontent.com",
    androidClientId: "900928347196-fqfnitr168ua2luevfr1v2lfujuaa20f.apps.googleusercontent.com",
    iosClientId: "900928347196-fqfnitr168ua2luevfr1v2lfujuaa20f.apps.googleusercontent.com",
    redirectUri,
  });

  // Log the redirect URI on mount so you know exactly what to add in Google Cloud Console
  useEffect(() => {
    console.log("=== GOOGLE AUTH REDIRECT URI ===");
    console.log("Add this URI to your Google Cloud Console OAuth 2.0 Authorized redirect URIs:");
    console.log(redirectUri);
    console.log("================================");
  }, [redirectUri]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    } else if (response?.type === 'error') {
      console.error("Google Auth Error:", response.error);
      Alert.alert(
        "Google Sign-In Error", 
        `${response.error?.message || 'Unknown error occurred.'}\n\nMake sure the redirect URI is configured in Google Cloud Console.`
      );
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string | undefined) => {
    if (!idToken) return;
    setLoading(true);
    setGoogleLoading(true);

    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      const profile = {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email || '',
        avatarUrl: user.photoURL || '',
        createdAt: new Date().toISOString()
      };

      // Save to cloud (Firestore) and local
      await userStorage.saveUserProfile(profile);
      await secureStorage.setItem('user_profile', JSON.stringify(profile));

      // Sync with Python Backend
      try {
        await axios.post(`${Config.API_BASE_URL}/auth/google`, {
          id_token: idToken,
          email: profile.email,
          name: profile.name,
          uid: profile.uid,
          photo_url: profile.avatarUrl
        });
      } catch (backendErr) {
        console.warn("Backend sync failed, but Firebase login succeeded:", backendErr);
      }

      // Check if user has completed onboarding
      try {
        const onboarded = await userStorage.isOnboardingComplete();
        if (!onboarded) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } catch {
        router.replace('/(tabs)/dashboard');
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Authentication Error", "Failed to sign in with Google Firebase.");
    } finally {
      setLoading(false);
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      const profile = {
        uid: user.uid,
        name: user.displayName || email.split('@')[0],
        email: user.email || '',
        avatarUrl: user.photoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        createdAt: new Date().toISOString()
      };
      await userStorage.saveUserProfile(profile);
      await secureStorage.setItem('user_profile', JSON.stringify(profile));

      try {
        await axios.post(`${Config.API_BASE_URL}/auth/google`, {
          email: profile.email, name: profile.name, uid: profile.uid
        });
      } catch (e) { }

      // Check if user has completed onboarding
      try {
        const onboarded = await userStorage.isOnboardingComplete();
        if (!onboarded) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } catch {
        router.replace('/(tabs)/dashboard');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        Alert.alert("Account Not Found", "No account with this email. Please sign up first.");
      } else if (error.code === 'auth/wrong-password') {
        Alert.alert("Wrong Password", "The password is incorrect.");
      } else {
        Alert.alert("Login Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      if (name.trim()) {
        await updateProfile(user, { displayName: name.trim() });
      }

      const profile = {
        uid: user.uid,
        name: name.trim() || email.split('@')[0],
        email: user.email || '',
        avatarUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        createdAt: new Date().toISOString()
      };
      await userStorage.saveUserProfile(profile);
      await secureStorage.setItem('user_profile', JSON.stringify(profile));

      try {
        await axios.post(`${Config.API_BASE_URL}/auth/google`, {
          email: profile.email, name: profile.name, uid: profile.uid
        });
      } catch (e) { }

      router.replace('/onboarding');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert("Email Taken", "An account with this email already exists. Try signing in.");
      } else {
        Alert.alert("Sign Up Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.pageBg }]}>
      {/* Decorative gradient circles */}
      <View style={[styles.gradientCircle1, { backgroundColor: colors.primary + '15' }]} />
      <View style={[styles.gradientCircle2, { backgroundColor: colors.secondary + '12' }]} />
      <View style={[styles.gradientCircle3, { backgroundColor: colors.info + '10' }]} />
      
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[
          styles.card,
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            backgroundColor: colors.card, 
          }
        ]}>
          {/* Logo & Branding */}
          <View style={styles.brandSection}>
            <View style={[styles.logoGlow, { backgroundColor: colors.cardHighlight }]}>
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3069/3069172.png' }}
                style={styles.logo}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>CampusFuel AI</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Fueling the Modern Student</Text>
            <View style={[styles.tagline, { backgroundColor: colors.cardHighlight }]}>
              <Ionicons name="sparkles" size={12} color={colors.primary} />
              <Text style={[styles.taglineText, { color: colors.primary }]}>Smart Health • Smart Campus • Smart You</Text>
            </View>
          </View>

          {/* Name Input (Sign Up only) */}
          {isSignUp && (
            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Full Name"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          {/* Email Input */}
          <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Email address"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(text) => setEmail(text.trim())}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Action Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary }, loading && !googleLoading && styles.buttonDisabled]} 
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading && !googleLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>OR</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }, googleLoading && styles.googleBtnLoading]}
            onPress={() => {
              setGoogleLoading(true);
              promptAsync();
            }}
            disabled={!request || loading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Image 
                  source={{ uri: 'https://www.google.com/favicon.ico' }} 
                  style={{ width: 20, height: 20 }} 
                />
                <Text style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Toggle Sign In / Sign Up */}
          <TouchableOpacity style={styles.toggleRow} onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: colors.primary, fontWeight: '800' }}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F0F1FF',
  },
  gradientCircle1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  gradientCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(139, 92, 246, 0.10)',
  },
  gradientCircle3: {
    position: 'absolute',
    top: '40%' as any,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 28,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
  },
  logo: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 8,
  },
  tagline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  taglineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    flexDirection: 'row',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  googleBtnLoading: {
    opacity: 0.7,
  },
  googleBtnText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '500',
  },
  toggleRow: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
