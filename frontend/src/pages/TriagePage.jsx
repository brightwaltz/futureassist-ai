/**
 * TriagePage — 状態整理3問 + チャット誘導
 *
 * Phase 3 新規ページ。ユーザーが今抱えている悩みを
 * 3つの質問で整理し、最適なトピックを特定してチャットへ誘導する。
 *
 * ルート: /triage
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

// ─── トピック定義 ──────────────────────────────────────────────────────────────
const TOPICS = [
  { value: "相続終活",  label: "相続・終活",   emoji: "📜", desc: "遺言・相続税・不動産登記" },
  { value: "介護と健康", label: "介護・健康",   emoji: "🏥", desc: "介護保険・地域支援・健康管理" },
  { value: "お金と資産", label: "お金・資産",   emoji: "💰", desc: "NISA・年金・家計見直し" },
  { value: "家庭問題",  label: "家庭・人間関係", emoji: "🏠", desc: "家族関係・DV・生活困窮" },
  { value: "仕事と生活", label: "仕事・キャリア", emoji: "💼", desc: "働き方・転職・育児介護両立" },
  { value: "健康管理",  label: "健康管理",     emoji: "🌱", desc: "メンタルヘルス・生活習慣" },
];

const URGENCY_OPTIONS = [
  { value: "high",   label: "今すぐ動かないといけない",     color: "border-red-300 bg-red-50 text-red-700" },
  { value: "medium", label: "近いうちに決める必要がある",    color: "border-yellow-300 bg-yellow-50 text-yellow-700" },
  { value: "low",    label: "まず状況を整理したい",          color: "border-blue-300 bg-blue-50 text-blue-700" },
];

const STEPS = ["topic", "concern", "urgency", "result"];

export default function TriagePage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [step, setStep]     = useState(0);  // index into STEPS
  const [topic, setTopic]   = useState(null);
  const [concern, setConcern] = useState("");
  const [urgency, setUrgency] = useState(null);

  const currentStep = STEPS[step];

  // ─── ナビゲーション ─────────────────────────────────────────────────────────
  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleStartChat = () => {
    // チャットページへ選択したトピックを渡して遷移
    navigate("/", { state: { preselectedTopic: topic } });
  };

  // ─── プログレスバー ─────────────────────────────────────────────────────────
  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="max-w-xl mx-auto px-4 py-8">

      {/* ヘッダー */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-900">今の状況を整理しましょう</h1>
          <span className="text-xs text-gray-400">
            {step < STEPS.length - 1 ? `${step + 1} / ${STEPS.length - 1}` : "完了"}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ─── Step 1: トピック選択 ─────────────────────────────────────────── */}
      {currentStep === "topic" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            今、一番気になっているテーマを選んでください。
          </p>
          <div className="grid grid-cols-2 gap-3">
            {TOPICS.map((t) => (
              <button
                key={t.value}
                onClick={() => { setTopic(t.value); goNext(); }}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  topic === t.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <span className="text-2xl block mb-1">{t.emoji}</span>
                <span className="text-sm font-semibold text-gray-800 block">{t.label}</span>
                <span className="text-xs text-gray-400">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Step 2: 悩みの自由入力 ──────────────────────────────────────── */}
      {currentStep === "concern" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">
              {TOPICS.find((t) => t.value === topic)?.emoji}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {TOPICS.find((t) => t.value === topic)?.label}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            今、具体的にどんなことが気になっていますか？
            <span className="text-gray-400">（できるだけ具体的に）</span>
          </p>
          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800
                       resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300
                       placeholder-gray-300 min-h-[120px]"
            placeholder="例）父が亡くなり相続の手続きが必要だが何から始めればよいかわからない"
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-gray-400 text-right">{concern.length} / 500</p>
          <div className="flex gap-3">
            <button
              onClick={goBack}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500
                         hover:bg-gray-50 transition"
            >
              ← 戻る
            </button>
            <button
              onClick={goNext}
              disabled={concern.trim().length < 5}
              className="flex-2 flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium
                         hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              次へ →
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: 緊急度 ───────────────────────────────────────────────── */}
      {currentStep === "urgency" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            今の状況はどのくらい急ぎですか？
          </p>
          <div className="space-y-3">
            {URGENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setUrgency(opt.value); goNext(); }}
                className={`w-full text-left p-4 rounded-xl border-2 font-medium text-sm transition-all ${
                  urgency === opt.value
                    ? opt.color + " border-current"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={goBack}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-500
                       hover:bg-gray-50 transition"
          >
            ← 戻る
          </button>
        </div>
      )}

      {/* ─── Step 4: 整理結果 + チャット誘導 ────────────────────────────── */}
      {currentStep === "result" && (
        <div className="space-y-5">
          {/* 整理カード */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-gray-900">状況が整理できました</h2>
            </div>

            <div className="space-y-2">
              <SummaryRow
                label="テーマ"
                value={TOPICS.find((t) => t.value === topic)?.label}
                emoji={TOPICS.find((t) => t.value === topic)?.emoji}
              />
              <SummaryRow
                label="気になっていること"
                value={concern}
              />
              <SummaryRow
                label="緊急度"
                value={URGENCY_OPTIONS.find((o) => o.value === urgency)?.label}
                urgency={urgency}
              />
            </div>
          </div>

          {/* 次のアクション */}
          <div className="bg-indigo-50 rounded-2xl p-5 space-y-3">
            <p className="text-sm text-indigo-900 font-medium">
              AIが詳しく整理をお手伝いします
            </p>
            <p className="text-xs text-indigo-700">
              「{TOPICS.find((t) => t.value === topic)?.label}」について、
              あなたの状況に合った公的情報をご案内します。
            </p>
            <button
              onClick={handleStartChat}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white
                         font-semibold text-sm rounded-xl transition shadow-sm"
            >
              AIに相談する →
            </button>
          </div>

          {/* サブアクション */}
          <div className="flex gap-3">
            <button
              onClick={() => { setStep(0); setTopic(null); setConcern(""); setUrgency(null); }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-500
                         hover:bg-gray-50 transition"
            >
              最初からやり直す
            </button>
            <button
              onClick={() => navigate("/survey")}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-500
                         hover:bg-gray-50 transition"
            >
              アンケートに回答する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 補助コンポーネント ──────────────────────────────────────────────────────
function SummaryRow({ label, value, emoji, urgency }) {
  const urgencyColor = {
    high: "text-red-600",
    medium: "text-yellow-600",
    low: "text-blue-600",
  };
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <span className={`text-gray-800 font-medium ${urgency ? urgencyColor[urgency] : ""}`}>
        {emoji ? `${emoji} ` : ""}{value}
      </span>
    </div>
  );
}
