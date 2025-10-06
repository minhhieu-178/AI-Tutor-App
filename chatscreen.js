import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../firebaseConfig";
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from "firebase/firestore";
import { sendMessageToAI } from "../constants/api";

export default function ChatScreen() {
  const router = useRouter();
  const flatListRef = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        router.replace("login");
      } else {
        setUser(currentUser);

        const q = query(
          collection(db, "chats"),
          orderBy("timestamp", "asc"),
          where("userId", "==", currentUser.uid)
        );

        const unsubscribeChat = onSnapshot(q, (snapshot) => {
          const chatData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setMessages(chatData);
          setLoading(false);

          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 99999, animated: true });
          }, 100);
        }, (err) => {
          setError("Không thể tải lịch sử chat: " + err.message);
          setLoading(false);
        });

        return () => unsubscribeChat();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
      userId: user.uid,
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, "chats"), newMessage);
    setInput("");

    try {
      setError(null);
      console.log("📨 Đang gửi tin nhắn tới AI:", input);
      const aiResponse = await sendMessageToAI(input, messages, {
        systemPrompt: "Bạn là một gia sư thân thiện, giải thích rõ ràng và từng bước.",
      });
      console.log("📩 Phản hồi từ AI:", aiResponse);

      if (aiResponse.includes("lỗi") || aiResponse.includes("Sorry")) {
        setError(aiResponse);
      } else {
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: aiResponse,
          sender: "bot",
          userId: user.uid,
          timestamp: serverTimestamp(),
        };
        await addDoc(collection(db, "chats"), botMessage);
      }
    } catch (error) {
      setError("Có lỗi xảy ra khi gửi tin nhắn: " + error.message);
      console.error("Lỗi khi gọi API:", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Chào, {user?.email}</Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.message, item.sender === "user" ? styles.userMessage : styles.botMessage]}>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        initialNumToRender={10}
        windowSize={5}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    padding: 12,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: "80%",
  },
  userMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
  },
  botMessage: {
    backgroundColor: "#34C759",
    alignSelf: "flex-start",
  },
  messageText: {
    color: "#fff",
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 20,
  },
});
