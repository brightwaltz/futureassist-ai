import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../utils/api";

export default function AuthPasswordResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [info,  setInfo]  = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (pw1.length < 8) { setError("パスワードは8文字以上にしてください"); return; }
    if (pw1 !== pw2)    { setError("パスワードが一致しません"); return; }
    if (!token)         { setError("トークンが見つかりません"); return; }
    setLoading(true);
    try {
      const r = await api.authPasswordResetConfirm(token, pw1);
      setInfo(r.message || "再設定しました");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      setError(err.message || "再設定に失敗しました");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 max-w-md w-full">
        <h1 className="text-lg font-bold text-gray-900 mb-1">パスワード再設定</h1>
        <p className="text-xs text-gray-500 mb-4">新しいパスワードを設定してください。</p>

        {info && <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm">{info}</div>}
        {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
        <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)}
          minLength={8} required
          className="w-full mb-3 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />

        <label className="block text-sm font-medium text-gray-700 mb-1">確認のためもう一度</label>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
          minLength={8} required
          className="w-full mb-4 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />

        <button disabled={loading}
          className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {loading ? "更新中…" : "パスワードを設定"}
        </button>
      </form>
    </div>
  );
}
