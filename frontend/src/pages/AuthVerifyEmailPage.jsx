import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../utils/api";

export default function AuthVerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | ok | err
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("err"); setMessage("トークンが見つかりません"); return; }
    api.authVerifyEmail(token)
      .then((r) => { setStatus("ok"); setMessage(r.message || "確認しました"); })
      .catch((e) => { setStatus("err"); setMessage(e.message || "確認に失敗しました"); });
  }, [params]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-500">確認中...</p>
          </>
        )}
        {status === "ok" && (
          <>
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-bold mb-2">{message}</h2>
            <button onClick={() => navigate("/")}
              className="mt-3 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
              ログインへ
            </button>
          </>
        )}
        {status === "err" && (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold mb-2 text-red-700">{message}</h2>
            <button onClick={() => navigate("/")}
              className="mt-3 px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm">
              ホームへ
            </button>
          </>
        )}
      </div>
    </div>
  );
}
