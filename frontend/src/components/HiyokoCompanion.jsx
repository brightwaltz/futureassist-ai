/**
 * HiyokoCompanion — 軽量版コンパニオン表示コンポーネント
 * API呼び出しなし。全ての対話画面・ダッシュボード画面に表示する。
 */
import React from "react";

const MOODS = {
  normal:  { emoji: "🐥", label: "ふつう" },
  happy:   { emoji: "🐤", label: "うれしい" },
  thinking:{ emoji: "🐣", label: "考えてる" },
  excited: { emoji: "🐥", label: "ワクワク" },
};

/**
 * @param {string}  mood      - "normal" | "happy" | "thinking" | "excited"
 * @param {string}  message   - 吹き出しに表示するテキスト
 * @param {string}  size      - "sm" | "md" | "lg"
 * @param {boolean} animated  - バウンスアニメーション
 */
export default function HiyokoCompanion({
  mood = "normal",
  message = "",
  size = "md",
  animated = true,
}) {
  const m = MOODS[mood] || MOODS.normal;

  const sizeClasses = {
    sm:  "text-4xl",
    md:  "text-6xl",
    lg:  "text-8xl",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 吹き出し */}
      {message && (
        <div className="relative max-w-xs">
          <div className="bg-white border border-primary-200 rounded-2xl px-4 py-2.5 shadow-sm text-sm text-gray-700 leading-relaxed">
            {message}
          </div>
          {/* 三角形 */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0
                          border-l-8 border-r-8 border-t-8
                          border-l-transparent border-r-transparent border-t-white
                          drop-shadow-[0_1px_0_rgba(186,224,253,1)]" />
        </div>
      )}
      {/* キャラクター */}
      <span className={`${sizeClasses[size] || sizeClasses.md} ${animated ? "animate-bounce" : ""} select-none`}>
        {m.emoji}
      </span>
    </div>
  );
}
