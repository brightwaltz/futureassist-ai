import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import ChatPage from "./pages/ChatPage";
import SurveyPage from "./pages/SurveyPage";
import MyDashboardPage from "./pages/MyDashboardPage";
import ConversationHistoryPage from "./pages/ConversationHistoryPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import AdminLogin from "./admin/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminConversations from "./admin/AdminConversations";
import AdminConversationDetail from "./admin/AdminConversationDetail";
import AdminSurveys from "./admin/AdminSurveys";
import AdminAnalysis from "./admin/AdminAnalysis";
import TenantLayout from "./TenantLayout";

function MainLayout() {
  const { user, logout } = useUser();

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">未</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">
                未来アシストAI
              </h1>
              <span className="text-xs text-gray-400 hidden sm:inline">
                Life Ability 実践プラットフォーム
              </span>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex gap-4">
                <Link
                  to="/"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  相談する
                </Link>
                <Link
                  to="/survey"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  アンケート
                </Link>
                <Link
                  to="/dashboard"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  ダッシュボード
                </Link>
                <Link
                  to="/history"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  会話履歴
                </Link>
              </nav>
              <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                <Link
                  to="/profile"
                  className="text-sm text-gray-700 hover:text-primary-600 transition"
                  title="プロフィール編集"
                >
                  {user.name}
                </Link>
                <button
                  onClick={logout}
                  className="text-xs text-gray-400 hover:text-red-500 transition"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/survey" element={<SurveyPage />} />
          <Route path="/dashboard" element={<MyDashboardPage />} />
          <Route path="/history" element={<ConversationHistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/:tenantSlug" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="conversations" element={<AdminConversations />} />
        <Route path="conversations/:conversationId" element={<AdminConversationDetail />} />
        <Route path="surveys" element={<AdminSurveys />} />
        <Route path="analysis" element={<AdminAnalysis />} />
      </Route>
      <Route path="/t/:tenantSlug/*" element={<TenantLayout />} />
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  );
}
