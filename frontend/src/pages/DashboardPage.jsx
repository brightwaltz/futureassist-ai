import React, { useState, useEffect } from "react";
import { api } from "../utils/api";

/**
 * User-facing dashboard showing scores and metrics.
 * For the full analytics dashboard, see the Streamlit app.
 */
export default function DashboardPage() {
  const [userId] = useState(1);
  const [wellbeing, setWellbeing] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [wb, sv] = await Promise.allSettled([
        api.getWellbeing(userId),
        api.getSurveyHistory(userId),
      ]);
      if (wb.status === "fulfilled") setWellbeing(wb.value);
      if (sv.status === "fulfilled") setSurveys(sv.value);
    } catch (err) {
      console.error("Dashboard data load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">マイダッシュボード</h2>

      {/* Wellbeing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ScoreCard
          label="総合ウェルビーイング"
          value={wellbeing?.wellbeing_index}
          color="primary"
        />
        <ScoreCard
          label="ライフアビリティ"
          value={wellbeing?.components?.life_ability_score}
          color="blue"
        />
        <ScoreCard
          label="生活満足度"
          value={wellbeing?.components?.satisfaction_score}
          color="green"
        />
        <ScoreCard
          label="ストレス"
          value={
            wellbeing?.components?.stress_level != null
              ? (10 - wellbeing.components.stress_level) * 10
              : null
          }
          color="yellow"
          subtitle="(低いほど良い)"
        />
      </div>

      {/* Survey History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">アンケート履歴</h3>
        </div>
        {surveys.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            まだアンケート記録がありません。
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日時</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">LA スコア</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">満足度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {surveys.map((s) => (
                <tr key={s.survey_id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(s.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {s.survey_type === "life_ability" ? "ライフアビリティ" : s.survey_type}
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-medium text-gray-900">
                    {s.life_ability_score?.toFixed(1) ?? "---"}
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-medium text-gray-900">
                    {s.satisfaction_score?.toFixed(1) ?? "---"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        詳細な分析は管理者ダッシュボード（Streamlit）をご覧ください。
      </p>
    </div>
  );
}

function ScoreCard({ label, value, color = "primary", subtitle }) {
  const colorMap = {
    primary: "bg-primary-50 text-primary-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
  };

  return (
    <div className={`rounded-xl p-4 ${colorMap[color] || colorMap.primary}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">
        {value != null ? value.toFixed(1) : "---"}
      </p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
