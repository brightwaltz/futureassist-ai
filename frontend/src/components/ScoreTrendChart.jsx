import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ScoreTrendChart({ surveys = [] }) {
  if (!surveys || surveys.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        グラフを表示するにはアンケートデータが必要です。
      </div>
    );
  }

  const data = surveys
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
      }),
      LAスコア: s.life_ability_score != null ? Number(s.life_ability_score.toFixed(1)) : null,
      満足度: s.satisfaction_score != null ? Number(s.satisfaction_score.toFixed(1)) : null,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="LAスコア"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="満足度"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
