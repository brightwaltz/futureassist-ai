import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import TopicSelector from "../components/TopicSelector";
import ChatWindow from "../components/ChatWindow";
import ConsentModal from "../components/ConsentModal";
import { useUser } from "../contexts/UserContext";
import useChat from "../hooks/useChat";

// ─── トリアージバナー ──────────────────────────────────────────────────────────
function TriageBanner() {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-6">
      <Link
        to="/triage"
        className="flex items-center gap-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4
                   hover:bg-indigo-100 hover:border-indigo-300 transition group"
      >
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-900">
            何から始めればよいかわからない方へ
          </p>
          <p className="text-xs text-indigo-600 mt-0.5">
            3つの質問で今の状況を整理 → 最適なテーマを特定できます
          </p>
        </div>
        <span className="text-indigo-400 group-hover:text-indigo-600 text-lg shrink-0">→</span>
      </Link>
    </div>
  );
}

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
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.resumeConversationId]);

  // Handle preselected topic arriving from TriagePage
  useEffect(() => {
    const preselected = location.state?.preselectedTopic;
    if (preselected && !chat.currentTopic) {
      handleTopicSelect(preselected);
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.preselectedTopic]);

  const handleTopicSelect = (topic) => {
    if (!hasConsent) {
      setShowConsent(true);
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
        <>
          <TriageBanner />
          <TopicSelector onSelect={handleTopicSelect} />
        </>
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
