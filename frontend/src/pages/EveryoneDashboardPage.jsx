/**
 * EveryoneDashboardPage — みんなのダッシュボード（管理者用）
 *
 * 設計書 (clearみんなのダッシュボード設計書.pptx) 準拠:
 *   ① ページヘッダー
 *   ② エグゼクティブサマリー (KPI)
 *   ③ 先行指標サマリー
 *   ④ 支援未活用・未準備マップ (ScatterChart)
 *   ⑤ 行動移行・支援接続
 *   ⑥ リソース別効果
 *   ⑦ セグメント分析
 *   ⑧ ROI / 人的資本 / ESG
 *   ⑨ AI推奨アクション
 *
 * 経営層が「支援投資の判断」を行える意思決定支援ツール。
 * 「気分」ではなく「損失リスク」を可視化する。
 *
 * ルート: /everyone
 */
import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ReferenceArea,
  BarChart, Bar, LabelList, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";
import {
  Users, TrendingUp, TrendingDown, Activity, AlertCircle,
  Filter, Calendar, Target, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Lightbulb, Building2, Heart, Briefcase,
  Sparkles, BarChart3, Award, Globe2,
} from "lucide-react";

import {
  EXEC_SUMMARY,
  LEADING_INDICATORS,
  PRIORITY_MAP,
  ACTION_FLOW,
  RESOURCE_EFFECTIVENESS,
  SEGMENT_ANALYSIS,
  ROI_HC_ESG,
  AI_RECOMMENDATIONS,
  FILTER_OPTIONS,
  TOTAL_TARGET_POPULATION,
} from "../data/everyoneDashboardMock";

// ═══════════════════════════════════════════════════════════════════════════
// ① ページヘッダー + フィルター
// ═══════════════════════════════════════════════════════════════════════════
function PageHeader({ filters, setFilters }) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              みんなのダッシュボード
              <span className="ml-2 text-xs font-normal bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                管理者用
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              社員の状態・行動・変化を匿名集計し、人的資本・ROI・ESGに活かせる形で表示します
            </p>
          </div>
        </div>

        {/* フィルターバー */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            <span>フィルター</span>
          </div>

          <FilterSelect
            icon={<Calendar className="w-3.5 h-3.5" />}
            value={filters.period}
            onChange={(v) => setFilters({ ...filters, period: v })}
            options={FILTER_OPTIONS.period}
          />
          <FilterSelect
            icon={<Building2 className="w-3.5 h-3.5" />}
            value={filters.department}
            onChange={(v) => setFilters({ ...filters, department: v })}
            options={FILTER_OPTIONS.department}
          />
          <FilterSelect
            value={filters.age}
            onChange={(v) => setFilters({ ...filters, age: v })}
            options={FILTER_OPTIONS.age}
          />
          <FilterSelect
            value={filters.family}
            onChange={(v) => setFilters({ ...filters, family: v })}
            options={FILTER_OPTIONS.family}
          />

          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              対象母数
              <span className="font-semibold text-gray-800">{TOTAL_TARGET_POPULATION}人</span>
            </span>
            <span className="text-gray-300">|</span>
            <span>{EXEC_SUMMARY.period_label} (vs {EXEC_SUMMARY.prev_label})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ icon, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl
                      px-3 py-1.5 hover:border-primary-300 transition cursor-pointer">
      {icon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs bg-transparent text-gray-700 focus:outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ② エグゼクティブサマリー (KPIカード)
// ═══════════════════════════════════════════════════════════════════════════
function ExecutiveSummary() {
  return (
    <Section
      icon={<Sparkles className="w-5 h-5 text-primary-600" />}
      title="エグゼクティブサマリー"
      subtitle="経営層が最初に見るべき要点"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {EXEC_SUMMARY.cards.map((c) => (
          <KpiCard key={c.key} {...c} />
        ))}
      </div>
    </Section>
  );
}

function KpiCard({ label, value, unit, delta, delta_unit, direction, good_direction }) {
  const isGood =
    (direction === "up"   && good_direction === "up")   ||
    (direction === "down" && good_direction === "down");
  const Arrow = direction === "up" ? ArrowUpRight : ArrowDownRight;
  const colorClass = isGood ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition">
      <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
      <div className={`mt-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        <Arrow className="w-3 h-3" />
        <span>{delta > 0 ? "+" : ""}{delta}{delta_unit}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ③ 先行指標サマリー
// ═══════════════════════════════════════════════════════════════════════════
function LeadingIndicators() {
  return (
    <Section
      icon={<AlertCircle className="w-5 h-5 text-orange-500" />}
      title="先行指標サマリー"
      subtitle="今後の損失を防ぐための先行指標"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {LEADING_INDICATORS.map((ind) => (
          <LeadingIndicatorCard key={ind.key} {...ind} />
        ))}
      </div>
    </Section>
  );
}

function LeadingIndicatorCard({ label, value, desc, threshold }) {
  const level =
    value >= threshold.danger ? "danger" :
    value >= threshold.warn   ? "warn"   : "ok";

  const palette = {
    danger: { bar: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50",    label: "要対応" },
    warn:   { bar: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50", label: "注意" },
    ok:     { bar: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  label: "良好" },
  }[level];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-gray-800 leading-tight">{label}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${palette.bg} ${palette.text}`}>
          {palette.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        <span className="text-sm text-gray-500">%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
        <div
          className={`h-full ${palette.bar} transition-all duration-700`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ④ 支援未活用・未準備マップ (2軸マトリクス)
// ═══════════════════════════════════════════════════════════════════════════
function PriorityMap() {
  // 右上 (高未準備 × 高影響) を「重点支援対象」として赤背景強調
  const QUADRANT_X = 50;  // 未準備率の閾値
  const QUADRANT_Y = 50;  // パフォーマンス影響度の閾値

  return (
    <Section
      icon={<Target className="w-5 h-5 text-red-500" />}
      title="支援未活用・未準備マップ"
      subtitle="どこに支援投資すべきか — 右上ほど優先支援対象"
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              {/* 右上重点支援エリア（赤背景） */}
              <ReferenceArea
                x1={QUADRANT_X} x2={100}
                y1={QUADRANT_Y} y2={100}
                fill="#fee2e2"
                fillOpacity={0.4}
                stroke="#fca5a5"
                strokeDasharray="3 3"
                label={{
                  value: "重点支援対象",
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "#dc2626",
                  fontWeight: 600,
                }}
              />

              <XAxis
                type="number"
                dataKey="unpreparedness"
                domain={[0, 100]}
                name="未準備率"
                unit="%"
                stroke="#9ca3af"
                tick={{ fontSize: 11 }}
                label={{
                  value: "未準備率 (%) →",
                  position: "insideBottom",
                  offset: -10,
                  fontSize: 12,
                  fill: "#6b7280",
                }}
              />
              <YAxis
                type="number"
                dataKey="performanceImpact"
                domain={[0, 100]}
                name="パフォーマンス影響度"
                unit="%"
                stroke="#9ca3af"
                tick={{ fontSize: 11 }}
                label={{
                  value: "パフォーマンス影響度 (%) →",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  fontSize: 12,
                  fill: "#6b7280",
                  style: { textAnchor: "middle" },
                }}
              />
              <ZAxis type="number" dataKey="headcount" range={[200, 1200]} name="人数" />

              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={<PriorityTooltip />}
              />

              <Scatter data={PRIORITY_MAP} shape={<ThemeBubble qx={QUADRANT_X} qy={QUADRANT_Y} />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* 凡例 */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
          {PRIORITY_MAP.map((p) => {
            const isCritical = p.unpreparedness >= 50 && p.performanceImpact >= 50;
            return (
              <span key={p.theme} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isCritical ? "bg-red-500" : "bg-primary-500"}`} />
                {p.emoji} {p.theme}
                {isCritical && <span className="text-red-600 font-medium">（重点）</span>}
              </span>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

// バブルの形状（円 + 絵文字 + ラベル）
function ThemeBubble({ cx, cy, payload, qx, qy }) {
  if (cx == null || cy == null) return null;
  const isCritical = payload.unpreparedness >= qx && payload.performanceImpact >= qy;
  const r = Math.sqrt(payload.headcount) * 2.2;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={isCritical ? "#dc2626" : "#0078c6"}
        fillOpacity={0.7}
        stroke={isCritical ? "#991b1b" : "#015fa1"}
        strokeWidth={1.5}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={14} pointerEvents="none">
        {payload.emoji}
      </text>
      <text
        x={cx} y={cy + r + 14}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={isCritical ? "#991b1b" : "#374151"}
        pointerEvents="none"
      >
        {payload.theme}
      </text>
    </g>
  );
}

function PriorityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-3 text-xs">
      <p className="font-bold text-gray-900 mb-1">{d.emoji} {d.theme}</p>
      <p className="text-gray-600">未準備率: <span className="font-semibold">{d.unpreparedness}%</span></p>
      <p className="text-gray-600">パフォーマンス影響度: <span className="font-semibold">{d.performanceImpact}%</span></p>
      <p className="text-gray-600">該当人数: <span className="font-semibold">{d.headcount}人</span></p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ 行動移行・支援接続
// ═══════════════════════════════════════════════════════════════════════════
function ActionFlow() {
  return (
    <Section
      icon={<Activity className="w-5 h-5 text-primary-600" />}
      title="行動移行・支援接続"
      subtitle="整理されただけでなく「動いた」かを見る"
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ACTION_FLOW} layout="vertical" margin={{ left: 130, right: 50, top: 5, bottom: 5 }}>
              <CartesianGrid horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} stroke="#374151" width={130} />
              <Tooltip
                cursor={{ fill: "#f0f7ff" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(v) => `${v}%`}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22}>
                {ACTION_FLOW.map((a, i) => (
                  <Cell key={i} fill={a.color} />
                ))}
                <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`}
                  style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ リソース別効果
// ═══════════════════════════════════════════════════════════════════════════
function ResourceEffectiveness() {
  return (
    <Section
      icon={<Award className="w-5 h-5 text-purple-600" />}
      title="リソース別効果"
      subtitle="MY HEROIC のどのリソースが効いているか"
    >
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">リソース</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-600">接続数</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-600">完了率</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-600">改善実感</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-600">再利用率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {RESOURCE_EFFECTIVENESS.map((r) => (
              <tr key={r.resource} className="hover:bg-gray-50">
                <td className="px-4 py-3 flex items-center gap-2">
                  <span className="text-lg">{r.icon}</span>
                  <span className="font-medium text-gray-800">{r.resource}</span>
                </td>
                <td className="px-3 py-3 text-right font-semibold text-gray-900">{r.connections}</td>
                <td className="px-3 py-3 text-right">
                  <PercentBadge value={r.completion} />
                </td>
                <td className="px-3 py-3 text-right">
                  <PercentBadge value={r.satisfaction} />
                </td>
                <td className="px-3 py-3 text-right text-gray-600">{r.reuse}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function PercentBadge({ value }) {
  const color =
    value >= 70 ? "bg-green-50 text-green-700" :
    value >= 50 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {value}%
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ セグメント分析
// ═══════════════════════════════════════════════════════════════════════════
function SegmentAnalysis() {
  const [tab, setTab] = useState("age");
  const data = SEGMENT_ANALYSIS[tab];

  return (
    <Section
      icon={<Users className="w-5 h-5 text-blue-600" />}
      title="セグメント分析"
      subtitle="どの層にどの支援が必要かを見る"
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        {/* タブ */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "age",    label: "年代別" },
            { key: "family", label: "家族構成別" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                tab === t.key
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="segment" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis unit="%" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="performanceLoss" name="パフォーマンス阻害率" fill="#ef4444" radius={[6, 6, 0, 0]} />
              <Bar dataKey="unprepared"      name="未準備率"             fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="supportUnused"   name="支援未活用率"          fill="#0078c6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑧ ROI / 人的資本 / ESG
// ═══════════════════════════════════════════════════════════════════════════
function RoiHcEsg() {
  return (
    <Section
      icon={<Globe2 className="w-5 h-5 text-green-600" />}
      title="ROI / 人的資本 / ESG"
      subtitle="経営会議・IR・統合報告向けに転用可能なデータ"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DataBlock
          title="ROI"
          subtitle="支援投資の対効果"
          icon={<TrendingUp className="w-4 h-4" />}
          color="primary"
          rows={ROI_HC_ESG.roi}
        />
        <DataBlock
          title="人的資本"
          subtitle="Life Ability・行動指標"
          icon={<Heart className="w-4 h-4" />}
          color="rose"
          rows={ROI_HC_ESG.human_capital}
        />
        <DataBlock
          title="ESG (Social)"
          subtitle="家族・健康支援接続"
          icon={<Globe2 className="w-4 h-4" />}
          color="green"
          rows={ROI_HC_ESG.esg}
        />
      </div>
    </Section>
  );
}

function DataBlock({ title, subtitle, icon, color, rows }) {
  const palette = {
    primary: { bg: "bg-primary-50",  text: "text-primary-700", border: "border-primary-100" },
    rose:    { bg: "bg-rose-50",     text: "text-rose-700",    border: "border-rose-100"    },
    green:   { bg: "bg-green-50",    text: "text-green-700",   border: "border-green-100"   },
  }[color];
  return (
    <div className={`bg-white border ${palette.border} rounded-2xl p-4`}>
      <div className={`flex items-center gap-2 mb-1 ${palette.text}`}>
        {icon}
        <h4 className="text-sm font-bold">{title}</h4>
      </div>
      <p className="text-xs text-gray-400 mb-3">{subtitle}</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className={`${palette.bg} rounded-xl px-3 py-2`}>
            <p className="text-xs text-gray-600">{r.label}</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-xl font-bold ${palette.text}`}>{r.value}</span>
              <span className="text-xs text-gray-500">{r.unit}</span>
            </div>
            {r.note && <p className="text-[10px] text-gray-500 mt-0.5">{r.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑨ AI推奨アクション
// ═══════════════════════════════════════════════════════════════════════════
function AiRecommendations() {
  return (
    <Section
      icon={<Lightbulb className="w-5 h-5 text-amber-500" />}
      title="今月の推奨アクション"
      subtitle="データから導き出された次の一手"
    >
      <div className="space-y-3">
        {AI_RECOMMENDATIONS.map((rec, i) => (
          <RecommendationCard key={i} rank={i + 1} {...rec} />
        ))}
      </div>
    </Section>
  );
}

function RecommendationCard({ rank, priority, theme, title, rationale, action, expected_impact }) {
  const palette = {
    high:   { bg: "bg-red-50",    border: "border-red-200",    badge: "bg-red-100 text-red-700",       label: "優先度: 高" },
    medium: { bg: "bg-yellow-50", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700", label: "優先度: 中" },
    low:    { bg: "bg-gray-50",   border: "border-gray-200",   badge: "bg-gray-100 text-gray-700",     label: "優先度: 低" },
  }[priority];

  return (
    <div className={`${palette.bg} border ${palette.border} rounded-2xl p-5`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center shrink-0
                        text-sm font-bold text-gray-700">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${palette.badge}`}>
              {palette.label}
            </span>
            <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded-full border border-gray-200">
              {theme}
            </span>
          </div>
          <h4 className="text-sm font-bold text-gray-900 mb-2">{title}</h4>
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              <span className="font-semibold text-gray-800">なぜ:</span> {rationale}
            </p>
            <p>
              <span className="font-semibold text-gray-800">実施内容:</span> {action}
            </p>
            <p className="flex items-center gap-1 text-green-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              想定効果: {expected_impact}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 共通: セクションラッパー
// ═══════════════════════════════════════════════════════════════════════════
function Section({ icon, title, subtitle, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && (
          <span className="text-xs text-gray-400 hidden sm:inline">— {subtitle}</span>
        )}
      </div>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// メインページ
// ═══════════════════════════════════════════════════════════════════════════
export default function EveryoneDashboardPage() {
  const [filters, setFilters] = useState({
    period:     "monthly",
    department: "all",
    age:        "all",
    family:     "all",
  });

  console.log("[EveryoneDashboard] filters changed", filters);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader filters={filters} setFilters={setFilters} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ExecutiveSummary />
        <LeadingIndicators />
        <PriorityMap />
        <ActionFlow />
        <ResourceEffectiveness />
        <SegmentAnalysis />
        <RoiHcEsg />
        <AiRecommendations />

        {/* フッター */}
        <div className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-6">
          匿名集計データに基づく経営判断支援ダッシュボード ・ K=5 匿名化基準
        </div>
      </div>
    </div>
  );
}
