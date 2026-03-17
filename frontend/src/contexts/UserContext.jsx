import React, { createContext, useContext, useState } from "react";
import { api } from "../utils/api";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("futureassist_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = async (email) => {
    const u = await api.loginUser({ email });
    setUser(u);
    localStorage.setItem("futureassist_user", JSON.stringify(u));
    return u;
  };

  const register = async (data) => {
    const u = await api.createUser(data);
    setUser(u);
    localStorage.setItem("futureassist_user", JSON.stringify(u));
    return u;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("futureassist_user");
  };

  return (
    <UserContext.Provider value={{ user, login, register, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
