import React, { createContext, useContext, useState, useEffect } from "react";
import { api, tokens } from "../utils/api";

const UserContext = createContext(null);

const USER_KEY = "futureassist_user";

function safeRead() {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function safeWrite(u) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {}
}

function safeRemove() {
  try { localStorage.removeItem(USER_KEY); } catch {}
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(safeRead);

  // On mount, if we have a token but no user, fetch /auth/me to rehydrate
  useEffect(() => {
    if (!user && tokens.getAccess()) {
      api.authMe()
        .then((u) => { setUser(u); safeWrite(u); })
        .catch(() => { tokens.clear(); safeRemove(); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── New JWT-based login ──────────────────────────────────────────────
  // Returns one of:
  //   { mfa_required: true, mfa_challenge_token } — caller must call mfaChallenge
  //   { user, access_token, refresh_token, ... } — login complete
  const login = async (email, password) => {
    const resp = await api.authLogin({ email, password });
    if (resp.mfa_required) {
      return { mfa_required: true, mfa_challenge_token: resp.mfa_challenge_token };
    }
    // Successful immediate login
    tokens.set(resp.access_token, resp.refresh_token);
    setUser(resp.user);
    safeWrite(resp.user);
    return { user: resp.user };
  };

  const mfaChallenge = async (mfa_challenge_token, code) => {
    const resp = await api.authMfaChallenge(mfa_challenge_token, code);
    tokens.set(resp.access_token, resp.refresh_token);
    setUser(resp.user);
    safeWrite(resp.user);
    return resp.user;
  };

  // ── Registration ─────────────────────────────────────────────────────
  // /auth/register returns AuthSimpleMessage. The user does NOT log in here;
  // they need to verify their email first, then can /auth/login.
  const register = async (data) => {
    const r = await api.authRegister(data);
    return r;
  };

  const updateProfile = async (data) => {
    if (!user) throw new Error("not logged in");
    const u = await api.updateUser(user.id, data);
    setUser(u);
    safeWrite(u);
    return u;
  };

  const logout = async () => {
    try { await api.authLogout(); } catch {}
    setUser(null);
    safeRemove();
  };

  // OAuth-completed handler: called by GoogleCallbackPage with the tokens
  // that came back in the URL fragment.
  const completeOAuth = async (access_token, refresh_token) => {
    tokens.set(access_token, refresh_token);
    const u = await api.authMe();
    setUser(u);
    safeWrite(u);
    return u;
  };

  return (
    <UserContext.Provider
      value={{ user, login, mfaChallenge, register, updateProfile, logout, completeOAuth }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
