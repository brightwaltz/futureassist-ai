import React, { useState, useRef, useEffect } from "react";
import { useCompanion } from "../hooks/useCompanion";

const MOOD_LABELS = {
  sleeping: "😴 ねむい",
  normal: "😊 ふつう",
  happy: "😄 うれしい",
  excited: "🤩 ワクワク",
  loving: "🥰 しあわせ",
};

const LEVEL_ANIMATION = {
  1: "animate-pulse",
  2: "animate-bounce",
  3: "animate-bounce",
  4: "companion-spin",
  5: "companion-glow animate-bounce",
};

function HeartEffect({ show }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className="absolute text-2xl heart-float"
          style={{
            left: `${20 + i * 15}%`,
            animationDelay: `${i * 0.15}s`,
          }}
        >
          ❤️
        </span>
      ))}
    </div>
  );
}

export default function CompanionDashboard({ userId }) {
  const { companion, points, loading, feedCompanion, renameCompanion } =
    useCompanion(userId);
  const [feeding, setFeeding] = useState(false);
  const [showHearts, setShowHearts] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (editing && nameRef.current) {
      nameRef.current.focus();
    }
  }, [editing]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!companion) return null;

  const totalPoints = points?.total_points ?? 0;
  const canFeed = totalPoints >= 20;
  const animation = LEVEL_ANIMATION[companion.level] || "";
  const emoji = companion.appearance?.emoji || "🥚";
  const xpProgress = companion.xp_progress || {};

  async function handleFeed() {
    setFeeding(true);
    setFeedError(null);
    try {
      const result = await feedCompanion();
      setShowHearts(true);
      setTimeout(() => setShowHearts(false), 1500);
      if (result?.leveled_up) {
        // Could add a special celebration here
      }
    } catch (err) {
      setFeedError(err.message || "エラーが発生しました");
    } finally {
      setFeeding(false);
    }
  }

  function handleNameDoubleClick() {
    setNameInput(companion.companion_name || "");
    setEditing(true);
  }

  async function handleNameSubmit(e) {
    e.preventDefault();
    if (nameInput.trim()) {
      await renameCompanion(nameInput.trim());
    }
    setEditing(false);
  }

  const ACTION_LABELS = {
    consultation_message: "相談メッセージ",
    consultation_complete: "セッション完了",
    survey_complete: "アンケート完了",
    daily_login: "デイリーログイン",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">育成コンパニオン</h3>
        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
          💎 {totalPoints} pt
        </span>
      </div>

      <div className="p-6">
        {/* Character Display */}
        <div className="relative flex flex-col items-center mb-6">
          <HeartEffect show={showHearts} />
          <div className={`text-7xl mb-3 ${animation}`}>{emoji}</div>

          {/* Name (double-click to edit) */}
          {editing ? (
            <form onSubmit={handleNameSubmit} className="flex gap-2">
              <input
                ref={nameRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm text-center w-32"
                maxLength={20}
                onBlur={handleNameSubmit}
              />
            </form>
          ) : (
            <p
              className="text-lg font-bold text-gray-900 cursor-pointer hover:text-primary-600"
              onDoubleClick={handleNameDoubleClick}
              title="ダブルクリックで名前変更"
            >
              {companion.companion_name}
            </p>
          )}

          <p className="text-xs text-gray-400 mt-1">
            Lv.{companion.level} {companion.appearance?.label || ""}
          </p>
        </div>

        {/* XP Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>経験値</span>
            <span>
              {companion.experience} / {xpProgress.next_threshold ?? "MAX"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(xpProgress.progress ?? 0) * 100}%` }}
            />
          </div>
        </div>

        {/* Mood */}
        <div className="text-center text-sm text-gray-600 mb-4">
          気分: {MOOD_LABELS[companion.mood] || companion.mood}
        </div>

        {/* Feed Button */}
        <button
          onClick={handleFeed}
          disabled={!canFeed || feeding}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition ${
            canFeed && !feeding
              ? "bg-orange-500 text-white hover:bg-orange-600 active:scale-95"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {feeding ? "あげています..." : "🍎 えさをあげる (20pt)"}
        </button>
        {feedError && (
          <p className="text-xs text-red-500 mt-1 text-center">{feedError}</p>
        )}
        {!canFeed && !feeding && (
          <p className="text-xs text-gray-400 mt-1 text-center">
            ポイントが不足しています
          </p>
        )}

        {/* Point History Accordion */}
        <div className="mt-6">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-900"
          >
            <span>ポイント履歴</span>
            <span className="text-xs">{historyOpen ? "▲" : "▼"}</span>
          </button>
          {historyOpen && points?.history && (
            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {points.history.slice(0, 10).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50"
                >
                  <div>
                    <span className="text-gray-700">
                      {ACTION_LABELS[h.action_type] || h.action_type}
                    </span>
                    <span className="text-gray-400 ml-2">
                      {h.created_at
                        ? new Date(h.created_at).toLocaleString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <span className="text-green-600 font-medium">
                    +{h.points_earned}pt
                  </span>
                </div>
              ))}
              {points.history.length === 0 && (
                <p className="text-xs text-gray-400 py-2">まだ履歴がありません</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSS for custom animations */}
      <style>{`
        @keyframes heart-float {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.5); }
        }
        .heart-float {
          animation: heart-float 1.2s ease-out forwards;
        }
        @keyframes companion-spin-kf {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        .companion-spin {
          animation: companion-spin-kf 2s ease-in-out infinite;
        }
        @keyframes companion-glow-kf {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(234, 179, 8, 0.5)); }
          50% { filter: drop-shadow(0 0 16px rgba(234, 179, 8, 0.9)); }
        }
        .companion-glow {
          animation: companion-glow-kf 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
