/**
 * TriagePage — 状態整理3問 (Step F)
 *
 * 画面遷移仕様書 F: 3問でコンテキストを収集し AI整理結果(G)へ誘導。
 * HomeページのモヤモヤテキストまたはCheckResultPageから遷移してくる。
 *
 * ルート: /triage
 */
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

const DEGREE_OPTIONS = [
  {
    value: "small",
    label: "小さい",
    desc: "気になってはいるが、急ぎではない",
    emoji: "🌱",
    color: "border-green-300 hover:bg-green-50",
  },
  {
    value: "medium",
    label: "少し大きい",
    desc: "そろそろ動いた方がいいかも",
    emoji: "🌤️",
    color: "border-yellow-300 hover:bg-yellow-50",
  },
  {
    value: "big",
    label: "かなり大きい",
    desc: "早めに解決したい・しないといけない",
    emoji: "🔥",
    color: "border-orange-300 hover:bg-orange-50",
  },
];

const TIMING_OPTIONS = [
  {
    value: "today",
    label: "今日中",
    emoji: "⚡",
    color: "border-red-300 hover:bg-red-50",
  },
  {
    value: "thisweek",
    label: "今週中",
    emoji: "📅",
    color: "border-yellow-300 hover:bg-yellow-50",
  },
  {
    value: "someday",
    label: "そのうち",
    emoji: "🌿",
    color: "border-green-300 hover:bg-green-50",
  },
];

const STATE_OPTIONS = [
  {
    value: "unknown",
    label: "何から始めればいいか分からない",
    emoji: "🤷",
    color: "border-gray-300 hover:bg-gray-50",
  },
  {
    value: "researching",
    label: "調べているが決めきれない",
    emoji: "🔍",
    color: "border-blue-300 hover:bg-blue-50",
  },
  {
    value: "ready",
    label: "行動に移せそう",
    emoji: "🚀",
    color: "border-primary-300 hover:bg-primary-50",
  },
];

const QUESTIONS = [
  {
    id: "degree",
    text: "気になる度合いはどのくらいですか？",
    options: DEGREE_OPTIONS,
  },
  {
    id: "timing",
    text: "動きたい時期はいつ頃ですか？",
    options: TIMING_OPTIONS,
  },
  {
    id: "state",
    text: "今の状態を教えてください",
    options: STATE_OPTIONS,
  },
];

export default function TriagePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // 前画面から受け取ったコンテキスト
  const moyanText    = location.state?.moyanText    || "";
  const fromCheck    = location.state?.fromCheck    || false;
  const checkLevel   = location.state?.checkLevel   || null;
  // 旧フロー互換（ChatPageからpreselectedTopicで来た場合は旧フローへ）
  const preselected  = location.state?.preselectedTopic || null;

  const [step, setStep]     = useState(0);
  const [answers, setAnswers] = useState({});

  const q = QUESTIONS[step];
  const progress = (step / QUESTIONS.length) * 100;

  console.log("[TriagePage] step", step, "moyanText", moyanText, "fromCheck", fromCheck);

  // 旧フロー: preselectedTopicがある場合はそのままチャットへ
  if (preselected) {
    navigate("/", { state: { preselectedTopic: preselected }, replace: true });
    return null;
  }

  function handleSelect(value) {
    const updated = { ...answers, [q.id]: value };
    setAnswers(updated);
    console.log("[TriagePage] answer", q.id, "=", value);

    if (step < QUESTIONS.length - 1) {
      setStep((s) => s + 1);
    } else {
      // 全問回答 → AI整理結果へ
      navigate("/ai-result", {
        state: {
          moyanText,
          fromCheck,
          checkLevel,
          degree:  updated.degree,
          timing:  updated.timing,
          state:   updated.state,
        },
      });
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
    else navigate(-1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* プログレスバー */}
      <div className="w-full h-1.5 bg-gray-200">
        <div
          className="h-1.5 bg-primary-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-base font-bold text-gray-900">状況を整理しましょう</h1>
          <span className="text-xs text-gray-400">
            {step + 1} / {QUESTIONS.length}
          </span>
        </div>

        {/* モヤモヤテキスト表示（あれば） */}
        {moyanText && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-5">
            <p className="text-xs text-gray-400 mb-0.5">気になっていること</p>
            <p className="text-sm text-gray-700 italic">「{moyanText}」</p>
          </div>
        )}

        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood="thinking"
            message="3つの質問で状況を整理します"
            size="sm"
            animated={false}
          />
        </div>

        {/* 質問カード */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 mb-5">
          <p className="text-base font-semibold text-gray-800 leading-relaxed text-center">
            {q.text}
          </p>
        </div>

        {/* 選択肢 */}
        <div className="space-y-3 mb-6">
          {q.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2
                          text-left transition-all active:scale-95 group ${opt.color}`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                {opt.desc && (
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                )}
              </div>
              <span className="text-gray-200 group-hover:text-primary-400">→</span>
            </button>
          ))}
        </div>

        {/* 戻る */}
        <button
          onClick={handleBack}
          className="w-full py-3 rounded-2xl border border-gray-200 text-sm text-gray-400
                     hover:bg-gray-50 transition"
        >
          ← 戻る
        </button>
      </div>
    </div>
  );
}
