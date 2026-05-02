/**
 * SessionEndPage — セッション終了チェック (Step J)
 * 2問のフィードバック
 * ルート: /session-end
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

const Q1_OPTIONS = [
  { value: "decided",  label: "次にやることが決まった",  emoji: "🎯" },
  { value: "lighter",  label: "少し楽になった",         emoji: "😌" },
  { value: "same",     label: "まだ変わらない",          emoji: "🤔" },
];

const Q2_OPTIONS = [
  { value: "very",   label: "とても役に立った",    emoji: "⭐⭐⭐" },
  { value: "mostly", label: "まあ役に立った",      emoji: "⭐⭐" },
  { value: "little", label: "あまり役に立たなかった", emoji: "⭐" },
];

export default function SessionEndPage() {
  const navigate = useNavigate();
  const [q1, setQ1] = useState(null);
  const [q2, setQ2] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!q1 || !q2) return;
    console.log("[SessionEndPage] feedback_submitted", { change: q1, usefulness: q2 });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-sm mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <HiyokoCompanion
              mood="excited"
              message="ありがとうございました！また来てください"
              size="lg"
              animated
            />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            今日もお疲れさまでした
          </h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            1週間後に、状況がどう変わったか確認しましょう。
            <br />フォローアップをお送りします。
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/")}
              className="w-full py-4 bg-primary-600 text-white font-bold text-sm
                         rounded-2xl hover:bg-primary-700 transition"
            >
              ホームに戻る
            </button>
            <button
              onClick={() => navigate("/followup")}
              className="w-full py-3 border border-gray-200 text-gray-500 text-sm
                         rounded-2xl hover:bg-gray-50 transition"
            >
              1週間後のフォローアップを見る（プレビュー）
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood="happy"
            message="今日の整理はいかがでしたか？"
            size="md"
            animated={false}
          />
        </div>

        <h1 className="text-lg font-bold text-gray-900 text-center mb-6">
          今日の整理を振り返る
        </h1>

        {/* Q1 */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-gray-800 mb-4">
            今日の整理で、どう変わりましたか？
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
            今回の整理は役に立ちましたか？
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
                <span className="text-base leading-none">{opt.emoji}</span>
                <span className={`font-medium ${q2 === opt.value ? "text-primary-700" : "text-gray-700"}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={!q1 || !q2}
          className="w-full py-4 bg-primary-600 text-white font-bold text-sm rounded-2xl
                     hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          送信して終了する
        </button>
      </div>
    </div>
  );
}
