import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
} from "recharts";
import { getSurveyStats, exportSurveys } from "./adminApi";

export default function AdminSurveys() {
  const { tenantSlug } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getSurveyStats(tenantSlug)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSurveys(tenantSlug);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

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

  const chartData = (stats?.questions || []).map((q) => {
    const text = q.question_text || `質問 ${q.question_id}`;
    return {
      name: text.length > 20 ? text.slice(0, 20) + "…" : text,
      fullName: text,
      avg: parseFloat(q.avg_value?.toFixed(2) ?? 0),
      stddev: parseFloat(q.stddev_value?.toFixed(2) ?? 0),
      count: q.response_count ?? 0,
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm">
        <p className="font-medium text-gray-900 mb-1">{d.fullName}</p>
        <p className="text-gray-600">平均: {d.avg}</p>
        <p className="text-gray-600">標準偏差: {d.stddev}</p>
        <p className="text-gray-600">回答数: {d.count}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">アンケート分析</h2>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? "エクスポート中..." : "CSVエクスポート"}
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">質問別平均スコア</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" domain={[0, 5]} tickCount={6} />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" fill="#0078c6" radius={[0, 6, 6, 0]} barSize={24}>
                <ErrorBar dataKey="stddev" width={4} stroke="#94a3b8" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 text-center py-16">データなし</p>
        )}
      </div>

      {/* Per-question details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">質問</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">平均</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">標準偏差</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">回答数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(stats?.questions || []).map((q) => (
              <tr key={q.question_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{q.question_text || `質問 ${q.question_id}`}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {q.avg_value?.toFixed(2) ?? "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {q.stddev_value?.toFixed(2) ?? "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {q.response_count ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
