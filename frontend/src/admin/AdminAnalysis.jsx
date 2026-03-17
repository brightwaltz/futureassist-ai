import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { summarizeConversations, clusterConversations } from "./adminApi";

export default function AdminAnalysis() {
  const { tenantSlug } = useParams();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);
  const [clusterResult, setClusterResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSummarize() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const result = await summarizeConversations(tenantSlug, params);
      setSummaryResult(result);
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
      if (dateTo) params.date_to = dateTo;
      const result = await clusterConversations(tenantSlug, params);
      setClusterResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">分析</h1>

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">期間フィルター</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">開始日</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">終了日</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={handleSummarize}
            disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {loading ? "処理中..." : "要約を生成"}
          </button>
          <button
            onClick={handleCluster}
            disabled={loading}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition"
          >
            {loading ? "処理中..." : "クラスター分析"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-gray-500">分析中...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Result */}
      {summaryResult && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">会話要約</h2>
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
                    <span
                      key={t.topic}
                      className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full"
                    >
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

      {/* Cluster Result */}
      {clusterResult && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">クラスター分析</h2>
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
                  <span className="text-sm font-bold text-primary-600">
                    {cluster.conversation_count}件
                  </span>
                </div>
                {cluster.description && (
                  <p className="text-sm text-gray-600 mb-2">{cluster.description}</p>
                )}
                {cluster.sample_topics?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cluster.sample_topics.map((topic) => (
                      <span
                        key={topic}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                      >
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
