import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { useUser } from "../contexts/UserContext";

/**
 * MFA Setup wizard:
 *  step "intro"  → click "Start" → /auth/mfa/setup → render QR
 *  step "verify" → user types 6-digit code → /auth/mfa/verify → success
 */
export default function MfaSetupPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState("intro");
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info,  setInfo]  = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  const startSetup = async () => {
    setError(""); setLoading(true);
    try {
      const r = await api.authMfaSetup();
      setSecret(r.secret);
      setQr(r.qr_code_data_url);
      setStep("verify");
    } catch (e) {
      setError(e.message || "セットアップに失敗しました");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await api.authMfaVerify(code);
      setInfo(r.message || "MFAを有効化しました");
      setTimeout(() => navigate("/"), 1500);
    } catch (e) {
      setError(e.message || "コードが無効です");
    } finally { setLoading(false); }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await api.authMfaDisable(code);
      setInfo(r.message || "MFAを無効化しました");
      setTimeout(() => navigate("/"), 1500);
    } catch (e) {
      setError(e.message || "コードが無効です");
    } finally { setLoading(false); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 max-w-md w-full">
        <h1 className="text-lg font-bold text-gray-900 mb-1">2段階認証 (MFA)</h1>
        <p className="text-xs text-gray-500 mb-4">
          スマートフォンの認証アプリで6桁コードを入力してログインを保護します。
        </p>

        {info  && <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm">{info}</div>}
        {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        {/* ─── Already enabled: show disable form ─── */}
        {user.mfa_enabled && step === "intro" && (
          <form onSubmit={handleDisable}>
            <p className="text-sm text-gray-700 mb-3">
              現在 MFA は <span className="text-green-700 font-semibold">有効</span> です。
            </p>
            <p className="text-xs text-gray-500 mb-3">
              無効化するには、現在のコードを入力してください。
            </p>
            <input type="text" inputMode="numeric" maxLength={8}
              value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="123456" required
              className="w-full text-center tracking-widest text-2xl font-bold border border-gray-300 rounded-xl px-3 py-3 mb-4 outline-none focus:ring-2 focus:ring-primary-500" />
            <button disabled={loading}
              className="w-full bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50">
              {loading ? "処理中…" : "MFAを無効化する"}
            </button>
            <Link to="/" className="block text-center text-xs text-gray-400 mt-3 hover:underline">
              キャンセル
            </Link>
          </form>
        )}

        {/* ─── Not yet enabled: setup wizard ─── */}
        {!user.mfa_enabled && step === "intro" && (
          <>
            <p className="text-sm text-gray-700 mb-4">
              Google Authenticator / Authy などの TOTP 対応認証アプリをご用意ください。
            </p>
            <button onClick={startSetup} disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {loading ? "準備中…" : "セットアップを開始"}
            </button>
            <Link to="/" className="block text-center text-xs text-gray-400 mt-3 hover:underline">
              あとで設定する
            </Link>
          </>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerify}>
            <p className="text-sm text-gray-700 mb-3">
              認証アプリで以下のQRコードをスキャンしてください:
            </p>
            <div className="flex justify-center mb-3">
              {qr && <img src={qr} alt="MFA QR" className="border border-gray-200 rounded-xl" />}
            </div>
            <details className="text-xs text-gray-500 mb-3">
              <summary className="cursor-pointer">スキャンできない場合は手動で…</summary>
              <p className="mt-2">アプリに以下を手入力してください:</p>
              <code className="block break-all bg-gray-50 px-2 py-1 rounded text-[10px] mt-1">{secret}</code>
            </details>
            <p className="text-sm text-gray-700 mb-2">
              アプリに表示されている <b>6桁のコード</b> を入力:
            </p>
            <input type="text" inputMode="numeric" maxLength={8}
              value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="123456" required
              className="w-full text-center tracking-widest text-2xl font-bold border border-gray-300 rounded-xl px-3 py-3 mb-4 outline-none focus:ring-2 focus:ring-primary-500" />
            <button disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {loading ? "確認中…" : "有効化する"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
