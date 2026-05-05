/**
 * FollowupPage — 1週間後フォローアップ (Step K)
 * モックアップ
 * ルート: /followup
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

const Q1_OPTIONS = [
  { value: "done",     label: "行動できた",         emoji: "🎉" },
  { value: "progress", label: "少し進んだ",          emoji: "🚶" },
  { value: "same",     label: "まだそのまま",        emoji: "🕰️" },
  { value: "resolved", label: "もう気にならない",    emoji: "✨" },
];

const Q2_OPTIONS = [
  { value: "better",      label: "楽になった",       emoji: "😊" },
  { value: "little",      label: "少し楽になった",   emoji: "🙂" },
  { value: "same",        label: "変わらない",        emoji: "😐" },
  { value: "worse",       label: "増えた",            emoji: "😟" },
];

export default function FollowupPage() {
  const navigate = useNavigate();
  const [q1, setQ1] = useState(null);
  const [q2, setQ2] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!q1 || !q2) return;
    console.log("[FollowupPage] followup_submitted", { progress: q1, emotion: q2 });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-sm mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <HiyokoCompanion
              mood={q1 === "done" || q1 === "resolved" ? "excited" : "happy"}
              message={
                q1 === "done" ? "行動できましたね！すばらしい🎉"
                : q1 === "resolved" ? "解決できてよかったです✨"
                : "また一緒に整理しましょう"
              }
              size="lg"
              animated
            />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            回答ありがとうございます
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            また気になることがあれば、いつでも相談してください。
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-4 bg-primary-600 text-white font-bold text-sm
                       rounded-2xl hover:bg-primary-700 transition"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* バッジ */}
        <div className="flex justify-center mb-4">
          <span className="text-xs bg-primary-100 text-primary-700 font-semibold
                           px-4 py-1.5 rounded-full border border-primary-200">
            📅 1週間後のフォローアップ
          </span>
        </div>

        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood="normal"
            message="先週の整理から1週間が経ちました"
            size="md"
            animated={false}
          />
        </div>

        <h1 className="text-lg font-bold text-gray-900 text-center mb-1">
          その後、どうなりましたか？
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          回答は今後のサポート改善に活用されます
        </p>

        {/* Q1 */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-gray-800 mb-4">
            実際にどうなりましたか？
          </p>
          <div className="space-y-2">
            {Q1_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQ1(opt.value)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left
                            text-sm transition-all active:scale-95
                            ${q1 === opt.value
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-100 bg-gray-50 hover:border-primary-300"
                            }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className={`font-medium ${q1 === opt.value ? "text-primary-700" : "text-gray-700"}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Q2 */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-gray-800 mb-4">
            気持ちはどう変わりましたか？
          </p>
          <div className="space-y-2">
            {Q2_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQ2(opt.value)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left
                            text-sm transition-all active:scale-95
                            ${q2 === opt.value
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-100 bg-gray-50 hover:border-primary-300"
                            }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className={`font-medium ${q2 === opt.value ? "text-primary-700" : "text-gray-700"}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 再相談ボタン */}
        {q1 === "same" && (
          <div className="bg-primary-50 rounded-3xl border border-primary-200 p-4 mb-4">
            <p className="text-sm text-primary-800 font-medium mb-2">
              まだ動けていない場合、もう一度整理しますか？
            </p>
            <button
              onClick={() => navigate("/triage")}
              className="w-full py-3 bg-primary-600 text-white text-sm font-medium
                         rounded-2xl hover:bg-primary-700 transition"
            >
              もう一度整理する
            </button>
          </div>
        )}

        {/* 送信 */}
        <button
          onClick={handleSubmit}
          disabled={!q1 || !q2}
          className="w-full py-4 bg-primary-600 text-white font-bold text-sm rounded-2xl
                     hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          回答を送信する
        </button>
      </div>
    </div>
  );
}
