import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getConversation } from "./adminApi";

export default function AdminConversationDetail() {
  const { tenantSlug, conversationId } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getConversation(tenantSlug, conversationId)
      .then(setConversation)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantSlug, conversationId]);

  const formatTime = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDateTime = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("ja-JP");
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
      <div className="space-y-4">
        <button
          onClick={() => navigate(`/admin/${tenantSlug}/conversations`)}
          className="text-sm text-primary-600 hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          一覧に戻る
        </button>
        <div className="bg-red-50 text-red-700 rounded-xl p-6 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => navigate(`/admin/${tenantSlug}/conversations`)}
        className="text-sm text-primary-600 hover:underline flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        一覧に戻る
      </button>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-3">会話詳細</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">トピック</span>
            <p className="font-medium text-gray-900">{conversation.topic || "-"}</p>
          </div>
          <div>
            <span className="text-gray-500">チャネル</span>
            <p className="font-medium text-gray-900">{conversation.channel || "-"}</p>
          </div>
          <div>
            <span className="text-gray-500">ユーザー</span>
            <p className="font-medium text-gray-900">{conversation.user_id || "-"}</p>
          </div>
          <div>
            <span className="text-gray-500">開始時刻</span>
            <p className="font-medium text-gray-900">{formatDateTime(conversation.started_at)}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">メッセージ</h3>
        <div className="space-y-3">
          {conversation.messages?.length > 0 ? (
            conversation.messages.map((msg) => {
              const isUser = msg.sender_type === "user";
              const isSystem = msg.sender_type === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-yellow-50 text-yellow-800 rounded-lg px-4 py-2 text-sm max-w-md text-center">
                      {msg.content}
                      <div className="text-xs text-yellow-600 mt-1">{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                      isUser
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div
                      className={`text-xs mt-1 ${
                        isUser ? "text-primary-200" : "text-gray-400"
                      }`}
                    >
                      {formatTime(msg.created_at)}
                    </div>
                    {msg.nlp_annotations &&
                      Object.keys(msg.nlp_annotations).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(msg.nlp_annotations).map(([k, v]) => (
                            <span
                              key={k}
                              className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                                isUser
                                  ? "bg-primary-500 text-primary-100"
                                  : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">メッセージがありません</p>
          )}
        </div>
      </div>
    </div>
  );
}
