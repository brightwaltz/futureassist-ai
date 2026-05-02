/**
 * ChatPage — ホーム画面 (Step B/E)
 *
 * 画面遷移仕様書 B/E:
 *   - モヤモヤ自由入力を主CTA（上部）
 *   - よくあるテーマ（カテゴリカード）を副CTA（下部）
 *   - HiyokoCompanionの吹き出し
 *   - 1分チェック招待バナー
 */
import React, { useState, useEffect, useRef } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import ChatWindow from "../components/ChatWindow";
import ConsentModal from "../components/ConsentModal";
import HiyokoCompanion from "../components/HiyokoCompanion";
import { useUser } from "../contexts/UserContext";
import useChat from "../hooks/useChat";

// ── モヤモヤプレースホルダー（ローテーション）───────────────────────────────
const PLACEHOLDERS = [
  "なんとなく不安…",
  "親のことが気になる",
  "この出費、必要？",
  "このままでいいのか迷っている",
  "仕事と生活の両立がしんどい",
  "老後のことが心配",
  "家族のことで頭がいっぱい",
];

// ── よくあるテーマ ──────────────────────────────────────────────────────────
const TOPICS = [
  { value: "相続終活",  label: "相続・終活",   emoji: "📜" },
  { value: "介護と健康", label: "介護・健康",   emoji: "🏥" },
  { value: "お金と資産", label: "お金・資産",   emoji: "💰" },
  { value: "家庭問題",  label: "家庭・関係",   emoji: "🏠" },
  { value: "仕事と生活", label: "仕事・キャリア", emoji: "💼" },
  { value: "健康管理",  label: "健康管理",     emoji: "🌱" },
];

// ── 1分チェック招待バナー ────────────────────────────────────────────────────
function CheckBanner() {
  return (
    <Link
      to="/check"
      className="flex items-center gap-3 bg-primary-50 border border-primary-200
                 rounded-2xl px-4 py-3 hover:bg-primary-100 transition group"
    >
      <span className="text-2xl">⏱️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary-900">はじめの1分チェック</p>
        <p className="text-xs text-primary-600 mt-0.5">
          11問で今の状態を見える化 → AI整理へ
        </p>
      </div>
      <span className="text-primary-300 group-hover:text-primary-600 text-lg">→</span>
    </Link>
  );
}

export default function ChatPage() {
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  // モヤモヤ入力
  const [moyanText, setMoyanText] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef(null);

  // プレースホルダーのローテーション
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const chat = useChat(user?.id);

  // 会話履歴からの再開
  useEffect(() => {
    const resumeId = location.state?.resumeConversationId;
    if (resumeId && user?.id) {
      chat.resume(resumeId);
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.resumeConversationId]);

  // TriagePageからpreselectedTopicで来た場合（旧フロー互換）
  useEffect(() => {
    const preselected = location.state?.preselectedTopic;
    if (preselected && !chat.currentTopic) {
      handleTopicSelect(preselected);
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.preselectedTopic]);

  // ── モヤモヤ入力を送信 → TriagePage(F)へ ────────────────────────────────
  function handleMoyanSubmit(e) {
    e.preventDefault();
    const text = moyanText.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    console.log("[ChatPage] moyan_submitted", text);
    navigate("/triage", { state: { moyanText: text } });
  }

  // ── テーマカードを直接クリック → チャット開始 ───────────────────────────
  const handleTopicSelect = (topic) => {
    if (!hasConsent) {
      setShowConsent(true);
      window._pendingTopic = topic;
      return;
    }
    console.log("[ChatPage] topic_selected", topic);
    chat.connect(topic);
  };

  const handleConsent = () => {
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

  // ── チャット画面（トピック選択後）──────────────────────────────────────
  if (chat.currentTopic) {
    return (
      <>
        {showConsent && (
          <ConsentModal onAccept={handleConsent} onDecline={handleDecline} />
        )}
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
      </>
    );
  }

  // ── ホーム画面（Step B/E）─────────────────────────────────────────────
  return (
    <>
      {showConsent && (
        <ConsentModal onAccept={handleConsent} onDecline={handleDecline} />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-xl mx-auto px-4 py-8">

          {/* コンパニオン */}
          <div className="flex justify-center mb-6">
            <HiyokoCompanion
              mood="happy"
              message={
                <>
                  <span className="block">今、ちょっと気になっていることはありますか？</span>
                  <span className="block text-xs text-gray-400 mt-1">
                    うまく言葉にできなくても大丈夫です。
                  </span>
                </>
              }
              size="md"
              animated
            />
          </div>

          {/* ── モヤモヤ入力（主CTA）────────────────────────────────────── */}
          <form onSubmit={handleMoyanSubmit} className="mb-6">
            <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-sm
                            focus-within:border-primary-400 transition p-1">
              <textarea
                ref={inputRef}
                value={moyanText}
                onChange={(e) => setMoyanText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleMoyanSubmit(e);
                  }
                }}
                placeholder={PLACEHOLDERS[placeholderIdx]}
                rows={3}
                maxLength={200}
                className="w-full resize-none px-4 pt-4 pb-2 text-sm text-gray-800
                           placeholder-gray-300 focus:outline-none rounded-3xl bg-transparent"
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="text-xs text-gray-300">{moyanText.length} / 200</span>
                <button
                  type="submit"
                  disabled={moyanText.trim().length === 0}
                  className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold
                             rounded-2xl hover:bg-primary-700 transition
                             disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                >
                  整理する →
                </button>
              </div>
            </div>
          </form>

          {/* ── 1分チェック招待バナー ─────────────────────────────────── */}
          <div className="mb-6">
            <CheckBanner />
          </div>

          {/* ── よくあるテーマ（副CTA）─────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              よくあるテーマから選ぶ
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTopicSelect(t.value)}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-2xl
                             border border-gray-200 hover:border-primary-300 hover:bg-primary-50
                             text-center transition active:scale-95 group"
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700 leading-tight">
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
