import React, { useState } from "react";
import { api } from "../utils/api";

/**
 * Life Ability Survey - Static questionnaire
 * Based on MY HEROIC GAS questionnaire design (柴田研究室)
 * Adapted for 未来アシストAI context
 */

const INTRO_TEXT = `本アンケートは、ご利用者の「生活満足度」や「時間・お金の余裕」、
それに伴うウェルビーイング向上を可視化し、よりよいサービス改善に活かすことを
目的としています。
完全匿名で実施し、結果は統計的に集計し個人が特定されることはございません
ので率直なご意見をお願いいたします。
所要時間は 1 分程度です。`;

// Face emojis for visual options (replacing external image URLs for reliability)
const FACE_NEGATIVE = (
  <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto">
    <circle cx="32" cy="32" r="30" fill="#FDE68A" stroke="#F59E0B" strokeWidth="2" />
    <circle cx="22" cy="26" r="3" fill="#78350F" />
    <circle cx="42" cy="26" r="3" fill="#78350F" />
    <path d="M20 44 Q32 36 44 44" stroke="#78350F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {/* sweat drop */}
    <ellipse cx="50" cy="22" rx="3" ry="5" fill="#93C5FD" />
  </svg>
);

const FACE_NEUTRAL = (
  <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto">
    <circle cx="32" cy="32" r="30" fill="#FDE68A" stroke="#F59E0B" strokeWidth="2" />
    <circle cx="22" cy="26" r="3" fill="#78350F" />
    <circle cx="42" cy="26" r="3" fill="#78350F" />
    <path d="M22 42 Q32 44 42 42" stroke="#78350F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

const FACE_POSITIVE = (
  <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto">
    <circle cx="32" cy="32" r="30" fill="#FDE68A" stroke="#F59E0B" strokeWidth="2" />
    <circle cx="22" cy="26" r="3" fill="#78350F" />
    <circle cx="42" cy="26" r="3" fill="#78350F" />
    <path d="M20 38 Q32 50 44 38" stroke="#78350F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

// Static questionnaire data (based on GAS code)
const QUESTIONS = [
  {
    id: "q1",
    category: "satisfaction",
    question: "1. 現在の生活全体にどの程度満足していますか？",
    type: "face",
    options: [
      { value: 1, text: "不満", face: FACE_NEGATIVE },
      { value: 2, text: "普通", face: FACE_NEUTRAL },
      { value: 3, text: "満足", face: FACE_POSITIVE },
    ],
  },
  {
    id: "q2",
    category: "satisfaction",
    question: "2. 仕事と私生活のバランスに満足していますか？",
    type: "face",
    options: [
      { value: 1, text: "不満", face: FACE_NEGATIVE },
      { value: 2, text: "普通", face: FACE_NEUTRAL },
      { value: 3, text: "満足", face: FACE_POSITIVE },
    ],
  },
  {
    id: "q3",
    category: "life_ability",
    question: "3. 最近のストレスの程度を教えてください",
    type: "face",
    options: [
      { value: 1, text: "高い", face: FACE_NEGATIVE },
      { value: 2, text: "低い", face: FACE_NEUTRAL },
      { value: 3, text: "全くない", face: FACE_POSITIVE },
    ],
  },
  {
    id: "q4",
    category: "life_ability",
    question: "4. 最近、ポジティブな気持ちで過ごした時間はどれくらいありましたか？",
    type: "face",
    options: [
      { value: 1, text: "ない", face: FACE_NEGATIVE },
      { value: 2, text: "少し", face: FACE_NEUTRAL },
      { value: 3, text: "たくさん", face: FACE_POSITIVE },
    ],
  },
  {
    id: "q5",
    category: "life_ability",
    question: "5. 今のエネルギー・活力のレベルを教えてください",
    type: "face",
    options: [
      { value: 1, text: "全く活力がない", face: FACE_NEGATIVE },
      { value: 2, text: "ふつう", face: FACE_NEUTRAL },
      { value: 3, text: "非常に元気", face: FACE_POSITIVE },
    ],
  },
  {
    id: "q6",
    category: "life_ability",
    question: "6. 今年の健康診断で改善が見られた項目はありましたか？",
    type: "face",
    options: [
      { value: 1, text: "いいえ", face: FACE_NEGATIVE },
      { value: 2, text: "わからない", face: FACE_NEUTRAL },
      { value: 3, text: "はい", face: FACE_POSITIVE },
    ],
  },
  {
    id: "q7",
    category: "usage",
    question: "7. 未来アシストAI を利用したことはありますか？",
    type: "button",
    options: [
      { value: "yes", text: "はい" },
      { value: "no", text: "いいえ" },
    ],
  },
  {
    id: "q8",
    category: "usage",
    question: "8. 未来アシストAI を利用して自由に使える時間は、増えましたか？",
    type: "button",
    options: [
      { value: "increased", text: "増えた" },
      { value: "same", text: "変わらない" },
      { value: "decreased", text: "減った" },
    ],
  },
  {
    id: "q9",
    category: "usage",
    question: "9. 未来アシストAI を利用して自由に使えるお金は、増えましたか？",
    type: "button",
    options: [
      { value: "increased", text: "増えた" },
      { value: "same", text: "変わらない" },
      { value: "decreased", text: "減った" },
    ],
  },
];

export default function SurveyForm({ userId, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  function handleAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Convert answers to the API format
      const formattedAnswers = QUESTIONS.map((q, idx) => ({
        question_id: idx + 1,
        value: answers[q.id] ?? null,
      })).filter((a) => a.value !== null);

      const result = await api.submitSurvey({
        user_id: userId,
        survey_type: "life_ability",
        answers: formattedAnswers,
      });

      onComplete?.(result);
    } catch (err) {
      // Even if API fails, show local result
      const scores = computeLocalScores();
      onComplete?.(scores);
    } finally {
      setSubmitting(false);
    }
  }

  function computeLocalScores() {
    // Local scoring fallback
    const faceQuestions = QUESTIONS.filter((q) => q.type === "face");
    let total = 0;
    let count = 0;
    let satTotal = 0;
    let satCount = 0;

    faceQuestions.forEach((q) => {
      const val = answers[q.id];
      if (val !== undefined) {
        total += val;
        count++;
        if (q.category === "satisfaction") {
          satTotal += val;
          satCount++;
        }
      }
    });

    const maxScore = 3;
    return {
      life_ability_score: count > 0 ? ((total / count) / maxScore) * 100 : 0,
      satisfaction_score: satCount > 0 ? ((satTotal / satCount) / maxScore) * 100 : 0,
    };
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = QUESTIONS.length;
  const progress = (answeredCount / totalQuestions) * 100;
  const allFaceAnswered = QUESTIONS.filter((q) => q.type === "face").every(
    (q) => answers[q.id] !== undefined
  );

  // Intro screen
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              ライフアビリティ評価アンケート
            </h2>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-6">
            {INTRO_TEXT}
          </p>

          <button
            onClick={() => setStarted(true)}
            className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
          >
            アンケートを始める
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          ライフアビリティ評価アンケート
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          該当する項目をタップしてください。
        </p>

        {/* Progress bar */}
        <div className="mt-4 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {answeredCount} / {totalQuestions} 問回答済み
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-5">
        {QUESTIONS.map((q) => (
          <div
            key={q.id}
            className={`bg-white rounded-xl border p-5 transition-all duration-200 ${
              answers[q.id] !== undefined
                ? "border-blue-200 bg-blue-50/30"
                : "border-gray-200"
            }`}
          >
            <p className="text-sm font-medium text-gray-900 mb-4">
              {q.question}
            </p>

            {/* Face-based options (Q1-Q6) */}
            {q.type === "face" && (
              <div className="flex justify-center gap-4 sm:gap-8">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAnswer(q.id, opt.value)}
                    className={`flex flex-col items-center p-3 rounded-xl transition-all duration-200 min-w-[80px] ${
                      answers[q.id] === opt.value
                        ? "bg-blue-100 ring-2 ring-blue-500 scale-105"
                        : "bg-gray-50 hover:bg-gray-100 hover:scale-102"
                    }`}
                  >
                    <div className={`transition-transform duration-200 ${
                      answers[q.id] === opt.value ? "scale-110" : ""
                    }`}>
                      {opt.face}
                    </div>
                    <span className={`text-xs mt-2 font-medium ${
                      answers[q.id] === opt.value
                        ? "text-blue-700"
                        : "text-gray-600"
                    }`}>
                      {opt.text}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Button-based options (Q7-Q9) */}
            {q.type === "button" && (
              <div className="flex flex-wrap gap-3 justify-center">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAnswer(q.id, opt.value)}
                    className={`px-5 py-2.5 text-sm rounded-xl border-2 transition-all duration-200 ${
                      answers[q.id] === opt.value
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !allFaceAnswered}
        className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
      >
        {submitting ? "送信中..." : "回答を送信"}
      </button>

      {!allFaceAnswered && (
        <p className="text-xs text-center text-gray-400">
          Q1〜Q6 の全ての質問にご回答ください
        </p>
      )}
    </form>
  );
}
