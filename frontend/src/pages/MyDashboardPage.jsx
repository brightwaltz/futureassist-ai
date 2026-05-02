import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { api } from "../utils/api";
import ScoreTrendChart from "../components/ScoreTrendChart";
import CompanionDashboard from "../components/CompanionDashboard";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";

// ─── LA 5要素 RadarChart コンポーネント ───────────────────────────────────────
const LA_LABELS = {
  s1_info_org:  "情報整理力",
  s2_decision:  "意思決定",
  s3_action:    "行動移行力",
  s4_stability: "生活安定性",
  s5_resource:  "リソース創出",
};

function LifeAbilityRadar({ history }) {
  if (!history || history.length === 0) return null;
  const latest = history[0]; // 最新スコア

  const data = Object.entries(LA_LABELS).map(([key, label]) => ({
    subject: label,
    score: latest[key] != null ? Math.round(latest[key]) : 0,
    fullMark: 100,
  }));

  const hasData = data.some((d) => d.score > 0);
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Life Ability 5要素レーダー</h3>
        <span className="text-xs text-gray-400">
          最新スコア（{latest.created_at ? new Date(latest.created_at).toLocaleDateString("ja-JP") : "---"}）
        </span>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Radar */}
        <div className="w-full md:w-1/2" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} tickCount={3} />
              <Radar
                name="スコア"
                dataKey="score"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                formatter={(v) => [`${v}点`, "スコア"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Score list */}
        <div className="w-full md:w-1/2 space-y-2">
          {data.map((d) => (
            <div key={d.subject} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24 shrink-0">{d.subject}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 w-8 text-right">
                {d.score}
              </span>
            </div>
          ))}
          {latest.ema_score != null && (
            <p className="text-xs text-gray-400 pt-1">
              EMA総合スコア: <span className="font-semibold text-indigo-600">{latest.ema_score.toFixed(1)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [laHistory, setLaHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  async function loadData() {
    try {
      const [wb, sv, convs, la] = await Promise.allSettled([
        api.getWellbeing(userId),
        api.getSurveyHistory(userId),
        api.getUserConversations(userId, 1),
        api.getLifeAbilityHistory(userId),
      ]);
      if (wb.status === "fulfilled") setWellbeing(wb.value);
      if (sv.status === "fulfilled") setSurveys(sv.value);
      if (convs.status === "fulfilled") setRecentConversations((convs.value.items || []).slice(0, 3));
      if (la.status === "fulfilled") setLaHistory(la.value || []);
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

      {/* Companion */}
      {userId && (
        <CompanionDashboard userId={userId} />
      )}

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

      {/* Life Ability 5要素 RadarChart（Phase 3） */}
      {laHistory.length > 0 && <LifeAbilityRadar history={laHistory} />}

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
