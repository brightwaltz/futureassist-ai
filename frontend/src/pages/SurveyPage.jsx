import React, { useState } from "react";
import SurveyForm from "../components/SurveyForm";

export default function SurveyPage() {
  const [userId] = useState(1); // Demo user
  const [result, setResult] = useState(null);

  if (result) {
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
          <p className="text-gray-500 mb-6">
            アンケートの結果が記録されました。
          </p>

          {/* Score Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-primary-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">ライフアビリティ</p>
              <p className="text-2xl font-bold text-primary-600">
                {result.life_ability_score?.toFixed(1) ?? "---"}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">生活満足度</p>
              <p className="text-2xl font-bold text-green-600">
                {result.satisfaction_score?.toFixed(1) ?? "---"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setResult(null)}
            className="px-6 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
          >
            もう一度回答する
          </button>
        </div>
      </div>
    );
  }

  return <SurveyForm userId={userId} onComplete={setResult} />;
}
