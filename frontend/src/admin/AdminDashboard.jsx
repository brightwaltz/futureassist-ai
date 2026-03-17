import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { getStats } from "./adminApi";

const CHART_COLORS = ["#0078c6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const kpiConfig = [
  { key: "conversation_count", label: "相談件数", color: "bg-blue-100 text-blue-600" },
  { key: "survey_count", label: "アンケート回答数", color: "bg-green-100 text-green-600" },
  { key: "active_users", label: "アクティブユーザー", color: "bg-purple-100 text-purple-600" },
  { key: "avg_life_ability_score", label: "平均LAスコア", color: "bg-amber-100 text-amber-600" },
];

const kpiIcons = [
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
];

export default function AdminDashboard() {
  const { tenantSlug } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats(tenantSlug)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 rounded-xl p-6 text-center">
        <p className="font-medium">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const topicData = stats.topic_distribution
    ? Object.entries(stats.topic_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const satisfactionData = [
    { name: "満足度", value: stats.avg_satisfaction_score || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiConfig.map((kpi, i) => (
          <div
            key={kpi.key}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                {kpiIcons[i]}
              </div>
              <div>
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {kpi.key === "avg_life_ability_score"
                    ? (stats[kpi.key] ?? 0).toFixed(1)
                    : stats[kpi.key] ?? 0}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Topic Distribution Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">トピック分布</h3>
          {topicData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={topicData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {topicData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-16">データなし</p>
          )}
        </div>

        {/* Satisfaction Score Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">満足度スコア</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={satisfactionData} layout="vertical">
              <XAxis type="number" domain={[0, 5]} tickCount={6} />
              <YAxis type="category" dataKey="name" width={60} />
              <Tooltip formatter={(v) => v.toFixed(1)} />
              <Bar dataKey="value" fill="#0078c6" radius={[0, 6, 6, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-2xl font-bold text-primary-600 mt-2">
            {(stats.avg_satisfaction_score ?? 0).toFixed(1)}
            <span className="text-sm text-gray-400 font-normal"> / 5.0</span>
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">最近のアクティビティ</h3>
        <p className="text-sm text-gray-400">
          直近の相談件数: {stats.conversation_count ?? 0}件、アンケート回答: {stats.survey_count ?? 0}件
        </p>
      </div>
    </div>
  );
}
