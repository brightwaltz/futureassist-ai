/**
 * AdminAnalysis — 分析タブ Phase 4
 *
 * Phase 4追加:
 *  - K匿名化セグメント分析（/api/roi/dashboard-analytics から取得）
 *    - セグメント別 LA5要素 BarChart
 *    - セグメントテーブル
 *    - MView手動リフレッシュボタン
 *  - ROI算出フォーム（/api/roi/calculate へ POST）
 * 既存機能:
 *  - 会話要約・クラスター分析（保持）
 */
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  summarizeConversations, clusterConversations,
  getDashboardAnalytics, refreshDashboardAnalytics, calculateRoi,
} from "./adminApi";

const SEGMENT_COLORS = ["#6366f1", "#0078c6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// ─── セグメント分析 ──────────────────────────────────────────────────────────
function SegmentAnalysis({ tenantSlug }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardAnalytics(tenantSlug || "default");
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tenantSlug]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshDashboardAnalytics();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const segments = analytics?.segments ?? [];

  // セグメント別 avg_composite バーチャート用データ
  const barData = segments.map((s, i) => ({
    name: [s.age_group, s.department].filter(Boolean).join("/") || `seg${i + 1}`,
    スコア: s.avg_composite != null ? Math.round(s.avg_composite) : 0,
    人数: s.headcount,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">セグメント別 LA分析</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {analytics?.k_anonymity_threshold ?? 5}人未満セグメントは自動除外（K匿名化）
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50 flex items-center gap-1"
        >
          {refreshing ? (
            <span className="animate-spin w-3 h-3 border border-gray-600 border-t-transparent rounded-full" />
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          集計更新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {segments.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          セグメントデータがありません。アンケートが5件以上揃うと表示されます。
        </div>
      ) : (
        <>
          {/* LA総合スコア バーチャート */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              セグメント別 LA総合スコア
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} layout="vertical" margin={{ left: 60, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip
                  formatter={(v, name, props) => [
                    `${v}点（${props.payload.人数}名）`,
                    "LAスコア",
                  ]}
                />
                <Bar dataKey="スコア" radius={[0, 4, 4, 0]} barSize={16}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* セグメントテーブル */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">セグメント詳細</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["年齢層", "部署", "人数", "情報整理", "意思決定", "行動移行", "生活安定", "リソース", "総合", "EMA"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {segments.map((s, i) => {
                    const fmt = (v) => (v != null ? v.toFixed(1) : "---");
                    const scoreColor = (v) => {
                      if (v == null) return "text-gray-400";
                      if (v >= 70) return "text-green-600";
                      if (v >= 50) return "text-yellow-600";
                      return "text-red-600";
                    };
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">{s.age_group || "---"}</td>
                        <td className="px-3 py-2 text-gray-700">{s.department || "---"}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{s.headcount}</td>
                        <td className={`px-3 py-2 font-medium ${scoreColor(s.avg_s1_info_org)}`}>
                          {fmt(s.avg_s1_info_org)}
                        </td>
                        <td className={`px-3 py-2 font-medium ${scoreColor(s.avg_s2_decision)}`}>
                          {fmt(s.avg_s2_decision)}
                        </td>
                        <td className={`px-3 py-2 font-medium ${scoreColor(s.avg_s3_action)}`}>
                          {fmt(s.avg_s3_action)}
                        </td>
                        <td className={`px-3 py-2 font-medium ${scoreColor(s.avg_s4_stability)}`}>
                          {fmt(s.avg_s4_stability)}
                        </td>
                        <td className={`px-3 py-2 font-medium ${scoreColor(s.avg_s5_resource)}`}>
                          {fmt(s.avg_s5_resource)}
                        </td>
                        <td className={`px-3 py-2 font-bold ${scoreColor(s.avg_composite)}`}>
                          {fmt(s.avg_composite)}
                        </td>
                        <td className="px-3 py-2 text-indigo-600 font-medium">
                          {fmt(s.avg_ema)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── ROI算出フォーム ──────────────────────────────────────────────────────────
function RoiCalculatorForm({ tenantSlug }) {
  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    period_start: threeMonthsAgo,
    period_end:   today,
    avg_daily_wage_jpy: 15000,
    intervention_cost_jpy: 500000,
    headcount_override: "",
    before_period_start: "",
    before_period_end:   "",
  });
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = {
        period_start: form.period_start,
        period_end:   form.period_end,
        avg_daily_wage_jpy: Number(form.avg_daily_wage_jpy),
        intervention_cost_jpy: Number(form.intervention_cost_jpy),
      };
      if (form.headcount_override) params.headcount_override = Number(form.headcount_override);
      if (form.before_period_start && form.before_period_end) {
        params.before_period_start = form.before_period_start;
        params.before_period_end   = form.before_period_end;
      }
      const res = await calculateRoi(tenantSlug || "default", params);
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fmtJpy = (v) =>
    v != null ? `¥${Number(v).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}` : "---";

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900">ROI算出</h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "算出期間 開始日",   key: "period_start",   type: "date" },
              { label: "算出期間 終了日",   key: "period_end",     type: "date" },
              { label: "平均日給（円）",     key: "avg_daily_wage_jpy",       type: "number" },
              { label: "介入コスト（円）",   key: "intervention_cost_jpy",    type: "number" },
              { label: "対象人数（省略可）", key: "headcount_override",        type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  required={!["headcount_override", "before_period_start", "before_period_end"].includes(key)}
                  min={type === "number" ? 0 : undefined}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            ))}
          </div>

          {/* 介入前期間（オプション） */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">
              介入前期間を指定する（ROI比較算出）
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {[
                { label: "介入前 開始日", key: "before_period_start" },
                { label: "介入前 終了日", key: "before_period_end" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type="date"
                    value={form[key]}
                    onChange={set(key)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              ))}
            </div>
          </details>

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg
                       text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "算出中..." : "ROIを算出する"}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-indigo-50">
            <h3 className="font-semibold text-indigo-900">算出結果</h3>
            <p className="text-xs text-indigo-600 mt-0.5">
              {result.period_start} 〜 {result.period_end}（{result.affected_headcount}名対象）
            </p>
          </div>
          <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "プレゼンティーイズム損失", value: fmtJpy(result.presenteeism_loss_jpy), color: "text-orange-600" },
              { label: "アブセンティーイズム損失",  value: fmtJpy(result.absenteeism_loss_jpy),  color: "text-red-600"    },
              { label: "推定損失削減額",            value: fmtJpy(result.estimated_roi_jpy),     color: "text-green-600"  },
              { label: "ROI倍率",                   value: `${(result.roi_ratio ?? 0).toFixed(2)}x`, color: "text-indigo-600" },
            ].map((c) => (
              <div key={c.label} className="text-center">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
          {result.avg_la_score_before != null && (
            <div className="px-5 pb-4 text-xs text-gray-400">
              LAスコア:{" "}
              <span className="font-semibold text-gray-600">
                {result.avg_la_score_before.toFixed(1)}
              </span>
              {result.avg_la_score_after != null && result.avg_la_score_after !== result.avg_la_score_before && (
                <>
                  {" → "}
                  <span className="font-semibold text-indigo-600">
                    {result.avg_la_score_after.toFixed(1)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 会話分析（既存機能） ─────────────────────────────────────────────────────
function ConversationAnalysis({ tenantSlug }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [summaryResult,  setSummaryResult]  = useState(null);
  const [clusterResult,  setClusterResult]  = useState(null);
  const [error, setError] = useState(null);

  async function handleSummarize() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      setSummaryResult(await summarizeConversations(tenantSlug, params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCluster() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      setClusterResult(await clusterConversations(tenantSlug, params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900">会話分析</h2>

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">期間フィルター</h3>
        <div className="flex flex-wrap gap-4 items-end">
          {[["開始日", dateFrom, setDateFrom], ["終了日", dateTo, setDateTo]].map(([label, val, setter]) => (
            <div key={label}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input
                type="date"
                value={val}
                onChange={(e) => setter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}
          <button
            onClick={handleSummarize}
            disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium
                       hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {loading ? "処理中..." : "要約を生成"}
          </button>
          <button
            onClick={handleCluster}
            disabled={loading}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium
                       hover:bg-gray-900 disabled:opacity-50 transition"
          >
            {loading ? "処理中..." : "クラスター分析"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-gray-500">分析中...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {summaryResult && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">会話要約</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {summaryResult.generated_by === "ai" ? "AI生成" : "統計ベース"}
            </span>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">会話件数</p>
                <p className="text-xl font-bold text-gray-900">{summaryResult.conversation_count}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">期間</p>
                <p className="text-sm text-gray-700">
                  {summaryResult.date_range?.from
                    ? new Date(summaryResult.date_range.from).toLocaleDateString("ja-JP")
                    : "---"}{" "}
                  〜{" "}
                  {summaryResult.date_range?.to
                    ? new Date(summaryResult.date_range.to).toLocaleDateString("ja-JP")
                    : "---"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">トップトピック</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {summaryResult.top_topics?.slice(0, 5).map((t) => (
                    <span key={t.topic} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                      {t.topic} ({t.count})
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{summaryResult.summary}</p>
            </div>
          </div>
        </div>
      )}

      {clusterResult && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">クラスター分析</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {clusterResult.generated_by === "ai" ? "AI生成" : "トピックベース"}
              {" "}/ 全{clusterResult.total_conversations}件
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {clusterResult.clusters?.map((cluster, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{cluster.label}</h3>
                  <span className="text-sm font-bold text-primary-600">{cluster.conversation_count}件</span>
                </div>
                {cluster.description && (
                  <p className="text-sm text-gray-600 mb-2">{cluster.description}</p>
                )}
                {cluster.sample_topics?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cluster.sample_topics.map((topic) => (
                      <span key={topic} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────────────────
const TABS = [
  { key: "segment", label: "セグメント分析" },
  { key: "roi",     label: "ROI算出" },
  { key: "conversation", label: "会話分析" },
];

export default function AdminAnalysis() {
  const { tenantSlug } = useParams();
  const [activeTab, setActiveTab] = useState("segment");

  return (
    <div className="space-y-6">
      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "segment"      && <SegmentAnalysis      tenantSlug={tenantSlug} />}
      {activeTab === "roi"          && <RoiCalculatorForm    tenantSlug={tenantSlug} />}
      {activeTab === "conversation" && <ConversationAnalysis tenantSlug={tenantSlug} />}
    </div>
  );
}
