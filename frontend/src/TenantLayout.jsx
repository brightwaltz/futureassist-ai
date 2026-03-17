import React from "react";
import { Routes, Route, Link, useParams } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import SurveyPage from "./pages/SurveyPage";
import MyDashboardPage from "./pages/MyDashboardPage";

export default function TenantLayout() {
  const { tenantSlug } = useParams();

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
                {tenantSlug}
              </span>
            </div>
            <nav className="flex gap-4">
              <Link
                to={`/t/${tenantSlug}`}
                className="text-sm text-gray-600 hover:text-primary-600 transition"
              >
                相談する
              </Link>
              <Link
                to={`/t/${tenantSlug}/survey`}
                className="text-sm text-gray-600 hover:text-primary-600 transition"
              >
                アンケート
              </Link>
              <Link
                to={`/t/${tenantSlug}/dashboard`}
                className="text-sm text-gray-600 hover:text-primary-600 transition"
              >
                ダッシュボード
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/survey" element={<SurveyPage />} />
          <Route path="/dashboard" element={<MyDashboardPage />} />
        </Routes>
      </main>
    </div>
  );
}
