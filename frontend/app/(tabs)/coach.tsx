import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, SafeAreaView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';

const API = 'http://10.0.2.2:8000';
const UID = 'user123';

const QUICK_PROMPTS = [
  "Why is my health score low?",
  "What should I eat for protein?",
  "Am I drinking enough water?",
  "How was my sleep last night?",
  "How many calories today?",
];

interface ChatBubble {
  role: 'user' | 'ai';
  text: string;
  suggestions?: string[];
}

export default function CoachTab() {
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Mount: AI sends greeting
  useEffect(() => {
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    setMessages([
      {
        role: 'ai',
        text: `${greeting}! I'm your CampusFuel AI Coach 🤖\n\nI can help you understand your health score, nutrition, hydration, and sleep. What would you like to know?`,
        suggestions: QUICK_PROMPTS.slice(0, 3),
      },
    ]);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatBubble = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await axios.post(`${API}/users/${UID}/coach/chat`, { message: text });
      const aiMsg: ChatBubble = {
        role: 'ai',
        text: res.data.reply,
        suggestions: res.data.suggestions,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: "Sorry, I couldn't reach the server. Please try again. 🔌" },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="robot-excited" size={32} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Health Coach</Text>
            <Text style={styles.headerSub}>⚡ Powered by your personal data</Text>
          </View>
        </View>

        {/* Chat Area */}
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <View key={i}>
              <View style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                {m.role === 'ai' && (
                  <MaterialCommunityIcons name="robot-excited" size={16} color="#6366f1" style={{ marginRight: 6, marginTop: 2 }} />
                )}
                <Text style={[styles.bubbleText, m.role === 'user' ? styles.userText : styles.aiText]}>
                  {m.text}
                </Text>
              </View>

              {/* Suggestion chips under AI messages */}
              {m.role === 'ai' && m.suggestions && m.suggestions.length > 0 && (
                <View style={styles.chipsWrap}>
                  {m.suggestions.map((s, si) => (
                    <TouchableOpacity key={si} style={styles.chip} onPress={() => sendMessage(s)}>
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View style={[styles.bubble, styles.aiBubble, { alignItems: 'center' }]}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={[styles.aiText, { marginLeft: 8 }]}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        {/* Quick Prompts Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRow}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          {QUICK_PROMPTS.map((q, i) => (
            <TouchableOpacity key={i} style={styles.quickChip} onPress={() => sendMessage(q)}>
              <Text style={styles.quickChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your AI Coach..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={300}
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && { backgroundColor: '#e5e7eb' }]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={20} color={input.trim() && !loading ? '#fff' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7ff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },

  chat: { flex: 1 },

  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    shadowColor: '#6366f1',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4f46e5',
  },
  aiText: { color: '#1e1b4b', fontSize: 15, lineHeight: 22, flex: 1 },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  bubbleText: { flexShrink: 1 },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    marginLeft: 4,
    gap: 6,
  },
  chip: {
    backgroundColor: '#ede9fe',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: '#4f46e5', fontSize: 12, fontWeight: '600' },

  quickRow: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e7ff',
    maxHeight: 50,
  },
  quickChip: {
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  quickChipText: { color: '#3730a3', fontSize: 12, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f7ff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
