import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthCtx {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login: () => setIsAuthenticated(true),
        logout: () => setIsAuthenticated(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
