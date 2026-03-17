import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import TopicSelector from "../components/TopicSelector";
import ChatWindow from "../components/ChatWindow";
import ConsentModal from "../components/ConsentModal";
import { useUser } from "../contexts/UserContext";
import useChat from "../hooks/useChat";

export default function ChatPage() {
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const { user } = useUser();
  const location = useLocation();

  const chat = useChat(user?.id);

  // Handle resume from conversation history
  useEffect(() => {
    const resumeId = location.state?.resumeConversationId;
    if (resumeId && user?.id) {
      chat.resume(resumeId);
      // Clear the state so we don't resume again on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.resumeConversationId]);

  const handleTopicSelect = (topic) => {
    if (!hasConsent) {
      setShowConsent(true);
      // Store selected topic for after consent
      window._pendingTopic = topic;
      return;
    }
    chat.connect(topic);
  };

  const handleConsent = (version) => {
    setHasConsent(true);
    setShowConsent(false);
    if (window._pendingTopic) {
      chat.connect(window._pendingTopic);
      delete window._pendingTopic;
    }
  };

  const handleDecline = () => {
    setShowConsent(false);
    delete window._pendingTopic;
  };

  return (
    <>
      {showConsent && (
        <ConsentModal onAccept={handleConsent} onDecline={handleDecline} />
      )}

      {!chat.currentTopic ? (
        <TopicSelector onSelect={handleTopicSelect} />
      ) : (
        <ChatWindow
          messages={chat.messages}
          isTyping={chat.isTyping}
          currentStep={chat.currentStep}
          onSendMessage={
            chat.isConnected ? chat.sendMessage : chat.sendMessageREST
          }
          onEndSession={() => {
            chat.endSession();
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
