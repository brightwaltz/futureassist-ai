import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

/**
 * Final step of /auth/google flow.
 * Reads access_token + refresh_token from the URL fragment, hands them to
 * UserContext, then navigates home.
 */
export default function AuthGoogleFinishPage() {
  const { completeOAuth } = useUser();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const frag = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access  = frag.get("access_token");
    const refresh = frag.get("refresh_token");
    if (!access || !refresh) {
      setError("認証情報が見つかりません");
      return;
    }
    // Clear the fragment from the URL bar (security/UX)
    window.history.replaceState({}, document.title, window.location.pathname);

    completeOAuth(access, refresh)
      .then(() => navigate("/"))
      .catch((e) => setError(e.message || "ログインに失敗しました"));
  }, [completeOAuth, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm text-center max-w-sm w-full">
        {error ? (
          <>
            <div className="text-3xl mb-2">⚠️</div>
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => navigate("/")}
              className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm">
              ホームへ
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-500">ログイン中…</p>
          </>
        )}
      </div>
    </div>
  );
}
