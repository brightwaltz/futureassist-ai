import React from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useUser } from "./contexts/UserContext";

// ── Pages ──────────────────────────────────────────────────────────────────
import ChatPage from "./pages/ChatPage";
import SurveyPage from "./pages/SurveyPage";
import MyDashboardPage from "./pages/MyDashboardPage";
import ConversationHistoryPage from "./pages/ConversationHistoryPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import TriagePage from "./pages/TriagePage";
import CheckPage from "./pages/CheckPage";
import CheckResultPage from "./pages/CheckResultPage";
import AiResultPage from "./pages/AiResultPage";
import CoachingPage from "./pages/CoachingPage";
import ResourcePage from "./pages/ResourcePage";
import SessionEndPage from "./pages/SessionEndPage";
import FollowupPage from "./pages/FollowupPage";

// ── Admin ──────────────────────────────────────────────────────────────────
import AdminLogin from "./admin/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminConversations from "./admin/AdminConversations";
import AdminConversationDetail from "./admin/AdminConversationDetail";
import AdminSurveys from "./admin/AdminSurveys";
import AdminAnalysis from "./admin/AdminAnalysis";
import TenantLayout from "./TenantLayout";

// ── Nav items definition ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: "/check",     label: "はじめの1分チェック", icon: "⏱️" },
  { to: "/dashboard", label: "わたしのダッシュボード", icon: "📊" },
  { to: "/history",   label: "会話履歴",            icon: "💬" },
];

function NavLink({ to, label, icon }) {
  const location = useLocation();
  const active = location.pathname === to ||
    (to === "/" && location.pathname === "/");
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 text-sm font-medium transition px-1 py-0.5 rounded
                  ${active
                    ? "text-primary-600"
                    : "text-white/80 hover:text-white"
                  }`}
    >
      <span className="hidden sm:inline text-base leading-none">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function MainLayout() {
  const { user, logout } = useUser();

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── ヘッダー (Sky-Blue) ────────────────────────────────────────── */}
      <header className="bg-primary-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* ロゴ + サブテキスト */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center
                              group-hover:bg-white/30 transition">
                <span className="text-white text-lg font-bold leading-none">🐥</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-white font-bold text-base leading-tight">
                  未来アシストAI
                </p>
                <p className="text-white/60 text-xs leading-tight">
                  あなたに合った次の一手を一緒に整理するサポート
                </p>
              </div>
            </Link>

            {/* ナビゲーション */}
            <nav className="flex items-center gap-4 sm:gap-6">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} {...item} />
              ))}
            </nav>

            {/* ユーザー */}
            <div className="flex items-center gap-2 pl-3 border-l border-white/20">
              <Link
                to="/profile"
                className="text-sm text-white/80 hover:text-white transition truncate max-w-[6rem]"
                title="プロフィール"
              >
                {user.name}
              </Link>
              <button
                onClick={logout}
                className="text-xs text-white/50 hover:text-white transition"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── メインコンテンツ ──────────────────────────────────────────── */}
      <main>
        <Routes>
          {/* ホーム（Step B/E） */}
          <Route path="/"               element={<ChatPage />} />

          {/* 1分チェック（Step C）*/}
          <Route path="/check"          element={<CheckPage />} />
          <Route path="/check/result"   element={<CheckResultPage />} />

          {/* 状態整理3問（Step F）*/}
          <Route path="/triage"         element={<TriagePage />} />

          {/* AI整理結果（Step G）*/}
          <Route path="/ai-result"      element={<AiResultPage />} />

          {/* 深掘りコーチング（Step H）*/}
          <Route path="/coaching"       element={<CoachingPage />} />

          {/* リソース接続（Step I）*/}
          <Route path="/resources"      element={<ResourcePage />} />

          {/* セッション終了（Step J）*/}
          <Route path="/session-end"    element={<SessionEndPage />} />

          {/* 1週間後フォローアップ（Step K）*/}
          <Route path="/followup"       element={<FollowupPage />} />

          {/* 既存ルート */}
          <Route path="/survey"         element={<SurveyPage />} />
          <Route path="/dashboard"      element={<MyDashboardPage />} />
          <Route path="/history"        element={<ConversationHistoryPage />} />
          <Route path="/profile"        element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin"                          element={<AdminLogin />} />
      <Route path="/admin/:tenantSlug"              element={<AdminLayout />}>
        <Route path="dashboard"                     element={<AdminDashboard />} />
        <Route path="conversations"                 element={<AdminConversations />} />
        <Route path="conversations/:conversationId" element={<AdminConversationDetail />} />
        <Route path="surveys"                       element={<AdminSurveys />} />
        <Route path="analysis"                      element={<AdminAnalysis />} />
      </Route>
      <Route path="/t/:tenantSlug/*"                element={<TenantLayout />} />
      <Route path="/*"                              element={<MainLayout />} />
    </Routes>
  );
}
