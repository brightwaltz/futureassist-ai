import React, { useState } from "react";
import TopicSelector from "../components/TopicSelector";
import ChatWindow from "../components/ChatWindow";
import ConsentModal from "../components/ConsentModal";
import useChat from "../hooks/useChat";

export default function ChatPage() {
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [userId] = useState(1); // Demo user ID

  const chat = useChat(userId);

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
