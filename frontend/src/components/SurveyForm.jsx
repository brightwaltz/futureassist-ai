import React, { useState, useEffect } from "react";
import { api } from "../utils/api";

const LIKERT_OPTIONS = [
  { value: 1, label: "全くそう思わない" },
  { value: 2, label: "あまりそう思わない" },
  { value: 3, label: "どちらとも言えない" },
  { value: 4, label: "ややそう思う" },
  { value: 5, label: "とてもそう思う" },
];

export default function SurveyForm({ userId, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    try {
      const data = await api.getQuestions();
      setQuestions(data);
    } catch (err) {
      setError("質問の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, value]) => ({
          question_id: parseInt(questionId),
          value: value,
        })
      );

      const result = await api.submitSurvey({
        user_id: userId,
        survey_type: "life_ability",
        answers: formattedAnswers,
      });

      onComplete?.(result);
    } catch (err) {
      setError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const totalRequired = questions.filter((q) => q.is_required).length;
  const progress = totalRequired > 0 ? (answeredCount / totalRequired) * 100 : 0;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          ライフアビリティ評価アンケート
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          現在の生活や心身の状態についてお聞かせください。
        </p>

        {/* Progress bar */}
        <div className="mt-4 bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {answeredCount} / {totalRequired} 問回答済み
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <p className="text-sm font-medium text-gray-900 mb-3">
              <span className="text-primary-600 mr-2">Q{idx + 1}.</span>
              {q.question_text}
              {q.is_required && (
                <span className="text-red-400 ml-1">*</span>
              )}
            </p>

            {q.question_type === "likert" && (
              <div className="flex flex-wrap gap-2">
                {LIKERT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAnswer(q.id, opt.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      answers[q.id] === opt.value
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {q.question_type === "yes_no" && (
              <div className="flex gap-3">
                {[
                  { value: true, label: "はい" },
                  { value: false, label: "いいえ" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => handleAnswer(q.id, opt.value)}
                    className={`px-4 py-2 text-sm rounded-lg border transition ${
                      answers[q.id] === opt.value
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {q.question_type === "free_text" && (
              <textarea
                value={answers[q.id] || ""}
                onChange={(e) => handleAnswer(q.id, e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ご自由にお書きください..."
              />
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || answeredCount < totalRequired}
        className="w-full py-3 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {submitting ? "送信中..." : "回答を送信"}
      </button>
    </form>
  );
}
