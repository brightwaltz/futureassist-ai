/**
 * わたしのダッシュボード モックデータ
 * 設計書 (clearわたしのダッシュボード設計書.pptx) の「表示例」を反映。
 */

// ── ① ヘッダー ─────────────────────────────────────────────────────────────
export const HEADER_INFO = {
  last_updated: "2026年4月25日 09:14",
};

// ── ② 今日の状態サマリー ──────────────────────────────────────────────────
export const TODAY_STATUS = {
  state_message: "少し気がかりを抱えやすいですが、整理すると前に進みやすい状態です",
  mood: "ふつう",          // "うれしい" | "ふつう" | "少し疲れぎみ"
  hiyoko_mood: "thinking", // HiyokoCompanion の mood
  recent_changes: [
    { label: "次の一手が決まった回数", value: 2, unit: "回", icon: "🎯" },
    { label: "少し楽になった回数",     value: 1, unit: "回", icon: "😌" },
    { label: "今週の整理件数",         value: 3, unit: "件", icon: "📝" },
  ],
};

// ── ③ 今のおすすめアクション ──────────────────────────────────────────────
export const RECOMMENDED_ACTION = {
  title: "親の今後について、家族に一度だけ確認してみましょう",
  reason: "最近の相談内容と状態から、今は情報を増やすより、最初の確認をする方が前に進みやすい状態です",
  duration_min: 10,
  category: "親・家族",
  category_emoji: "👨‍👩‍👧",
  ctas: [
    { key: "do",    label: "これをやる",          primary: true },
    { key: "tips",  label: "話し方のポイントを見る" },
    { key: "where", label: "相談先を見る" },
  ],
};

// ── ④ 主要スコアカード（解説付き） ───────────────────────────────────────
export const SCORE_CARDS = [
  {
    key: "wellbeing",
    label: "総合ウェルビーイング",
    value: 40.0,
    max: 100,
    comment: "最近はやや余白が少ない状態です",
    color: "primary",
    icon: "💙",
  },
  {
    key: "life_ability",
    label: "Life Ability",
    value: 40.0,
    max: 100,
    comment: "整理すると前に進みやすい状態です",
    color: "purple",
    icon: "🌱",
  },
  {
    key: "satisfaction",
    label: "生活満足度",
    value: 40.0,
    max: 100,
    comment: "今後の見通しを整えると改善しやすいです",
    color: "green",
    icon: "🌿",
  },
  {
    key: "stress",
    label: "ストレス",
    value: "やや高め",
    label_value: true,        // 数値ではなくラベル
    comment: "まずは1つだけ気がかりを減らしましょう",
    color: "orange",
    icon: "🌀",
  },
  {
    key: "actionability",
    label: "行動しやすさ",
    value: "低め",
    label_value: true,
    comment: "情報不足より、決めきれなさが残っています",
    color: "red",
    icon: "🚶",
  },
  {
    key: "future_readiness",
    label: "将来準備度",
    value: "低め",
    label_value: true,
    comment: "親・お金・健康のどれかを少し整理すると改善しやすいです",
    color: "amber",
    icon: "🔮",
  },
];

// ── ⑤ 最近の相談・続きから ───────────────────────────────────────────────
export const RECENT_CONSULTATIONS = [
  {
    id: "c1",
    theme: "お金と資産",
    emoji: "💰",
    datetime: "4/16 10:53",
    next_action: "固定費を1つ見直す",
    incomplete: true,
  },
  {
    id: "c2",
    theme: "相続・将来準備",
    emoji: "📜",
    datetime: "4/14 13:10",
    next_action: "家族に一度確認する",
    incomplete: true,
  },
  {
    id: "c3",
    theme: "健康管理",
    emoji: "🏥",
    datetime: "4/14 10:21",
    next_action: "気になる項目を確認する",
    incomplete: false,
  },
];

// ── ⑥ 変化の推移（タブ切り替え）──────────────────────────────────────────
export const TREND_DATA = {
  wellbeing: {
    label: "総合ウェルビーイング",
    color: "#0078c6",
    interpretation: "4月に入ってから、少しずつ持ち直しの傾向があります",
    points: [
      { date: "3/01", value: 38 },
      { date: "3/08", value: 36 },
      { date: "3/15", value: 35 },
      { date: "3/22", value: 37 },
      { date: "3/29", value: 39 },
      { date: "4/05", value: 40 },
      { date: "4/12", value: 41 },
      { date: "4/19", value: 40 },
    ],
  },
  life_ability: {
    label: "Life Ability",
    color: "#8b5cf6",
    interpretation: "Life Ability は横ばいですが、安定して推移しています",
    points: [
      { date: "3/01", value: 42 },
      { date: "3/08", value: 41 },
      { date: "3/15", value: 40 },
      { date: "3/22", value: 41 },
      { date: "3/29", value: 40 },
      { date: "4/05", value: 40 },
      { date: "4/12", value: 41 },
      { date: "4/19", value: 40 },
    ],
  },
  actionability: {
    label: "行動しやすさ",
    color: "#10b981",
    interpretation: "4月に入ってから、行動しやすさは少し改善しています",
    points: [
      { date: "3/01", value: 30 },
      { date: "3/08", value: 28 },
      { date: "3/15", value: 32 },
      { date: "3/22", value: 35 },
      { date: "3/29", value: 38 },
      { date: "4/05", value: 42 },
      { date: "4/12", value: 45 },
      { date: "4/19", value: 47 },
    ],
  },
  stress: {
    label: "ストレス",
    color: "#ef4444",
    interpretation: "ストレスは少し高い水準が続いています。整理を一つずつ進めましょう",
    inverted: true, // 高い方が悪い
    points: [
      { date: "3/01", value: 55 },
      { date: "3/08", value: 60 },
      { date: "3/15", value: 65 },
      { date: "3/22", value: 62 },
      { date: "3/29", value: 60 },
      { date: "4/05", value: 58 },
      { date: "4/12", value: 60 },
      { date: "4/19", value: 58 },
    ],
  },
};

// ── ⑦ Life Ability 5要素 ─────────────────────────────────────────────────
export const LIFE_ABILITY_FIVE = {
  elements: [
    {
      key: "info_org",
      label: "情報整理力",
      score: 38,
      level: "やや低い",
      desc: "情報が多いときに、何を優先するか決めやすい状態か",
    },
    {
      key: "decision",
      label: "意思決定納得度",
      score: 32,
      level: "低い",
      desc: "自分の選択に納得して進める状態か",
    },
    {
      key: "action",
      label: "行動移行力",
      score: 30,
      level: "低い",
      desc: "次の一手に移りやすい状態か",
    },
    {
      key: "stability",
      label: "生活運用安定性",
      score: 52,
      level: "普通",
      desc: "仕事と生活を落ち着いて回せているか",
    },
    {
      key: "resource",
      label: "リソース創出力",
      score: 35,
      level: "低い",
      desc: "時間・お金・気持ちの余白を作れているか",
    },
  ],
  bottleneck_message: "今は「決めきれなさ」がボトルネックです",
};

// ── ⑧ 今のあなたに合うサポート ───────────────────────────────────────────
export const RECOMMENDED_SUPPORT = [
  {
    type: "expert",
    type_label: "専門家",
    title: "司法書士に相談する",
    desc: "相続・遺言・登記の手続きを一緒に整理",
    icon: "⚖️",
    color: "purple",
    why: "親・家族テーマで未整理の項目があります",
  },
  {
    type: "info",
    type_label: "情報整理",
    title: "家計を整理する",
    desc: "支出・固定費の見える化シート",
    icon: "📊",
    color: "primary",
    why: "今やることに「固定費の見直し」があります",
  },
  {
    type: "self",
    type_label: "自分でできる",
    title: "10分の家族会議を試す",
    desc: "話し方ガイド付き・話す内容のテンプレート",
    icon: "💬",
    color: "green",
    why: "今のおすすめアクションと連動",
  },
];

// ── ⑨ 1分チェック履歴 ────────────────────────────────────────────────────
export const CHECK_HISTORY = [
  {
    id: "h1",
    datetime: "4/22 09:08",
    type: "1分チェック",
    life_ability: 40,
    satisfaction: 40,
    performance_loss: 38,
    unprepared_themes: ["親・家族", "お金・老後"],
  },
  {
    id: "h2",
    datetime: "4/15 18:42",
    type: "1分チェック",
    life_ability: 41,
    satisfaction: 38,
    performance_loss: 42,
    unprepared_themes: ["お金・老後"],
  },
  {
    id: "h3",
    datetime: "4/08 10:15",
    type: "1分チェック",
    life_ability: 38,
    satisfaction: 36,
    performance_loss: 45,
    unprepared_themes: ["親・家族", "健康", "お金・老後"],
  },
];
