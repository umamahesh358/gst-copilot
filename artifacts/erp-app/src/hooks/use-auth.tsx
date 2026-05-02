import { useState, useEffect, createContext, useContext } from "react";
import { useGetMe, UserWithPlan } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: UserWithPlan | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
    },
  });

  const [, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("bizos_token");
    setLocation("/login");
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
