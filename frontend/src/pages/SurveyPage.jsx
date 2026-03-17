import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";
import SurveyForm from "../components/SurveyForm";

export default function SurveyPage() {
  const { user } = useUser();
  const userId = user?.id;
  const [result, setResult] = useState(null);

  if (result) {
    const laScore = result.life_ability_score ?? 0;
    const satScore = result.satisfaction_score ?? 0;

    // Determine level text
    function getLevel(score) {
      if (score >= 80) return { text: "非常に良好", color: "text-green-600" };
      if (score >= 60) return { text: "良好", color: "text-blue-600" };
      if (score >= 40) return { text: "普通", color: "text-yellow-600" };
      return { text: "改善の余地あり", color: "text-red-500" };
    }

    const laLevel = getLevel(laScore);
    const satLevel = getLevel(satScore);

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            ご回答ありがとうございました
          </h2>
          <p className="text-gray-500 mb-6 text-sm">
            アンケートの結果をもとに、あなたのスコアを算出しました。
          </p>

          {/* Score Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-1">ライフアビリティ</p>
              <p className="text-3xl font-bold text-blue-600">
                {laScore.toFixed(1)}
              </p>
              <p className={`text-xs mt-1 font-medium ${laLevel.color}`}>
                {laLevel.text}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-1">生活満足度</p>
              <p className="text-3xl font-bold text-green-600">
                {satScore.toFixed(1)}
              </p>
              <p className={`text-xs mt-1 font-medium ${satLevel.color}`}>
                {satLevel.text}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-6">
            スコアは0〜100の範囲で算出されます。
            このデータは匿名で統計処理され、サービス改善に活用されます。
          </p>

          <button
            onClick={() => setResult(null)}
            className="px-6 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
          >
            もう一度回答する
          </button>
        </div>
      </div>
    );
  }

  return <SurveyForm userId={userId} onComplete={setResult} />;
}
