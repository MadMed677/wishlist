import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { watchUser } from './firebase';

interface AuthState {
  /** undefined — ещё грузится, null — не вошёл */
  user: User | null | undefined;
  /** меняется при любом обновлении пользователя (в т.ч. привязке Google к анониму) */
  version: number;
}

const AuthContext = createContext<AuthState>({ user: undefined, version: 0 });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: undefined, version: 0 });
  useEffect(() => watchUser((user) => setState((s) => ({ user, version: s.version + 1 }))), []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
