/**
 * みんなのダッシュボード モックデータ
 *
 * 仕様書 (clearみんなのダッシュボード設計書.pptx) 準拠の
 * 経営層向け意思決定支援指標。実APIに置き換えるまでの暫定データ。
 */

// ── ② エグゼクティブサマリー (KPIカード) ──────────────────────────────────────
export const EXEC_SUMMARY = {
  period_label: "2026年4月",
  prev_label:   "2026年3月",
  cards: [
    {
      key: "users",
      label: "利用者数",
      value: 100,
      unit: "人",
      delta: +8,
      delta_unit: "人",
      direction: "up",
      good_direction: "up",
    },
    {
      key: "consultations_per_user",
      label: "1人あたり悩み処理数",
      value: 4.5,
      unit: "件",
      delta: +0.6,
      delta_unit: "件",
      direction: "up",
      good_direction: "up",
    },
    {
      key: "action_transition",
      label: "行動移行率",
      value: 62,
      unit: "%",
      delta: +5,
      delta_unit: "pt",
      direction: "up",
      good_direction: "up",
    },
    {
      key: "support_connection",
      label: "支援接続率",
      value: 28,
      unit: "%",
      delta: +3,
      delta_unit: "pt",
      direction: "up",
      good_direction: "up",
    },
    {
      key: "anxiety_retention",
      label: "不安滞留率",
      value: 21,
      unit: "%",
      delta: -4,
      delta_unit: "pt",
      direction: "down",
      good_direction: "down",
    },
  ],
};

// ── ③ 先行指標サマリー (Leading Indicators) ──────────────────────────────────
export const LEADING_INDICATORS = [
  {
    key: "performance_loss",
    label: "生活起因パフォーマンス阻害率",
    value: 38,
    desc: "仕事外の気がかりで判断・集中に影響が出ている社員割合",
    threshold: { warn: 30, danger: 40 },
  },
  {
    key: "life_event_unprepared",
    label: "ライフイベント未準備率",
    value: 46,
    desc: "親・お金・健康・住まい・キャリア後半戦の準備不足を感じる割合",
    threshold: { warn: 35, danger: 45 },
  },
  {
    key: "support_unused",
    label: "支援未活用率",
    value: 52,
    desc: "相談先や制度があっても使えていない割合",
    threshold: { warn: 40, danger: 50 },
  },
  {
    key: "recovery_delay",
    label: "回復遅延率",
    value: 29,
    desc: "気がかりから通常状態に戻るまで1週間以上かかる割合",
    threshold: { warn: 25, danger: 35 },
  },
];

// ── ④ 支援未活用・未準備マップ (ScatterChart) ────────────────────────────────
// 横軸: 未準備率 (%), 縦軸: パフォーマンス影響度 (%), 大きさ: 該当人数
export const PRIORITY_MAP = [
  { theme: "親・家族",         unpreparedness: 67, performanceImpact: 71, headcount: 38, emoji: "👨‍👩‍👧" },
  { theme: "お金・老後",       unpreparedness: 58, performanceImpact: 54, headcount: 52, emoji: "💰" },
  { theme: "健康",             unpreparedness: 41, performanceImpact: 63, headcount: 31, emoji: "🏥" },
  { theme: "働き方・キャリア", unpreparedness: 35, performanceImpact: 39, headcount: 27, emoji: "💼" },
  { theme: "住まい",           unpreparedness: 28, performanceImpact: 22, headcount: 14, emoji: "🏠" },
];

// ── ⑤ 行動移行・支援接続 ───────────────────────────────────────────────────
export const ACTION_FLOW = [
  { stage: "AI整理後の次の一手決定", value: 74, color: "#0078c6" },
  { stage: "行動移行率",            value: 62, color: "#0c97e8" },
  { stage: "専門家接続率",          value: 28, color: "#36b2f7" },
  { stage: "再相談率",              value: 18, color: "#7ccbfb" },
  { stage: "1週間後改善率",         value: 47, color: "#015fa1" },
];

// ── ⑥ リソース別効果 ─────────────────────────────────────────────────────────
export const RESOURCE_EFFECTIVENESS = [
  { resource: "司法書士紹介", icon: "⚖️", connections: 12, completion: 58, satisfaction: 67, reuse: 18 },
  { resource: "良医紹介",     icon: "🏥", connections: 18, completion: 72, satisfaction: 81, reuse: 24 },
  { resource: "看護相談",     icon: "📞", connections: 24, completion: 65, satisfaction: 74, reuse: 31 },
  { resource: "FP相談",       icon: "💼", connections: 16, completion: 51, satisfaction: 62, reuse: 22 },
  { resource: "公的制度案内", icon: "🏛️", connections: 28, completion: 44, satisfaction: 58, reuse: 12 },
  { resource: "学び直し支援", icon: "📚", connections: 9,  completion: 38, satisfaction: 71, reuse: 14 },
];

// ── ⑦ セグメント分析 ───────────────────────────────────────────────────────
export const SEGMENT_ANALYSIS = {
  age: [
    { segment: "20代", performanceLoss: 32, unprepared: 38, supportUnused: 61, headcount: 18 },
    { segment: "30代", performanceLoss: 41, unprepared: 51, supportUnused: 55, headcount: 27 },
    { segment: "40代", performanceLoss: 45, unprepared: 58, supportUnused: 49, headcount: 31 },
    { segment: "50代", performanceLoss: 38, unprepared: 47, supportUnused: 44, headcount: 16 },
    { segment: "60代+", performanceLoss: 28, unprepared: 35, supportUnused: 39, headcount: 8 },
  ],
  family: [
    { segment: "独身",       performanceLoss: 30, unprepared: 39, supportUnused: 58, headcount: 24 },
    { segment: "DINKs",      performanceLoss: 34, unprepared: 42, supportUnused: 51, headcount: 11 },
    { segment: "子育て中",   performanceLoss: 47, unprepared: 54, supportUnused: 48, headcount: 36 },
    { segment: "親介護期",   performanceLoss: 52, unprepared: 64, supportUnused: 42, headcount: 21 },
    { segment: "シニア世帯", performanceLoss: 31, unprepared: 38, supportUnused: 45, headcount: 8 },
  ],
};

// ── ⑧ ROI / 人的資本 / ESG ──────────────────────────────────────────────────
export const ROI_HC_ESG = {
  roi: [
    { label: "可処分時間 改善実感",    value: 64, unit: "%" },
    { label: "可処分所得 改善実感",    value: 41, unit: "%" },
    { label: "健康関連コスト 予防実感", value: 52, unit: "%" },
    { label: "離職抑制 関連指標",      value: 18, unit: "pt", note: "前年同月比改善" },
  ],
  human_capital: [
    { label: "Life Ability 平均", value: 67.4, unit: "/100" },
    { label: "行動移行率",        value: 62,   unit: "%" },
    { label: "回復速度",          value: 4.2,  unit: "日", note: "気がかり→通常まで" },
    { label: "不安滞留率",        value: 21,   unit: "%" },
  ],
  esg: [
    { label: "家族支援 関連接続数", value: 47, unit: "件" },
    { label: "健康支援 接続数",    value: 71, unit: "件" },
    { label: "将来不安 低減実感",  value: 58, unit: "%" },
    { label: "安心就業条件 改善",  value: 44, unit: "%" },
  ],
};

// ── ⑨ AI推奨アクション ──────────────────────────────────────────────────────
export const AI_RECOMMENDATIONS = [
  {
    priority: "high",
    theme: "親・家族",
    title: "司法書士導線の強化を推奨",
    rationale: "親・家族テーマの未準備率が67%と全テーマ中最高。パフォーマンス影響度も71%と高く、優先支援対象です。",
    action: "司法書士紹介リソースをAI整理結果画面に常時表示し、初回相談無料を訴求してください。",
    expected_impact: "未準備率を15pt低下、行動移行率を8pt向上見込み",
  },
  {
    priority: "high",
    theme: "支援未活用",
    title: "制度案内の表示位置改善を推奨",
    rationale: "支援未活用率が52%と高水準。制度を知っていても活用に至っていない社員が多数います。",
    action: "ホーム画面と1分チェック結果画面に「使える制度」のサマリーカードを追加してください。",
    expected_impact: "支援接続率を10pt向上見込み",
  },
  {
    priority: "medium",
    theme: "健康",
    title: "良医紹介導線の強化を推奨",
    rationale: "健康テーマで回復遅延率が29%と高め。早期受診で長期化を防げる可能性があります。",
    action: "健康関連の相談時、良医紹介リソースを優先表示してください。",
    expected_impact: "回復遅延率を6pt低下見込み",
  },
];

// ── ① ヘッダーフィルタ選択肢 ─────────────────────────────────────────────────
export const FILTER_OPTIONS = {
  period:    [
    { value: "monthly", label: "月次" },
    { value: "weekly",  label: "週次" },
  ],
  department: [
    { value: "all",         label: "全部署" },
    { value: "engineering", label: "エンジニアリング" },
    { value: "sales",       label: "営業" },
    { value: "corporate",   label: "コーポレート" },
    { value: "operations",  label: "オペレーション" },
  ],
  age: [
    { value: "all",   label: "全年代" },
    { value: "20s",   label: "20代" },
    { value: "30s",   label: "30代" },
    { value: "40s",   label: "40代" },
    { value: "50s",   label: "50代" },
    { value: "60s+",  label: "60代+" },
  ],
  family: [
    { value: "all",       label: "全家族構成" },
    { value: "single",    label: "独身" },
    { value: "dinks",     label: "DINKs" },
    { value: "raising",   label: "子育て中" },
    { value: "caregiver", label: "親介護期" },
    { value: "senior",    label: "シニア世帯" },
  ],
};

export const TOTAL_TARGET_POPULATION = 248; // 対象母数（社員数）
