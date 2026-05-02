/**
 * CheckPage — はじめの1分チェック (Step C)
 * 11問の状態チェック（顔アイコン3択）
 * ルート: /check
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HiyokoCompanion from "../components/HiyokoCompanion";

const QUESTIONS = [
  // Q1-5: 状態把握
  { id: 1, group: "状態把握", text: "今の生活全体に、どのくらい満足していますか？" },
  { id: 2, group: "状態把握", text: "仕事と私生活のバランスに満足していますか？" },
  { id: 3, group: "状態把握", text: "最近のストレスの程度はどのくらいですか？", reverse: true },
  { id: 4, group: "状態把握", text: "最近、ポジティブな気持ちで過ごした時間はどれくらいありましたか？" },
  { id: 5, group: "状態把握", text: "今の活力・エネルギーのレベルを教えてください" },
  // Q6-11: 企業向け先行指標
  { id: 6, group: "先行指標", text: "仕事外の気がかりで、仕事の判断や集中が落ちることはありましたか？", reverse: true },
  { id: 7, group: "先行指標", text: "今すぐではないが、準備不足だと感じるテーマはありますか？", reverse: true },
  { id: 8, group: "先行指標", text: "困ったときに、自分に合う相談先や制度をすぐ見つけられますか？" },
  { id: 9, group: "先行指標", text: "身近な人（家族・友人）のことで、気がかりなことはありますか？", reverse: true },
  { id: 10, group: "先行指標", text: "将来の生活設計について、見通しを持てていますか？" },
  { id: 11, group: "先行指標", text: "今の状況を整理・解決するための情報や手段を知っていますか？" },
];

const CHOICES = [
  { value: 1, label: "不満",   emoji: "😞", color: "border-red-300   bg-red-50   hover:bg-red-100" },
  { value: 3, label: "普通",   emoji: "😐", color: "border-gray-300  bg-gray-50  hover:bg-gray-100" },
  { value: 5, label: "満足",   emoji: "😊", color: "border-primary-300 bg-primary-50 hover:bg-primary-100" },
];

export default function CheckPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});   // { [questionId]: value }
  const [currentQ, setCurrentQ] = useState(0);  // 0-based index

  const q = QUESTIONS[currentQ];
  const progress = (currentQ / QUESTIONS.length) * 100;
  const isLast = currentQ === QUESTIONS.length - 1;

  console.log("[CheckPage] question", q?.id, "progress", Math.round(progress));

  function handleChoose(value) {
    const updated = { ...answers, [q.id]: value };
    setAnswers(updated);

    console.log("[CheckPage] answer", q.id, "=", value);

    if (isLast) {
      // 完了 → 結果ページへ
      navigate("/check/result", { state: { answers: updated } });
    } else {
      setCurrentQ((i) => i + 1);
    }
  }

  function handleBack() {
    if (currentQ > 0) setCurrentQ((i) => i - 1);
  }

  const groupChanged =
    currentQ === 5 && !answers[6]; // 先行指標グループ開始

  return (
    <div className="min-h-screen bg-slate-50">
      {/* プログレスバー */}
      <div className="w-full h-1.5 bg-gray-200">
        <div
          className="h-1.5 bg-primary-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-gray-900">はじめの1分チェック</h1>
          <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-200">
            {currentQ + 1} / {QUESTIONS.length}
          </span>
        </div>

        {/* グループラベル */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
            {q.group}
          </span>
          {groupChanged && (
            <span className="text-xs text-gray-500">企業向け先行指標に入ります</span>
          )}
        </div>

        {/* コンパニオン */}
        <div className="flex justify-center mb-6">
          <HiyokoCompanion
            mood="normal"
            message="正直に答えてください。正解はありません🙂"
            size="sm"
            animated={false}
          />
        </div>

        {/* 質問カード */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 mb-6">
          <p className="text-base font-semibold text-gray-800 leading-relaxed text-center min-h-[3rem]">
            {q.text}
          </p>
        </div>

        {/* 選択肢 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {CHOICES.map((c) => {
            const selected = answers[q.id] === c.value;
            return (
              <button
                key={c.value}
                onClick={() => handleChoose(c.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 font-medium
                            text-sm transition-all active:scale-95
                            ${selected
                              ? "border-primary-500 bg-primary-100 shadow-inner"
                              : `${c.color} border-opacity-80`
                            }`}
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className={selected ? "text-primary-700" : "text-gray-600"}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 戻るボタン */}
        {currentQ > 0 && (
          <button
            onClick={handleBack}
            className="w-full py-3 rounded-2xl border border-gray-200 text-sm text-gray-400
                       hover:bg-gray-50 transition"
          >
            ← 前の質問に戻る
          </button>
        )}
      </div>
    </div>
  );
}
