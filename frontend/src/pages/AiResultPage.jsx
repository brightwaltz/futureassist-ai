/**
 * AiResultPage — AI整理結果 (Step G)
 * 3ブロック表示: あなたの状態 / 今やること / 今使えるサポート
 * ルート: /ai-result
 */
import React, { useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

// トリアージ回答からコンテンツを生成するロジック
function buildResult(moyanText, degree, timing, state) {
  // 状態テキスト
  const stateDesc = {
    unknown:   "何から始めればいいか分からない状況",
    researching: "調べているが決めきれない状況",
    ready:     "行動に移せそうな状況",
  }[state] || "整理が必要な状況";

  const degreeDesc = {
    small:  "小さな気がかり",
    medium: "少し大きな気がかり",
    big:    "かなり大きな気がかり",
  }[degree] || "気がかり";

  const timingDesc = {
    today:    "今日中",
    thisweek: "今週中",
    someday:  "そのうち",
  }[timing] || "近いうち";

  // やること
  const actionMap = {
    unknown_today:     "まず「何が分かっていて、何が分からないか」を紙に書き出してみる",
    unknown_thisweek:  "関連する公的制度・相談窓口を1つ調べてみる",
    unknown_someday:   "気になることをリストアップして優先順位をつける",
    researching_today: "比較している選択肢を3つに絞って一つ決める",
    researching_thisweek: "専門家（FP・司法書士等）に無料相談の予約を入れる",
    researching_someday: "情報を整理するノートやメモをまとめる",
    ready_today:       "今日、最初の一歩（電話・申込・手続き）を踏み出す",
    ready_thisweek:    "具体的なスケジュールと担当者を決める",
    ready_someday:     "行動計画を文書化して家族と共有する",
  };
  const action = actionMap[`${state}_${timing}`] || "まず今の状況を書き出して整理してみる";

  return {
    stateText: `${degreeDesc}が${stateDesc}です。「${timingDesc}に動きたい」という気持ちがあります。`,
    action,
    links: [
      { label: "公的相談窓口を探す",  icon: "🏛️", href: "/resources" },
      { label: "専門家に相談する",    icon: "👨‍💼", href: "/resources" },
      { label: "関連情報を見る",      icon: "📚", href: "/resources" },
    ],
  };
}

export default function AiResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    moyanText = "",
    degree   = "medium",
    timing   = "thisweek",
    state    = "unknown",
  } = location.state || {};

  console.log("[AiResultPage] context", { moyanText, degree, timing, state });

  const result = useMemo(
    () => buildResult(moyanText, degree, timing, state),
    [moyanText, degree, timing, state]
  );

  function handleAction() {
    console.log("[AiResultPage] action: これをやる", result.action);
    navigate("/session-end", {
      state: { action: result.action, fromAiResult: true },
    });
  }

  function handleDeepen() {
    console.log("[AiResultPage] action: もう少し整理する");
    navigate("/coaching", { state: { moyanText, degree, timing, state } });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood="happy"
            message="整理できました！確認してみてください"
            size="md"
            animated={false}
          />
        </div>

        {/* モヤモヤテキスト表示 */}
        {moyanText && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-5">
            <p className="text-xs text-gray-400 mb-1">あなたのモヤモヤ</p>
            <p className="text-sm text-gray-700 italic">「{moyanText}」</p>
          </div>
        )}

        {/* ブロック1: あなたの状態 */}
        <div className="bg-white rounded-3xl border border-primary-100 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-primary-100 rounded-xl flex items-center justify-center">
              <span className="text-sm">🧭</span>
            </div>
            <h3 className="text-sm font-bold text-gray-800">あなたの状態</h3>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {result.stateText}
          </p>
        </div>

        {/* ブロック2: 今やること */}
        <div className="bg-primary-50 rounded-3xl border border-primary-200 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-primary-500 rounded-xl flex items-center justify-center">
              <span className="text-sm text-white">✓</span>
            </div>
            <h3 className="text-sm font-bold text-primary-800">今やること</h3>
          </div>
          <p className="text-sm text-primary-900 font-medium leading-relaxed">
            {result.action}
          </p>
        </div>

        {/* ブロック3: 今使えるサポート */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-green-100 rounded-xl flex items-center justify-center">
              <span className="text-sm">🤝</span>
            </div>
            <h3 className="text-sm font-bold text-gray-800">今使えるサポート</h3>
          </div>
          <div className="space-y-2">
            {result.links.map((l) => (
              <Link
                key={l.label}
                to={l.href}
                className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-primary-50
                           border border-transparent hover:border-primary-200 transition"
              >
                <span className="text-xl">{l.icon}</span>
                <span className="text-sm text-gray-700">{l.label}</span>
                <span className="ml-auto text-gray-300 text-sm">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={handleAction}
            className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white
                       font-bold text-sm rounded-2xl transition shadow-sm active:scale-95"
          >
            ✅ これをやる
          </button>
          <button
            onClick={handleDeepen}
            className="w-full py-3 bg-white border border-primary-300 text-primary-700
                       font-medium text-sm rounded-2xl hover:bg-primary-50 transition"
          >
            🔍 もう少し整理する
          </button>
          <Link
            to="/resources"
            className="block w-full py-3 text-center border border-gray-200 text-gray-500
                       text-sm rounded-2xl hover:bg-gray-50 transition"
          >
            📋 サポートを見る
          </Link>
        </div>
      </div>
    </div>
  );
}
