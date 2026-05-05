/**
 * CoachingPage — 深掘り整理コーチング (Step H)
 * 3問の追加質問 → AI整理結果を再表示
 * ルート: /coaching
 */
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

const COACHING_QUESTIONS = [
  {
    id: "timeframe",
    text: "それは「今」の問題ですか？それとも「将来」の備えですか？",
    options: [
      { value: "now",    label: "今すぐ対処が必要",    emoji: "🔥" },
      { value: "near",   label: "近い将来（1年以内）",  emoji: "📅" },
      { value: "future", label: "将来への備え",         emoji: "🔭" },
    ],
  },
  {
    id: "who",
    text: "それは主にあなた自身のことですか？それとも家族のことですか？",
    options: [
      { value: "self",   label: "主に自分のこと",  emoji: "🙋" },
      { value: "family", label: "家族のこと",     emoji: "👨‍👩‍👧" },
      { value: "both",   label: "両方関係する",   emoji: "🤝" },
    ],
  },
  {
    id: "barrier",
    text: "前に進めない一番の理由は何ですか？",
    options: [
      { value: "info",    label: "情報が足りない",      emoji: "📚" },
      { value: "decide",  label: "決めきれない・迷っている", emoji: "🤔" },
      { value: "action",  label: "行動する踏ん切りがつかない", emoji: "🚪" },
      { value: "support", label: "相談できる人・場所がない", emoji: "🗣️" },
    ],
  },
];

// コーチング回答から強化されたアクションを生成
function buildEnhancedAction(base, coaching) {
  const { timeframe, who, barrier } = coaching;

  const barrierActions = {
    info:    "まず公的機関のサイトや相談窓口で基本情報を調べる",
    decide:  "選択肢をメモに書き出して比較検討する",
    action:  "小さな最初の一歩（問い合わせだけでもOK）を今日踏み出す",
    support: "地域の相談窓口やHEROICのサポートを活用する",
  };

  const whoNote =
    who === "family" ? "（家族と一緒に取り組む）" :
    who === "both"   ? "（家族にも状況を共有しながら）" : "";

  const action = barrierActions[barrier] || base;
  return `${action}${whoNote}`;
}

export default function CoachingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const triageContext = location.state || {};

  const [step, setStep] = useState(0);
  const [coaching, setCoaching] = useState({});

  const q = COACHING_QUESTIONS[step];
  const progress = ((step + 1) / (COACHING_QUESTIONS.length + 1)) * 100;

  console.log("[CoachingPage] question", q?.id, "step", step);

  function handleSelect(value) {
    const updated = { ...coaching, [q.id]: value };
    setCoaching(updated);
    console.log("[CoachingPage] answer", q.id, "=", value);

    if (step < COACHING_QUESTIONS.length - 1) {
      setStep((s) => s + 1);
    } else {
      // 全問回答完了 → AI整理結果へ（コーチングデータを追加）
      navigate("/ai-result", {
        state: {
          ...triageContext,
          coaching: updated,
          enhanced: true,
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
          <h1 className="text-base font-bold text-gray-900">もう少し整理する</h1>
          <span className="text-xs text-gray-400">
            {step + 1} / {COACHING_QUESTIONS.length}
          </span>
        </div>

        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood="thinking"
            message="もう少し教えてください。より的確なサポートができます"
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
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2
                         border-gray-200 hover:border-primary-400 hover:bg-primary-50
                         text-left transition-all active:scale-95 group"
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                {opt.label}
              </span>
              <span className="ml-auto text-gray-200 group-hover:text-primary-400">→</span>
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
