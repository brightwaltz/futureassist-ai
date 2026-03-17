import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { api } from "../utils/api";
import ScoreTrendChart from "../components/ScoreTrendChart";

function ScoreLevel({ score }) {
  if (score == null) return <span className="text-gray-400">---</span>;
  let label, color;
  if (score >= 80) {
    label = "高い";
    color = "text-green-600";
  } else if (score >= 50) {
    label = "中程度";
    color = "text-yellow-600";
  } else {
    label = "低い";
    color = "text-red-600";
  }
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}

export default function MyDashboardPage() {
  const { user } = useUser();
  const userId = user?.id;
  const navigate = useNavigate();
  const [wellbeing, setWellbeing] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [recentConversations, setRecentConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  async function loadData() {
    try {
      const [wb, sv, convs] = await Promise.allSettled([
        api.getWellbeing(userId),
        api.getSurveyHistory(userId),
        api.getUserConversations(userId, 1),
      ]);
      if (wb.status === "fulfilled") setWellbeing(wb.value);
      if (sv.status === "fulfilled") setSurveys(sv.value);
      if (convs.status === "fulfilled") setRecentConversations((convs.value.items || []).slice(0, 3));
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

  const hasData = wellbeing || surveys.length > 0;

  if (!hasData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">マイダッシュボード</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-2">まだデータがありません</p>
          <p className="text-sm text-gray-400 mb-6">
            アンケートに回答するとスコアの推移を確認できます。
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/survey"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition"
            >
              アンケートに回答する
            </Link>
            <Link
              to="/"
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              相談を始める
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">マイダッシュボード</h2>

      {/* Score Cards */}
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

      {/* Recent Conversations */}
      {recentConversations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">最近の相談</h3>
            <Link to="/history" className="text-xs text-primary-600 hover:underline">
              すべて見る
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentConversations.map((conv) => (
              <div
                key={conv.id}
                className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate("/", { state: { resumeConversationId: conv.id } })}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{conv.topic || "その他"}</p>
                  <p className="text-xs text-gray-400">
                    {conv.started_at ? new Date(conv.started_at).toLocaleString("ja-JP") : "---"}
                  </p>
                </div>
                <span className="text-xs text-primary-600">続きから →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Trend Chart */}
      {surveys.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">スコア推移</h3>
          </div>
          <div className="p-4">
            <ScoreTrendChart surveys={surveys} />
          </div>
        </div>
      )}

      {/* Life Ability 5 Elements */}
      {wellbeing?.components?.life_ability_score != null && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Life Ability 5要素</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            {[
              { key: "information_organizing", label: "情報整理力" },
              { key: "decision_satisfaction", label: "意思決定納得度" },
              { key: "action_bridging", label: "行動移行力" },
              { key: "life_stability", label: "生活運用安定性" },
              { key: "resource_optimization", label: "リソース創出力" },
            ].map((el) => (
              <div key={el.key} className="text-center">
                <p className="text-xs text-gray-500">{el.label}</p>
                <p className="text-lg font-bold text-primary-600">
                  {wellbeing?.components?.life_ability_elements?.[el.key]?.toFixed(1) ?? "---"}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-sm text-gray-500">ライフアビリティ総合: </span>
              <ScoreLevel score={wellbeing.components.life_ability_score} />
            </div>
            <div>
              <span className="text-sm text-gray-500">満足度: </span>
              <ScoreLevel score={wellbeing.components.satisfaction_score} />
            </div>
          </div>
        </div>
      )}

      {/* Survey History Table */}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  種類
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  LA スコア
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  満足度
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {surveys.map((s) => (
                <tr key={s.survey_id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(s.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {s.survey_type === "life_ability"
                      ? "ライフアビリティ"
                      : s.survey_type}
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
      {subtitle && (
        <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
