/**
 * CheckResultPage — 1分チェック結果要約 (Step D)
 * ルート: /check/result
 */
import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

const SCORE_LABELS = {
  high:   { label: "余裕がある状態",          color: "text-green-700",   bg: "bg-green-50",   icon: "🌟" },
  medium: { label: "少し負荷がかかっている状態", color: "text-yellow-700",  bg: "bg-yellow-50",  icon: "⚡" },
  low:    { label: "余裕が少し減りやすい状態",  color: "text-orange-700",  bg: "bg-orange-50",  icon: "🌱" },
};

// スコアから状態ラベルへ変換
function classifyScore(avg) {
  if (avg >= 4.0) return "high";
  if (avg >= 2.5) return "medium";
  return "low";
}

// 特に注意が必要な質問を特定
const CONCERN_TEXTS = {
  3:  "ストレス",
  6:  "仕事への影響",
  7:  "準備不足テーマ",
  9:  "家族への気がかり",
};

export default function CheckResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const answers = location.state?.answers || {};

  console.log("[CheckResultPage] answers received", answers);

  const { avg, level, concerns } = useMemo(() => {
    const vals = Object.values(answers);
    if (vals.length === 0) return { avg: 3, level: "medium", concerns: [] };

    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const level = classifyScore(avg);

    // 低スコア（1点）の質問を特定
    const concerns = Object.entries(answers)
      .filter(([, v]) => v === 1)
      .map(([id]) => CONCERN_TEXTS[Number(id)])
      .filter(Boolean);

    return { avg, level, concerns };
  }, [answers]);

  const info = SCORE_LABELS[level];

  function handleChat() {
    console.log("[CheckResultPage] action: start_chat", { level, avg: avg.toFixed(1) });
    navigate("/triage", { state: { fromCheck: true, checkLevel: level } });
  }

  function handleLater() {
    console.log("[CheckResultPage] action: later");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood={level === "high" ? "happy" : "thinking"}
            message="今の状態を整理しました"
            size="md"
            animated
          />
        </div>

        {/* 状態カード */}
        <div className={`rounded-3xl ${info.bg} border border-opacity-30 p-6 mb-5 text-center`}>
          <div className="text-4xl mb-3">{info.icon}</div>
          <p className="text-xs text-gray-500 mb-1">あなたの今の状態</p>
          <p className={`text-xl font-bold ${info.color}`}>{info.label}</p>
          <p className="text-sm text-gray-500 mt-2">
            スコア: {avg.toFixed(1)} / 5.0
          </p>
        </div>

        {/* 気になる点 */}
        {concerns.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-5 mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">特に気になる点</p>
            <div className="flex flex-wrap gap-2">
              {concerns.map((c) => (
                <span
                  key={c}
                  className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1 rounded-full"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              これらのテーマについて、AIが整理をお手伝いします
            </p>
          </div>
        )}

        {/* メッセージ */}
        <div className="bg-white rounded-3xl border border-primary-100 p-5 mb-6">
          <p className="text-sm text-gray-700 leading-relaxed">
            {level === "high"
              ? "今はバランスが取れている状態です。引き続きセルフケアを続けながら、将来に向けた準備も考えてみましょう。"
              : level === "medium"
              ? "少し負荷がかかっているようです。気になることをAIと一緒に整理して、次の一手を考えてみましょう。"
              : "余裕が少し落ちているようです。一つずつ整理することで、だいぶ楽になります。AIがサポートします。"}
          </p>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={handleChat}
            className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white
                       font-bold text-sm rounded-2xl transition shadow-sm active:scale-95"
          >
            🐥 このまま相談する
          </button>
          <button
            onClick={handleLater}
            className="w-full py-3 border border-gray-200 rounded-2xl text-sm text-gray-500
                       hover:bg-gray-50 transition"
          >
            あとで相談する
          </button>
        </div>
      </div>
    </div>
  );
}
