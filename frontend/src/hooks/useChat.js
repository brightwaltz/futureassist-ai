import { useState, useCallback, useRef, useEffect } from "react";
import { createChatWebSocket, api } from "../utils/api";

/**
 * Custom hook for managing chat state and WebSocket connection.
 */
export default function useChat(userId) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const wsRef = useRef(null);

  const connect = useCallback((topic) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setCurrentTopic(topic);
    setMessages([]);

    const ws = createChatWebSocket({
      onOpen: () => {
        setIsConnected(true);
        ws.initSession(userId, topic);
      },
      onSessionInit: (payload) => {
        setSessionId(payload.session_id);
        setCurrentStep(payload.current_step);
        if (payload.greeting) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: payload.greeting,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      },
      onMessage: (payload) => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: payload.text,
            suggestedLinks: payload.suggested_links || [],
            nextQuestion: payload.next_question,
            emotion: payload.emotion,
            timestamp: new Date().toISOString(),
          },
        ]);
        setCurrentStep(payload.current_step);
        setIsTyping(false);
      },
      onTyping: (typing) => setIsTyping(typing),
      onSessionEnd: () => {
        setIsConnected(false);
        setSessionId(null);
      },
      onClose: () => setIsConnected(false),
      onError: (msg) => {
        console.error("Chat error:", msg);
        setIsTyping(false);
      },
    });

    wsRef.current = ws;
  }, [userId]);

  const sendMessage = useCallback((text) => {
    if (!wsRef.current || !text.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);

    wsRef.current.sendMessage(text);
  }, []);

  const endSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.endSession();
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Fallback: REST API for chat when WebSocket unavailable
  const sendMessageREST = useCallback(async (text) => {
    if (!sessionId) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    setIsTyping(true);

    try {
      const response = await api.sendMessage({
        session_id: sessionId,
        user_input: text,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.assistant_reply,
          suggestedLinks: response.suggested_links || [],
          nextQuestion: response.next_question,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "申し訳ございません。一時的にエラーが発生しました。",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [sessionId]);

  return {
    messages,
    isTyping,
    isConnected,
    currentTopic,
    currentStep,
    sessionId,
    connect,
    sendMessage,
    sendMessageREST,
    endSession,
  };
}
