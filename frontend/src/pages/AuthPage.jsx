import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { api } from "../utils/api";

/**
 * AuthPage — login / register / MFA challenge.
 *
 * Modes:
 *   "login"     — email + password
 *   "register"  — name/email/password/company/...
 *   "mfa"       — 6-digit TOTP code (only visible after login returns mfa_required)
 *   "reset_req" — request password reset email
 */
export default function AuthPage() {
  const { login, mfaChallenge, register } = useUser();
  const [mode, setMode] = useState("login");

  // Common fields
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");
  const [loading, setLoading]   = useState(false);

  // Register-only fields
  const [name, setName]             = useState("");
  const [ageGroup, setAgeGroup]     = useState("");
  const [company, setCompany]       = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition]     = useState("");

  // MFA-only
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode,  setMfaCode]  = useState("");

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const r = await login(email, password);
      if (r?.mfa_required) {
        setMfaToken(r.mfa_challenge_token);
        setMode("mfa");
      }
      // else: useUser already set user; App.jsx will re-render to MainLayout
    } catch (err) {
      setError(err.message || "ログインに失敗しました");
    } finally { setLoading(false); }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await mfaChallenge(mfaToken, mfaCode);
    } catch (err) {
      setError(err.message || "MFA認証に失敗しました");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const r = await register({
        name, email, password,
        age_group: ageGroup || null,
        company,
        department: department || null,
        position: position || null,
      });
      setInfo(r.message || "登録が完了しました。確認メールをご確認ください。");
      setMode("login");
      setPassword("");
    } catch (err) {
      setError(err.message || "登録に失敗しました");
    } finally { setLoading(false); }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const r = await api.authPasswordResetRequest(email);
      setInfo(r.message || "メールを送信しました。");
    } catch (err) {
      setError(err.message || "送信に失敗しました");
    } finally { setLoading(false); }
  };

  const goGoogle = () => {
    window.location.href = "/api/auth/google";
  };

  // ── UI ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl">🐥</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">未来アシストAI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Life Ability 実践プラットフォーム
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          {info  && <Banner kind="info"  text={info} />}
          {error && <Banner kind="error" text={error} />}

          {mode === "login" && (
            <form onSubmit={handleLogin}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ログイン</h2>
              <Field label="メールアドレス" type="email" value={email} onChange={setEmail} required />
              <Field label="パスワード" type="password" value={password} onChange={setPassword} required minLength={8} />
              <button disabled={loading}
                className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                {loading ? "確認中…" : "ログイン"}
              </button>

              <button type="button" onClick={goGoogle}
                className="w-full mt-3 flex items-center justify-center gap-2 border border-gray-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                <GoogleIcon /> Googleで続ける
              </button>

              <div className="flex justify-between text-xs text-gray-400 mt-4">
                <button type="button" onClick={() => { setMode("register"); setError(""); setInfo(""); }}
                  className="text-primary-600 hover:underline">新規登録</button>
                <button type="button" onClick={() => { setMode("reset_req"); setError(""); setInfo(""); }}
                  className="text-primary-600 hover:underline">パスワードを忘れた</button>
              </div>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">新規登録</h2>
              <Field label="お名前" value={name} onChange={setName} required />
              <Field label="メールアドレス" type="email" value={email} onChange={setEmail} required />
              <Field label="パスワード（8文字以上）" type="password" value={password} onChange={setPassword} required minLength={8} />
              <SelectField label="年齢層（任意）" value={ageGroup} onChange={setAgeGroup}
                options={["", "10代","20代","30代","40代","50代","60代","70代以上"]} />
              <Field label="会社名" value={company} onChange={setCompany} required />
              <Field label="部署名（任意）" value={department} onChange={setDepartment} />
              <Field label="役職（任意）" value={position} onChange={setPosition} />

              <button disabled={loading}
                className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                {loading ? "登録中…" : "登録する"}
              </button>
              <p className="text-xs text-gray-400 text-center mt-4">
                既にアカウントをお持ちの方は
                <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}
                  className="text-primary-600 hover:underline ml-1">ログイン</button>
              </p>
            </form>
          )}

          {mode === "mfa" && (
            <form onSubmit={handleMfa}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">2段階認証</h2>
              <p className="text-sm text-gray-600 mb-3">
                認証アプリに表示されている <b>6桁のコード</b>を入力してください。
              </p>
              <input type="text" inputMode="numeric" pattern="[0-9]*"
                maxLength={8} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                className="w-full text-center tracking-widest text-2xl font-bold border border-gray-300 rounded-xl px-3 py-3 mb-4 focus:ring-2 focus:ring-primary-500 outline-none"
                required />
              <button disabled={loading}
                className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                {loading ? "確認中…" : "認証する"}
              </button>
              <p className="text-xs text-gray-400 text-center mt-4">
                <button type="button" onClick={() => { setMode("login"); setMfaCode(""); }}
                  className="hover:underline">キャンセル</button>
              </p>
            </form>
          )}

          {mode === "reset_req" && (
            <form onSubmit={handleResetRequest}>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">パスワード再設定</h2>
              <p className="text-xs text-gray-500 mb-4">
                登録済みメールアドレスに再設定リンクを送信します。
              </p>
              <Field label="メールアドレス" type="email" value={email} onChange={setEmail} required />
              <button disabled={loading}
                className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                {loading ? "送信中…" : "再設定リンクを送る"}
              </button>
              <p className="text-xs text-gray-400 text-center mt-4">
                <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}
                  className="hover:underline">ログインに戻る</button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── small helpers ───────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", required, minLength }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
        {options.map((o) => <option key={o} value={o}>{o || "選択してください"}</option>)}
      </select>
    </div>
  );
}

function Banner({ kind, text }) {
  const cls = kind === "error"
    ? "bg-red-50 border-red-200 text-red-700"
    : "bg-blue-50 border-blue-200 text-blue-700";
  return (
    <div className={`mb-4 px-3 py-2 border rounded-xl text-sm ${cls}`}>{text}</div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.63z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.46-.81 5.95-2.18l-2.9-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.95v2.33A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.17.28-1.71V4.96H.95A8.998 8.998 0 0 0 0 9c0 1.45.35 2.83.95 4.04l3.02-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A8.998 8.998 0 0 0 9 0 8.997 8.997 0 0 0 .95 4.96l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
