/**
 * AdminDashboard — 企業向けダッシュボード Phase 4
 *
 * Phase 4追加:
 *  - ROI指標カード（プレゼンティーイズム損失・アブセンティーイズム損失・ROI率）
 *  - LA 5要素先行指標レーダーチャート（全社平均）
 *  - 2軸マトリクス ScatterChart（未準備率 × 人数規模）
 */
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
  ScatterChart, Scatter, ZAxis, CartesianGrid, Label,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend,
} from "recharts";
import { getStats, getRoiSummary, getDashboardAnalytics } from "./adminApi";

const CHART_COLORS = ["#0078c6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// ─── ROI指標カード ────────────────────────────────────────────────────────────
function RoiCards({ roi }) {
  if (!roi) return null;

  const fmt = (v) =>
    v != null ? `¥${Number(v).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}` : "---";

  const cards = [
    {
      label: "プレゼンティーイズム損失",
      value: fmt(roi.presenteeism_loss_jpy),
      sub: "出勤中の生産性低下",
      color: "bg-orange-50 text-orange-600 border-orange-100",
    },
    {
      label: "アブセンティーイズム損失",
      value: fmt(roi.absenteeism_loss_jpy),
      sub: "欠勤・休職コスト",
      color: "bg-red-50 text-red-600 border-red-100",
    },
    {
      label: "推定損失削減額",
      value: fmt(roi.estimated_roi_jpy),
      sub: "介入による改善効果",
      color: "bg-green-50 text-green-600 border-green-100",
    },
    {
      label: "ROI倍率",
      value: roi.roi_ratio != null ? `${roi.roi_ratio.toFixed(2)}x` : "---",
      sub: `対象人数 ${roi.affected_headcount ?? "---"}名`,
      color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">人的資本ROI指標</h3>
        <span className="text-xs text-gray-400">
          {roi.period_start} 〜 {roi.period_end}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-xl font-bold">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>
      {roi.avg_la_score_before != null && roi.avg_la_score_after != null && (
        <p className="text-xs text-gray-400">
          LAスコア推移:{" "}
          <span className="font-semibold text-gray-600">
            {roi.avg_la_score_before.toFixed(1)}
          </span>{" "}
          →{" "}
          <span className="font-semibold text-indigo-600">
            {roi.avg_la_score_after.toFixed(1)}
          </span>
        </p>
      )}
    </div>
  );
}

// ─── LA5要素 全社平均レーダー ───────────────────────────────────────────────
const LA_LABELS = {
  avg_s1_info_org: "情報整理力",
  avg_s2_decision: "意思決定",
  avg_s3_action: "行動移行力",
  avg_s4_stability: "生活安定性",
  avg_s5_resource: "リソース創出",
};

function OrgLaRadar({ segments }) {
  if (!segments || segments.length === 0) return null;

  // 全セグメントの加重平均（headcount加重）
  const totalHead = segments.reduce((s, seg) => s + (seg.headcount || 1), 0);
  const keys = Object.keys(LA_LABELS);
  const data = keys.map((k) => {
    const wavg =
      segments.reduce((s, seg) => s + (seg[k] ?? 0) * (seg.headcount || 1), 0) / totalHead;
    return { subject: LA_LABELS[k], score: Math.round(wavg), fullMark: 100 };
  });

  const hasData = data.some((d) => d.score > 0);
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">LA 5要素 — 全社先行指標</h3>
      <p className="text-xs text-gray-400 mb-4">
        {segments.length}セグメント加重平均（K=5匿名化済み）
      </p>
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={3} />
              <Radar
                name="全社平均"
                dataKey="score"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip formatter={(v) => [`${v}点`, "全社平均スコア"]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full md:w-48 space-y-2 shrink-0">
          {data.map((d) => (
            <div key={d.subject} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">{d.subject}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 w-6 text-right">
                {d.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 2軸マトリクス: 未準備率 × 人数規模 ────────────────────────────────────
const QUADRANT_COLORS = {
  critical: "#ef4444",  // 高headcount + 高未準備率
  watch:    "#f59e0b",  // 低headcount + 高未準備率
  good:     "#22c55e",  // 高headcount + 低未準備率
  stable:   "#6366f1",  // 低headcount + 低未準備率
};

function riskQuadrant(unreadiness, headcount, medHead) {
  const highPeople = headcount >= medHead;
  const highRisk   = unreadiness >= 40;
  if (highPeople && highRisk)  return "critical";
  if (!highPeople && highRisk) return "watch";
  if (highPeople && !highRisk) return "good";
  return "stable";
}

const CustomScatterDot = (props) => {
  const { cx, cy, payload } = props;
  const r = Math.max(8, Math.sqrt(payload.headcount || 1) * 3);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={payload.color}
      fillOpacity={0.7}
      stroke={payload.color}
      strokeWidth={1.5}
    />
  );
};

const CustomScatterLabel = (props) => {
  const { x, y, value } = props;
  return (
    <text x={x} y={y - 12} textAnchor="middle" fontSize={10} fill="#374151">
      {value}
    </text>
  );
};

function RiskMatrix({ segments }) {
  if (!segments || segments.length === 0) return null;

  const headcounts = segments.map((s) => s.headcount || 1);
  const medHead = headcounts.sort((a, b) => a - b)[Math.floor(headcounts.length / 2)] || 5;

  const data = segments.map((s) => {
    const unreadiness = s.avg_composite != null ? Math.round(100 - s.avg_composite) : 50;
    const label = [s.age_group, s.department].filter(Boolean).join("/") || "不明";
    const q = riskQuadrant(unreadiness, s.headcount || 1, medHead);
    return {
      x: unreadiness,
      y: s.headcount || 1,
      headcount: s.headcount || 1,
      label,
      color: QUADRANT_COLORS[q],
      quadrant: q,
    };
  });

  const QUADRANT_LEGEND = [
    { key: "critical", label: "優先対応",   color: QUADRANT_COLORS.critical },
    { key: "watch",    label: "経過観察",   color: QUADRANT_COLORS.watch },
    { key: "good",     label: "良好",       color: QUADRANT_COLORS.good },
    { key: "stable",   label: "安定",       color: QUADRANT_COLORS.stable },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            リスクマトリクス — 未準備率 × 人数規模
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            右上（未準備率高・人数多）が優先対応セグメント
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUADRANT_LEGEND.map((q) => (
            <span key={q.key} className="flex items-center gap-1 text-xs text-gray-600">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: q.color }}
              />
              {q.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            name="未準備率"
          >
            <Label value="未準備率 (%)" position="bottom" offset={15} fontSize={11} fill="#9ca3af" />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            tick={{ fontSize: 11 }}
            name="人数"
          >
            <Label value="人数規模" angle={-90} position="insideLeft" offset={10} fontSize={11} fill="#9ca3af" />
          </YAxis>
          <ZAxis range={[60, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs shadow-lg">
                  <p className="font-semibold text-gray-800 mb-1">{d.label}</p>
                  <p className="text-gray-500">未準備率: <span className="font-medium text-gray-800">{d.x}%</span></p>
                  <p className="text-gray-500">人数: <span className="font-medium text-gray-800">{d.y}名</span></p>
                </div>
              );
            }}
          />
          {/* Reference lines for quadrants */}
          <Scatter
            data={data}
            shape={<CustomScatterDot />}
            label={({ x, y, index }) => (
              <CustomScatterLabel x={x} y={y} value={data[index]?.label} />
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 既存KPI設定 ───────────────────────────────────────────────────────────
const kpiConfig = [
  { key: "conversation_count",      label: "相談件数",         color: "bg-blue-100 text-blue-600" },
  { key: "survey_count",            label: "アンケート回答数", color: "bg-green-100 text-green-600" },
  { key: "active_users",            label: "アクティブユーザー", color: "bg-purple-100 text-purple-600" },
  { key: "avg_life_ability_score",  label: "平均Life Ability", color: "bg-amber-100 text-amber-600" },
];

const kpiIcons = [
  <svg key="chat" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  <svg key="survey" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  <svg key="users" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  <svg key="score" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
];

// ─── メインコンポーネント ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const { tenantSlug } = useParams();
  const [stats, setStats]         = useState(null);
  const [roi, setRoi]             = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    const slug = tenantSlug || "default";
    Promise.allSettled([
      getStats(slug),
      getRoiSummary(slug).catch(() => null),
      getDashboardAnalytics(slug).catch(() => null),
    ]).then(([s, r, a]) => {
      if (s.status === "fulfilled") setStats(s.value);
      else setError(s.reason?.message || "統計の取得に失敗しました");
      if (r.status === "fulfilled" && r.value?.data) setRoi(r.value.data);
      if (a.status === "fulfilled" && a.value?.segments) setAnalytics(a.value.segments);
    }).finally(() => setLoading(false));
  }, [tenantSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !stats) {
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

  return (
    <div className="space-y-6">

      {/* ─── KPI Cards (existing) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiConfig.map((kpi, i) => (
          <div key={kpi.key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
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

      {/* ─── ROI指標 (Phase 4) ─── */}
      {roi ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <RoiCards roi={roi} />
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">
          ROIデータがありません。「分析」タブから算出してください。
        </div>
      )}

      {/* ─── LA先行指標レーダー + リスクマトリクス (Phase 4) ─── */}
      {analytics && analytics.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OrgLaRadar segments={analytics} />
          <RiskMatrix segments={analytics} />
        </div>
      )}

      {/* ─── Charts Row (existing) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Topic Distribution */}
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {topicData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-16">データなし</p>
          )}
        </div>

        {/* Satisfaction Score */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">満足度スコア</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[{ name: "満足度", value: stats.avg_satisfaction_score || 0 }]} layout="vertical">
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

      {/* ─── Recent Activity ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">最近のアクティビティ</h3>
        <p className="text-sm text-gray-400">
          直近の相談件数: {stats.conversation_count ?? 0}件、アンケート回答: {stats.survey_count ?? 0}件
        </p>
      </div>

    </div>
  );
}
