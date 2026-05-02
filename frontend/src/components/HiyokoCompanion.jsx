/**
 * HiyokoCompanion — SVGベースのコンパニオン表示コンポーネント
 *
 * 提供プロトタイプのSVG (myheroic_ai_prototype.html L43-71) をベースに、
 * mood に応じた表情変化と吹き出し（左横/上）を実装。
 * API呼び出しなし。全ての対話画面・ダッシュボード画面で利用する。
 */
import React from "react";

const SIZE_PX = {
  sm: 48,
  md: 80,
  lg: 120,
};

/**
 * @param {string}  mood      - "normal" | "happy" | "thinking" | "excited"
 * @param {string|ReactNode} message - 吹き出しに表示するテキスト/JSX
 * @param {string}  size      - "sm" | "md" | "lg"
 * @param {boolean} animated  - ふわふわアニメーション
 * @param {string}  layout    - "column" (縦並び・デフォルト) | "row" (横並び・プロトタイプ準拠)
 */
export default function HiyokoCompanion({
  mood = "normal",
  message = "",
  size = "md",
  animated = true,
  layout = "column",
}) {
  const px = SIZE_PX[size] || SIZE_PX.md;

  const isRow = layout === "row";

  return (
    <div
      className={`flex ${isRow ? "items-center" : "flex-col items-center"} gap-3
                  ${animated ? "animate-in fade-in slide-in-from-bottom-2 duration-700" : ""}`}
    >
      <div className="relative shrink-0">
        <HiyokoSvg mood={mood} size={px} animated={animated} />
        {/* オンライン通知ドット */}
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500
                         border-2 border-white rounded-full animate-pulse" />
      </div>

      {message && (
        <SpeechBubble layout={layout}>{message}</SpeechBubble>
      )}
    </div>
  );
}

// ─── 吹き出し ───────────────────────────────────────────────────────────────
function SpeechBubble({ children, layout }) {
  const isRow = layout === "row";
  return (
    <div
      className={`relative bg-white border border-yellow-100 shadow-sm
                  rounded-2xl px-4 py-2.5 text-sm text-gray-700 max-w-xs leading-relaxed
                  ${isRow ? "rounded-tl-none" : "rounded-bl-none"}`}
    >
      {/* 三角形（横並び:左上、縦並び:左下） */}
      {isRow ? (
        <span
          className="absolute left-0 top-0 -ml-2 w-0 h-0
                     border-t-[8px] border-t-white
                     border-l-[8px] border-l-transparent
                     drop-shadow-[-1px_0_0_rgba(254,243,199,1)]"
        />
      ) : (
        <span
          className="absolute left-4 -bottom-2 w-0 h-0
                     border-l-[8px] border-r-[8px] border-t-[8px]
                     border-l-transparent border-r-transparent border-t-white
                     drop-shadow-[0_1px_0_rgba(254,243,199,1)]"
        />
      )}
      {children}
    </div>
  );
}

// ─── ひよこ SVG（mood別表情） ─────────────────────────────────────────────
function HiyokoSvg({ mood, size, animated }) {
  const moodProps = {
    normal:   <NormalFace />,
    happy:    <HappyFace />,
    thinking: <ThinkingFace />,
    excited:  <ExcitedFace />,
  }[mood] || <NormalFace />;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`drop-shadow-md ${animated ? "hiyoko-float" : ""}`}
    >
      {/* Body */}
      <circle cx="50" cy="55" r="35" fill="#FFEB3B" />
      {/* Head */}
      <circle cx="50" cy="35" r="25" fill="#FFEB3B" />
      {/* Wings */}
      <path
        d="M15 55 Q5 50 15 45"
        fill="none"
        stroke="#FBC02D"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M85 55 Q95 50 85 45"
        fill="none"
        stroke="#FBC02D"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Feet */}
      <path
        d="M40 90 L45 80 M60 90 L55 80"
        stroke="#FF9800"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* 表情（mood別） */}
      {moodProps}

      <style>{`
        .hiyoko-float {
          animation: hiyoko-float-kf 3s ease-in-out infinite;
        }
        @keyframes hiyoko-float-kf {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
      `}</style>
    </svg>
  );
}

// ── 表情パーツ ──────────────────────────────────────────────────────────────
function NormalFace() {
  return (
    <>
      {/* Eyes (普通) */}
      <circle cx="42" cy="30" r="3" fill="#333" />
      <circle cx="58" cy="30" r="3" fill="#333" />
      {/* Beak */}
      <path d="M45 38 L55 38 L50 45 Z" fill="#FF9800" />
    </>
  );
}

function HappyFace() {
  return (
    <>
      {/* Eyes (笑顔: 弧) */}
      <path d="M39 30 Q42 27 45 30" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M55 30 Q58 27 61 30" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* 頬の赤み */}
      <circle cx="35" cy="40" r="2.5" fill="#FFB6C1" opacity="0.7" />
      <circle cx="65" cy="40" r="2.5" fill="#FFB6C1" opacity="0.7" />
      {/* Beak (にっこり) */}
      <path d="M45 38 L55 38 L50 46 Z" fill="#FF9800" />
    </>
  );
}

function ThinkingFace() {
  return (
    <>
      {/* Eyes (考え中: 視線左上) */}
      <circle cx="40" cy="29" r="3" fill="#333" />
      <circle cx="56" cy="29" r="3" fill="#333" />
      {/* Beak */}
      <path d="M45 38 L55 38 L50 45 Z" fill="#FF9800" />
      {/* 考え中マーク */}
      <text x="72" y="20" fontSize="14" fill="#0284c7">?</text>
    </>
  );
}

function ExcitedFace() {
  return (
    <>
      {/* Eyes (キラキラ: 大きな星型風) */}
      <circle cx="42" cy="30" r="4" fill="#333" />
      <circle cx="58" cy="30" r="4" fill="#333" />
      <circle cx="43" cy="29" r="1.2" fill="#fff" />
      <circle cx="59" cy="29" r="1.2" fill="#fff" />
      {/* Beak (開き) */}
      <ellipse cx="50" cy="42" rx="5" ry="4" fill="#FF9800" />
      {/* 感嘆符 */}
      <text x="74" y="22" fontSize="16" fontWeight="bold" fill="#f59e0b">!</text>
    </>
  );
}
