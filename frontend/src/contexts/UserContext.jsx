import React, { createContext, useContext, useState } from "react";
import { api } from "../utils/api";

const UserContext = createContext(null);

const STORAGE_KEY = "futureassist_user";

function safeRead() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function safeWrite(u) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    /* iframe sandbox / private mode — fall back to in-memory state */
  }
}

function safeRemove() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see safeWrite */
  }
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(safeRead);

  const login = async (email) => {
    const u = await api.loginUser({ email });
    setUser(u);
    safeWrite(u);
    return u;
  };

  const register = async (data) => {
    const u = await api.createUser(data);
    setUser(u);
    safeWrite(u);
    return u;
  };

  const updateProfile = async (data) => {
    const u = await api.updateUser(user.id, data);
    setUser(u);
    safeWrite(u);
    return u;
  };

  const logout = () => {
    setUser(null);
    safeRemove();
  };

  return (
    <UserContext.Provider value={{ user, login, register, updateProfile, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
