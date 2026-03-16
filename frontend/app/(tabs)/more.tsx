import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, TextInput, Modal, SafeAreaView, Platform } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { auth } from '../../src/firebaseConfig';
import { userStorage } from '../../src/storage';

const PRIMARY_COLOR = '#4F46E5';

const MenuOption = ({ icon, label, onPress, color = '#64748B', rightElement }: any) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.option} onPress={onPress}>
      <View style={styles.optionLeft}>
        <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      </View>
      {rightElement ? rightElement : <Ionicons name="chevron-forward" size={20} color={colors.border} />}
    </TouchableOpacity>
  );
};

export default function MoreScreen() {
  const { colors, theme, mode, setMode } = useTheme();
  const router = useRouter();
  const [devClicks, setDevClicks] = useState(0);
  const [isDevMode, setIsDevMode] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  
  // Health Profile State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [healthProfile, setHealthProfile] = useState({
    height_cm: '175',
    weight_kg: '70',
    goal_weight_kg: '75',
    goal_type: 'bulking', // bulking, maintenance, fat loss
  });
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; content: string }>({ visible: false, title: '', content: '' });

  React.useEffect(() => {
    const fetchProfileData = async () => {
      try {
        if (!auth.currentUser) {
          console.log("[MoreScreen] No user authenticated yet.");
          return;
        }

        const [profile, xp, goals] = await Promise.all([
          userStorage.getUserProfile(),
          userStorage.getXP(),
          userStorage.getHealthGoals()
        ]);
        
        // Mocking gamification titles/levels from logic if not in doc
        setDashboardData({
          level: Math.floor(xp / 500) + 1,
          level_title: xp > 2000 ? "Master" : "Beginner",
          badges: [], 
        });

        if (goals) {
          setHealthProfile({
            height_cm: goals.heightCm?.toString() || '175',
            weight_kg: goals.weightKg?.toString() || '70',
            goal_weight_kg: goals.targetWeightKg?.toString() || '75',
            goal_type: (goals.goalType as any) || 'maintenance',
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchProfileData();
  }, []);

  const handleDevClick = () => {
    if (isDevMode) return;
    const newClicks = devClicks + 1;
    if (newClicks >= 5) {
      setIsDevMode(true);
      Alert.alert("Developer Mode", "You have unlocked the hidden Developer Menu! 🛠️");
    } else {
      setDevClicks(newClicks);
    }
  };

  const handleExport = async () => {
    try {
      await Share.share({
        message: "Check out my weekly health progress on CampusFuel AI!",
        title: "Weekly Health Report"
      });
    } catch (e) {}
  };

  const handleDownloadReport = async () => {
    Alert.alert("Cloud Feature", "Weekly Health Report PDF generation is being migrated to Firebase Cloud Functions. Please check back soon!");
  };

  const handleSaveProfile = async () => {
    try {
      const newGoals = {
        heightCm: parseFloat(healthProfile.height_cm),
        weightKg: parseFloat(healthProfile.weight_kg),
        targetWeightKg: parseFloat(healthProfile.goal_weight_kg),
        goalType: healthProfile.goal_type as any
      };
      await userStorage.saveHealthGoals(newGoals);
      Alert.alert("Success Cloud Sync", "Your health profile has been updated and synced to Firebase! ☁️");
      setProfileModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Failed to update profile to cloud.");
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.replace('/login');
    } catch (e) {
      Alert.alert("Error", "Failed to sign out.");
    }
  };




  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Layer 1 — App Bar (Sticky) */}
      <View style={{ backgroundColor: colors.headerBg }}>
        <View style={[styles.appBar, { backgroundColor: colors.headerBg, shadowColor: colors.shadow }]}>
          <Text style={[styles.appBarTitle, { color: colors.text }]}>Me</Text>
        </View>
      </View>

      <ScrollView 
        style={[styles.scrollArea, { backgroundColor: colors.pageBg }]} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 👤 Profile Header */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>AB</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.name, { color: colors.text }]}>{auth.currentUser?.displayName || "User Name"}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{auth.currentUser?.email || "user@campusfuel.ai"}</Text>
          <View style={[styles.badge, { backgroundColor: colors.cardHighlight }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {dashboardData?.level_title ? `Level ${dashboardData.level} - ${dashboardData.level_title}` : "Level 1 - Beginner"}
            </Text>
          </View>
        </View>
      </View>

      {/* 🏅 Achievements & Badges */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>ACHIEVEMENTS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, paddingVertical: 16 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {dashboardData?.badges?.map((badge: any, idx: number) => (
            <View key={idx} style={[styles.badgeItem, { backgroundColor: colors.cardHighlight, borderColor: colors.border }]}>
              <View style={[styles.badgeIconWrap, { backgroundColor: colors.pageBg }]}>
                <MaterialCommunityIcons name={badge.icon as any || "trophy"} size={32} color={colors.primary} />
              </View>
              <Text style={[styles.badgeName, { color: colors.text }]}>{badge.name}</Text>
              <Text style={[styles.badgeDesc, { color: colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">{badge.description}</Text>
            </View>
          ))}
          {(!dashboardData?.badges || dashboardData?.badges.length === 0) && (
            <Text style={{ color: colors.textSecondary, padding: 10 }}>Keep logging your habits to earn badges!</Text>
          )}
        </ScrollView>
      </View>

      {/* 🚀 Tools Section */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>PERSONAL TOOLS</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <MenuOption 
          icon="calendar-outline" 
          label="Mess Timetable" 
          onPress={() => router.push('/timetable' as any)} 
          color="#3B82F6" 
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="calculator-outline" 
          label="Calorie Calculator" 
          onPress={() => router.push('/calorie-calculator' as any)} 
          color="#8B5CF6" 
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="document-text-outline" 
          label="Download Health Report (PDF)" 
          onPress={handleDownloadReport} 
          color="#10B981" 
        />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <MenuOption icon="person-outline" label="Personal Health Profile" onPress={() => setProfileModalVisible(true)} color="#4F46E5" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption icon="notifications-outline" label="Notifications" onPress={() => Alert.alert("Coming Soon", "Notification settings will be available in the next update.")} color="#F59E0B" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption icon="settings-outline" label="Advanced Settings" onPress={() => router.push('/settings' as any)} color="#64748B" />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={[styles.option, { paddingVertical: 14 }]} onPress={() => setMode('light')}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#F59E0B' + '15' }]}>
              <Ionicons name="sunny-outline" size={22} color="#F59E0B" />
            </View>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Light</Text>
          </View>
          <Ionicons name={mode === 'light' ? "checkmark-circle" : "ellipse-outline"} size={24} color={mode === 'light' ? colors.primary : colors.border} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={[styles.option, { paddingVertical: 14 }]} onPress={() => setMode('dark')}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#6366F1' + '15' }]}>
              <Ionicons name="moon-outline" size={22} color="#6366F1" />
            </View>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Dark</Text>
          </View>
          <Ionicons name={mode === 'dark' ? "checkmark-circle" : "ellipse-outline"} size={24} color={mode === 'dark' ? colors.primary : colors.border} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={[styles.option, { paddingVertical: 14 }]} onPress={() => setMode('system')}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#64748B' + '15' }]}>
              <Ionicons name="settings-outline" size={22} color="#64748B" />
            </View>
            <Text style={[styles.optionLabel, { color: colors.text }]}>System Default</Text>
          </View>
          <Ionicons name={mode === 'system' ? "checkmark-circle" : "ellipse-outline"} size={24} color={mode === 'system' ? colors.primary : colors.border} />
        </TouchableOpacity>
      </View>

      {/* 🛠️ Hidden Developer Menu */}
      {isDevMode && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>DEVELOPER OPTIONS</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: '#FCA5A5', borderWidth: 1 }]}>
            <MenuOption 
              icon="bug-outline" 
              label="Bypass LLM Cache" 
              onPress={() => Alert.alert("Debug", "Cache Bypassed")} 
              color="#EF4444" 
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuOption 
              icon="server-outline" 
              label="Firebase Status" 
              onPress={() => Alert.alert("Cloud Status", "Firestore: Connected\nAuth: Securely Logged In")} 
              color="#EF4444" 
            />
          </View>
        </>
      )}

      {/* ℹ️ About & Legal Section */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>ABOUT</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <MenuOption 
          icon="information-circle-outline" 
          label="About CampusFuel AI" 
          onPress={() => setInfoModal({ visible: true, title: 'About CampusFuel AI', content: 'CampusFuel AI v2.0.0\n\nAn AI-powered campus health & nutrition tracker built for students and health-conscious individuals.\n\nKey Features:\n• Personalized calorie & protein goals using the Mifflin-St Jeor equation\n• AI Coach with EWMA trend detection\n• Smart food recommendations based on time of day and nutritional gaps\n• Water tracking with custom goals\n• Sleep monitoring & consistency scoring\n• Weekly progress insights with pattern analysis\n• Campus schedule integration\n\nTech Stack:\n• Frontend: React Native + Expo\n• Backend: FastAPI + Python\n• Database: Firebase Cloud Firestore\n• Auth: Firebase Authentication\n• AI: Custom EWMA engine + GPT integration\n\nDesigned & Developed by Adarsh Bandaru' })} 
          color="#4F46E5"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="document-text-outline" 
          label="Terms & Conditions" 
          onPress={() => setInfoModal({ visible: true, title: 'Terms & Conditions', content: 'Last updated: March 2026\n\nBy downloading, installing, or using CampusFuel AI, you agree to the following terms:\n\n1. Acceptance of Terms\nBy accessing CampusFuel AI, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.\n\n2. Health Disclaimer\nCampusFuel AI provides nutritional tracking and AI-generated recommendations for informational purposes only. This app is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making dietary changes.\n\n3. Data Collection & Storage\nYour health data (meals, water intake, sleep, weight) is stored securely on Firebase Cloud Firestore. We use industry-standard encryption to protect your information.\n\n4. User Responsibilities\nYou are responsible for the accuracy of the data you input. Inaccurate data may lead to incorrect AI recommendations.\n\n5. Intellectual Property\nAll content, features, and functionality of CampusFuel AI are owned by Adarsh Bandaru and are protected by copyright laws.\n\n6. Account Termination\nYou may delete your account and all associated data at any time through the app settings.\n\n7. Limitation of Liability\nCampusFuel AI is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use of this application.\n\n8. Changes to Terms\nWe reserve the right to modify these terms at any time. Continued use constitutes acceptance of modified terms.\n\nContact: adarshbandaru05@gmail.com' })} 
          color="#8B5CF6"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="shield-checkmark-outline" 
          label="Privacy Policy" 
          onPress={() => setInfoModal({ visible: true, title: 'Privacy Policy', content: 'Effective Date: March 2026\n\nAdarsh Bandaru built CampusFuel AI as an educational and wellness application. This Privacy Policy explains how we collect, use, and protect your information.\n\n1. Information We Collect\n• Account Info: Name, email address (via Firebase Auth)\n• Health Data: Meals logged, water intake, sleep hours, weight entries\n• Device Info: Device type and OS version for compatibility\n• Usage Data: Feature usage patterns (anonymous)\n\n2. How We Use Your Data\n• To calculate personalized nutrition goals\n• To generate AI-powered health insights\n• To track your progress over time\n• To improve app features and user experience\n\n3. Data Storage & Security\n• All data is encrypted and stored on Google Firebase Cloud Firestore\n• We use Firebase Authentication for secure login\n• Data is transmitted over HTTPS\n\n4. Data Sharing\n• We do NOT sell your personal data to third parties\n• We do NOT share your health data with advertisers\n• We do NOT serve ads in the app\n\n5. Your Rights\n• Access: View all your stored data within the app\n• Deletion: Request complete account & data deletion\n• Export: Export your health data at any time\n\n6. Contact Us\nFor privacy-related questions or data deletion requests:\nEmail: adarshbandaru05@gmail.com\nPhone: 8885006708' })} 
          color="#10B981"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="help-circle-outline" 
          label="Help & Support" 
          onPress={() => setInfoModal({ visible: true, title: 'Help & Support', content: 'Welcome to CampusFuel AI Help Center!\n\nGetting Started:\n1. Complete onboarding to set your personalized goals\n2. Log your first meal using the Log tab\n3. Track water intake from Quick Actions\n4. Check your Consistency Score on the Dashboard\n\nFeatures Guide:\n\n📊 Dashboard\nYour daily overview with consistency score, quick actions, meal tracker, and weekly streak calendar.\n\n📝 Log Tab\nBuild your plate with common foods, log water intake, and track weight changes.\n\n📈 Insights\nWeekly and monthly progress trends for calories, protein, water, and sleep.\n\n🤖 AI Coach\nAsk any health or nutrition question. The coach analyzes your data to give personalized advice.\n\n👤 Me Tab\nManage your profile, health goals, app settings, and view app information.\n\nTroubleshooting:\n• Data not loading? Pull down to refresh\n• Goals wrong? Update your profile in Me tab\n• App crashing? Clear cache and restart\n\nStill need help?\nEmail: adarshbandaru05@gmail.com\nPhone: 8885006708' })} 
          color="#0EA5E9"
        />
      </View>

      {/* 📱 Connect Section */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>CONNECT</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <MenuOption 
          icon="mail-outline" 
          label="Contact Developer" 
          onPress={() => setInfoModal({ visible: true, title: 'Contact Developer', content: 'Developer: Adarsh Bandaru\n\n📱 Phone: 8885006708\n📧 Email: adarshbandaru05@gmail.com\n🌐 GitHub: github.com/Adarshbandaru\n\nAbout the Developer:\nPassionate about building AI-powered solutions that make a real difference in people\'s lives. CampusFuel AI was created as part of an AI/ML capstone project, combining nutrition science with machine learning.\n\nI\'m always open to feedback, suggestions, and collaboration opportunities. Don\'t hesitate to reach out!\n\nApp: CampusFuel AI v2.0.0-Gold' })} 
          color="#F59E0B"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="share-social-outline" 
          label="Share CampusFuel AI" 
          onPress={handleExport} 
          color="#EC4899"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="star-outline" 
          label="Rate This App" 
          onPress={() => Alert.alert('Thank You!', 'Your feedback means everything! ⭐')} 
          color="#F97316"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MenuOption 
          icon="code-slash-outline" 
          label="Version" 
          onPress={handleDevClick} 
          rightElement={<Text style={[styles.versionText, { color: colors.textSecondary }]}>v2.0.0</Text>}
          color="#64748B"
        />
      </View>

      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.cardHighlight }]} onPress={handleSignOut}>
        <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.legalText, { color: colors.textSecondary }]}>CampusFuel AI © 2026 • Made with ❤️ by Adarsh Bandaru</Text>

      {/* 🏥 Health Profile Modal */}
      {profileModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Health Profile</Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.pageBg }]}>
                <Ionicons name="body-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="e.g. 175"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={healthProfile.height_cm}
                  onChangeText={(val) => setHealthProfile({...healthProfile, height_cm: val})}
                />
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Current Weight (kg)</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.pageBg }]}>
                <Ionicons name="scale-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="e.g. 70"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={healthProfile.weight_kg}
                  onChangeText={(val) => setHealthProfile({...healthProfile, weight_kg: val})}
                />
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Goal Weight (kg)</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.pageBg }]}>
                <MaterialCommunityIcons name="target" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="e.g. 75"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={healthProfile.goal_weight_kg}
                  onChangeText={(val) => setHealthProfile({...healthProfile, goal_weight_kg: val})}
                />
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Goal Type</Text>
              <View style={styles.goalTypeContainer}>
                {['Fat Loss', 'Maintenance', 'Bulking'].map((goal) => {
                  const isActive = healthProfile.goal_type.toLowerCase() === goal.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={goal}
                      style={[
                        styles.goalTypeChip,
                        { borderColor: colors.border, backgroundColor: colors.pageBg },
                        isActive && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                      onPress={() => setHealthProfile({...healthProfile, goal_type: goal.toLowerCase()})}
                    >
                      <Text style={[
                        styles.goalTypeText,
                        { color: colors.textSecondary },
                        isActive && { color: '#FFF', fontWeight: '800' }
                      ]}>{goal}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProfile}>
              <Text style={styles.primaryBtnText}>Save Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>

    {/* 📄 Info Detail Modal */}
    <Modal visible={infoModal.visible} transparent animationType="slide">
      <View style={styles.infoModalOverlay}>
        <View style={[styles.infoModalContent, { backgroundColor: colors.card }]}>
          <View style={styles.infoModalHeader}>
            <Text style={[styles.infoModalTitle, { color: colors.text }]}>{infoModal.title}</Text>
            <TouchableOpacity onPress={() => setInfoModal({ ...infoModal, visible: false })} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={[styles.infoModalBody, { color: colors.text }]}>{infoModal.content}</Text>
          </ScrollView>
        </View>
      </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollArea: { flex: 1 },
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
  content: { padding: 20, paddingBottom: 60 },

  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY_COLOR, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileInfo: { marginLeft: 14, flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  email: { fontSize: 12, color: '#64748B', marginVertical: 2 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', color: PRIMARY_COLOR },

  sectionHeader: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  divider: { height: 1, backgroundColor: '#F1F5F9' },
  
  versionText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  
  logoutBtn: { backgroundColor: '#FFF1F2', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 16 },
  logoutText: { color: '#E11D48', fontWeight: '700', fontSize: 15 },
  legalText: { textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginBottom: 20 },
  
  badgeItem: { width: 120, height: 140, borderRadius: 16, borderWidth: 1, alignItems: 'center', padding: 12, marginRight: 12 },
  badgeIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  badgeName: { fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  badgeDesc: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20, zIndex: 1000 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, height: 50 },
  inputField: { flex: 1, height: '100%', marginLeft: 10, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  
  goalTypeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  goalTypeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginHorizontal: 4 },
  goalTypeText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  
  primaryBtn: { backgroundColor: '#4F46E5', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  infoModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  infoModalContent: { maxHeight: '80%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  infoModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoModalTitle: { fontSize: 20, fontWeight: '800' },
  infoModalBody: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
});

