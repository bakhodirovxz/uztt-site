import { createContext, useContext, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("uztt_user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email, password) {
    const data = await api.post("/auth/login", { email, password });
    localStorage.setItem("uztt_token", data.token);
    localStorage.setItem("uztt_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem("uztt_token");
    localStorage.removeItem("uztt_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
