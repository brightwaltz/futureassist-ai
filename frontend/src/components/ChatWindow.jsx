import React, { useState, useRef, useEffect } from "react";

/**
 * Chat window component with message display and input.
 */
export default function ChatWindow({
  messages,
  isTyping,
  currentStep,
  onSendMessage,
  onEndSession,
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const stepLabels = {
    information_organizing: "情報整理",
    decision_support: "意思決定支援",
    action_bridging: "行動移行",
    life_stability: "生活安定性",
    resource_optimization: "リソース創出",
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          {Object.entries(stepLabels).map(([key, label]) => (
            <span
              key={key}
              className={`text-xs px-2 py-1 rounded-full transition ${
                currentStep === key
                  ? "bg-primary-100 text-primary-700 font-medium"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
        <button
          onClick={onEndSession}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          終了
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-gray-200 text-gray-800"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Suggested Links */}
              {msg.suggestedLinks?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-medium text-gray-500">関連情報:</p>
                  {msg.suggestedLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      📌 {link.title}
                      {link.description && (
                        <span className="text-gray-400 ml-1">
                          - {link.description}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <p
                className={`text-[10px] mt-1 ${
                  msg.role === "user" ? "text-primary-200" : "text-gray-300"
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 bg-white border-t border-gray-200"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
