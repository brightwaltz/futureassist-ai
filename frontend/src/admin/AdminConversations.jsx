import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getConversations } from "./adminApi";

export default function AdminConversations() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    topic: "",
    channel: "",
    date_from: "",
    date_to: "",
    page: 1,
    page_size: 20,
  });

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.topic) params.topic = filters.topic;
      if (filters.channel) params.channel = filters.channel;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      params.page = filters.page;
      params.page_size = filters.page_size;
      const result = await getConversations(tenantSlug, params);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantSlug, filters.page]);

  const handleFilter = (e) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, page: 1 }));
    fetchData();
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return "-";
    const ms = new Date(end) - new Date(start);
    const min = Math.floor(ms / 60000);
    return `${min}分`;
  };

  const formatDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = data ? Math.ceil(data.total / filters.page_size) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">会話ログ</h2>

      {/* Filters */}
      <form
        onSubmit={handleFilter}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">トピック</label>
          <select
            value={filters.topic}
            onChange={(e) => setFilters((f) => ({ ...f, topic: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            <option value="相続">相続</option>
            <option value="終活">終活</option>
            <option value="年金">年金</option>
            <option value="介護">介護</option>
            <option value="健康管理">健康管理</option>
            <option value="家族関係">家族関係</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">チャネル</label>
          <select
            value={filters.channel}
            onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            <option value="chat">チャット</option>
            <option value="voice">音声</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">開始日</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">終了日</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
        >
          検索
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">日時</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">ユーザー</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">トピック</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">チャネル</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">所要時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.items?.length > 0 ? (
                    data.items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer transition"
                        onClick={() =>
                          navigate(`/admin/${tenantSlug}/conversations/${item.id}`)
                        }
                      >
                        <td className="px-4 py-3 text-gray-700">{formatDate(item.started_at)}</td>
                        <td className="px-4 py-3 text-gray-700">{item.user_id || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-xs">
                            {item.topic || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{item.channel || "-"}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {formatDuration(item.started_at, item.ended_at)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        会話データがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  全{data.total}件中 {(filters.page - 1) * filters.page_size + 1}-
                  {Math.min(filters.page * filters.page_size, data.total)}件
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={filters.page <= 1}
                    onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition"
                  >
                    前へ
                  </button>
                  <button
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
