/**
 * ResourcePage — MY HEROICリソース接続 (Step I)
 * カテゴリ別リソースカード
 * ルート: /resources
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

const CATEGORIES = [
  {
    id: "family",
    label: "家族・相続",
    emoji: "👨‍👩‍👧",
    color: "border-purple-200 bg-purple-50",
    headerColor: "bg-purple-100 text-purple-800",
    resources: [
      {
        title: "司法書士に相談",
        desc: "相続手続き・登記・遺言作成の専門家",
        icon: "⚖️",
        tag: "専門家相談",
      },
      {
        title: "相続の流れを知る",
        desc: "死亡届から相続完了までの手順を解説",
        icon: "📋",
        tag: "情報",
      },
      {
        title: "家族と話すポイント",
        desc: "エンディングノート・家族会議の進め方",
        icon: "💬",
        tag: "ガイド",
      },
    ],
  },
  {
    id: "health",
    label: "健康・受診",
    emoji: "🏥",
    color: "border-green-200 bg-green-50",
    headerColor: "bg-green-100 text-green-800",
    resources: [
      {
        title: "良医・病院を探す",
        desc: "専門分野・地域で絞り込める医師検索",
        icon: "🔍",
        tag: "検索",
      },
      {
        title: "看護師に電話相談",
        desc: "24時間対応の健康・医療相談窓口",
        icon: "📞",
        tag: "相談窓口",
      },
      {
        title: "健康確認ポイント",
        desc: "年齢別・性別に合わせた検診チェックリスト",
        icon: "✅",
        tag: "チェック",
      },
    ],
  },
  {
    id: "money",
    label: "お金・老後",
    emoji: "💰",
    color: "border-yellow-200 bg-yellow-50",
    headerColor: "bg-yellow-100 text-yellow-800",
    resources: [
      {
        title: "家計を整理する",
        desc: "支出・収入・保険を可視化するシート",
        icon: "📊",
        tag: "ツール",
      },
      {
        title: "FPに相談",
        desc: "ライフプラン・老後資金の無料相談",
        icon: "🧮",
        tag: "専門家相談",
      },
      {
        title: "公的制度を調べる",
        desc: "高額療養費・障害年金・介護保険の案内",
        icon: "🏛️",
        tag: "制度",
      },
    ],
  },
  {
    id: "work",
    label: "働き方・これから",
    emoji: "💼",
    color: "border-blue-200 bg-blue-50",
    headerColor: "bg-blue-100 text-blue-800",
    resources: [
      {
        title: "キャリアを整理する",
        desc: "強み・やりたいこと・市場価値を棚卸し",
        icon: "🗺️",
        tag: "ツール",
      },
      {
        title: "学び直し情報",
        desc: "リスキリング支援制度・オンライン講座",
        icon: "📚",
        tag: "情報",
      },
    ],
  },
];

export default function ResourcePage() {
  const navigate = useNavigate();
  const [openCat, setOpenCat] = useState(null);

  function handleResourceClick(cat, res) {
    console.log("[ResourcePage] resource_clicked", { category: cat.id, title: res.title });
    // 実際のリソースリンクは今後接続
    alert(`「${res.title}」は近日公開予定です`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood="happy"
            message="あなたに合ったサポートを見つけましょう"
            size="sm"
            animated={false}
          />
        </div>

        <h1 className="text-lg font-bold text-gray-900 mb-2 text-center">
          今使えるサポート
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          MY HEROICのリソースから選んでください
        </p>

        {/* カテゴリカード */}
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const isOpen = openCat === cat.id;
            return (
              <div
                key={cat.id}
                className={`rounded-3xl border-2 overflow-hidden transition-all ${cat.color}`}
              >
                {/* カテゴリヘッダー */}
                <button
                  onClick={() => {
                    setOpenCat(isOpen ? null : cat.id);
                    console.log("[ResourcePage] category_toggle", cat.id);
                  }}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="font-bold text-gray-800 flex-1">{cat.label}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.headerColor}`}
                  >
                    {cat.resources.length}件
                  </span>
                  <span className="text-gray-400 text-sm">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {/* リソース一覧 */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {cat.resources.map((res) => (
                      <button
                        key={res.title}
                        onClick={() => handleResourceClick(cat, res)}
                        className="w-full flex items-start gap-3 bg-white rounded-2xl p-4
                                   border border-gray-100 hover:border-primary-300 hover:shadow-sm
                                   text-left transition group"
                      >
                        <span className="text-xl mt-0.5">{res.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-primary-700">
                            {res.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{res.desc}</p>
                          <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-500
                                           px-2 py-0.5 rounded-full">
                            {res.tag}
                          </span>
                        </div>
                        <span className="text-gray-200 group-hover:text-primary-400 mt-1">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* セッション終了 */}
        <div className="mt-8">
          <button
            onClick={() => {
              console.log("[ResourcePage] action: finish_session");
              navigate("/session-end");
            }}
            className="w-full py-3 border border-gray-200 rounded-2xl text-sm text-gray-500
                       hover:bg-gray-50 transition"
          >
            今日の整理を終える
          </button>
        </div>
      </div>
    </div>
  );
}
