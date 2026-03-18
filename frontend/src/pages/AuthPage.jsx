import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";

export default function AuthPage() {
  const { login, register } = useUser();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email);
    } catch (err) {
      if (err.message === "User not found") {
        setMode("register");
        setError("メールアドレスが見つかりません。新規登録してください。");
      } else {
        setError(err.message || "ログインに失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        name,
        email,
        age_group: ageGroup || null,
        company,
        department: department || null,
        position: position || null,
      });
    } catch (err) {
      setError(err.message || "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-bold">未</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">未来アシストAI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Life Ability 実践プラットフォーム
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {mode === "login" ? (
            <form onSubmit={handleLogin}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ログイン
              </h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="your@email.com"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 mb-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? "確認中..." : "ログイン"}
              </button>
              <p className="text-xs text-gray-400 text-center mt-4">
                アカウントをお持ちでない方は
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); }}
                  className="text-primary-600 hover:underline ml-1"
                >
                  新規登録
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                新規登録
              </h2>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お名前
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="山田 太郎"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="your@email.com"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  年齢層
                </label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="">選択してください（任意）</option>
                  <option value="10代">10代</option>
                  <option value="20代">20代</option>
                  <option value="30代">30代</option>
                  <option value="40代">40代</option>
                  <option value="50代">50代</option>
                  <option value="60代">60代</option>
                  <option value="70代以上">70代以上</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会社名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="株式会社○○"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  部署名
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="人事部（任意）"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役職
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="マネージャー（任意）"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 mb-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? "登録中..." : "登録する"}
              </button>
              <p className="text-xs text-gray-400 text-center mt-4">
                すでにアカウントをお持ちの方は
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); }}
                  className="text-primary-600 hover:underline ml-1"
                >
                  ログイン
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
