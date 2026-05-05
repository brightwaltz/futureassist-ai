/**
 * MyDashboardPage — わたしのダッシュボード（個人用）
 *
 * 設計書 (clearわたしのダッシュボード設計書.pptx) 準拠:
 *   ① ページヘッダー
 *   ② 今日の状態サマリー（ひよこ）
 *   ③ 今のおすすめアクション (High Priority)
 *   ④ 主要スコアカード（解説付き）
 *   ⑤ 最近の相談・続きから
 *   ⑥ 変化の推移（タブ切替）
 *   ⑦ Life Ability 5要素分解
 *   ⑧ 今のあなたに合うサポート
 *   ⑨ 1分チェック履歴
 *
 * 思想:
 *   - Action-First: 数値より「次の一手」
 *   - 意味づけの付与: スコアに必ず一言コメント
 *   - ひよこの伴走: 状態フィードバック
 *
 * ルート: /dashboard
 */
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Area, AreaChart, ReferenceLine,
} from "recharts";
import {
  Sparkles, Target, Calendar, Clock, ArrowRight, RefreshCw,
  TrendingUp, AlertTriangle, Lightbulb, Award,
  ChevronRight, MessageCircle, Heart, Activity, Zap,
} from "lucide-react";

import HiyokoCompanion from "../components/HiyokoCompanion";
import {
  HEADER_INFO,
  TODAY_STATUS,
  RECOMMENDED_ACTION,
  SCORE_CARDS,
  RECENT_CONSULTATIONS,
  TREND_DATA,
  LIFE_ABILITY_FIVE,
  RECOMMENDED_SUPPORT,
  CHECK_HISTORY,
} from "../data/myDashboardMock";

// ═══════════════════════════════════════════════════════════════════════════
// ① ページヘッダー
// ═══════════════════════════════════════════════════════════════════════════
function PageHeader() {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
              <span className="text-2xl">🏡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">マイダッシュボード</h1>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                今の状態と、次にやることが分かります。
                <br className="sm:hidden" />
                <span className="text-xs text-gray-400">
                  最近の相談、1分チェック、状態の変化をもとに表示しています
                </span>
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1 shrink-0 hidden sm:flex">
            <RefreshCw className="w-3 h-3" />
            最終更新: {HEADER_INFO.last_updated}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ② 今日の状態サマリー（ひよこ）
// ═══════════════════════════════════════════════════════════════════════════
function TodayStatusSummary() {
  const navigate = useNavigate();

  return (
    <Section
      icon={<Heart className="w-5 h-5 text-rose-500" />}
      title="今日の状態"
      subtitle="ひよこからのメッセージ"
    >
      <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100
                      rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6">
          {/* ひよこ + 吹き出し */}
          <div className="md:w-1/3 flex justify-center">
            <HiyokoCompanion
              mood={TODAY_STATUS.hiyoko_mood}
              message={TODAY_STATUS.state_message}
              size="lg"
              animated
            />
          </div>

          {/* 統計 + CTA */}
          <div className="md:w-2/3 space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">今の気分</p>
              <span className="inline-block bg-white border border-primary-200 text-primary-700
                               px-4 py-1.5 rounded-full text-sm font-medium">
                😊 {TODAY_STATUS.mood}
              </span>
            </div>

            {/* 最近の変化 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">最近の変化</p>
              <div className="grid grid-cols-3 gap-2">
                {TODAY_STATUS.recent_changes.map((c) => (
                  <div
                    key={c.label}
                    className="bg-white border border-gray-100 rounded-2xl p-3 text-center"
                  >
                    <div className="text-xl mb-1">{c.icon}</div>
                    <div className="text-xl font-bold text-primary-700">
                      {c.value}
                      <span className="text-xs font-normal text-gray-400 ml-0.5">{c.unit}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => {
                  console.log("[MyDashboard] cta: integrate_now");
                  navigate("/");
                }}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white
                           text-sm font-medium rounded-xl transition active:scale-95"
              >
                今のモヤモヤを整理する
              </button>
              <button
                onClick={() => {
                  console.log("[MyDashboard] cta: 1min_check");
                  navigate("/check");
                }}
                className="px-4 py-2 bg-white border border-primary-300 text-primary-700
                           text-sm font-medium rounded-xl hover:bg-primary-50 transition"
              >
                ⏱ 1分チェックをする
              </button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ③ 今のおすすめアクション (最重要)
// ═══════════════════════════════════════════════════════════════════════════
function RecommendedAction() {
  const a = RECOMMENDED_ACTION;
  const navigate = useNavigate();

  function handleClick(key) {
    console.log("[MyDashboard] recommended_action_cta", key);
    if (key === "do") navigate("/session-end", { state: { action: a.title } });
  }

  return (
    <Section
      icon={<Lightbulb className="w-5 h-5 text-amber-500" />}
      title="今のおすすめアクション"
      subtitle="優先度: 高"
    >
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200
                      rounded-3xl p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center
                          shrink-0 shadow-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {a.category_emoji} {a.category}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                目安 {a.duration_min}分
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900 leading-snug">
              {a.title}
            </h3>
          </div>
        </div>

        {/* 理由 */}
        <div className="bg-white/70 rounded-2xl p-3 mb-4 border border-amber-100">
          <p className="text-xs font-semibold text-amber-800 mb-1">なぜ、これ？</p>
          <p className="text-xs text-gray-700 leading-relaxed">{a.reason}</p>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap gap-2">
          {a.ctas.map((cta) => (
            <button
              key={cta.key}
              onClick={() => handleClick(cta.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-xl transition active:scale-95 ${
                cta.primary
                  ? "bg-primary-600 hover:bg-primary-700 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {cta.primary && "✓ "}{cta.label}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ④ 主要スコアカード（解説付き）
// ═══════════════════════════════════════════════════════════════════════════
function ScoreCardsGrid() {
  return (
    <Section
      icon={<Activity className="w-5 h-5 text-primary-600" />}
      title="主要スコア"
      subtitle="数値だけでなく「今の意味」を添えています"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SCORE_CARDS.map((s) => <ScoreCard key={s.key} {...s} />)}
      </div>
    </Section>
  );
}

function ScoreCard({ label, value, max, comment, color, icon, label_value }) {
  const palette = {
    primary: { bg: "bg-primary-50",  text: "text-primary-700",  bar: "bg-primary-500" },
    purple:  { bg: "bg-purple-50",   text: "text-purple-700",   bar: "bg-purple-500"  },
    green:   { bg: "bg-green-50",    text: "text-green-700",    bar: "bg-green-500"   },
    orange:  { bg: "bg-orange-50",   text: "text-orange-700",   bar: "bg-orange-500"  },
    red:     { bg: "bg-red-50",      text: "text-red-700",      bar: "bg-red-500"     },
    amber:   { bg: "bg-amber-50",    text: "text-amber-700",    bar: "bg-amber-500"   },
  }[color];

  const pct = label_value ? null : Math.round((value / (max || 100)) * 100);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            {label_value ? (
              <span className={`text-xl font-bold ${palette.text}`}>{value}</span>
            ) : (
              <>
                <span className="text-2xl font-bold text-gray-900">{value}</span>
                {max && <span className="text-xs text-gray-400">/{max}</span>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* プログレスバー (数値スコアのみ) */}
      {pct != null && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
          <div
            className={`h-1.5 rounded-full ${palette.bar} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* 一言コメント */}
      <div className={`${palette.bg} rounded-xl px-3 py-2 mt-2`}>
        <p className={`text-xs leading-relaxed ${palette.text}`}>
          💡 {comment}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ 最近の相談・続きから
// ═══════════════════════════════════════════════════════════════════════════
function RecentConsultations() {
  const navigate = useNavigate();

  function handleResume(c) {
    console.log("[MyDashboard] resume_consultation", c.id);
    navigate("/", { state: { resumeConversationId: c.id } });
  }

  return (
    <Section
      icon={<MessageCircle className="w-5 h-5 text-blue-600" />}
      title="最近の相談・続きから"
      subtitle="未完了の整理は続きから再開できます"
    >
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {RECENT_CONSULTATIONS.map((c, i) => (
          <div
            key={c.id}
            className={`flex items-center gap-3 p-4 ${
              i < RECENT_CONSULTATIONS.length - 1 ? "border-b border-gray-100" : ""
            } hover:bg-gray-50 transition`}
          >
            <span className="text-2xl">{c.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-gray-800 truncate">{c.theme}</p>
                <span className="text-xs text-gray-400">{c.datetime}</span>
              </div>
              <p className="text-xs text-gray-600 truncate">
                <span className="text-primary-600 font-medium">今やること:</span> {c.next_action}
              </p>
            </div>
            {c.incomplete ? (
              <button
                onClick={() => handleResume(c)}
                className="shrink-0 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white
                           text-xs font-medium rounded-xl transition active:scale-95
                           flex items-center gap-1"
              >
                続きから
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-xs text-green-600 font-medium shrink-0
                               bg-green-50 px-2 py-1 rounded-full">完了</span>
            )}
          </div>
        ))}

        <Link
          to="/history"
          className="block py-3 text-center text-xs text-gray-500 hover:text-primary-600
                     hover:bg-gray-50 transition border-t border-gray-100"
        >
          すべての履歴を見る →
        </Link>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ 変化の推移（タブ切替）
// ═══════════════════════════════════════════════════════════════════════════
function TrendChart() {
  const [activeTab, setActiveTab] = useState("wellbeing");
  const t = TREND_DATA[activeTab];

  console.log("[MyDashboard] trend_tab", activeTab);

  return (
    <Section
      icon={<TrendingUp className="w-5 h-5 text-green-600" />}
      title="変化の推移"
      subtitle="ここ8週間の変化"
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        {/* タブ */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(TREND_DATA).map(([key, td]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                activeTab === key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {td.label}
            </button>
          ))}
        </div>

        {/* グラフ */}
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={t.points} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={t.color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={t.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(v) => [`${v}`, t.label]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={t.color}
                strokeWidth={2.5}
                fill="url(#trendGrad)"
                dot={{ r: 3, fill: t.color }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI解釈 */}
        <div className="mt-3 bg-primary-50 border border-primary-100 rounded-2xl p-3 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-primary-800 mb-0.5">最近の変化</p>
            <p className="text-xs text-primary-900 leading-relaxed">{t.interpretation}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ Life Ability 5要素分解
// ═══════════════════════════════════════════════════════════════════════════
function LifeAbilityFiveElements() {
  const data = LIFE_ABILITY_FIVE.elements.map((e) => ({
    subject:  e.label,
    score:    e.score,
    fullMark: 100,
  }));

  return (
    <Section
      icon={<Award className="w-5 h-5 text-purple-600" />}
      title="Life Ability 5要素の分解"
      subtitle="どこがボトルネックか分かります"
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* レーダーチャート */}
          <div className="lg:w-1/2 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} tickCount={3} />
                <Radar
                  name="スコア"
                  dataKey="score"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Tooltip
                  formatter={(v) => [`${v}点`, "スコア"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 要素一覧（説明付き） */}
          <div className="lg:w-1/2 space-y-2">
            {LIFE_ABILITY_FIVE.elements.map((e) => {
              const lvlColor = {
                "低い":     "text-red-600 bg-red-50",
                "やや低い": "text-orange-600 bg-orange-50",
                "普通":     "text-gray-600 bg-gray-100",
                "やや高い": "text-green-600 bg-green-50",
                "高い":     "text-green-700 bg-green-100",
              }[e.level] || "text-gray-600 bg-gray-100";
              return (
                <div key={e.key} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800">{e.label}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lvlColor}`}>
                      {e.level}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{e.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ボトルネック */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium">
            {LIFE_ABILITY_FIVE.bottleneck_message}
          </p>
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑧ 今のあなたに合うサポート
// ═══════════════════════════════════════════════════════════════════════════
function RecommendedSupport() {
  const navigate = useNavigate();

  function handleClick(s) {
    console.log("[MyDashboard] support_clicked", s.type, s.title);
    navigate("/resources");
  }

  return (
    <Section
      icon={<Zap className="w-5 h-5 text-yellow-500" />}
      title="今のあなたに合うサポート"
      subtitle="状態に合わせた3つのおすすめ"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {RECOMMENDED_SUPPORT.map((s) => <SupportCard key={s.title} support={s} onClick={() => handleClick(s)} />)}
      </div>
      <div className="text-center mt-3">
        <Link
          to="/resources"
          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
        >
          すべてのサポートを見る <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </Section>
  );
}

function SupportCard({ support: s, onClick }) {
  const palette = {
    purple:  { bg: "bg-purple-50",  border: "border-purple-200",  badge: "bg-purple-100 text-purple-700"   },
    primary: { bg: "bg-primary-50", border: "border-primary-200", badge: "bg-primary-100 text-primary-700" },
    green:   { bg: "bg-green-50",   border: "border-green-200",   badge: "bg-green-100 text-green-700"     },
  }[s.color];

  return (
    <button
      onClick={onClick}
      className={`text-left ${s.bg} bg-white border ${palette.border} rounded-2xl p-4
                  hover:shadow-md transition active:scale-95 group`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{s.icon}</div>
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5 ${palette.badge}`}>
            {s.type_label}
          </span>
          <p className="text-sm font-bold text-gray-800 group-hover:text-primary-700 leading-tight">
            {s.title}
          </p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.desc}</p>
          <p className="text-[10px] text-gray-400 mt-2 italic">→ {s.why}</p>
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑨ 1分チェック履歴
// ═══════════════════════════════════════════════════════════════════════════
function CheckHistory() {
  return (
    <Section
      icon={<Calendar className="w-5 h-5 text-gray-500" />}
      title="1分チェック履歴"
      subtitle="過去のチェック結果"
    >
      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">日時</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-600">Life Ability</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-600">満足度</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-600">パフォーマンス阻害</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600">未準備テーマ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CHECK_HISTORY.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-700">{h.datetime}</td>
                <td className="px-3 py-3 text-right text-xs font-semibold text-primary-700">{h.life_ability}</td>
                <td className="px-3 py-3 text-right text-xs font-semibold text-green-700">{h.satisfaction}</td>
                <td className="px-3 py-3 text-right text-xs font-semibold text-orange-700">{h.performance_loss}%</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {h.unprepared_themes.map((t) => (
                      <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 共通: セクションラッパー
// ═══════════════════════════════════════════════════════════════════════════
function Section({ icon, title, subtitle, children }) {
  return (
    <section className="mb-7">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <span className="text-xs text-gray-400 hidden sm:inline">— {subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// メインページ
// ═══════════════════════════════════════════════════════════════════════════
export default function MyDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <TodayStatusSummary />
        <RecommendedAction />
        <ScoreCardsGrid />
        <RecentConsultations />
        <TrendChart />
        <LifeAbilityFiveElements />
        <RecommendedSupport />
        <CheckHistory />

        <div className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-6">
          わたしのダッシュボード ・ あなたの状態と次の一手を、いつでも確認できます
        </div>
      </div>
    </div>
  );
}
